import * as React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import {
  FILE_TRANSFER_TOPIC,
  FileMsgType,
  MAX_FILE_BYTES,
  generateTransferId,
  encodeWireMessage,
  decodeWireMessage,
  sha256Blob,
  splitFileIntoChunks,
  assembleChunks,
  formatFileSize,
  type FileMeta,
  type TransferProgress,
} from '../lib/file-transfer';

/**
 * Manages file transfer over LiveKit data channels.
 *
 * - sendFile(file) — initiates a chunked transfer to all participants
 * - onFileReceived — callback when a complete file arrives
 * - transfers — live map of all active/completed transfers (for progress UI)
 */
export function useFileTransfer() {
  const room = useRoomContext();

  // Active transfers keyed by fileId
  const [transfers, setTransfers] = React.useState<Map<string, TransferProgress>>(new Map());

  // Incoming assembly buffers: fileId -> { meta, chunks }
  const incomingRef = React.useRef<
    Map<string, { meta: FileMeta; chunks: Map<number, string> }>
  >(new Map());

  // Completed file callbacks
  const onFileReceivedRef = React.useRef<
    ((file: { name: string; blob: Blob; mimeType: string; hash: string }) => void) | null
  >(null);

  /** Register a callback for when a file transfer completes */
  const onFileReceived = React.useCallback(
    (cb: (file: { name: string; blob: Blob; mimeType: string; hash: string }) => void) => {
      onFileReceivedRef.current = cb;
    },
    [],
  );

  // ── Send ──────────────────────────────────────────────────────────────────

  const sendFile = React.useCallback(
    async (file: File): Promise<string> => {
      if (!room) throw new Error('Room not connected');
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`File too large. Maximum ${formatFileSize(MAX_FILE_BYTES)}.`);
      }

      const fileId = generateTransferId();
      const totalChunks = Math.ceil(file.size / 55_000);

      // 1. Send metadata
      const meta: FileMeta = {
        t: FileMsgType.META,
        id: fileId,
        n: file.name,
        s: file.size,
        m: file.type || 'application/octet-stream',
        c: totalChunks,
      };
      room.localParticipant.publishData(encodeWireMessage(meta), {
        reliable: true,
        topic: FILE_TRANSFER_TOPIC,
      });

      // Track progress locally
      setTransfers((prev) => {
        const next = new Map(prev);
        next.set(fileId, {
          fileId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          chunksReceived: 0,
          totalChunks,
          progress: 0,
          status: 'sending',
        });
        return next;
      });

      // 2. Send chunks (async, non-blocking)
      (async () => {
        let chunkIndex = 0;
        for await (const chunk of splitFileIntoChunks(file, fileId)) {
          room.localParticipant.publishData(encodeWireMessage(chunk), {
            reliable: true,
            topic: FILE_TRANSFER_TOPIC,
          });
          chunkIndex++;

          setTransfers((prev) => {
            const existing = prev.get(fileId);
            if (!existing) return prev;
            const next = new Map(prev);
            next.set(fileId, {
              ...existing,
              chunksReceived: chunkIndex,
              progress: chunkIndex / totalChunks,
            });
            return next;
          });

          // Yield to event loop every 5 chunks to avoid blocking
          if (chunkIndex % 5 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        // 3. Compute hash and send done
        const hash = await sha256Blob(file);
        room.localParticipant.publishData(
          encodeWireMessage({ t: FileMsgType.DONE, id: fileId, h: hash }),
          { reliable: true, topic: FILE_TRANSFER_TOPIC },
        );

        // Mark complete
        setTransfers((prev) => {
          const existing = prev.get(fileId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(fileId, { ...existing, status: 'complete', progress: 1, hash });
          return next;
        });
      })().catch((err) => {
        console.error('[FileTransfer] Send failed:', err);
        setTransfers((prev) => {
          const existing = prev.get(fileId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(fileId, { ...existing, status: 'cancelled' });
          return next;
        });
      });

      return fileId;
    },
    [room],
  );

  /** Cancel an active transfer */
  const cancelTransfer = React.useCallback(
    (fileId: string) => {
      if (!room) return;
      room.localParticipant.publishData(
        encodeWireMessage({ t: FileMsgType.CANCEL, id: fileId }),
        { reliable: true, topic: FILE_TRANSFER_TOPIC },
      );
      setTransfers((prev) => {
        const existing = prev.get(fileId);
        if (!existing) return prev;
        const next = new Map(prev);
        next.set(fileId, { ...existing, status: 'cancelled' });
        return next;
      });
    },
    [room],
  );

  // ── Receive ───────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array, _participant: any, _kind: any, topic?: string) => {
      // Only handle file transfer messages
      if (topic !== FILE_TRANSFER_TOPIC) return;

      const msg = decodeWireMessage(payload);
      if (!msg) return;

      switch (msg.t) {
        case FileMsgType.META: {
          // New incoming transfer
          incomingRef.current.set(msg.id, {
            meta: msg,
            chunks: new Map(),
          });
          setTransfers((prev) => {
            const next = new Map(prev);
            next.set(msg.id, {
              fileId: msg.id,
              fileName: msg.n,
              fileSize: msg.s,
              mimeType: msg.m,
              chunksReceived: 0,
              totalChunks: msg.c,
              progress: 0,
              status: 'receiving',
            });
            return next;
          });
          break;
        }

        case FileMsgType.CHUNK: {
          const incoming = incomingRef.current.get(msg.id);
          if (!incoming) return;
          incoming.chunks.set(msg.i, msg.d);

          const received = incoming.chunks.size;
          const total = incoming.meta.c;

          setTransfers((prev) => {
            const existing = prev.get(msg.id);
            if (!existing) return prev;
            const next = new Map(prev);
            next.set(msg.id, {
              ...existing,
              chunksReceived: received,
              progress: received / total,
            });
            return next;
          });

          // All chunks received — assemble
          if (received === total) {
            try {
              const blob = assembleChunks(incoming.chunks, incoming.meta.m);
              sha256Blob(blob).then((hash) => {
                setTransfers((prev) => {
                  const existing = prev.get(msg.id);
                  if (!existing) return prev;
                  const next = new Map(prev);
                  next.set(msg.id, {
                    ...existing,
                    status: 'complete',
                    progress: 1,
                    blob,
                    hash,
                  });
                  return next;
                });
                // Fire callback
                onFileReceivedRef.current?.({
                  name: incoming.meta.n,
                  blob,
                  mimeType: incoming.meta.m,
                  hash,
                });
              });
            } catch (err) {
              console.error('[FileTransfer] Assembly failed:', err);
            }
          }
          break;
        }

        case FileMsgType.DONE: {
          // Remote sender signaled completion — verify we have all chunks
          const incoming = incomingRef.current.get(msg.id);
          if (!incoming) return;
          if (incoming.chunks.size === incoming.meta.c) {
            try {
              const blob = assembleChunks(incoming.chunks, incoming.meta.m);
              sha256Blob(blob).then((hash) => {
                setTransfers((prev) => {
                  const existing = prev.get(msg.id);
                  if (!existing) return prev;
                  const next = new Map(prev);
                  next.set(msg.id, {
                    ...existing,
                    status: 'complete',
                    progress: 1,
                    blob,
                    hash,
                  });
                  return next;
                });
                onFileReceivedRef.current?.({
                  name: incoming.meta.n,
                  blob,
                  mimeType: incoming.meta.m,
                  hash,
                });
              });
            } catch (err) {
              console.error('[FileTransfer] Assembly failed:', err);
            }
          }
          break;
        }

        case FileMsgType.CANCEL: {
          incomingRef.current.delete(msg.id);
          setTransfers((prev) => {
            const existing = prev.get(msg.id);
            if (!existing) return prev;
            const next = new Map(prev);
            next.set(msg.id, { ...existing, status: 'cancelled' });
            return next;
          });
          break;
        }
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  /** Remove a completed/cancelled transfer from the list */
  const removeTransfer = React.useCallback((fileId: string) => {
    setTransfers((prev) => {
      const next = new Map(prev);
      next.delete(fileId);
      return next;
    });
    incomingRef.current.delete(fileId);
  }, []);

  /** Get transfer by id */
  const getTransfer = React.useCallback(
    (fileId: string) => transfers.get(fileId),
    [transfers],
  );

  return {
    transfers,
    sendFile,
    cancelTransfer,
    removeTransfer,
    getTransfer,
    onFileReceived,
  };
}

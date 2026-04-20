import * as React from 'react';
import { useChat, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { ACCEPT_IMAGES, MAX_TEXT_LEN } from '../lib/chat-constants';
import { fileToDataUrl } from '../components/livekit/chat-with-attachments/helpers';
import {
  MAX_FILE_BYTES,
  ACCEPT_ALL_FILES,
  formatFileSize,
  FILE_TRANSFER_TOPIC,
  CHUNK_SIZE,
  FileMsgType,
  TRANSFER_TTL_MS,
  generateTransferId,
  encodeWireMessage,
  decodeWireMessage,
  splitFileIntoChunks,
  assembleChunks,
  type FileMeta,
} from '../lib/file-transfer';

export interface PendingFile {
  file: File;
  /** 'image' = small file via chat base64, 'file' = large file via data channel */
  kind: 'image' | 'file';
}

export interface ReceivedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  from: string;
  timestamp: number;
}

const MAX_RECEIVED_FILES = 50;
const PROGRESS_THROTTLE_MS = 100;

/**
 * Manages file & image attachments: drag & drop, paste, file picker, sending/receiving.
 *
 * - Files ≤ 5MB → base64 via chat (fast, instant)
 * - Files > 5MB → chunked via LiveKit data channel
 */
export function useFileAttachments(enableAttachments: boolean) {
  const { send, isSending } = useChat();
  const room = useRoomContext();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = React.useState<PendingFile[]>([]);
  const [isSendingFiles, setIsSendingFiles] = React.useState(false);
  const [sentCount, setSentCount] = React.useState(0);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [textValue, setTextValue] = React.useState('');
  const [receivedFiles, setReceivedFiles] = React.useState<ReceivedFile[]>([]);

  // ── File classification ─────────────────────────────────────────────────

  const MAX_CHAT_FILE = 5 * 1024 * 1024; // 5MB

  const classifyFile = React.useCallback((file: File): PendingFile['kind'] => {
    if (file.size > MAX_CHAT_FILE) return 'file'; // data channel
    return 'image'; // chat (reuse base64 path)
  }, []);

  // ── Add files ───────────────────────────────────────────────────────────

  const addFiles = React.useCallback((files: File[]) => {
    const valid: PendingFile[] = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        alert(`File "${f.name}" is too large. Maximum ${formatFileSize(MAX_FILE_BYTES)}.`);
        continue;
      }
      valid.push({ file: f, kind: classifyFile(f) });
    }
    if (valid.length > 0) setPendingFiles((prev) => [...prev, ...valid]);
  }, [classifyFile]);

  const onFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(e.target.files ?? []));
      e.target.value = '';
    },
    [addFiles],
  );

  const removePending = React.useCallback(
    (idx: number) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx)),
    [],
  );

  // ── Drag & drop ─────────────────────────────────────────────────────────

  const handleDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files') && enableAttachments) setIsDragOver(true);
  }, [enableAttachments]);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (e.dataTransfer.types.includes('Files') && enableAttachments) setIsDragOver(true);
  }, [enableAttachments]);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (enableAttachments) addFiles(Array.from(e.dataTransfer.files));
    },
    [enableAttachments, addFiles],
  );

  // ── Paste ───────────────────────────────────────────────────────────────

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0 && enableAttachments) {
        e.preventDefault();
        addFiles(files);
      }
    },
    [enableAttachments, addFiles],
  );

  // ── Data channel send (for large files > 5MB) ───────────────────────────

  const sendFileViaDataChannel = React.useCallback(
    async (file: File) => {
      if (!room) throw new Error('Room not connected');

      const fileId = generateTransferId();
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // Send metadata
      const meta: FileMeta = {
        t: FileMsgType.META,
        id: fileId,
        n: file.name,
        s: file.size,
        m: file.type || 'application/octet-stream',
        c: totalChunks,
      };
      await room.localParticipant.publishData(encodeWireMessage(meta), {
        reliable: true,
        topic: FILE_TRANSFER_TOPIC,
      });

      // Send chunks — NO per-chunk setState (throttled)
      let chunkIndex = 0;
      let lastProgressUpdate = 0;

      for await (const chunk of splitFileIntoChunks(file, fileId)) {
        await room.localParticipant.publishData(encodeWireMessage(chunk), {
          reliable: true,
          topic: FILE_TRANSFER_TOPIC,
        });
        chunkIndex++;

        // Throttle progress updates to every 100ms
        const now = Date.now();
        if (now - lastProgressUpdate > PROGRESS_THROTTLE_MS) {
          lastProgressUpdate = now;
          // progress tracked via ref, not state — no re-renders
        }
      }

      // Send completion (no hash — saves time)
      await room.localParticipant.publishData(
        encodeWireMessage({ t: FileMsgType.DONE, id: fileId }),
        { reliable: true, topic: FILE_TRANSFER_TOPIC },
      );

      return fileId;
    },
    [room],
  );

  // ── Receive handler (data channel) ──────────────────────────────────────

  // Use ref for incoming to avoid stale closures in finalizeIncoming
  const incomingRef = React.useRef<
    Map<string, { meta: FileMeta; chunks: Map<number, string>; from: string }>
  >(new Map());

  React.useEffect(() => {
    if (!room) return;

    const handleData = (
      payload: Uint8Array,
      participant: any,
      _kind: any,
      topic?: string,
    ) => {
      if (topic !== FILE_TRANSFER_TOPIC) return;
      const msg = decodeWireMessage(payload);
      if (!msg) return;

      const senderIdentity = participant?.identity ?? 'unknown';

      switch (msg.t) {
        case FileMsgType.META: {
          // Dedup — don't overwrite existing transfer
          if (incomingRef.current.has(msg.id)) return;
          incomingRef.current.set(msg.id, {
            meta: msg,
            chunks: new Map(),
            from: senderIdentity,
          });
          // Auto-cleanup after TTL
          setTimeout(() => incomingRef.current.delete(msg.id), TRANSFER_TTL_MS);
          break;
        }

        case FileMsgType.CHUNK: {
          const incoming = incomingRef.current.get(msg.id);
          if (!incoming) return;
          // Dedup chunks
          if (incoming.chunks.has(msg.i)) return;
          incoming.chunks.set(msg.i, msg.d);

          // Check if all chunks received
          if (incoming.chunks.size === incoming.meta.c) {
            finalizeIncoming(msg.id, incoming);
          }
          break;
        }

        case FileMsgType.DONE: {
          const incoming = incomingRef.current.get(msg.id);
          if (!incoming) return;
          if (incoming.chunks.size === incoming.meta.c) {
            finalizeIncoming(msg.id, incoming);
          }
          break;
        }

        case FileMsgType.CANCEL: {
          incomingRef.current.delete(msg.id);
          break;
        }
      }
    };

    const finalizeIncoming = async (
      fileId: string,
      incoming: { meta: FileMeta; chunks: Map<number, string>; from: string },
    ) => {
      try {
        const blob = assembleChunks(incoming.chunks, incoming.meta.m);
        const receivedFile: ReceivedFile = {
          id: fileId,
          name: incoming.meta.n,
          mimeType: incoming.meta.m,
          size: incoming.meta.s,
          blob,
          from: incoming.from,
          timestamp: Date.now(),
        };

        setReceivedFiles((prev) => [...prev.slice(-(MAX_RECEIVED_FILES - 1)), receivedFile]);
        incomingRef.current.delete(fileId);
      } catch (err) {
        console.error('[FileAttach] Assembly failed:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  // ── Submit ──────────────────────────────────────────────────────────────

  const FT_MARKER = '__FT__';

  const handleSubmit = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = textValue.trim();
      const files = [...pendingFiles];
      if (!text && files.length === 0) return;
      if (text.length > MAX_TEXT_LEN) return;

      try {
        setIsSendingFiles(files.length > 0);
        setSentCount(0);

        if (text) await send(text);

        for (let i = 0; i < files.length; i++) {
          const { file, kind } = files[i];

          if (kind === 'image') {
            // File ≤ 5MB → base64 via chat (instant)
            await send(await fileToDataUrl(file));
          } else {
            // Large file → data channel (await for back-pressure)
            const fileId = await sendFileViaDataChannel(file);

            // Add to receivedFiles for sender (no loopback)
            setReceivedFiles((prev) => [...prev.slice(-(MAX_RECEIVED_FILES - 1)), {
              id: fileId,
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              blob: file,
              from: 'you',
              timestamp: Date.now(),
            }]);

            // Chat marker for receiver
            await send(`${FT_MARKER}${JSON.stringify({
              fileId,
              name: file.name,
              size: file.size,
              mime: file.type || 'application/octet-stream',
            })}`);
          }

          setSentCount(i + 1);
        }

        setTextValue('');
        setPendingFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error('[Chat] Send failed:', err);
      } finally {
        setIsSendingFiles(false);
        setSentCount(0);
      }
    },
    [send, pendingFiles, textValue, sendFileViaDataChannel],
  );

  // ── Cleanup ─────────────────────────────────────────────────────────────

  const removeReceivedFile = React.useCallback((id: string) => {
    setReceivedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ── Return ──────────────────────────────────────────────────────────────

  const busy = isSending || isSendingFiles;
  const overLimit = textValue.length > MAX_TEXT_LEN;
  const nearLimit = textValue.length > MAX_TEXT_LEN * 0.85;

  return {
    fileInputRef,
    textValue,
    setTextValue,
    pendingFiles,
    isSendingFiles,
    sentCount,
    isDragOver,
    setIsDragOver,
    busy,
    overLimit,
    nearLimit,
    enableAttachments,
    ACCEPT_IMAGES,
    acceptAllFiles: ACCEPT_ALL_FILES,
    onFileChange,
    removePending,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
    handleSubmit,
    receivedFiles,
    removeReceivedFile,
  };
}

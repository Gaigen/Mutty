import * as React from 'react';
import { useChat, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { ACCEPT_IMAGES, MAX_IMAGE_BYTES, MAX_TEXT_LEN } from '../lib/chat-constants';
import { fileToDataUrl } from '../components/livekit/chat-with-attachments/helpers';
import {
  MAX_FILE_BYTES,
  ACCEPT_ALL_FILES,
  isImage,
  formatFileSize,
  FILE_TRANSFER_TOPIC,
  CHUNK_SIZE,
  FileMsgType,
  generateTransferId,
  encodeWireMessage,
  decodeWireMessage,
  sha256Blob,
  splitFileIntoChunks,
  assembleChunks,
  type FileMeta,
} from '../lib/file-transfer';

export interface PendingFile {
  file: File;
  /** 'image' = will be sent as base64 data URL via chat, 'file' = chunked via data channel */
  kind: 'image' | 'file';
}

export interface ReceivedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  hash: string;
  from: string;
  timestamp: number;
}

/**
 * Manages file & image attachments: drag & drop, paste, file picker, validation, sending.
 *
 * - Images (< 10MB) are sent as base64 data URLs through the chat (backward compatible)
 * - Other files are sent via chunked data channel protocol
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

  // Track active file transfers for progress
  const [transferProgress, setTransferProgress] = React.useState<Map<string, {
    fileId: string;
    fileName: string;
    fileSize: number;
    progress: number;
    status: 'sending' | 'receiving' | 'complete' | 'cancelled';
  }>>(new Map());

  // Received files queue
  const [receivedFiles, setReceivedFiles] = React.useState<ReceivedFile[]>([]);

  // Incoming assembly buffers
  const incomingRef = React.useRef<Map<string, {
    meta: FileMeta;
    chunks: Map<number, string>;
    from: string;
  }>>(new Map());

  // Callback for new received files
  const onFileReceivedRef = React.useRef<
    ((file: ReceivedFile) => void) | null
  >(null);

  const onFileReceived = React.useCallback(
    (cb: (file: ReceivedFile) => void) => {
      onFileReceivedRef.current = cb;
    },
    [],
  );

  // ── File classification ─────────────────────────────────────────────────

  const classifyFile = React.useCallback((file: File): PendingFile['kind'] => {
    // Images under the image limit go through chat (backward compatible)
    if (isImage(file.type) && file.size <= MAX_IMAGE_BYTES) {
      return 'image';
    }
    // Everything else (including large images) goes through data channel
    return 'file';
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
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOver(false);
    }
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
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0 && enableAttachments) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    },
    [enableAttachments, addFiles],
  );

  // ── Chunked file send via data channel ──────────────────────────────────

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
      room.localParticipant.publishData(encodeWireMessage(meta), {
        reliable: true,
        topic: FILE_TRANSFER_TOPIC,
      });

      // Track progress
      setTransferProgress((prev) => {
        const next = new Map(prev);
        next.set(fileId, {
          fileId,
          fileName: file.name,
          fileSize: file.size,
          progress: 0,
          status: 'sending',
        });
        return next;
      });

      // Send chunks
      let chunkIndex = 0;
      for await (const chunk of splitFileIntoChunks(file, fileId)) {
        room.localParticipant.publishData(encodeWireMessage(chunk), {
          reliable: true,
          topic: FILE_TRANSFER_TOPIC,
        });
        chunkIndex++;

        setTransferProgress((prev) => {
          const existing = prev.get(fileId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(fileId, {
            ...existing,
            progress: chunkIndex / totalChunks,
          });
          return next;
        });

        if (chunkIndex % 5 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // Send completion
      const hash = await sha256Blob(file);
      room.localParticipant.publishData(
        encodeWireMessage({ t: FileMsgType.DONE, id: fileId, h: hash }),
        { reliable: true, topic: FILE_TRANSFER_TOPIC },
      );

      setTransferProgress((prev) => {
        const existing = prev.get(fileId);
        if (!existing) return prev;
        const next = new Map(prev);
        next.set(fileId, { ...existing, status: 'complete', progress: 1 });
        return next;
      });

      return fileId;
    },
    [room, send],
  );

  // ── Receive handler ─────────────────────────────────────────────────────

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
          incomingRef.current.set(msg.id, {
            meta: msg,
            chunks: new Map(),
            from: senderIdentity,
          });
          setTransferProgress((prev) => {
            const next = new Map(prev);
            next.set(msg.id, {
              fileId: msg.id,
              fileName: msg.n,
              fileSize: msg.s,
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

          setTransferProgress((prev) => {
            const existing = prev.get(msg.id);
            if (!existing) return prev;
            const next = new Map(prev);
            next.set(msg.id, {
              ...existing,
              progress: received / total,
            });
            return next;
          });

          if (received === total) {
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
          setTransferProgress((prev) => {
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

    const finalizeIncoming = async (
      fileId: string,
      incoming: { meta: FileMeta; chunks: Map<number, string>; from: string },
    ) => {
      try {
        const blob = assembleChunks(incoming.chunks, incoming.meta.m);
        const hash = await sha256Blob(blob);

        const receivedFile: ReceivedFile = {
          id: fileId,
          name: incoming.meta.n,
          mimeType: incoming.meta.m,
          size: incoming.meta.s,
          blob,
          hash,
          from: incoming.from,
          timestamp: Date.now(),
        };

        setReceivedFiles((prev) => [...prev, receivedFile]);

        setTransferProgress((prev) => {
          const existing = prev.get(fileId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(fileId, { ...existing, status: 'complete', progress: 1 });
          return next;
        });

        onFileReceivedRef.current?.(receivedFile);
        incomingRef.current.delete(fileId);
      } catch (err) {
        console.error('[FileAttach] Assembly failed:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  // ── File transfer chat marker ──────────────────────────────────────────
  // After sending via data channel, we send a chat message with this prefix
  // so the receiver can display a file card even if data channel is delayed
  const FT_MARKER = '__FT__';

  // ── Submit ──────────────────────────────────────────────────────────────

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

        // Send text first
        if (text) await send(text);

        // Send files
        for (let i = 0; i < files.length; i++) {
          const { file, kind } = files[i];
          if (kind === 'image') {
            // Small image → base64 via chat (backward compatible)
            await send(await fileToDataUrl(file));
          } else {
            // All files → chunked via data channel + chat marker for UI
            const fileId = await sendFileViaDataChannel(file);

            // For sender: add to receivedFiles so they see Download button too
            // (data channel doesn't loop back to sender)
            const senderFile: ReceivedFile = {
              id: fileId,
              name: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              blob: file,
              hash: '',
              from: 'you',
              timestamp: Date.now(),
            };
            setReceivedFiles((prev) => [...prev, senderFile]);

            // Send a marker message so receiver sees a file card in chat
            const marker = JSON.stringify({
              fileId,
              name: file.name,
              size: file.size,
              mime: file.type || 'application/octet-stream',
            });
            await send(`${FT_MARKER}${marker}`);
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
    // New file transfer stuff
    transferProgress,
    receivedFiles,
    removeReceivedFile: (id: string) =>
      setReceivedFiles((prev) => prev.filter((f) => f.id !== id)),
    onFileReceived,
  };
}

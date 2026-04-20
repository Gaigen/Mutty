/**
 * File transfer protocol over LiveKit data channels.
 *
 * Binary files are split into chunks and sent as a sequence of messages:
 *   1. FILE_META  — metadata (name, size, mime, chunk count)
 *   2. FILE_CHUNK — binary payload chunks (indexed 0..N-1)
 *   3. FILE_DONE  — completion marker with integrity hash
 *
 * All messages share the topic 'file-transfer' on LiveKit data channel.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** LiveKit data channel topic for file transfer messages */
export const FILE_TRANSFER_TOPIC = 'file-transfer';

/**
 * Chunk payload size in bytes.
 * LiveKit reliable data channel limit is ~60KB per message.
 * We use 55KB to leave room for JSON envelope overhead.
 */
export const CHUNK_SIZE = 55_000;

/** Maximum file size for transfer (100 MB) */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

/** Accept string for all supported file types */
export const ACCEPT_ALL_FILES =
  'image/jpeg,image/png,image/gif,image/webp,' +
  'video/mp4,video/webm,video/quicktime,' +
  'audio/mpeg,audio/ogg,audio/wav,audio/webm,' +
  'application/pdf,application/zip,application/x-zip-compressed,' +
  'application/json,text/plain,text/csv,' +
  '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rar,.7z,.tar,.gz';

// ── Wire Types (what goes over the wire) ───────────────────────────────────────

export const enum FileMsgType {
  META = 'fm',
  CHUNK = 'fc',
  DONE = 'fd',
  CANCEL = 'fx',
}

export interface FileMeta {
  t: FileMsgType.META;
  /** Unique transfer id */
  id: string;
  /** Original filename */
  n: string;
  /** File size in bytes */
  s: number;
  /** MIME type */
  m: string;
  /** Total number of chunks */
  c: number;
}

export interface FileChunk {
  t: FileMsgType.CHUNK;
  /** Transfer id */
  id: string;
  /** Chunk index (0-based) */
  i: number;
  /** Base64-encoded chunk payload */
  d: string;
}

export interface FileDone {
  t: FileMsgType.DONE;
  /** Transfer id */
  id: string;
  /** SHA-256 hex digest of the complete file */
  h: string;
}

export interface FileCancel {
  t: FileMsgType.CANCEL;
  /** Transfer id */
  id: string;
}

/** Union of all wire messages */
export type FileWireMessage = FileMeta | FileChunk | FileDone | FileCancel;

// ── Internal State Types ──────────────────────────────────────────────────────

export interface TransferProgress {
  /** Transfer id */
  fileId: string;
  /** Original filename */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type */
  mimeType: string;
  /** Number of chunks received/sent so far */
  chunksReceived: number;
  /** Total chunks */
  totalChunks: number;
  /** Progress 0..1 */
  progress: number;
  /** 'sending' | 'receiving' | 'complete' | 'cancelled' */
  status: 'sending' | 'receiving' | 'complete' | 'cancelled';
  /** Assembled blob (only when complete) */
  blob?: Blob;
  /** SHA-256 hash (only when complete) */
  hash?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let _counter = 0;

/** Generate a short unique transfer id */
export function generateTransferId(): string {
  _counter = (_counter + 1) % 10_000;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${ts}-${rand}-${_counter}`;
}

/** Encode a wire message to Uint8Array for publishData */
export function encodeWireMessage(msg: FileWireMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(msg));
}

/** Try to decode incoming data to a wire message, returns null on failure */
export function decodeWireMessage(data: Uint8Array): FileWireMessage | null {
  try {
    const text = new TextDecoder().decode(data);
    const obj = JSON.parse(text);
    if (obj && typeof obj.t === 'string') {
      switch (obj.t) {
        case FileMsgType.META:
        case FileMsgType.CHUNK:
        case FileMsgType.DONE:
        case FileMsgType.CANCEL:
          return obj as FileWireMessage;
      }
    }
  } catch {
    // not our message
  }
  return null;
}

/** Compute SHA-256 hex digest of a Blob */
export async function sha256Blob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Split a File into base64-encoded chunks */
export async function* splitFileIntoChunks(
  file: File,
  fileId: string,
): AsyncGenerator<FileChunk, void, unknown> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const slice = file.slice(start, end);
    const buf = await slice.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Base64 encode
    let binary = '';
    for (let j = 0; j < bytes.length; j++) {
      binary += String.fromCharCode(bytes[j]);
    }
    const b64 = btoa(binary);
    yield { t: FileMsgType.CHUNK, id: fileId, i, d: b64 };
  }
}

/** Reassemble chunks into a Blob */
export function assembleChunks(chunks: Map<number, string>, mimeType: string): Blob {
  const parts: Blob[] = [];
  const total = chunks.size;
  for (let i = 0; i < total; i++) {
    const b64 = chunks.get(i);
    if (!b64) throw new Error(`Missing chunk ${i}`);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) {
      bytes[j] = binary.charCodeAt(j);
    }
    parts.push(new Blob([bytes]));
  }
  return new Blob(parts, { type: mimeType });
}

/** Get a display-friendly file size string */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Get an icon/emoji for a MIME type */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('7z'))
    return '📦';
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return '📝';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📃';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  return '📎';
}

/** Check if MIME type is an image */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** Check if MIME type is a video */
export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/** Check if MIME type is audio */
export function isAudio(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

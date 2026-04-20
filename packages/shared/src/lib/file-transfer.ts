/**
 * File transfer protocol over LiveKit data channels.
 *
 * Binary files are split into chunks and sent as a sequence of messages:
 *   1. FILE_META  — metadata (name, size, mime, chunk count)
 *   2. FILE_CHUNK — binary payload chunks (indexed 0..N-1)
 *   3. FILE_DONE  — completion marker (no hash by default)
 *
 * All messages share the topic 'file-transfer' on LiveKit data channel.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** LiveKit data channel topic for file transfer messages */
export const FILE_TRANSFER_TOPIC = 'file-transfer';

/**
 * Chunk payload size in bytes.
 * LiveKit data channel limit is ~65KB per message.
 * Base64 adds ~33% overhead, JSON envelope adds more.
 * 40KB raw → ~53KB base64 → ~54KB JSON = safe margin.
 */
export const CHUNK_SIZE = 40_000;

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

/** Transfer TTL — auto-cleanup after 5 minutes */
export const TRANSFER_TTL_MS = 5 * 60 * 1000;

// ── Wire Types ─────────────────────────────────────────────────────────────────

export const enum FileMsgType {
  META = 'fm',
  CHUNK = 'fc',
  DONE = 'fd',
  CANCEL = 'fx',
}

export interface FileMeta {
  t: FileMsgType.META;
  id: string;
  n: string;
  s: number;
  m: string;
  c: number;
}

export interface FileChunk {
  t: FileMsgType.CHUNK;
  id: string;
  i: number;
  d: string;
}

export interface FileDone {
  t: FileMsgType.DONE;
  id: string;
}

export interface FileCancel {
  t: FileMsgType.CANCEL;
  id: string;
}

export type FileWireMessage = FileMeta | FileChunk | FileDone | FileCancel;

// ── Internal State Types ──────────────────────────────────────────────────────

export interface TransferProgress {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunksReceived: number;
  totalChunks: number;
  progress: number;
  status: 'sending' | 'receiving' | 'complete' | 'cancelled';
  blob?: Blob;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a unique transfer id using crypto.getRandomValues */
export function generateTransferId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

/** Encode a wire message to Uint8Array for publishData */
export function encodeWireMessage(msg: FileWireMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(msg));
}

/** Try to decode incoming data to a wire message */
export function decodeWireMessage(data: Uint8Array): FileWireMessage | null {
  try {
    const obj = JSON.parse(new TextDecoder().decode(data));
    if (obj?.t && [FileMsgType.META, FileMsgType.CHUNK, FileMsgType.DONE, FileMsgType.CANCEL].includes(obj.t)) {
      return obj;
    }
  } catch { /* not our message */ }
  return null;
}

/**
 * Split a File into base64-encoded chunks (async generator).
 * Uses Array.from for efficient conversion — no O(n²) string concat.
 */
export async function* splitFileIntoChunks(
  file: File,
  fileId: string,
): AsyncGenerator<FileChunk, void, unknown> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const buf = await file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE).arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Efficient base64 — no O(n²) string concat
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    yield { t: FileMsgType.CHUNK, id: fileId, i, d: btoa(binary) };
  }
}

/**
 * Reassemble chunks into a Blob.
 * Uses Array.from for efficient conversion.
 */
export function assembleChunks(chunks: Map<number, string>, mimeType: string): Blob {
  const parts: Blob[] = [];
  const total = chunks.size;
  for (let i = 0; i < total; i++) {
    const b64 = chunks.get(i);
    if (!b64) throw new Error(`Missing chunk ${i}`);
    const binary = atob(b64);
    const bytes = new Uint8Array(Array.from(binary, (c) => c.charCodeAt(0)));
    parts.push(new Blob([bytes]));
  }
  return new Blob(parts, { type: mimeType });
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Get icon for MIME type */
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

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export function isAudio(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

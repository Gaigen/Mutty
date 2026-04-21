import * as React from 'react';
import type { ReceivedChatMessage, MessageFormatter } from '@livekit/components-react';
import type { ChatMessageRow } from './types';
import { MessageEntry } from './message-entry';
import { FullscreenImageOverlay } from './fullscreen-overlay';
import { findFirstUrl, hasMultipleUrls } from './link-preview/helpers';
import { MarkdownMessage } from './markdown-message';
import { LinkPreview } from './link-preview';
import { getFileIcon, formatFileSize, isImage, isVideo, isAudio } from '../../../lib/file-transfer';
import type { ReceivedFile } from '../../../hooks/useImageAttachments';

const FT_MARKER = '__FT__';

/** Parse a data URL into mime and binary data */
function parseDataUrl(dataUrl: string): { mime: string; data: Uint8Array } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime, data: bytes };
}

/** File card for data URL messages (non-image files sent via chat) */
function DataUrlFileCard({ dataUrl }: { dataUrl: string }) {
  const parsed = React.useMemo(() => parseDataUrl(dataUrl), [dataUrl]);
  if (!parsed) return <span style={{ color: '#f88' }}>Invalid file data</span>;

  const { mime, data } = parsed;
  const size = data.length;
  const ext = mime.split('/')[1] || 'bin';
  const fileName = `file.${ext}`;

  const handleDownload = () => {
    const blob = new Blob([data.buffer as ArrayBuffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.05)',
      minWidth: 180,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{getFileIcon(mime)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {fileName}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            {formatFileSize(size)} · {mime}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          style={{
            padding: '5px 14px', borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.95)', fontSize: 12,
            fontWeight: 500, cursor: 'pointer', flexShrink: 0,
          }}
        >
          ⬇ Download
        </button>
      </div>
    </div>
  );
}

interface ChatMessageListProps {
  messages: ReceivedChatMessage[];
  avatarMap: Map<string, string>;
  customFormatter?: MessageFormatter;
  onOpenFullscreen: (src: string) => void;
  fullscreenImage: string | null;
  onCloseFullscreen: () => void;
  listRef: React.RefObject<HTMLUListElement | null>;
  onScroll?: () => void;
  receivedFiles?: ReceivedFile[];
  onDownloadFile?: (blob: Blob, name: string) => void;
}

/** Inline file card rendered inside a chat bubble */
function FileCardInline({
  meta,
  receivedFile,
  onDownload,
}: {
  meta: { name: string; size: number; mime: string };
  receivedFile?: ReceivedFile;
  onDownload?: (blob: Blob, name: string) => void;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (receivedFile && (isImage(receivedFile.mimeType) || isVideo(receivedFile.mimeType) || isAudio(receivedFile.mimeType))) {
      const url = URL.createObjectURL(receivedFile.blob);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [receivedFile]);

  const ready = !!receivedFile;

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
        minWidth: 200,
      }}
    >
      {/* Image preview */}
      {ready && isImage(meta.mime) && objectUrl && (
        <img
          src={objectUrl}
          alt={meta.name}
          onClick={() => window.open(objectUrl, '_blank')?.focus()}
          style={{
            display: 'block',
            width: '100%',
            maxHeight: 200,
            objectFit: 'cover',
            cursor: 'pointer',
          }}
          title="Click to enlarge"
        />
      )}

      {/* Video preview */}
      {ready && isVideo(meta.mime) && objectUrl && (
        <video
          src={objectUrl}
          controls
          style={{ display: 'block', width: '100%', maxHeight: 200 }}
        />
      )}

      {/* Audio player */}
      {ready && isAudio(meta.mime) && objectUrl && (
        <audio
          src={objectUrl}
          controls
          style={{ display: 'block', width: '100%', height: 36 }}
        />
      )}

      {/* File info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>
          {getFileIcon(meta.mime)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {meta.name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            {formatFileSize(meta.size)}
            {!ready && ' · receiving…'}
          </div>
        </div>
        {ready && onDownload && receivedFile && (
          <button
            type="button"
            onClick={() => onDownload(receivedFile.blob, receivedFile.name)}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.9)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ⬇ Download
          </button>
        )}
      </div>
    </div>
  );
}

export const ChatMessageList = React.memo(function ChatMessageList({
  messages,
  avatarMap,
  customFormatter,
  onOpenFullscreen,
  fullscreenImage,
  onCloseFullscreen,
  listRef,
  onScroll,
  receivedFiles = [],
  onDownloadFile,
}: ChatMessageListProps) {
  // Build lookup: fileName → ReceivedFile (latest match)
  const fileMap = React.useMemo(() => {
    const map = new Map<string, ReceivedFile>();
    for (const f of receivedFiles) {
      map.set(f.name, f);
    }
    return map;
  }, [receivedFiles]);

  const effectiveFormatter: MessageFormatter = React.useCallback(
    (message: string) => {
      // Image data URL — show inline image (backward compatible)
      if (message.startsWith('data:image/')) {
        return (
          <button
            type="button"
            className="chat-shared-image-trigger"
            onClick={() => onOpenFullscreen(message)}
            aria-label="Open image fullscreen"
          >
            <img src={message} alt="Shared image" className="chat-shared-image-thumb" />
          </button>
        );
      }

      // Non-image data URL — show file card with download
      if (message.startsWith('data:')) {
        return <DataUrlFileCard dataUrl={message} />;
      }

      // File transfer marker: __FT__{"fileId":"...","name":"...","size":123,"mime":"..."}
      if (message.startsWith(FT_MARKER)) {
        try {
          const meta = JSON.parse(message.slice(FT_MARKER.length));
          const receivedFile = fileMap.get(meta.name);
          return (
            <FileCardInline
              meta={meta}
              receivedFile={receivedFile}
              onDownload={onDownloadFile}
            />
          );
        } catch {
          // Malformed marker
        }
      }

      if (customFormatter) return customFormatter(message);
      const url = findFirstUrl(message);
      const multiple = hasMultipleUrls(message);
      return (
        <div className="chat-message-content">
          <MarkdownMessage content={message} />
          {url && !multiple && <LinkPreview url={url} />}
        </div>
      );
    },
    [customFormatter, onOpenFullscreen, fileMap, onDownloadFile],
  );

  return (
    <>
      <ul
        className="lk-list lk-chat-messages"
        ref={listRef}
        onScroll={onScroll}
      >
        {messages.map((msg, idx, allMsg) => {
          const hideName = idx >= 1 && allMsg[idx - 1].from === msg.from;
          const hideTimestamp =
            idx >= 1 && (msg.timestamp ?? 0) - (allMsg[idx - 1].timestamp ?? 0) < 60_000;
          const hideAvatar = idx < allMsg.length - 1 && allMsg[idx + 1].from === msg.from;
          return (
            <MessageEntry
              key={msg.id ?? idx}
              msg={msg as ChatMessageRow}
              hideName={hideName}
              hideTimestamp={hideTimestamp}
              hideAvatar={hideAvatar}
              formatter={effectiveFormatter}
              avatarMap={avatarMap}
            />
          );
        })}
      </ul>

      {fullscreenImage && (
        <FullscreenImageOverlay src={fullscreenImage} onClose={onCloseFullscreen} />
      )}
    </>
  );
}, (prev, next) => {
  // Re-render only if messages array reference changed (new message) or key props differ
  if (prev.messages !== next.messages) return false;
  if (prev.receivedFiles !== next.receivedFiles) return false;
  // avatarMap: new Map on every useLocalParticipant update, but content rarely changes
  // Compare size + entries only if reference changed
  if (prev.avatarMap !== next.avatarMap) {
    if (prev.avatarMap.size !== next.avatarMap.size) return false;
    for (const [k, v] of prev.avatarMap) {
      if (next.avatarMap.get(k) !== v) return false;
    }
  }
  return true;
});

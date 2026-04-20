import * as React from 'react';
import type { ReceivedChatMessage, MessageFormatter } from '@livekit/components-react';
import type { ChatMessageRow } from './types';
import { MessageEntry } from './message-entry';
import { FullscreenImageOverlay } from './fullscreen-overlay';
import { IMG_PREFIX } from './constants';
import { findFirstUrl, hasMultipleUrls } from './link-preview/helpers';
import { MarkdownMessage } from './markdown-message';
import { LinkPreview } from './link-preview';
import { getFileIcon, formatFileSize, isImage, isVideo, isAudio } from '../../../lib/file-transfer';
import type { ReceivedFile } from '../../../hooks/useImageAttachments';

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
  onRemoveReceivedFile?: (id: string) => void;
}

/** Renders a received file attachment inline */
function ReceivedFileBubble({
  file,
  onDownload,
}: {
  file: ReceivedFile;
  onDownload: (blob: Blob, name: string) => void;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isImage(file.mimeType) || isVideo(file.mimeType) || isAudio(file.mimeType)) {
      const url = URL.createObjectURL(file.blob);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file.blob, file.mimeType]);

  return (
    <div
      className="chat-received-file"
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)',
        marginTop: 4,
      }}
    >
      {/* Image preview */}
      {isImage(file.mimeType) && objectUrl && (
        <img
          src={objectUrl}
          alt={file.name}
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: 300,
            objectFit: 'contain',
            cursor: 'pointer',
          }}
          onClick={() => {
            // Open fullscreen
            const win = window.open(objectUrl, '_blank');
            win?.focus();
          }}
        />
      )}

      {/* Video preview */}
      {isVideo(file.mimeType) && objectUrl && (
        <video
          src={objectUrl}
          controls
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: 300,
          }}
        />
      )}

      {/* Audio player */}
      {isAudio(file.mimeType) && objectUrl && (
        <audio
          src={objectUrl}
          controls
          style={{
            display: 'block',
            width: '100%',
            height: 40,
          }}
        />
      )}

      {/* File info + download */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
        }}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>
          {getFileIcon(file.mimeType)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file.name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            {formatFileSize(file.size)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDownload(file.blob, file.name)}
          style={{
            padding: '3px 10px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 11,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ⬇ Download
        </button>
      </div>
    </div>
  );
}

export function ChatMessageList({
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
  onRemoveReceivedFile,
}: ChatMessageListProps) {
  // Build a map of file references from chat messages
  const fileRefMap = React.useMemo(() => {
    const map = new Map<string, ReceivedFile>();
    for (const f of receivedFiles) {
      // Match by name in chat messages
      map.set(f.name, f);
    }
    return map;
  }, [receivedFiles]);

  const effectiveFormatter: MessageFormatter = React.useCallback(
    (message: string) => {
      // Image data URL (backward compatible)
      if (message.startsWith(IMG_PREFIX)) {
        return (
          <button
            type="button"
            className="chat-shared-image-trigger"
            onClick={() => onOpenFullscreen(message)}
            aria-label="Open image fullscreen"
          >
            <img
              src={message}
              alt="Shared image"
              className="chat-shared-image-thumb"
            />
          </button>
        );
      }

      // Check for file transfer message (icon + filename + size)
      const fileMatch = message.match(/^[🖼🎬🎵📄📦📝📃📊📽📎]\s+(.+?)\s+\((.+?)\)$/);
      if (fileMatch) {
        const fileName = fileMatch[1];
        const receivedFile = fileRefMap.get(fileName);
        if (receivedFile && onDownloadFile) {
          return (
            <ReceivedFileBubble
              file={receivedFile}
              onDownload={onDownloadFile}
            />
          );
        }
        // File not yet received — show placeholder
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              marginTop: 4,
              fontSize: 12,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            <span>📎</span>
            <span>{message}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
              (receiving…)
            </span>
          </div>
        );
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
    [customFormatter, onOpenFullscreen, fileRefMap, onDownloadFile, onRemoveReceivedFile],
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
}

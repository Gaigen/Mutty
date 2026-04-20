import * as React from 'react';
import type { ReceivedChatMessage, MessageFormatter } from '@livekit/components-react';
import type { ChatMessageRow } from './types';
import { MessageEntry } from './message-entry';
import { FullscreenImageOverlay } from './fullscreen-overlay';
import { IMG_PREFIX } from './constants';
import { findFirstUrl, hasMultipleUrls } from './link-preview/helpers';
import { MarkdownMessage } from './markdown-message';
import { LinkPreview } from './link-preview';

interface ChatMessageListProps {
  messages: ReceivedChatMessage[];
  avatarMap: Map<string, string>;
  customFormatter?: MessageFormatter;
  onOpenFullscreen: (src: string) => void;
  fullscreenImage: string | null;
  onCloseFullscreen: () => void;
  listRef: React.RefObject<HTMLUListElement | null>;
  onScroll?: () => void;
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
}: ChatMessageListProps) {
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
    [customFormatter, onOpenFullscreen],
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

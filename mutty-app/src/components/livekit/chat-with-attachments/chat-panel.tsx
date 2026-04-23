import * as React from 'react';
import {
  useChat,
  useLocalParticipant,
  useRemoteParticipants,
} from '@livekit/components-react';
import { MAX_IMAGE_BYTES } from './constants';
import { useChatNotifications } from '../../../hooks/useChatNotifications';
import { useChatScroll } from '../../../hooks/useChatScroll';
import { useUnreadMessages } from '../../../hooks/useUnreadMessages';
import { useImageAttachments } from '../../../hooks/useImageAttachments';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { ChatDragOverlay } from './ChatDragOverlay';
import { ChatImagePreview } from './ChatImagePreview';
import { ChatInput } from './ChatInput';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import type { ChatWithAttachmentsProps } from './types';

export function ChatWithAttachments({
  messageFormatter,
  enableAttachments = true,
  onClose,
  ...props
}: ChatWithAttachmentsProps) {
  const [fullscreenImage, setFullscreenImage] = React.useState<string | null>(null);

  const { chatMessages } = useChat();
  const localParticipant = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const avatarMap = React.useMemo(() => {
    const map = new Map<string, string>();
    const allParticipants = [localParticipant.localParticipant, ...remoteParticipants];
    for (const p of allParticipants) {
      if (!p?.identity) continue;
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata) as { avatar?: string };
          if (meta.avatar) map.set(p.identity, meta.avatar);
        }
      } catch { /* ignore */ }
    }
    return map;
  }, [localParticipant.localParticipant, remoteParticipants]);

  // ── Hooks ──────────────────────────────────────────────────────────────
  useChatNotifications({ chatMessages });

  const { ulRef, atBottom, newMsgCount, scrollToBottom, handleScroll } =
    useChatScroll(chatMessages);

  useUnreadMessages(chatMessages);

  const imageAtt = useImageAttachments(enableAttachments);

  const openFullscreen = React.useCallback((src: string) => setFullscreenImage(src), []);
  const closeFullscreen = React.useCallback(() => setFullscreenImage(null), []);

  return (
    <div
      className="lk-chat"
      {...props}
      style={{ position: 'relative', ...(props.style ?? {}) }}
      onDragEnter={imageAtt.handleDragEnter}
      onDragOver={imageAtt.handleDragOver}
      onDragLeave={imageAtt.handleDragLeave}
      onDrop={imageAtt.handleDrop}
    >
      <ChatDragOverlay isDragOver={imageAtt.isDragOver} />

      <ChatHeader onClose={onClose} />

      <ChatMessageList
        messages={chatMessages}
        avatarMap={avatarMap}
        customFormatter={messageFormatter}
        onOpenFullscreen={openFullscreen}
        fullscreenImage={fullscreenImage}
        onCloseFullscreen={closeFullscreen}
        listRef={ulRef}
        onScroll={handleScroll}
      />

      {!atBottom && (
        <ScrollToBottomButton
          onClick={scrollToBottom}
          newMsgCount={newMsgCount}
          pendingFileCount={imageAtt.pendingFiles.length}
        />
      )}

      <ChatImagePreview
        files={imageAtt.pendingFiles}
        isSendingImages={imageAtt.isSendingImages}
        sentCount={imageAtt.sentCount}
        onRemove={imageAtt.removePending}
      />

      <ChatInput
        textValue={imageAtt.textValue}
        onTextChange={imageAtt.setTextValue}
        onSubmit={imageAtt.handleSubmit}
        onPaste={imageAtt.handlePaste}
        onAttachClick={() => imageAtt.fileInputRef.current?.click()}
        onFileChange={imageAtt.onFileChange}
        fileInputRef={imageAtt.fileInputRef}
        busy={imageAtt.busy}
        overLimit={imageAtt.overLimit}
        nearLimit={imageAtt.nearLimit}
        enableAttachments={imageAtt.enableAttachments}
        acceptImages={imageAtt.ACCEPT_IMAGES}
        maxImageMB={Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}
        isSendingImages={imageAtt.isSendingImages}
      />
    </div>
  );
}

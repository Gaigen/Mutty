import * as React from 'react';
import {
  useChat,
  useLocalParticipant,
  useRemoteParticipants,
} from '@livekit/components-react';
import { useChatNotifications } from '../../../hooks/useChatNotifications';
import { useChatScroll } from '../../../hooks/useChatScroll';
import { useUnreadMessages } from '../../../hooks/useUnreadMessages';
import { useFileAttachments } from '../../../hooks/useImageAttachments';
import { useDownloadFile } from '../../../context/DownloadFileContext';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { ChatDragOverlay } from './ChatDragOverlay';
import { ChatFilePreview } from './ChatFilePreview';
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
  useChatNotifications({ chatMessages, avatarMap });

  const { ulRef, atBottom, newMsgCount, scrollToBottom, handleScroll } =
    useChatScroll(chatMessages);

  useUnreadMessages(chatMessages);

  const fileAtt = useFileAttachments(enableAttachments);

  const openFullscreen = React.useCallback((src: string) => setFullscreenImage(src), []);
  const closeFullscreen = React.useCallback(() => setFullscreenImage(null), []);

  const customDownload = useDownloadFile();

  // Download received files
  const handleDownloadFile = React.useCallback((blob: Blob, name: string) => {
    if (customDownload) {
      customDownload(blob, name);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [customDownload]);

  return (
    <div
      className="lk-chat"
      {...props}
      style={{ position: 'relative', ...(props.style ?? {}) }}
      onDragEnter={fileAtt.handleDragEnter}
      onDragOver={fileAtt.handleDragOver}
      onDragLeave={fileAtt.handleDragLeave}
      onDrop={fileAtt.handleDrop}
    >
      <ChatDragOverlay isDragOver={fileAtt.isDragOver} />

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
        receivedFiles={fileAtt.receivedFiles}
        onDownloadFile={handleDownloadFile}
      />

      {!atBottom && (
        <ScrollToBottomButton
          onClick={scrollToBottom}
          newMsgCount={newMsgCount}
          pendingFileCount={fileAtt.pendingFiles.length}
        />
      )}

      <ChatFilePreview
        files={fileAtt.pendingFiles}
        isSendingFiles={fileAtt.isSendingFiles}
        sentCount={fileAtt.sentCount}
        activeTransfers={fileAtt.activeTransfers}
        onRemove={fileAtt.removePending}
      />

      <ChatInput
        textValue={fileAtt.textValue}
        onTextChange={fileAtt.setTextValue}
        onSubmit={fileAtt.handleSubmit}
        onPaste={fileAtt.handlePaste}
        onAttachClick={() => fileAtt.fileInputRef.current?.click()}
        onFileChange={fileAtt.onFileChange}
        fileInputRef={fileAtt.fileInputRef}
        busy={fileAtt.busy}
        overLimit={fileAtt.overLimit}
        nearLimit={fileAtt.nearLimit}
        enableAttachments={fileAtt.enableAttachments}
        acceptAllFiles={fileAtt.acceptAllFiles}
        maxFileSizeMB={Math.round(100)}
        isSendingFiles={fileAtt.isSendingFiles}
      />
    </div>
  );
}

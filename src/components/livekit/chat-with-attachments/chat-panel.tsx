import {
  useChat,
  useMaybeLayoutContext,
  useRemoteParticipants,
  useLocalParticipant,
  type MessageFormatter,
} from '@livekit/components-react';
import * as React from 'react';
import { playChatNotificationSound } from '../../../lib/play-chat-notification';
import {
  ACCEPT_IMAGES,
  IMG_PREFIX,
  MAX_IMAGE_BYTES,
  MAX_TEXT_LEN,
} from './constants';
import { FileThumbnail } from './file-thumbnail';
import { FullscreenImageOverlay } from './fullscreen-overlay';
import { fileToDataUrl } from './helpers';
import { AttachIcon, CloseIcon } from './icons';
import { LinkPreview } from './link-preview';
import { findFirstUrl, hasMultipleUrls } from './link-preview/helpers';
import { MarkdownMessage } from './markdown-message';
import { MessageEntry } from './message-entry';
import type { ChatMessageRow, ChatWithAttachmentsProps } from './types';

import { invoke } from '@tauri-apps/api/core';

function sendNativeNotification(title: string, body: string) {
  try {
    invoke('send_native_notification', { title, body }).catch(() => {});
  } catch {
    // Not in Tauri, fallback to browser
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      void Notification.requestPermission().then((p) => {
        if (p === 'granted') new Notification(title, { body });
      });
    }
  }
}

export function ChatWithAttachments({
  messageFormatter,
  enableAttachments = true,
  onClose,
  ...props
}: ChatWithAttachmentsProps) {
  const ulRef = React.useRef<HTMLUListElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaHadFocusRef = React.useRef(false);

  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [isSendingImages, setIsSendingImages] = React.useState(false);
  const dragCounterRef = React.useRef(0);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [textValue, setTextValue] = React.useState('');

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

  const atBottomRef = React.useRef(true);
  const [atBottom, setAtBottom] = React.useState(true);
  const [newMsgCount, setNewMsgCount] = React.useState(0);

  const layoutContext = useMaybeLayoutContext();
  const lastReadMsgAt = React.useRef(0);

  const { chatMessages, send, isSending } = useChat();
  const prevChatLenForSoundRef = React.useRef<number | null>(null);
  const [fullscreenImage, setFullscreenImage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const len = chatMessages.length;
    if (prevChatLenForSoundRef.current === null) {
      prevChatLenForSoundRef.current = len;
      return;
    }
    if (len > prevChatLenForSoundRef.current) {
      const added = chatMessages.slice(prevChatLenForSoundRef.current);
      const remoteMsgs = added.filter((m) => !m.from?.isLocal);
      if (remoteMsgs.length > 0) {
        playChatNotificationSound();
        for (const msg of remoteMsgs) {
          const sender = msg.from?.name || msg.from?.identity || 'Unknown';
          const text = msg.message.startsWith(IMG_PREFIX) ? 'Photo' : msg.message;
          sendNativeNotification(sender, text);
        }
      }
    }
    prevChatLenForSoundRef.current = len;
  }, [chatMessages]);

  const openFullscreen = React.useCallback((src: string) => setFullscreenImage(src), []);
  const closeFullscreen = React.useCallback(() => setFullscreenImage(null), []);

  const effectiveFormatter: MessageFormatter = React.useCallback(
    (message: string) => {
      if (message.startsWith(IMG_PREFIX)) {
        return (
          <button
            type="button"
            className="chat-shared-image-trigger"
            onClick={() => openFullscreen(message)}
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
      const url = findFirstUrl(message);
      const multiple = hasMultipleUrls(message);
      const content = messageFormatter ? messageFormatter(message) : <MarkdownMessage content={message} />;
      return (
        <div className="chat-message-content">
          {content}
          {url && !multiple && <LinkPreview url={url} />}
        </div>
      );
    },
    [messageFormatter, openFullscreen],
  );

  const addImageFiles = React.useCallback((files: File[]) => {
    const valid: File[] = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        alert(`File "${f.name}" is too large. Maximum ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length > 0) setPendingFiles((prev) => [...prev, ...valid]);
  }, []);

  const onFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addImageFiles(Array.from(e.target.files ?? []));
      e.target.value = '';
    },
    [addImageFiles],
  );

  const removePending = React.useCallback(
    (idx: number) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx)),
    [],
  );

  React.useEffect(() => {
    if (!enableAttachments) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      if (e.dataTransfer?.types.includes('Files')) setIsDragOver(true);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) setIsDragOver(false);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounterRef.current = 0;
      if (e.dataTransfer?.files) {
        addImageFiles(Array.from(e.dataTransfer.files));
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [enableAttachments, addImageFiles]);

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
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImageFiles(imageFiles);
      }
    },
    [addImageFiles],
  );

  const handleSubmit = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = textValue.trim();
      const files = [...pendingFiles];
      if (!text && files.length === 0) return;
      if (text.length > MAX_TEXT_LEN) return;

      setTextValue('');
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      try {
        setIsSendingImages(files.length > 0);
        if (text) await send(text);
        for (const file of files) {
          await send(await fileToDataUrl(file));
        }
        textareaRef.current?.focus();
      } catch (err) {
        console.error('[Chat] Send failed:', err);
      } finally {
        setIsSendingImages(false);
      }
    },
    [send, pendingFiles, textValue],
  );

  const adjustHeight = React.useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
  }, []);

  const scrollToBottom = React.useCallback(() => {
    ulRef.current?.scrollTo({ top: ulRef.current.scrollHeight, behavior: 'smooth' });
    setNewMsgCount(0);
    atBottomRef.current = true;
    setAtBottom(true);
  }, []);

  const handleScroll = React.useCallback(() => {
    const ul = ulRef.current;
    if (!ul) return;
    const isAtBottom = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 64;
    atBottomRef.current = isAtBottom;
    setAtBottom(isAtBottom);
    if (isAtBottom) setNewMsgCount(0);
  }, []);

  React.useEffect(() => {
    if (atBottomRef.current) {
      ulRef.current?.scrollTo({ top: ulRef.current.scrollHeight });
      setNewMsgCount(0);
    } else {
      setNewMsgCount((n) => n + 1);
    }
  }, [chatMessages]);

  React.useEffect(() => {
    if (!layoutContext || chatMessages.length === 0) return;
    if (
      layoutContext.widget.state?.showChat &&
      chatMessages.length > 0 &&
      lastReadMsgAt.current !== chatMessages[chatMessages.length - 1]?.timestamp
    ) {
      lastReadMsgAt.current = chatMessages[chatMessages.length - 1]?.timestamp ?? 0;
      return;
    }
    const unread = chatMessages.filter(
      (msg) => !lastReadMsgAt.current || (msg.timestamp ?? 0) > lastReadMsgAt.current
    ).length;
    if (unread > 0 && layoutContext.widget.state?.unreadMessages !== unread) {
      layoutContext.widget.dispatch?.({ msg: 'unread_msg', count: unread });
    }
  }, [chatMessages, layoutContext?.widget]);

  React.useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !textareaHadFocusRef.current || ta.disabled) return;
    if (
      document.activeElement !== ta &&
      (document.activeElement === document.body || document.activeElement === document.documentElement)
    ) {
      ta.focus();
    }
  });

  const busy = isSending || isSendingImages;
  const overLimit = textValue.length > MAX_TEXT_LEN;
  const nearLimit = textValue.length > MAX_TEXT_LEN * 0.85;

  return (
    <div
      className="lk-chat"
      {...props}
      style={{ position: 'relative', ...(props.style ?? {}) }}
    >
      {isDragOver && enableAttachments && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            background: 'rgba(99,102,241,0.22)',
            border: '2px dashed rgba(99,102,241,0.85)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              textShadow: '0 1px 6px rgba(0,0,0,0.8)',
            }}
          >
            Drop image to send
          </span>
        </div>
      )}

      <div className="lk-chat-header">
        <span className="lk-chat-header-title">Messages</span>
        {onClose && (
          <div
            className="lk-chat-close-button"
            onClick={onClose}
            role="button"
            aria-label="Close chat"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
          >
            <CloseIcon />
          </div>
        )}
      </div>

      <ul className="lk-list lk-chat-messages" ref={ulRef} onScroll={handleScroll}>
        {chatMessages.map((msg, idx, allMsg) => {
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

      {!atBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            bottom: pendingFiles.length > 0 ? 120 : 58,
            right: 10,
            zIndex: 10,
            background: 'rgba(20,20,20,0.92)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 14,
            color: 'rgba(255,255,255,0.9)',
            fontSize: 12,
            fontWeight: 500,
            padding: '4px 11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            backdropFilter: 'blur(6px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
          aria-label="Scroll to latest message"
        >
          ↓{newMsgCount > 0 && <span style={{ color: '#818cf8' }}>{newMsgCount} new</span>}
        </button>
      )}

      {pendingFiles.length > 0 && (
        <div
          style={{
            padding: '6px 8px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {pendingFiles.map((f, i) => (
            <FileThumbnail key={i} file={f} onRemove={() => removePending(i)} />
          ))}
        </div>
      )}

      <form
        className="lk-chat-form"
        onSubmit={handleSubmit}
        style={{ position: 'relative', alignItems: 'flex-end' }}
      >
        {enableAttachments && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_IMAGES}
              multiple
              onChange={onFileChange}
              style={{ display: 'none' }}
              aria-hidden
            />
            <button
              type="button"
              className="lk-button chat-attach-button"
              onClick={() => fileInputRef.current?.click()}
              title={`Attach image (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB)`}
              disabled={busy}
              aria-label="Attach image"
            >
              <AttachIcon size={22} />
            </button>
          </>
        )}

        <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
          <textarea
            ref={textareaRef}
            className="lk-form-control lk-chat-form-input"
            placeholder="Message…"
            disabled={busy}
            value={textValue}
            rows={1}
            style={{
              resize: 'none',
              overflowY: 'auto',
              lineHeight: '1.45',
              boxSizing: 'border-box',
              width: '100%',
              paddingBottom: nearLimit ? '18px' : undefined,
              borderColor: overLimit ? 'rgba(239,68,68,0.6)' : undefined,
            }}
            onChange={(e) => {
              setTextValue(e.target.value);
              adjustHeight();
            }}
            onFocus={() => { textareaHadFocusRef.current = true; }}
            onBlur={() => { textareaHadFocusRef.current = false; }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!overLimit) handleSubmit();
              }
            }}
            onKeyUp={(e) => e.stopPropagation()}
            onPaste={enableAttachments ? handlePaste : undefined}
          />
          {nearLimit && (
            <span
              style={{
                position: 'absolute',
                bottom: 3,
                right: 6,
                fontSize: 10,
                color: overLimit ? '#ef4444' : 'rgba(255,255,255,0.35)',
                pointerEvents: 'none',
                lineHeight: 1,
              }}
            >
              {textValue.length}/{MAX_TEXT_LEN}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="lk-button lk-chat-form-button"
          disabled={busy || overLimit}
          style={{ flexShrink: 0, alignSelf: 'flex-end', marginBottom: 1 }}
        >
          {isSendingImages ? '…' : 'Send'}
        </button>
      </form>

      {fullscreenImage && (
        <FullscreenImageOverlay src={fullscreenImage} onClose={closeFullscreen} />
      )}
    </div>
  );
}

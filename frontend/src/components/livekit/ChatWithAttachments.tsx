/**
 * Chat с поддержкой отправки картинок через DataURL в теле сообщения.
 * Полностью обходит байт-стримы (которые ненадёжны в dev-среде),
 * используя только текстовый стрим — который гарантированно работает.
 */
import {
  ChatEntry,
  formatChatMessageLinks,
  useChat,
  useMaybeLayoutContext,
  type MessageFormatter,
} from '@livekit/components-react';
import * as React from 'react';
import ReactDOM from 'react-dom';

/** Max file size before base64 encoding (10 MB). */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPT_IMAGES = 'image/jpeg,image/png,image/gif,image/webp';

/** Prefix for image messages (DataURL). */
const IMG_PREFIX = 'data:image/';

interface ChatWithAttachmentsProps extends React.HTMLAttributes<HTMLDivElement> {
  messageFormatter?: MessageFormatter;
  enableAttachments?: boolean;
}

function AttachIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}


export function ChatWithAttachments({
  messageFormatter,
  enableAttachments = true,
  ...props
}: ChatWithAttachmentsProps) {
  const ulRef = React.useRef<HTMLUListElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [isSendingImages, setIsSendingImages] = React.useState(false);
  const layoutContext = useMaybeLayoutContext();
  const lastReadMsgAt = React.useRef(0);

  const { chatMessages, send, isSending } = useChat();

  const [fullscreenImage, setFullscreenImage] = React.useState<string | null>(null);

  const openFullscreen = React.useCallback((src: string) => setFullscreenImage(src), []);
  const closeFullscreen = React.useCallback(() => setFullscreenImage(null), []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFullscreen();
    };
    if (fullscreenImage) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', onKeyDown);
      };
    }
  }, [fullscreenImage, closeFullscreen]);

  const effectiveFormatter: MessageFormatter = React.useCallback(
    (message: string) => {
      if (message.startsWith(IMG_PREFIX)) {
        return (
          <button
            type="button"
            onClick={() => openFullscreen(message)}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'zoom-in',
              display: 'block',
              marginTop: '4px',
            }}
            aria-label="Open image fullscreen"
          >
            <img
              src={message}
              alt="Shared image"
              style={{
                maxWidth: '280px',
                maxHeight: '280px',
                borderRadius: '8px',
                display: 'block',
                objectFit: 'contain',
              }}
            />
          </button>
        );
      }
      return messageFormatter ? messageFormatter(message) : formatChatMessageLinks(message);
    },
    [messageFormatter, openFullscreen]
  );

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = inputRef.current?.value.trim() ?? '';
      const files = [...pendingFiles];
      setPendingFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (!text && files.length === 0) return;

      try {
        setIsSendingImages(files.length > 0);

        // Сначала текст (если есть)
        if (text) {
          await send(text);
          if (inputRef.current) inputRef.current.value = '';
        }

        // Затем каждое изображение отдельным сообщением как DataURL
        for (const file of files) {
          const dataUrl = await fileToDataUrl(file);
          await send(dataUrl);
        }

        if (inputRef.current) {
          inputRef.current.focus();
        }
      } catch (err) {
        console.error('[Chat] Send failed:', err);
      } finally {
        setIsSendingImages(false);
      }
    },
    [send, pendingFiles]
  );

  const onFileChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid: File[] = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        const maxMb = Math.round(MAX_IMAGE_BYTES / 1024 / 1024);
        console.warn(`[Chat] Image too large (max ${maxMb} MB):`, f.name);
        alert(`File "${f.name}" is too large. Maximum ${maxMb} MB.`);
        continue;
      }
      valid.push(f);
    }
    setPendingFiles((prev) => [...prev, ...valid]);
    e.target.value = '';
  }, []);

  const removePending = React.useCallback((idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  React.useEffect(() => {
    ulRef.current?.scrollTo({ top: ulRef.current.scrollHeight });
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

  const busy = isSending || isSendingImages;

  return (
    <div className="lk-chat" {...props}>
      <div className="lk-chat-header">
        <span className="lk-chat-header-title">Messages</span>
      </div>
      <ul className="lk-list lk-chat-messages" ref={ulRef}>
        {chatMessages.map((msg, idx, allMsg) => {
          const hideName = idx >= 1 && allMsg[idx - 1].from === msg.from;
          const hideTimestamp =
            idx >= 1 && (msg.timestamp ?? 0) - (allMsg[idx - 1].timestamp ?? 0) < 60_000;
          return (
            <ChatEntry
              key={msg.id ?? idx}
              entry={msg}
              hideName={hideName}
              hideTimestamp={hideTimestamp}
              messageFormatter={effectiveFormatter}
            />
          );
        })}
      </ul>
      {pendingFiles.length > 0 && (
        <div
          style={{
            padding: '4px 8px',
            fontSize: 11,
            color: 'rgba(255,255,255,0.7)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
          }}
        >
          {pendingFiles.map((f, i) => (
            <span
              key={i}
              style={{
                background: 'rgba(255,255,255,0.15)',
                padding: '2px 6px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {f.name}
              <button
                type="button"
                onClick={() => removePending(i)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 12,
                }}
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <form className="lk-chat-form" onSubmit={handleSubmit}>
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
              className="lk-button"
              onClick={() => fileInputRef.current?.click()}
              title={`Attach image (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB)`}
              style={{ padding: '6px 8px' }}
              disabled={busy}
              aria-label="Attach image"
            >
              <AttachIcon />
            </button>
          </>
        )}
        <input
          ref={inputRef}
          className="lk-form-control lk-chat-form-input"
          type="text"
          placeholder="Message..."
          disabled={busy}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
        />
        <button type="submit" className="lk-button lk-chat-form-button" disabled={busy}>
          {isSendingImages ? '…' : 'Send'}
        </button>
      </form>

      {fullscreenImage &&
        ReactDOM.createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Image fullscreen"
            onClick={closeFullscreen}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 16,
            }}
          >
            <button
              type="button"
              onClick={closeFullscreen}
              aria-label="Close fullscreen"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontSize: 24,
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <img
              src={fullscreenImage}
              alt="Fullscreen"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}

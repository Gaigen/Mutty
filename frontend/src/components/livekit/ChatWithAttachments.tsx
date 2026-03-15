/**
 * Chat с поддержкой отправки картинок через DataURL в теле сообщения.
 * Полностью обходит байт-стримы (которые ненадёжны в dev-среде),
 * используя только текстовый стрим — который гарантированно работает.
 *
 * Возможности: drag&drop, Ctrl+V paste, thumbnail-превью, автоскролл,
 *              textarea, markdown-рендеринг, код-блоки с copy, collapsible.
 */
import {
  useChat,
  useMaybeLayoutContext,
  type MessageFormatter,
} from '@livekit/components-react';
import * as React from 'react';
import ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPT_IMAGES = 'image/jpeg,image/png,image/gif,image/webp';
const IMG_PREFIX = 'data:image/';
const MAX_TEXT_LEN = 2000;
const COLLAPSE_CHARS = 500;
const COLLAPSE_LINES = 8;

interface ChatWithAttachmentsProps extends React.HTMLAttributes<HTMLDivElement> {
  messageFormatter?: MessageFormatter;
  enableAttachments?: boolean;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="3.2 57.28 218.7 179.26"
      width="100%"
      height="100%"
      aria-hidden
    >
      <path d="m221.9 166.8c0 35.97-36.79 69.74-109.8 69.74-73.98 0-108.9-28.32-108.9-70.5 0-15.7 5.04-31.52 13.7-48.28-4-6.12-5.27-13.01-5.09-20.6 0.66-20.96 17.61-39.88 39.85-39.88h1.09c15.22 0 26.65 7.94 32.98 19.56 9.01-1.8 17.61-2.83 25.9-2.83 9.08 0 17.47 1.09 25.96 2.83 7.62-11.8 19.28-19.56 33.78-19.56h1.33c23.86 0 38.47 18.06 38.85 38.41 0.19 8.56-2.69 16.62-6.35 22.26 10.55 15.51 16.67 31.19 16.67 48.85z" fill="#999"/>
      <path d="m111.6 226.2c-63.7 0-101.6-24.12-108-62.91-0.15 1.58-0.4 2.68-0.4 4.31 0 39.52 33.8 68.92 107.8 68.92 72.98 0 110.9-35.1 110.9-69.41 0-1.87-0.15-3.69-0.32-5.51-5.65 36.26-42.49 64.6-110 64.6z" fill="#808080"/>
      <path d="m51.85 73.48h0.32c12.94 0 21.61 12.14 21.61 22.74v0.59c0 11.38-10.17 21-20.99 21h-2.07c-11.98 0-22.21-9.53-22.21-20.74 0-12.41 10.33-23.59 23.34-23.59z" fill="#333"/>
      <path d="m171.1 73.55h0.87c12.71 0 21.27 11.38 21.27 22.52v0.66c0 11.18-9.87 20.98-20.97 20.98h-1.7c-11.69 0-21.19-10.1-21.19-20.7 0-12.28 9.16-23.46 21.72-23.46z" fill="#333"/>
      <path d="m126.6 172.3c-1.69-1.69-4.42-1.52-5.77 0.06l-9.03 9.5-9.32-10.02c-1.92-1.83-4.31-1.38-5.5 0.29-1.16 1.63-0.86 3.88 0.48 5.1l9.56 9.89-9.74 10.24c-1.55 1.89-1.4 3.72-0.18 4.93 1.55 1.55 3.93 1.1 5.26-0.28l9.44-10.12 9.93 9.92c1.72 1.38 3.73 0.93 4.83-0.4 1.27-1.58 0.94-3.9-0.39-5.17l-9.34-9.86 9.57-9.86c1.55-1.46 1.4-3.04 0.2-4.22z" fill="#4D4D4D"/>
      <path d="m59.31 80.32-2.07 4.41-3.57 1.09c-1.05 0.52-0.85 1.17-0.06 1.55l3.23 1.34 0.99 3.36c0.59 1.24 1.85 0.75 2.26-0.34l1.61-3.61 2.82-1.09c1.2-0.56 1.14-1.62-0.06-2.04l-2.44-1.03-1.61-3.64c-0.45-0.96-0.83-0.77-1.1 0z" fill="#F9F9F9"/>
      <path d="m65.51 94.09-0.59 1.21-1.09 0.32c-0.31 0.16-0.25 0.35 0 0.45l1.02 0.45 0.38 1.09c0.22 0.45 0.73 0.26 0.89-0.19l0.59-1.35 1.02-0.38c0.45-0.23 0.42-0.65-0.03-0.81l-0.86-0.38-0.59-1.34c-0.19-0.42-0.38-0.32-0.47 0l-0.27 0.93z" fill="#F9F9F9"/>
      <path d="m180.5 80.32-1.49 4.41-4.22 1.42c-0.92 0.45-0.86 1.22 0.07 1.71l2.88 1.41 1.39 3.25c0.49 0.96 1.48 0.47 1.93-0.62l1.27-3.29 3.17-1.3c1.03-0.65 0.9-1.55-0.12-2.2l-2.2-1.27-1.33-3.52c-0.59-0.96-1.1-0.9-1.35 0z" fill="#F9F9F9"/>
      <path d="m186.4 94.62-0.52 0.9-0.8 0.32c-0.25 0.13-0.22 0.29 0 0.42l0.86 0.45 0.32 0.96c0.16 0.39 0.57 0.23 0.73-0.16l0.59-1.18 0.86-0.45c0.38-0.26 0.32-0.61-0.06-0.81l-0.8-0.38-0.51-1.18c-0.19-0.39-0.35-0.29-0.41 0.03l-0.26 1.08z" fill="#F9F9F9"/>
    </svg>
  );
}

// ── Markdown components ───────────────────────────────────────────────────────

/** Code block wrapper with a copy-to-clipboard button. */
function PreWithCopy({ children }: { children?: React.ReactNode }) {
  const preRef = React.useRef<HTMLPreElement>(null);
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    const text = preRef.current?.textContent ?? '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div className="chat-code-block-wrapper">
      <pre ref={preRef}>{children}</pre>
      <button type="button" className="chat-code-copy" onClick={copy}>
        {copied ? '✓' : 'copy'}
      </button>
    </div>
  );
}

/**
 * Renders a chat message as Markdown.
 * Long messages are collapsed with a "Show more" toggle.
 */
function MarkdownMessage({ content }: { content: string }) {
  const [expanded, setExpanded] = React.useState(false);

  const lines = content.split('\n');
  const isLong = content.length > COLLAPSE_CHARS || lines.length > COLLAPSE_LINES;

  const displayContent =
    isLong && !expanded
      ? lines.length > COLLAPSE_LINES
        ? lines.slice(0, COLLAPSE_LINES).join('\n')
        : content.slice(0, COLLAPSE_CHARS)
      : content;

  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <PreWithCopy>{children}</PreWithCopy>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {displayContent}
      </ReactMarkdown>
      {isLong && (
        <button
          type="button"
          className="chat-expand-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? '↑ Show less'
            : lines.length > COLLAPSE_LINES
            ? `↓ +${lines.length - COLLAPSE_LINES} lines`
            : `↓ +${content.length - COLLAPSE_CHARS} chars`}
        </button>
      )}
    </div>
  );
}

// ── Custom message entry ──────────────────────────────────────────────────────
// LiveKit's ChatEntry wraps message content in <span class="lk-message-body">.
// Block-level markdown elements (div, p, pre) inside a span are invalid HTML;
// browsers evict them from the span, breaking the React virtual-DOM reconciliation.
// We replicate ChatEntry's structure but use <div> for the body so markdown works.

type ChatMsg = ReturnType<typeof useChat>['chatMessages'][number];

function MessageEntry({
  msg,
  hideName,
  hideTimestamp,
  formatter,
}: {
  msg: ChatMsg;
  hideName: boolean;
  hideTimestamp: boolean;
  formatter: (m: string) => React.ReactNode;
}) {
  const isLocal = !!msg.from?.isLocal;
  const name = msg.from?.name ?? msg.from?.identity ?? '';
  const ts = new Date(msg.timestamp);
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const isEdited = !!msg.editTimestamp;
  const showMeta = !hideName || !hideTimestamp || isEdited;

  return (
    <li
      className="lk-chat-entry"
      title={ts.toLocaleTimeString(lang, { timeStyle: 'full' })}
      data-lk-message-origin={isLocal ? 'local' : 'remote'}
    >
      {showMeta && (
        <span className="lk-meta-data">
          {!hideName && <strong className="lk-participant-name">{name}</strong>}
          {(!hideTimestamp || isEdited) && (
            <span className="lk-timestamp">
              {isEdited && 'edited '}
              {ts.toLocaleTimeString(lang, { timeStyle: 'short' })}
            </span>
          )}
        </span>
      )}
      {/* div instead of span — required for block-level markdown children */}
      <div className="lk-message-body">{formatter(msg.message)}</div>
    </li>
  );
}

// ── FileThumbnail ─────────────────────────────────────────────────────────────

function FileThumbnail({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    const objUrl = URL.createObjectURL(file);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [file]);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <img
        src={url}
        alt={file.name}
        title={file.name}
        style={{
          width: 52,
          height: 52,
          objectFit: 'cover',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'block',
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        style={{
          position: 'absolute',
          top: -5,
          right: -5,
          width: 17,
          height: 17,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.8)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white',
          fontSize: 11,
          lineHeight: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ChatWithAttachments({
  messageFormatter,
  enableAttachments = true,
  ...props
}: ChatWithAttachmentsProps) {
  const ulRef = React.useRef<HTMLUListElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaHadFocusRef = React.useRef(false);

  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [isSendingImages, setIsSendingImages] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [textValue, setTextValue] = React.useState('');

  const atBottomRef = React.useRef(true);
  const [atBottom, setAtBottom] = React.useState(true);
  const [newMsgCount, setNewMsgCount] = React.useState(0);

  const layoutContext = useMaybeLayoutContext();
  const lastReadMsgAt = React.useRef(0);

  const { chatMessages, send, isSending } = useChat();
  const [fullscreenImage, setFullscreenImage] = React.useState<string | null>(null);

  const openFullscreen = React.useCallback((src: string) => setFullscreenImage(src), []);
  const closeFullscreen = React.useCallback(() => setFullscreenImage(null), []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFullscreen(); };
    if (fullscreenImage) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', onKeyDown);
      };
    }
  }, [fullscreenImage, closeFullscreen]);

  // Message formatter — renders images inline, everything else as Markdown
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
              marginTop: 4,
            }}
            aria-label="Open image fullscreen"
          >
            <img
              src={message}
              alt="Shared image"
              style={{
                maxWidth: 280,
                maxHeight: 280,
                borderRadius: 8,
                display: 'block',
                objectFit: 'contain',
              }}
            />
          </button>
        );
      }
      // Delegate to custom formatter when provided (e.g. bot commands),
      // otherwise render as full Markdown
      if (messageFormatter) return messageFormatter(message);
      return <MarkdownMessage content={message} />;
    },
    [messageFormatter, openFullscreen]
  );

  // ── File processing ──────────────────────────────────────────────────────────

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
    [addImageFiles]
  );

  const removePending = React.useCallback(
    (idx: number) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx)),
    []
  );

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  const handleDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
  }, []);

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
      addImageFiles(Array.from(e.dataTransfer.files));
    },
    [addImageFiles]
  );

  // ── Ctrl+V paste ─────────────────────────────────────────────────────────────

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
    [addImageFiles]
  );

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = textValue.trim();
      const files = [...pendingFiles];
      if (!text && files.length === 0) return;
      // Hard limit — refuse to send oversized text
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
    [send, pendingFiles, textValue]
  );

  // ── Textarea auto-resize ──────────────────────────────────────────────────────

  const adjustHeight = React.useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────────

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
      onDragEnter={enableAttachments ? handleDragEnter : undefined}
      onDragOver={enableAttachments ? handleDragOver : undefined}
      onDragLeave={enableAttachments ? handleDragLeave : undefined}
      onDrop={enableAttachments ? handleDrop : undefined}
    >
      {/* ── Drag overlay ── */}
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
      </div>

      {/* ── Messages list ── */}
      <ul className="lk-list lk-chat-messages" ref={ulRef} onScroll={handleScroll}>
        {chatMessages.map((msg, idx, allMsg) => {
          const hideName = idx >= 1 && allMsg[idx - 1].from === msg.from;
          const hideTimestamp =
            idx >= 1 && (msg.timestamp ?? 0) - (allMsg[idx - 1].timestamp ?? 0) < 60_000;
          return (
            <MessageEntry
              key={msg.id ?? idx}
              msg={msg}
              hideName={hideName}
              hideTimestamp={hideTimestamp}
              formatter={effectiveFormatter}
            />
          );
        })}
      </ul>

      {/* ── Scroll-to-bottom pill ── */}
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

      {/* ── Pending thumbnails ── */}
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

      {/* ── Input form ── */}
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
              className="lk-button"
              onClick={() => fileInputRef.current?.click()}
              title={`Attach image (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB)`}
              style={{ padding: '6px 8px', flexShrink: 0, alignSelf: 'flex-end', marginBottom: 1 }}
              disabled={busy}
              aria-label="Attach image"
            >
              <AttachIcon />
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

      {/* ── Fullscreen image viewer ── */}
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
              background: 'rgba(0,0,0,0.93)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 16,
            }}
          >
            {/* Adaptive close button: scales between 48–72px with viewport */}
            <button
              type="button"
              onClick={closeFullscreen}
              aria-label="Close fullscreen"
              style={{
                position: 'absolute',
                top: 'clamp(8px, 2vh, 20px)',
                right: 'clamp(8px, 2vw, 20px)',
                width: 'clamp(52px, 5vw, 72px)',
                height: 'clamp(44px, 4vw, 60px)',
                borderRadius: 'clamp(26px, 3vw, 36px)',
                border: 'none',
                background: 'rgba(0,0,0,0.55)',
                cursor: 'pointer',
                padding: '6px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.82)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.55)')
              }
            >
              <CloseIcon />
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
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}

import * as React from 'react';
import { AttachIcon } from './icons';
import { MAX_TEXT_LEN } from './constants';

interface ChatInputProps {
  textValue: string;
  onTextChange: (val: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  onAttachClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  busy: boolean;
  overLimit: boolean;
  nearLimit: boolean;
  enableAttachments: boolean;
  acceptImages: string;
  maxImageMB: number;
  isSendingImages: boolean;
}

export function ChatInput({
  textValue,
  onTextChange,
  onSubmit,
  onPaste,
  onAttachClick,
  onFileChange,
  fileInputRef,
  busy,
  overLimit,
  nearLimit,
  enableAttachments,
  acceptImages,
  maxImageMB,
  isSendingImages,
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [textareaHadFocus, setTextareaHadFocus] = React.useState(false);

  const adjustHeight = React.useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
  }, []);

  // Reset textarea height when textValue is cleared (e.g. after submit)
  React.useLayoutEffect(() => {
    if (textValue === '') adjustHeight();
  }, [textValue, adjustHeight]);

  // Restore focus when chat reopens
  React.useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !textareaHadFocus || ta.disabled) return;
    if (
      document.activeElement !== ta &&
      (document.activeElement === document.body || document.activeElement === document.documentElement)
    ) {
      ta.focus();
    }
  });

  return (
    <form
      className="lk-chat-form"
      onSubmit={onSubmit}
      style={{ position: 'relative', alignItems: 'flex-end' }}
    >
      {enableAttachments && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptImages}
            multiple
            onChange={onFileChange}
            style={{ display: 'none' }}
            aria-hidden
          />
          <button
            type="button"
            className="lk-button chat-attach-button"
            onClick={onAttachClick}
            title={`Attach image (max ${maxImageMB} MB)`}
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
            onTextChange(e.target.value);
            adjustHeight();
          }}
          onFocus={() => setTextareaHadFocus(true)}
          onBlur={() => setTextareaHadFocus(false)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!overLimit) onSubmit();
            }
          }}
          onKeyUp={(e) => e.stopPropagation()}
          onPaste={onPaste}
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
  );
}

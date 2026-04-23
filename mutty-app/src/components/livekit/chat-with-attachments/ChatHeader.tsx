import { CloseIcon } from './icons';

interface ChatHeaderProps {
  onClose?: () => void;
}

export function ChatHeader({ onClose }: ChatHeaderProps) {
  return (
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
  );
}

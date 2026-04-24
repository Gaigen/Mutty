/** Vertical offset of the button above the chat input bar. */
const BASE_BOTTOM_PX = 58;
/** Extra spacing applied when image attachments panel is visible. */
const ATTACHMENT_OVERLAY_PX = 62;

interface ScrollToBottomButtonProps {
  onClick: () => void;
  newMsgCount: number;
  pendingFileCount: number;
}

export function ScrollToBottomButton({ onClick, newMsgCount, pendingFileCount }: ScrollToBottomButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'absolute',
        bottom: pendingFileCount > 0 ? BASE_BOTTOM_PX + ATTACHMENT_OVERLAY_PX : BASE_BOTTOM_PX,
        right: 10,
        zIndex: 10,
        background: 'rgba(20,20,20,0.92)',
        border: '1px solid var(--mutty-border-2)',
        borderRadius: 14,
        color: 'var(--mutty-fg-1)',
        fontSize: 12,
        fontWeight: 500,
        padding: '4px 11px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        backdropFilter: 'blur(6px)',
        boxShadow: '0 2px 8px var(--mutty-burger-dropdown-shadow)',
      }}
      aria-label="Scroll to latest message"
    >
      ↓{newMsgCount > 0 && <span style={{ color: '#818cf8' }}>{newMsgCount} new</span>}
    </button>
  );
}

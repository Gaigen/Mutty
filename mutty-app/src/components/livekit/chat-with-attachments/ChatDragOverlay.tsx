interface ChatDragOverlayProps {
  isDragOver: boolean;
}

export function ChatDragOverlay({ isDragOver }: ChatDragOverlayProps) {
  if (!isDragOver) return null;

  return (
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
  );
}

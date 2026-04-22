import * as React from 'react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { useWhiteboard } from '../../hooks/useWhiteboard';

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;

type ResizeDir = 'left' | 'right' | 'bottom' | 'bottom-right' | 'bottom-left';

const ResizeHandle = ({
  style,
  onMouseDown,
}: {
  style: React.CSSProperties;
  onMouseDown: (e: React.MouseEvent) => void;
}) => (
  <div onMouseDown={onMouseDown} style={{ position: 'absolute', zIndex: 2, ...style }} />
);

export function WhiteboardFloating() {
  const { isOpen, close } = useWhiteboard();
  const [minimized, setMinimized] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);

  const [pos, setPos] = React.useState({ x: 150, y: 80 });
  const [size, setSize] = React.useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });

  const posRef = React.useRef(pos);
  const sizeRef = React.useRef(size);
  posRef.current = pos;
  sizeRef.current = size;

  // Cleanup body styles on unmount
  React.useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // Ctrl+B hotkey — toggle whiteboard
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        // Dispatch custom event so parent can handle toggle
        window.dispatchEvent(new CustomEvent('whiteboard:toggle'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Drag ──────────────────────────────────────────────
  const handleDragStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = posRef.current.x;
    const startPosY = posRef.current.y;

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      const newX = startPosX + (ev.clientX - startX);
      const newY = startPosY + (ev.clientY - startY);
      const maxX = window.innerWidth - MIN_WIDTH;
      const maxY = window.innerHeight - 40;
      setPos({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsDragging(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // ── Resize ────────────────────────────────────────────
  const handleResizeStart = React.useCallback(
    (dir: ResizeDir) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = sizeRef.current.w;
      const startH = sizeRef.current.h;
      const startPX = posRef.current.x;

      const cursors: Record<ResizeDir, string> = {
        left: 'ew-resize', right: 'ew-resize',
        bottom: 'ns-resize', 'bottom-right': 'nwse-resize', 'bottom-left': 'nesw-resize',
      };
      document.body.style.cursor = cursors[dir];
      document.body.style.userSelect = 'none';
      setIsResizing(true);

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let newW = startW;
        let newH = startH;
        let newPX = startPX;

        if (dir === 'right' || dir === 'bottom-right') newW = Math.max(MIN_WIDTH, startW + dx);
        if (dir === 'left' || dir === 'bottom-left') {
          newW = Math.max(MIN_WIDTH, startW - dx);
          newPX = startPX + (startW - newW);
        }
        if (dir === 'bottom' || dir === 'bottom-right' || dir === 'bottom-left') {
          newH = Math.max(MIN_HEIGHT, startH + dy);
        }

        setSize({ w: newW, h: newH });
        if (newPX !== startPX) setPos((prev) => ({ ...prev, x: newPX }));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsResizing(false);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [],
  );

  if (!isOpen) return null;

  const headerHeight = 36;

  return (
    <div
      className="whiteboard-floating"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: minimized ? 280 : size.w,
        height: minimized ? headerHeight : size.h,
        zIndex: 9999,
        borderRadius: 10,
        overflow: 'visible',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgb(30,30,30)',
        transition: minimized ? 'height 0.2s ease, width 0.2s ease' : undefined,
      }}
    >
      {/* Header */}
      <div
        onMouseDown={handleDragStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: 'rgb(40,40,40)',
          borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.08)',
          cursor: 'grab',
          minHeight: headerHeight,
          userSelect: 'none',
          flexShrink: 0,
          borderRadius: minimized ? 10 : '10px 10px 0 0',
        }}
      >
        <span style={{ fontSize: 13, opacity: 0.5 }}>🖌️</span>
        <div style={{
          flex: 1, minWidth: 0, fontSize: 12, opacity: 0.7, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          Whiteboard
        </div>

        <HeaderButton onClick={() => setMinimized(v => !v)} title={minimized ? 'Expand' : 'Minimize'}>
          {minimized ? '▲' : '▼'}
        </HeaderButton>
        <HeaderButton onClick={close} title="Close">✕</HeaderButton>
      </div>

      {/* Content */}
      {!minimized && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: '0 0 10px 10px' }}>
          {(isDragging || isResizing) && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'inherit' }} />
          )}

          <div
            style={{
              all: 'initial',
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'block',
              isolation: 'isolate',
            }}
          >
            <Tldraw />
          </div>

          {/* Resize handles */}
          <ResizeHandle onMouseDown={handleResizeStart('left')} style={{ top: 0, left: -3, width: 6, height: '100%', cursor: 'ew-resize' }} />
          <ResizeHandle onMouseDown={handleResizeStart('right')} style={{ top: 0, right: -3, width: 6, height: '100%', cursor: 'ew-resize' }} />
          <ResizeHandle onMouseDown={handleResizeStart('bottom')} style={{ bottom: -3, left: 0, width: '100%', height: 6, cursor: 'ns-resize' }} />
          <ResizeHandle onMouseDown={handleResizeStart('bottom-right')} style={{
            bottom: -3, right: -3, width: 16, height: 16, cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 60%, rgba(255,255,255,0.2) 60%)',
            borderRadius: '0 0 10px 0',
          }} />
          <ResizeHandle onMouseDown={handleResizeStart('bottom-left')} style={{ bottom: -3, left: -3, width: 12, height: 12, cursor: 'nesw-resize' }} />
        </div>
      )}
    </div>
  );
}

function HeaderButton({ children, onClick, title, style }: {
  children: React.ReactNode; onClick: () => void; title: string;
  style?: React.CSSProperties;
}) {
  return (
    <button type="button" onClick={onClick} title={title} style={{
      padding: '3px 6px', borderRadius: 4,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)',
      fontSize: 12, cursor: 'pointer', flexShrink: 0, lineHeight: 1,
      ...style,
    }}>
      {children}
    </button>
  );
}

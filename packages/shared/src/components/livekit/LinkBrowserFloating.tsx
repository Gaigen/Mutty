import * as React from 'react';
import { useLinkBrowser } from '../../hooks/useLinkBrowser';

const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 360;

export function LinkBrowserFloating() {
  const { state, close, openInBrowser, copyLink } = useLinkBrowser();
  const [copied, setCopied] = React.useState(false);
  const [iframeError, setIframeError] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const prevUrlRef = React.useRef<string | null>(null);

  // Position and size state
  const [pos, setPos] = React.useState({ x: 100, y: 100 });
  const [size, setSize] = React.useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
  const dragRef = React.useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeRef = React.useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  // Reset iframe error when URL changes
  React.useEffect(() => {
    if (state.url !== prevUrlRef.current) {
      setIframeError(false);
      setMinimized(false);
      prevUrlRef.current = state.url;
    }
  }, [state.url]);

  // Drag handlers
  const handleDragStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.startPosX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.startPosY + (ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos]);

  // Resize handler
  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      setSize({
        w: Math.max(MIN_WIDTH, resizeRef.current.startW + (ev.clientX - resizeRef.current.startX)),
        h: Math.max(MIN_HEIGHT, resizeRef.current.startH + (ev.clientY - resizeRef.current.startY)),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [size]);

  const handleCopy = React.useCallback(() => {
    if (!state.url) return;
    copyLink(state.url).then((ok: boolean) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    });
  }, [state.url, copyLink]);

  const handleIframeError = React.useCallback(() => {
    setIframeError(true);
  }, []);

  if (!state.isOpen || !state.url) return null;

  const displayUrl = state.url.length > 60
    ? state.url.slice(0, 57) + '...'
    : state.url;

  const headerHeight = 36;

  return (
    <div
      className="link-browser-floating"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: minimized ? 280 : size.w,
        height: minimized ? headerHeight : size.h,
        zIndex: 10000,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgb(30,30,30)',
        transition: minimized ? 'height 0.2s ease, width 0.2s ease' : undefined,
      }}
    >
      {/* Header - draggable */}
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
        }}
      >
        <span style={{ fontSize: 13, opacity: 0.5 }}>🌐</span>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11,
            opacity: 0.6,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={state.url}
        >
          {displayUrl}
        </div>

        {/* Minimize */}
        <button
          type="button"
          onClick={() => setMinimized(v => !v)}
          title={minimized ? 'Expand' : 'Minimize'}
          style={headerBtnStyle}
        >
          {minimized ? '□' : '—'}
        </button>

        {/* Open in browser */}
        <button
          type="button"
          onClick={() => openInBrowser(state.url!)}
          title="Open in browser"
          style={headerBtnStyle}
        >
          🌐
        </button>

        {/* Copy */}
        <button
          type="button"
          onClick={handleCopy}
          title="Copy link"
          style={{
            ...headerBtnStyle,
            background: copied ? 'rgba(34,197,94,0.25)' : headerBtnStyle.background,
          }}
        >
          {copied ? '✓' : '📋'}
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={close}
          title="Close"
          style={headerBtnStyle}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      {!minimized && (
        <div style={{ flex: 1, position: 'relative' }}>
          {iframeError ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 16,
                padding: 24,
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 40 }}>🚫</span>
              <div style={{ fontSize: 13, opacity: 0.6 }}>
                This site doesn't allow embedding.
              </div>
              <button
                type="button"
                onClick={() => openInBrowser(state.url!)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1f8cf9',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Open in browser →
              </button>
            </div>
          ) : (
            <iframe
              src={state.url}
              title="Link preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onError={handleIframeError}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#fff',
              }}
            />
          )}

          {/* Resize handle - bottom right */}
          <div
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 16,
              height: 16,
              cursor: 'nwse-resize',
              background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.15) 50%)',
              borderRadius: '0 0 10px 0',
            }}
          />
        </div>
      )}
    </div>
  );
}

const headerBtnStyle: React.CSSProperties = {
  padding: '3px 6px',
  borderRadius: 4,
  border: 'none',
  background: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.8)',
  fontSize: 12,
  cursor: 'pointer',
  flexShrink: 0,
  lineHeight: 1,
};

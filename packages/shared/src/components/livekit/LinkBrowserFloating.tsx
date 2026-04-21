import * as React from 'react';
import { useLinkBrowser } from '../../hooks/useLinkBrowser';

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 360;

type ResizeDir = 'right' | 'bottom' | 'bottom-right' | 'bottom-left' | 'top';

export function LinkBrowserFloating() {
  const { state, close, openInBrowser, copyLink } = useLinkBrowser();
  const [copied, setCopied] = React.useState(false);
  const [iframeError, setIframeError] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const prevUrlRef = React.useRef<string | null>(null);

  // Position and size
  const [pos, setPos] = React.useState({ x: 100, y: 100 });
  const [size, setSize] = React.useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });

  // Refs for drag/resize (avoid stale closures)
  const posRef = React.useRef(pos);
  const sizeRef = React.useRef(size);
  posRef.current = pos;
  sizeRef.current = size;

  // Reset when URL changes
  React.useEffect(() => {
    if (state.url !== prevUrlRef.current) {
      setIframeError(false);
      setMinimized(false);
      prevUrlRef.current = state.url;
    }
  }, [state.url]);

  // ── Drag ──────────────────────────────────────────────
  const handleDragStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = posRef.current.x;
    const startPosY = posRef.current.y;

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      setPos({
        x: startPosX + (ev.clientX - startX),
        y: startPosY + (ev.clientY - startY),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // ── Resize ────────────────────────────────────────────
  const handleResizeStart = React.useCallback((dir: ResizeDir) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = sizeRef.current.w;
    const startH = sizeRef.current.h;
    const startPX = posRef.current.x;
    const startPY = posRef.current.y;

    const cursors: Record<ResizeDir, string> = {
      'right': 'ew-resize',
      'bottom': 'ns-resize',
      'bottom-right': 'nwse-resize',
      'bottom-left': 'nesw-resize',
      'top': 'ns-resize',
    };
    document.body.style.cursor = cursors[dir];
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      let newW = startW;
      let newH = startH;
      let newPX = startPX;
      let newPY = startPY;

      if (dir === 'right' || dir === 'bottom-right') {
        newW = Math.max(MIN_WIDTH, startW + dx);
      }
      if (dir === 'bottom-left') {
        newW = Math.max(MIN_WIDTH, startW - dx);
        newPX = startPX + (startW - newW);
      }
      if (dir === 'bottom' || dir === 'bottom-right' || dir === 'bottom-left') {
        newH = Math.max(MIN_HEIGHT, startH + dy);
      }
      if (dir === 'top') {
        newH = Math.max(MIN_HEIGHT, startH - dy);
        newPY = startPY + (startH - newH);
      }

      setSize({ w: newW, h: newH });
      if (newPX !== startPX || newPY !== startPY) {
        setPos({ x: newPX, y: newPY });
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // ── Copy ──────────────────────────────────────────────
  const handleCopy = React.useCallback(() => {
    if (!state.url) return;
    copyLink(state.url).then((ok: boolean) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    });
  }, [state.url, copyLink]);

  // ── Iframe load check ─────────────────────────────────
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const handleIframeLoad = React.useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      // Try to access contentDocument — throws if cross-origin
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || !doc.body || doc.body.children.length === 0) {
        setIframeError(true);
      }
    } catch {
      // Cross-origin — but iframe loaded, so it's probably fine
      // (we can't inspect the content, but it rendered)
    }
  }, []);

  if (!state.isOpen || !state.url) return null;

  const displayUrl = state.url.length > 60
    ? state.url.slice(0, 57) + '...'
    : state.url;

  const headerHeight = 36;

  // Resize handle component
  const ResizeHandle = ({ dir, style }: { dir: ResizeDir; style: React.CSSProperties }) => (
    <div
      onMouseDown={handleResizeStart(dir)}
      style={{
        position: 'absolute',
        zIndex: 2,
        ...style,
      }}
    />
  );

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
        overflow: 'visible',
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
          borderRadius: '10px 10px 0 0',
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

        <HeaderButton onClick={() => setMinimized(v => !v)} title={minimized ? 'Expand' : 'Minimize'}>
          {minimized ? '□' : '—'}
        </HeaderButton>
        <HeaderButton onClick={handleCopy} title="Copy link"
          style={{ background: copied ? 'rgba(34,197,94,0.25)' : undefined }}>
          {copied ? '✓' : '📋'}
        </HeaderButton>
        <HeaderButton onClick={close} title="Close">✕</HeaderButton>
      </div>

      {/* Content */}
      {!minimized && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: '0 0 10px 10px' }}>
          {iframeError ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 16, padding: 24, textAlign: 'center',
            }}>
              <span style={{ fontSize: 40 }}>🔗</span>
              <div style={{ fontSize: 13, opacity: 0.6, maxWidth: 300 }}>
                This site doesn't allow embedding.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={handleCopy}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: copied ? '#22c55e' : 'rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 13, cursor: 'pointer',
                  }}>
                  {copied ? '✓ Copied!' : '📋 Copy link'}
                </button>
                <button type="button" onClick={() => openInBrowser(state.url!)}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: '#1f8cf9', color: '#fff', fontSize: 13, cursor: 'pointer',
                  }}>
                  Open in browser →
                </button>
              </div>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={state.url}
              title="Link preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
              onLoad={handleIframeLoad}
              style={{
                width: '100%', height: '100%', border: 'none', background: '#fff',
              }}
            />
          )}

          {/* ── Resize handles ──────────────────────── */}
          {!iframeError && !minimized && (
            <>
              {/* Right edge */}
              <ResizeHandle dir="right" style={{
                top: 0, right: -3, width: 6, height: '100%', cursor: 'ew-resize',
              }} />
              {/* Bottom edge */}
              <ResizeHandle dir="bottom" style={{
                bottom: -3, left: 0, width: '100%', height: 6, cursor: 'ns-resize',
              }} />
              {/* Bottom-right corner */}
              <ResizeHandle dir="bottom-right" style={{
                bottom: -3, right: -3, width: 16, height: 16, cursor: 'nwse-resize',
                background: 'linear-gradient(135deg, transparent 60%, rgba(255,255,255,0.2) 60%)',
                borderRadius: '0 0 10px 0',
              }} />
              {/* Bottom-left corner */}
              <ResizeHandle dir="bottom-left" style={{
                bottom: -3, left: -3, width: 12, height: 12, cursor: 'nesw-resize',
              }} />
              {/* Top edge */}
              <ResizeHandle dir="top" style={{
                top: -3, left: 0, width: '100%', height: 6, cursor: 'ns-resize',
              }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared components ───────────────────────────────────
function HeaderButton({ children, onClick, title, style }: {
  children: React.ReactNode; onClick: () => void; title: string;
  style?: React.CSSProperties;
}) {
  return (
    <button type="button" onClick={onClick} title={title} style={{
      padding: '3px 6px', borderRadius: 4, border: 'none',
      background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)',
      fontSize: 12, cursor: 'pointer', flexShrink: 0, lineHeight: 1,
      ...style,
    }}>
      {children}
    </button>
  );
}

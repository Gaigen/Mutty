import * as React from 'react';
import { useLinkBrowser } from '../../hooks/useLinkBrowser';

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 360;

type ResizeDir = 'left' | 'right' | 'bottom' | 'bottom-right' | 'bottom-left';

// ── Вынесен за пределы компонента
const ResizeHandle = ({
  style,
  onMouseDown,
}: {
  style: React.CSSProperties;
  onMouseDown: (e: React.MouseEvent) => void;
}) => (
  <div
    onMouseDown={onMouseDown}
    style={{ position: 'absolute', zIndex: 2, ...style }}
  />
);

export function LinkBrowserFloating() {
  const { state, close, copyLink } = useLinkBrowser();
  const [copied, setCopied] = React.useState(false);
  const [iframeError, setIframeError] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const prevUrlRef = React.useRef<string | null>(null);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pos, setPos] = React.useState({ x: 100, y: 100 });
  const [size, setSize] = React.useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });

  const posRef = React.useRef(pos);
  const sizeRef = React.useRef(size);
  posRef.current = pos;
  sizeRef.current = size;

  // Cleanup timers + body styles on unmount
  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // Reset on URL change
  React.useEffect(() => {
    if (state.url !== prevUrlRef.current) {
      setIframeError(false);
      setMinimized(false);
      setPos({ x: 100, y: 100 });
      setSize({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
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
        left: 'ew-resize',
        right: 'ew-resize',
        bottom: 'ns-resize',
        'bottom-right': 'nwse-resize',
        'bottom-left': 'nesw-resize',
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

        // Right-side resize
        if (dir === 'right' || dir === 'bottom-right') {
          newW = Math.max(MIN_WIDTH, startW + dx);
        }
        // Left-side resize (moves x, adjusts width inversely)
        if (dir === 'left') {
          newW = Math.max(MIN_WIDTH, startW - dx);
          newPX = startPX + (startW - newW);
        }
        // Bottom-left corner
        if (dir === 'bottom-left') {
          newW = Math.max(MIN_WIDTH, startW - dx);
          newPX = startPX + (startW - newW);
        }
        // Bottom directions
        if (dir === 'bottom' || dir === 'bottom-right' || dir === 'bottom-left') {
          newH = Math.max(MIN_HEIGHT, startH + dy);
        }

        setSize({ w: newW, h: newH });
        if (newPX !== startPX) {
          setPos((prev) => ({ ...prev, x: newPX }));
        }
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

  // ── Copy ──────────────────────────────────────────────
  const handleCopy = React.useCallback(() => {
    if (!state.url) return;
    copyLink(state.url).then((ok: boolean) => {
      if (ok) {
        setCopied(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => {
          setCopied(false);
          copyTimerRef.current = null;
        }, 1500);
      }
    });
  }, [state.url, copyLink]);

  // ── Open in browser (works in Tauri without plugin) ───
  const handleOpenInBrowser = React.useCallback((url: string) => {
    // Create a temporary <a target="_blank"> — Tauri webview handles this
    // natively by opening in the system browser, unlike window.open()
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ── Iframe load check ─────────────────────────────────
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const handleIframeLoad = React.useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        setIframeError(true);
      }
    } catch {
      // Cross-origin — iframe loaded fine, just no DOM access
    }
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
          borderRadius: minimized ? 10 : '10px 10px 0 0',
        }}
      >
        <span style={{ fontSize: 13, opacity: 0.5 }}>🌐</span>
        <div
          style={{
            flex: 1, minWidth: 0, fontSize: 11, opacity: 0.6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          title={state.url}
        >
          {displayUrl}
        </div>

        <HeaderButton onClick={() => setMinimized(v => !v)} title={minimized ? 'Развернуть' : 'Свернуть'}>
          {minimized ? '▲' : '▼'}
        </HeaderButton>
        <HeaderButton onClick={() => handleOpenInBrowser(state.url!)} title="Открыть в браузере">
          🌐
        </HeaderButton>
        <HeaderButton onClick={handleCopy} title="Скопировать"
          style={{ background: copied ? 'rgba(34,197,94,0.25)' : undefined }}>
          {copied ? '✓' : '📋'}
        </HeaderButton>
        <HeaderButton onClick={close} title="Закрыть">✕</HeaderButton>
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
                Этот сайт не разрешает встраивание.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={handleCopy}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: copied ? '#22c55e' : 'rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 13, cursor: 'pointer',
                  }}>
                  {copied ? '✓ Скопировано!' : '📋 Скопировать'}
                </button>
                <button type="button" onClick={() => handleOpenInBrowser(state.url!)}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: '#1f8cf9', color: '#fff', fontSize: 13, cursor: 'pointer',
                  }}>
                  Открыть в браузере →
                </button>
              </div>
            </div>
          ) : (
            <>
              <iframe
                ref={iframeRef}
                src={state.url}
                title="Link preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
                onLoad={handleIframeLoad}
                style={{
                  width: '100%', height: '100%', border: 'none', background: '#fff',
                  pointerEvents: isResizing ? 'none' : 'auto',
                }}
              />
              {isResizing && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 1, cursor: 'inherit' }} />
              )}
            </>
          )}

          {/* ── Resize handles (always visible, even on error) ── */}
          {!minimized && (
            <>
              {/* Left edge */}
              <ResizeHandle
                onMouseDown={handleResizeStart('left')}
                style={{ top: 0, left: -3, width: 6, height: '100%', cursor: 'ew-resize' }}
              />
              {/* Right edge */}
              <ResizeHandle
                onMouseDown={handleResizeStart('right')}
                style={{ top: 0, right: -3, width: 6, height: '100%', cursor: 'ew-resize' }}
              />
              {/* Bottom edge */}
              <ResizeHandle
                onMouseDown={handleResizeStart('bottom')}
                style={{ bottom: -3, left: 0, width: '100%', height: 6, cursor: 'ns-resize' }}
              />
              {/* Bottom-right corner */}
              <ResizeHandle
                onMouseDown={handleResizeStart('bottom-right')}
                style={{
                  bottom: -3, right: -3, width: 16, height: 16, cursor: 'nwse-resize',
                  background: 'linear-gradient(135deg, transparent 60%, rgba(255,255,255,0.2) 60%)',
                  borderRadius: '0 0 10px 0',
                }}
              />
              {/* Bottom-left corner */}
              <ResizeHandle
                onMouseDown={handleResizeStart('bottom-left')}
                style={{ bottom: -3, left: -3, width: 12, height: 12, cursor: 'nesw-resize' }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared ──────────────────────────────────────────────
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

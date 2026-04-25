// Collaborative whiteboard using tldraw + LiveKit data channel. No Yjs.

import * as React from 'react';
import {
  Tldraw,
  createTLStore,
  defaultShapeUtils,
} from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { getAssetUrls } from '@tldraw/assets/selfHosted';
import { useFloatingWindow, FloatingWindow } from '../../floating';
import { useModuleToggle } from '../../hooks';
import { useTheme } from '../../context/ThemeContext';
import { useTldrawSync } from './useTldrawSync';

export const TLDRAW_ID = 'tldraw';

// Self-hosted assets — served from /tldraw-assets/ (copied from @tldraw/assets at build time)
const assetUrls = getAssetUrls({ baseUrl: '/tldraw-assets' });

/** Error boundary to catch tldraw crashes instead of silently unmounting */
class TldrawErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[TldrawModule] Crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: '#ef4444', padding: 20, textAlign: 'center',
          flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Whiteboard crashed</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{this.state.error.message}</div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 8, padding: '4px 12px', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)',
              color: '#e2e8f0', cursor: 'pointer', fontSize: 11,
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function TldrawModule() {
  const { resolvedTheme } = useTheme();
  const win = useFloatingWindow({
    id: TLDRAW_ID,
    initialPosition: { x: 120, y: 80 },
    initialSize: { w: 900, h: 650 },
    minSize: { w: 500, h: 350 },
    title: '🎨 Whiteboard',
    isSingleton: true,
  });

  const [store] = React.useState(() =>
    createTLStore({ shapeUtils: [...defaultShapeUtils] }),
  );

  const storeWithStatus = useTldrawSync(store);

  useModuleToggle('tldraw', win.toggle);

  if (!win.isOpen) return null;

  return (
    <FloatingWindow api={win}>
      <div
        className="w-full h-full"
        style={{ position: 'relative' }}
        data-theme={resolvedTheme}
      >
        <TldrawErrorBoundary>
          <Tldraw store={storeWithStatus} assetUrls={assetUrls} />
        </TldrawErrorBoundary>
      </div>
    </FloatingWindow>
  );
}

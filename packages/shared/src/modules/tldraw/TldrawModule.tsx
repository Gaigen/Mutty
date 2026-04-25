// Collaborative whiteboard using tldraw + LiveKit data channel. No Yjs.

import * as React from 'react';
import {
  Tldraw,
  createTLStore,
  defaultShapeUtils,
} from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { useFloatingWindow, FloatingWindow } from '../../floating';
import { useModuleToggle } from '../../hooks';
import { useTheme } from '../../context/ThemeContext';
import { useTldrawSync } from './useTldrawSync';

export const TLDRAW_ID = 'tldraw';

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
        <Tldraw store={storeWithStatus} />
      </div>
    </FloatingWindow>
  );
}

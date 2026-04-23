// Collaborative whiteboard using Excalidraw + Yjs + LiveKit.

import * as React from 'react';
import * as Y from 'yjs';
import { Excalidraw } from '@excalidraw/excalidraw';
import { useFloatingWindow, FloatingWindow } from '../../floating';
import { useYjsDoc } from '../../collab/useYjsDoc';

export const WHITEBOARD_ID = 'whiteboard';

export function WhiteboardModule() {
  const win = useFloatingWindow({
    id: WHITEBOARD_ID,
    initialPosition: { x: 120, y: 80 },
    initialSize: { w: 800, h: 600 },
    minSize: { w: 400, h: 300 },
    title: '🎨 Whiteboard',
    isSingleton: true,
  });

  const doc = useYjsDoc(WHITEBOARD_ID);
  const yElements = React.useMemo(() => doc.getArray<Y.Map<any>>('elements'), [doc]);

  const excalidrawRef = React.useRef<any>(null);
  const isRemoteRef = React.useRef(false);

  // Sync Yjs → Excalidraw
  React.useEffect(() => {
    const observer = () => {
      if (isRemoteRef.current) return;
      const elements = yElements.toArray().map((ymap) => {
        const obj: Record<string, any> = {};
        ymap.forEach((val, key) => { obj[key] = val; });
        return obj;
      });
      excalidrawRef.current?.updateScene({ elements });
    };
    yElements.observe(observer);
    return () => { yElements.unobserve(observer); };
  }, [yElements]);

  // Sync Excalidraw → Yjs
  const handleChange = React.useCallback(
    (elements: readonly any[]) => {
      if (isRemoteRef.current) return;
      doc.transact(() => {
        yElements.delete(0, yElements.length);
        for (const el of elements) {
          const ymap = new Y.Map<any>();
          for (const [k, v] of Object.entries(el)) {
            ymap.set(k, v);
          }
          yElements.push([ymap]);
        }
      });
    },
    [doc, yElements]
  );

  // Toggle hotkey Ctrl+B
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        win.toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [win]);

  if (!win.isOpen) return null;

  return (
    <FloatingWindow api={win}>
      <div className="w-full h-full relative">
        <Excalidraw
          ref={excalidrawRef}
          onChange={handleChange}
          theme="dark"
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: false,
            },
          }}
        />
      </div>
    </FloatingWindow>
  );
}

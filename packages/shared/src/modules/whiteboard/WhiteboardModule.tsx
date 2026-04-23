// Collaborative whiteboard using Excalidraw + Yjs + LiveKit.

import * as React from 'react';
import * as Y from 'yjs';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useFloatingWindow, FloatingWindow } from '../../floating';
import { useYjsDoc } from '../../collab/useYjsDoc';
import { useModuleToggle } from '../../hooks';

export const WHITEBOARD_ID = 'whiteboard';

const EMPTY_INITIAL_DATA = { elements: [] };

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
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const setExcalidrawApi = React.useCallback((api: any) => {
    excalidrawRef.current = api;
  }, []);

  // Sync Yjs → Excalidraw (remote changes only)
  React.useEffect(() => {
    const observer = (_event: any, transaction: any) => {
      // Ignore our own local updates — they already exist in Excalidraw
      if (transaction?.origin === 'excalidraw-local') return;
      const elements = yElements.toArray().map((ymap) => {
        const obj: Record<string, any> = {};
        ymap.forEach((val, key) => { obj[key] = val; });
        return obj;
      });
      excalidrawRef.current?.updateScene({ elements, commitToHistory: false });
    };
    yElements.observe(observer);
    return () => { yElements.unobserve(observer); };
  }, [yElements]);

  // Sync Excalidraw → Yjs (debounced so we don't write 60fps)
  const handleChange = React.useCallback(
    (elements: readonly any[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doc.transact(() => {
          yElements.delete(0, yElements.length);
          for (const el of elements) {
            const ymap = new Y.Map<any>();
            for (const [k, v] of Object.entries(el)) {
              ymap.set(k, v);
            }
            yElements.push([ymap]);
          }
        }, 'excalidraw-local');
      }, 100);
    },
    [doc, yElements]
  );

  useModuleToggle('whiteboard', win.toggle);

  if (!win.isOpen) return null;

  return (
    <FloatingWindow api={win}>
      <div className="w-full h-full relative">
        <Excalidraw
          excalidrawAPI={setExcalidrawApi}
          initialData={EMPTY_INITIAL_DATA}
          onChange={handleChange}
          theme="dark"
          UIOptions={{
            welcomeScreen: false,
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

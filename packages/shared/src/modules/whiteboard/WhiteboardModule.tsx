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

/** Excalidraw image elements contain base64 data >65KB — too large for LiveKit data channel. Filter them out. */
function filterImages(elements: readonly any[]): any[] {
  return elements.filter((el) => el.type !== 'image');
}

/** Convert Yjs Y.Map array to plain Excalidraw elements */
function yElementsToPlain(yElements: Y.Array<Y.Map<any>>): Record<string, any>[] {
  return yElements.toArray().map((ymap) => {
    const obj: Record<string, any> = {};
    ymap.forEach((val, key) => { obj[key] = val; });
    return obj;
  });
}

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
  const lastRemoteRef = React.useRef<string>('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Serialize elements for cheap comparison
  const serializeElements = React.useCallback(
    (elements: readonly any[]) => JSON.stringify(elements.map((e) => e.id).sort()),
    []
  );

  // Load elements from Yjs into Excalidraw (initialization + remote updates)
  const loadFromYjs = React.useCallback(() => {
    const api = excalidrawRef.current;
    if (!api) return;
    const elements = filterImages(yElementsToPlain(yElements));
    const fingerprint = JSON.stringify(elements.map((e) => e.id).sort());
    if (fingerprint === lastRemoteRef.current) return; // already up to date
    lastRemoteRef.current = fingerprint;
    api.updateScene({ elements, commitToHistory: false });
  }, [yElements]);

  // Called once when Excalidraw API is ready — initialize with current Yjs state
  const setExcalidrawApi = React.useCallback(
    (api: any) => {
      excalidrawRef.current = api;
      loadFromYjs(); // load existing remote data on open
    },
    [loadFromYjs]
  );

  // Sync Yjs → Excalidraw (remote changes + initial load)
  React.useEffect(() => {
    const observer = () => {
      loadFromYjs();
    };
    yElements.observe(observer);
    return () => { yElements.unobserve(observer); };
  }, [yElements, loadFromYjs]);

  // Sync Excalidraw → Yjs (debounced so we don't write 60fps)
  const handleChange = React.useCallback(
    (elements: readonly any[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const syncable = filterImages(elements);
        const fingerprint = serializeElements(syncable);
        if (fingerprint === lastRemoteRef.current) return; // came from Yjs, don't echo
        lastRemoteRef.current = fingerprint;
        doc.transact(() => {
          yElements.delete(0, yElements.length);
          for (const el of syncable) {
            const ymap = new Y.Map<any>();
            for (const [k, v] of Object.entries(el)) {
              ymap.set(k, v);
            }
            yElements.push([ymap]);
          }
        });
      }, 150);
    },
    [doc, yElements, serializeElements]
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

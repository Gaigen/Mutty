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
const LOCAL_ORIGIN = 'wb-local';
const MAX_FILE_BASE64 = 50_000; // ~37KB binary, safe for LiveKit data channel

/** Convert Yjs Y.Map array to plain Excalidraw elements */
function yElementsToPlain(yElements: Y.Array<Y.Map<any>>): Record<string, any>[] {
  return yElements.toArray().map((ymap) => {
    const obj: Record<string, any> = {};
    ymap.forEach((val, key) => { obj[key] = val; });
    return obj;
  });
}

/** Deep clone plain JSON objects */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Deep-equal check for plain JSON values */
function valueChanged(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Compress an image dataURL so it fits into LiveKit data channel limits */
async function compressImageDataUrl(
  dataURL: string,
  maxDim: number = 1000,
  quality: number = 0.8,
  maxOutputBytes: number = MAX_FILE_BASE64
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0, width, height);

      const mime = dataURL.match(/^data:([^;]+);/)?.[1] ?? 'image/jpeg';
      const targetMime = mime === 'image/png' ? 'image/jpeg' : mime;

      const tryCompress = (q: number) => {
        const out = canvas.toDataURL(targetMime, q);
        if (out.length <= maxOutputBytes || q <= 0.3) {
          resolve(out.length <= maxOutputBytes ? out : null);
        } else {
          tryCompress(q - 0.1);
        }
      };
      tryCompress(quality);
    };
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });
}

/** Fingerprint for a single element — catches any visual change */
function elementFingerprint(el: any): string {
  return JSON.stringify([
    el.id,
    el.versionNonce,
    el.x,
    el.y,
    el.width,
    el.height,
    el.angle,
    el.strokeColor,
    el.backgroundColor,
    el.fillStyle,
    el.strokeWidth,
    el.strokeStyle,
    el.roughness,
    el.opacity,
    el.seed,
    el.text,
    el.fontSize,
    el.fontFamily,
    el.textAlign,
    el.verticalAlign,
    el.groupIds,
    el.boundElements?.map((b: any) => b.id).join(','),
    el.points,
    el.startBinding?.elementId,
    el.endBinding?.elementId,
    el.locked,
    el.isDeleted,
    el.fileId,
    el.status,
    el.scale,
  ]);
}

function fingerprint(elements: readonly any[]): string {
  return elements.map(elementFingerprint).join('\n');
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
  const yFiles = React.useMemo(() => doc.getMap<any>('files'), [doc]);

  const excalidrawRef = React.useRef<any>(null);
  const lastAppliedFp = React.useRef<string>('');   // what Excalidraw currently shows
  const lastSyncedFp = React.useRef<string>('');    // what we last wrote to Yjs
  const prevElementsRef = React.useRef<readonly any[]>([]);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isInteractingRef = React.useRef(false);
  const pendingRemoteRef = React.useRef(false);
  const compressingRef = React.useRef<Set<string>>(new Set());
  const pendingChangeRef = React.useRef<{ elements: readonly any[]; files?: Record<string, any> } | null>(null);

  // ── Core sync logic (elements + files) ─────────────────────────────────────
  const syncToYjs = React.useCallback(
    (elements: readonly any[], files?: Record<string, any>) => {
      const syncable = deepClone(elements);
      const fp = fingerprint(syncable);
      if (fp === lastSyncedFp.current) return; // already synced this state

      const prev = prevElementsRef.current;
      const prevMap = new Map(prev.map((e) => [e.id, e]));
      const nextMap = new Map(syncable.map((e) => [e.id, e]));

      doc.transact(() => {
        // 1. Remove deleted elements (iterate backwards to keep indices valid)
        for (let i = yElements.length - 1; i >= 0; i--) {
          const ymap = yElements.get(i);
          const id = ymap.get('id');
          if (!nextMap.has(id)) {
            yElements.delete(i, 1);
          }
        }

        // 2. Check if z-order changed (add / delete / reorder)
        const currentIds = Array.from({ length: yElements.length }, (_, i) =>
          yElements.get(i).get('id')
        );
        const newIds = syncable.map((e) => e.id);
        const orderChanged =
          currentIds.length !== newIds.length ||
          currentIds.some((id, i) => id !== newIds[i]);

        if (orderChanged) {
          // Full rebuild only for structural changes
          yElements.delete(0, yElements.length);
          for (const el of syncable) {
            const ymap = new Y.Map<any>();
            for (const [k, v] of Object.entries(el)) {
              ymap.set(k, v);
            }
            yElements.push([ymap]);
          }
        } else {
          // Property-level diff — update only changed fields
          for (let i = 0; i < yElements.length; i++) {
            const ymap = yElements.get(i);
            const id = ymap.get('id');
            const el = nextMap.get(id)!;
            const prevEl = prevMap.get(id);
            if (!prevEl) continue;
            for (const [k, v] of Object.entries(el)) {
              if (valueChanged(prevEl[k], v)) {
                ymap.set(k, v);
              }
            }
          }
        }
      }, LOCAL_ORIGIN);

      lastSyncedFp.current = fp;
      lastAppliedFp.current = fp; // Excalidraw already has this state
      prevElementsRef.current = syncable;

      // ── Files sync ──────────────────────────────────────────────────────
      if (files && Object.keys(files).length > 0) {
        const smallFiles: Record<string, any> = {};

        for (const [fileId, file] of Object.entries(files)) {
          if (yFiles.has(fileId)) continue;           // already synced
          if (compressingRef.current.has(fileId)) continue; // being compressed

          const base64Len = file.dataURL?.length ?? 0;
          if (base64Len > MAX_FILE_BASE64) {
            compressingRef.current.add(fileId);
            compressImageDataUrl(file.dataURL).then((compressed) => {
              compressingRef.current.delete(fileId);
              if (!compressed) {
                console.warn('[whiteboard] Image too large even after compression:', fileId);
                return;
              }
              const compressedFile = { ...file, dataURL: compressed };
              const api = excalidrawRef.current;
              if (api) {
                api.updateScene({ files: { [fileId]: compressedFile }, commitToHistory: false });
              }
              doc.transact(() => {
                yFiles.set(fileId, compressedFile);
              }, LOCAL_ORIGIN);
            });
          } else {
            smallFiles[fileId] = file;
          }
        }

        if (Object.keys(smallFiles).length > 0) {
          doc.transact(() => {
            for (const [fileId, file] of Object.entries(smallFiles)) {
              yFiles.set(fileId, file);
            }
          }, LOCAL_ORIGIN);
        }
      }
    },
    [doc, yElements, yFiles]
  );

  const syncToYjsRef = React.useRef(syncToYjs);
  syncToYjsRef.current = syncToYjs;

  // Load elements + files from Yjs into Excalidraw
  const loadFromYjs = React.useCallback(() => {
    const api = excalidrawRef.current;
    if (!api) return;

    // Flush any pending local changes BEFORE applying remote state.
    // Otherwise remote updateScene would overwrite local elements that
    // haven't been synced to Yjs yet (because of the 50ms debounce).
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingChangeRef.current) {
      syncToYjsRef.current(pendingChangeRef.current.elements, pendingChangeRef.current.files);
      pendingChangeRef.current = null;
    } else {
      // Safety: sync current scene even if onChange hasn't fired yet
      syncToYjsRef.current(api.getSceneElements());
    }

    // Now yElements already contains our flushed local + remote changes
    const elements = yElementsToPlain(yElements).map((e) => deepClone(e));
    const fp = fingerprint(elements);
    if (fp === lastAppliedFp.current) return; // already up to date
    lastAppliedFp.current = fp;

    const files: Record<string, any> = {};
    yFiles.forEach((file, id) => { files[id] = deepClone(file); });

    api.updateScene({ elements, files, commitToHistory: false });
    prevElementsRef.current = elements;
  }, [yElements, yFiles]);

  const loadFromYjsRef = React.useRef(loadFromYjs);
  loadFromYjsRef.current = loadFromYjs;

  // Called once when Excalidraw API is ready — initialize with current Yjs state
  const setExcalidrawApi = React.useCallback(
    (api: any) => {
      excalidrawRef.current = api;
      loadFromYjsRef.current(); // load existing remote data on open
    },
    []
  );

  // Sync Yjs → Excalidraw via doc update events
  React.useEffect(() => {
    const onDocUpdate = (_update: Uint8Array, origin: any) => {
      if (origin === LOCAL_ORIGIN) return; // ignore our own changes
      if (isInteractingRef.current) {
        pendingRemoteRef.current = true;
        return;
      }
      loadFromYjsRef.current();
    };
    doc.on('update', onDocUpdate);
    return () => { doc.off('update', onDocUpdate); };
  }, [doc]);

  // Buffer incoming updates while user is interacting (drag / resize / draw)
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDown = () => { isInteractingRef.current = true; };
    const onUp = () => {
      isInteractingRef.current = false;
      if (pendingRemoteRef.current) {
        pendingRemoteRef.current = false;
        loadFromYjsRef.current();
      }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onUp);
    };
  }, []);

  // Sync Excalidraw → Yjs (debounced — only fires 50ms after last onChange)
  const handleChange = React.useCallback(
    (elements: readonly any[], _appState: any, files?: Record<string, any>) => {
      pendingChangeRef.current = { elements, files };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (pendingChangeRef.current) {
          syncToYjsRef.current(pendingChangeRef.current.elements, pendingChangeRef.current.files);
          pendingChangeRef.current = null;
        }
      }, 50);
    },
    []
  );

  useModuleToggle('whiteboard', win.toggle);

  if (!win.isOpen) return null;

  return (
    <FloatingWindow api={win}>
      <div ref={containerRef} className="w-full h-full">
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

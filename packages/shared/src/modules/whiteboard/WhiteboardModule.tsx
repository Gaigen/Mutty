// Collaborative whiteboard using Excalidraw + Yjs + LiveKit.

import * as React from 'react';
import * as Y from 'yjs';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useFloatingWindow, FloatingWindow } from '../../floating';
import { useYjsDoc } from '../../collab/useYjsDoc';
import { useModuleToggle } from '../../hooks';
import { useTheme } from '../../context/ThemeContext';

export const WHITEBOARD_ID = 'whiteboard';

const EMPTY_INITIAL_DATA = { elements: [] };
const LOCAL_ORIGIN = 'wb-local';
const MAX_FILE_BASE64 = 50_000; // ~37KB binary, safe for LiveKit data channel
const DEBOUNCE_MS = 50;

/** Convert Yjs Y.Array of Y.Maps to plain Excalidraw elements */
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

      // Always target JPEG for lossy compression — canvas ignores the
      // quality parameter for PNG, so we always convert to JPEG regardless of
      // the original mime type.  This makes tryCompress actually reduce size
      // with each step instead of looping endlessly at the same byte count.
      const tryCompress = (q: number) => {
        const out = canvas.toDataURL('image/jpeg', q);
        if (out.length <= maxOutputBytes || q <= 0.3) {
          resolve(out.length <= maxOutputBytes ? out : null);
        } else {
          tryCompress(Math.round((q - 0.1) * 10) / 10); // avoid float drift
        }
      };
      tryCompress(quality);
    };
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });
}

export function WhiteboardModule() {
  const { resolvedTheme } = useTheme();
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
  const lastSyncedFp = React.useRef<string>('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isInteractingRef = React.useRef(false);
  const pendingRemoteRef = React.useRef(false);
  const compressingRef = React.useRef<Set<string>>(new Set());
  const failedFilesRef = React.useRef<Set<string>>(new Set());
  const pendingChangeRef = React.useRef<{ elements: readonly any[]; files?: Record<string, any> } | null>(null);
  const isApplyingRemoteRef = React.useRef(false);

  // Simple fingerprint — just versionNonces + ids for dedup
  const simpleFp = React.useCallback((elements: readonly any[]): string => {
    return elements.map((e) => `${e.id}:${e.versionNonce ?? 0}`).join(',');
  }, []);

  // ── Core sync: write current elements into Yjs (diff-based) ─────────────
  //
  // Instead of delete-all + push-all (which destroys CRDT convergence under
  // concurrent edits), we diff against the existing Y.Array:
  //   • update Y.Maps in-place for elements that already exist
  //   • push new Y.Maps for elements that don't
  //   • delete Y.Maps whose ids are no longer present
  // Deletions are processed back-to-front so indices stay valid.
  const syncToYjs = React.useCallback(
    (elements: readonly any[], files?: Record<string, any>) => {
      const syncable = deepClone(elements) as Record<string, any>[];
      const fp = simpleFp(syncable);
      if (fp === lastSyncedFp.current) return; // already synced this state

      doc.transact(() => {
        // Build an index of current Yjs elements by id → array position
        const existingIdx = new Map<string, number>();
        yElements.toArray().forEach((m, i) => existingIdx.set(m.get('id') as string, i));

        const incomingIds = new Set(syncable.map((e) => e.id as string));

        // Delete removed elements (back-to-front to keep indices stable)
        const toDelete = [...existingIdx.entries()]
          .filter(([id]) => !incomingIds.has(id))
          .sort((a, b) => b[1] - a[1]);
        for (const [, i] of toDelete) {
          yElements.delete(i, 1);
        }

        // Rebuild the index after deletions
        const currentIdx = new Map<string, number>();
        yElements.toArray().forEach((m, i) => currentIdx.set(m.get('id') as string, i));

        // Update existing / insert new
        for (const el of syncable) {
          const idx = currentIdx.get(el.id as string);
          if (idx === undefined) {
            // New element — append
            const ymap = new Y.Map<any>();
            for (const [k, v] of Object.entries(el)) {
              ymap.set(k, v);
            }
            yElements.push([ymap]);
          } else {
            // Existing element — update only changed fields in-place
            const ymap = yElements.get(idx);
            for (const [k, v] of Object.entries(el)) {
              if (ymap.get(k) !== v) ymap.set(k, v);
            }
            // Remove fields that no longer exist on the element
            ymap.forEach((_v, k) => {
              if (!(k in el)) ymap.delete(k);
            });
          }
        }
      }, LOCAL_ORIGIN);

      lastSyncedFp.current = fp;

      // ── Files sync ──────────────────────────────────────────────────────
      if (files && Object.keys(files).length > 0) {
        const smallFiles: Record<string, any> = {};

        for (const [fileId, file] of Object.entries(files)) {
          if (yFiles.has(fileId)) continue;                   // already synced
          if (compressingRef.current.has(fileId)) continue;   // in-flight compression
          if (failedFilesRef.current.has(fileId)) continue;   // gave up earlier

          const base64Len = file.dataURL?.length ?? 0;
          if (base64Len > MAX_FILE_BASE64) {
            compressingRef.current.add(fileId);
            compressImageDataUrl(file.dataURL).then((compressed) => {
              compressingRef.current.delete(fileId);
              if (!compressed) {
                // Mark as failed so we stop retrying on every syncToYjs call
                failedFilesRef.current.add(fileId);
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
    [doc, yElements, yFiles, simpleFp]
  );

  const syncToYjsRef = React.useRef(syncToYjs);
  syncToYjsRef.current = syncToYjs;

  // Load elements + files from Yjs into Excalidraw
  const loadFromYjs = React.useCallback(() => {
    const api = excalidrawRef.current;
    if (!api) return;

    // CRITICAL: flush any pending local change BEFORE reading Yjs.
    // Otherwise updateScene would overwrite the local stroke that
    // hasn't been synced yet (debounce is still pending).
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingChangeRef.current) {
      syncToYjsRef.current(pendingChangeRef.current.elements, pendingChangeRef.current.files);
      pendingChangeRef.current = null;
    }

    const elements = yElementsToPlain(yElements).map((e) => deepClone(e));
    const files: Record<string, any> = {};
    yFiles.forEach((file, id) => { files[id] = deepClone(file); });

    // Guard against the Yjs update event that syncToYjs (above) just
    // emitted from triggering another loadFromYjs and creating a feedback loop.
    isApplyingRemoteRef.current = true;
    try {
      api.updateScene({ elements, files, commitToHistory: false });
    } finally {
      isApplyingRemoteRef.current = false;
    }
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
      if (origin === LOCAL_ORIGIN) return;       // ignore our own writes
      if (isApplyingRemoteRef.current) return;   // ignore re-entrant events
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
      // Flush pending local change BEFORE applying buffered remote update.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (pendingChangeRef.current) {
        syncToYjsRef.current(pendingChangeRef.current.elements, pendingChangeRef.current.files);
        pendingChangeRef.current = null;
      }
      if (pendingRemoteRef.current) {
        pendingRemoteRef.current = false;
        loadFromYjsRef.current();
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onUp);
    // pointercancel fires when the browser interrupts the pointer
    // sequence (touch scroll, system gesture, stylus lifted out of range).
    // Without this handler isInteractingRef stays true forever and all
    // subsequent remote updates are buffered but never applied.
    el.addEventListener('pointercancel', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // Sync Excalidraw → Yjs (debounced diff sync)
  const handleChange = React.useCallback(
    (elements: readonly any[], _appState: any, files?: Record<string, any>) => {
      // Snapshot files shallowly so mutations by Excalidraw between
      // now and when the debounce fires don't corrupt the pending state.
      pendingChangeRef.current = {
        elements,
        files: files ? { ...files } : undefined,
      };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (pendingChangeRef.current) {
          syncToYjsRef.current(pendingChangeRef.current.elements, pendingChangeRef.current.files);
          pendingChangeRef.current = null;
        }
      }, DEBOUNCE_MS);
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
          theme={resolvedTheme}
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

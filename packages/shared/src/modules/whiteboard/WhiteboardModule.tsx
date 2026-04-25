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
const MAX_FILE_BASE64 = 50_000;
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

      const tryCompress = (q: number) => {
        const out = canvas.toDataURL('image/jpeg', q);
        if (out.length <= maxOutputBytes || q <= 0.3) {
          resolve(out.length <= maxOutputBytes ? out : null);
        } else {
          tryCompress(Math.round((q - 0.1) * 10) / 10);
        }
      };
      tryCompress(quality);
    };
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });
}

/** Validate an element before passing to Excalidraw — filter out incomplete
 *  elements that would crash the renderer (e.g. freedraw/line without points,
 *  or elements missing required geometry fields). */
function isValidElement(el: Record<string, any>): boolean {
  if (!el.id || !el.type || el.x == null || el.y == null) return false;
  if (el.type === 'freedraw' || el.type === 'line' || el.type === 'arrow') {
    if (!Array.isArray(el.points)) return false;
  }
  return true;
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
  // Track explicit deletions so they propagate without risking accidental wipes
  const yDeleted = React.useMemo(() => doc.getMap<boolean>('deleted'), [doc]);

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

  const simpleFp = React.useCallback((elements: readonly any[]): string => {
    return elements.map((e) => `${e.id}:${e.versionNonce ?? 0}`).join(',');
  }, []);

  // ── Core sync: append-only + in-place update, NEVER delete from Yjs ────
  //
  // Deleting elements from Yjs based on local Excalidraw state is unsafe:
  // the local state may be incomplete (elements still rendering, or buffered).
  // Instead, we track explicit deletions in a separate Y.Set.
  //
  // This approach:
  //   • Appends new elements (by id)
  //   • Updates existing elements in-place (changed fields only)
  //   • NEVER deletes elements from yElements
  //   • Marks user-deleted elements in yDeleted for propagation
  const syncToYjs = React.useCallback(
    (elements: readonly any[], files?: Record<string, any>) => {
      const syncable = deepClone(elements) as Record<string, any>[];
      const fp = simpleFp(syncable);
      if (fp === lastSyncedFp.current) return;

      const incomingIds = new Set(syncable.map((e) => e.id as string));

      console.log('[whiteboard] syncToYjs:', {
        incomingCount: syncable.length,
        yjsCount: yElements.length,
        deletedCount: yDeleted.size,
        isApplyingRemote: isApplyingRemoteRef.current,
      });

      doc.transact(() => {
        // Build index of existing Yjs elements by id
        const existingIdx = new Map<string, number>();
        yElements.toArray().forEach((m, i) => {
          const id = m.get('id') as string;
          if (id) existingIdx.set(id, i);
        });

        // Detect explicit deletions: elements that were in Yjs but are NOT
        // in local Excalidraw AND are not already marked deleted.
        // CRITICAL: Only do this if:
        // 1. We've synced before (not initial load)
        // 2. We're NOT currently applying a remote update (to avoid false deletions)
        if (lastSyncedFp.current && !isApplyingRemoteRef.current) {
          const toDelete: string[] = [];
          for (const [id] of existingIdx) {
            if (!incomingIds.has(id) && !yDeleted.has(id)) {
              toDelete.push(id);
              yDeleted.set(id, true);
            }
          }
          if (toDelete.length > 0) {
            console.warn('[whiteboard] Marking elements as deleted:', toDelete, 'remaining:', syncable.length);
          }
        }

        // Update existing / insert new
        for (const el of syncable) {
          const idx = existingIdx.get(el.id as string);
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
          if (yFiles.has(fileId)) continue;
          if (compressingRef.current.has(fileId)) continue;
          if (failedFilesRef.current.has(fileId)) continue;

          const base64Len = file.dataURL?.length ?? 0;
          if (base64Len > MAX_FILE_BASE64) {
            compressingRef.current.add(fileId);
            compressImageDataUrl(file.dataURL).then((compressed) => {
              compressingRef.current.delete(fileId);
              if (!compressed) {
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
    [doc, yElements, yFiles, yDeleted, simpleFp]
  );

  const syncToYjsRef = React.useRef(syncToYjs);
  syncToYjsRef.current = syncToYjs;

  // Load elements + files from Yjs into Excalidraw
  const loadFromYjs = React.useCallback(() => {
    const api = excalidrawRef.current;
    if (!api) return;

    // CRITICAL: flush any pending local change BEFORE reading Yjs.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingChangeRef.current) {
      syncToYjsRef.current(pendingChangeRef.current.elements, pendingChangeRef.current.files);
      pendingChangeRef.current = null;
    }

    // Read elements from Yjs, filter out deleted and invalid ones
    const raw = yElementsToPlain(yElements);
    const deleted = new Set<string>();
    yDeleted.forEach((_val, key) => deleted.add(key));

    const valid: Record<string, any>[] = [];
    for (const e of raw) {
      if (deleted.has(e.id)) continue;
      if (isValidElement(e)) {
        valid.push(deepClone(e));
      }
    }
    const elements = valid;

    const files: Record<string, any> = {};
    yFiles.forEach((file, id) => { files[id] = deepClone(file); });

    console.log('[whiteboard] loadFromYjs:', {
      rawCount: raw.length,
      deletedCount: deleted.size,
      validCount: elements.length,
      filesCount: Object.keys(files).length,
    });

    // Guard against the Yjs update event that syncToYjs (above) just
    // emitted from triggering another loadFromYjs and creating a feedback loop.
    isApplyingRemoteRef.current = true;
    try {
      api.updateScene({ elements, files, commitToHistory: false });
    } finally {
      isApplyingRemoteRef.current = false;
    }
  }, [yElements, yFiles, yDeleted]);

  const loadFromYjsRef = React.useRef(loadFromYjs);
  loadFromYjsRef.current = loadFromYjs;

  // Called once when Excalidraw API is ready — initialize with current Yjs state
  const setExcalidrawApi = React.useCallback(
    (api: any) => {
      excalidrawRef.current = api;
      loadFromYjsRef.current();
    },
    []
  );

  // Sync Yjs → Excalidraw via doc update events
  React.useEffect(() => {
    const onDocUpdate = (_update: Uint8Array, origin: any) => {
      if (origin === LOCAL_ORIGIN) return;
      if (isApplyingRemoteRef.current) return;
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
    el.addEventListener('pointercancel', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // Sync Excalidraw → Yjs (debounced)
  // CRITICAL: skip onChange fired by our own updateScene to prevent echo loops.
  const handleChange = React.useCallback(
    (elements: readonly any[], _appState: any, files?: Record<string, any>) => {
      // If we're applying a remote update, this onChange is an echo — ignore it.
      if (isApplyingRemoteRef.current) {
        console.log('[whiteboard] handleChange: skipped (applying remote)');
        return;
      }

      console.log('[whiteboard] handleChange:', {
        elementsCount: elements.length,
        filesCount: files ? Object.keys(files).length : 0,
      });

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

// Yjs document synced over LiveKit data channel.

import * as React from 'react';
import * as Y from 'yjs';
import { useCollab } from './CollabProvider';

export function useYjsDoc(moduleId: string): Y.Doc {
  const { sendUpdate, subscribe, sendRaw, subscribeRaw } = useCollab();
  const docRef = React.useRef<Y.Doc | null>(null);

  if (!docRef.current) {
    docRef.current = new Y.Doc();
  }
  const doc = docRef.current;

  // Send local updates to other participants
  React.useEffect(() => {
    const handler = (update: Uint8Array) => {
      sendUpdate(moduleId, update);
    };
    doc.on('update', handler);
    return () => { doc.off('update', handler); };
  }, [doc, moduleId, sendUpdate]);

  // Receive remote updates from other participants
  React.useEffect(() => {
    const unsub = subscribe(moduleId, (update) => {
      Y.applyUpdate(doc, new Uint8Array(update));
    });
    return unsub;
  }, [doc, moduleId, subscribe]);

  // ── Initial state sync protocol ──────────────────────────────────────
  //
  // LiveKit data channel has no replay — if you open the whiteboard after
  // others have drawn, you won't receive past updates. This protocol
  // implements a Yjs state-vector exchange to catch up:
  //
  // 1. New participant broadcasts a sync request with its (empty) state vector
  // 2. Existing participants compute the delta and respond
  // 3. New participant applies the delta → full state convergence
  //
  const SYNC_REQ_TOPIC = `collab:${moduleId}:sync-req`;
  const SYNC_RES_TOPIC = `collab:${moduleId}:sync-res`;
  const syncedRef = React.useRef(false);

  // Listen for sync requests from new participants — respond with our state
  React.useEffect(() => {
    const unsub = subscribeRaw(SYNC_REQ_TOPIC, (data, _from) => {
      if (doc.store.clients.size === 0) return; // nothing to share
      try {
        const theirSV = new Uint8Array(data);
        const ourState = Y.encodeStateAsUpdate(doc, theirSV);
        sendRaw(SYNC_RES_TOPIC, ourState);
      } catch (err) {
        console.warn(`[useYjsDoc:${moduleId}] Failed to respond to sync request:`, err);
      }
    });
    return unsub;
  }, [doc, moduleId, subscribeRaw, sendRaw]);

  // On mount: broadcast a sync request to catch up with existing state
  React.useEffect(() => {
    if (syncedRef.current) return;

    const timer = setTimeout(() => {
      if (syncedRef.current) return;
      // Broadcast our (empty) state vector — existing participants will respond
      // with the full state delta
      const ourSV = Y.encodeStateVector(doc);
      sendRaw(SYNC_REQ_TOPIC, ourSV);
    }, 200); // small delay to ensure subscriptions are ready

    return () => clearTimeout(timer);
  }, [doc, moduleId, sendRaw]);

  // Listen for sync responses — apply the delta to catch up
  React.useEffect(() => {
    const unsub = subscribeRaw(SYNC_RES_TOPIC, (data) => {
      if (syncedRef.current) return;
      try {
        Y.applyUpdate(doc, new Uint8Array(data));
        syncedRef.current = true;
      } catch (err) {
        console.warn(`[useYjsDoc:${moduleId}] Failed to apply sync response:`, err);
      }
    });
    return unsub;
  }, [doc, moduleId, subscribeRaw]);

  // Destroy the Y.Doc when the hook unmounts to release all internal
  // event listeners and prevent memory leaks.  This matters especially under
  // React StrictMode (double-mount) and during HMR where the component is
  // torn down and rebuilt without a full page reload.
  // We also null out docRef so a future mount creates a fresh document.
  React.useEffect(() => {
    return () => {
      doc.destroy();
      docRef.current = null;
    };
  }, [doc]);

  return doc;
}

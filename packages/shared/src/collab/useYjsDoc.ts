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
  // CRITICAL: only send updates that originated locally, not remote updates
  React.useEffect(() => {
    const handler = (update: Uint8Array, origin: any) => {
      // Skip updates that came from remote participants to prevent echo loops
      if (origin === 'remote') return;
      sendUpdate(moduleId, update);
    };
    doc.on('update', handler);
    return () => { doc.off('update', handler); };
  }, [doc, moduleId, sendUpdate]);

  // Receive remote updates from other participants
  React.useEffect(() => {
    const unsub = subscribe(moduleId, (update) => {
      // Apply with 'remote' origin to prevent re-broadcasting
      Y.applyUpdate(doc, new Uint8Array(update), 'remote');
    });
    return unsub;
  }, [doc, moduleId, subscribe]);

  // ── Initial state sync protocol ──────────────────────────────────────
  //
  // LiveKit data channel has no replay — if you open a module after
  // others have drawn, you won't receive past updates. This protocol
  // implements a Yjs state-vector exchange to catch up:
  //
  // 1. New participant broadcasts a sync request with its (empty) state vector
  // 2. Existing participants compute the delta and respond
  // 3. New participant applies ALL deltas (merges multiple responses)
  // 4. Retry if no response received within timeout
  //
  const SYNC_REQ_TOPIC = `collab:${moduleId}:sync-req`;
  const SYNC_RES_TOPIC = `collab:${moduleId}:sync-res`;
  const syncedRef = React.useRef(false);
  const syncAttemptRef = React.useRef(0);
  const MAX_SYNC_ATTEMPTS = 3;

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

  // Listen for sync responses — apply ALL deltas to catch up
  // CRITICAL: Accept multiple responses and merge them (don't stop at first)
  React.useEffect(() => {
    const unsub = subscribeRaw(SYNC_RES_TOPIC, (data) => {
      try {
        // Apply with 'remote' origin to prevent re-broadcasting
        Y.applyUpdate(doc, new Uint8Array(data), 'remote');
        // Mark as synced after receiving first response
        if (!syncedRef.current) {
          syncedRef.current = true;
          console.log(`[useYjsDoc:${moduleId}] Initial sync completed`);
        }
      } catch (err) {
        console.warn(`[useYjsDoc:${moduleId}] Failed to apply sync response:`, err);
      }
    });
    return unsub;
  }, [doc, moduleId, subscribeRaw]);

  // On mount: broadcast sync requests with retry logic
  React.useEffect(() => {
    if (syncedRef.current) return;

    const sendSyncRequest = () => {
      if (syncedRef.current) return;
      syncAttemptRef.current += 1;
      
      const ourSV = Y.encodeStateVector(doc);
      sendRaw(SYNC_REQ_TOPIC, ourSV);
      console.log(`[useYjsDoc:${moduleId}] Sync request sent (attempt ${syncAttemptRef.current})`);

      // Retry if no response within 1 second (up to MAX_SYNC_ATTEMPTS)
      if (syncAttemptRef.current < MAX_SYNC_ATTEMPTS) {
        setTimeout(() => {
          if (!syncedRef.current) {
            sendSyncRequest();
          }
        }, 1000);
      }
    };

    // Small delay to ensure subscriptions are ready
    const timer = setTimeout(sendSyncRequest, 300);
    return () => clearTimeout(timer);
  }, [doc, moduleId, sendRaw]);

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

// Sync hook — tldraw store ↔ LiveKit data channel. No Yjs.

import * as React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import type { TLRecord, TLStoreWithStatus, TLStore } from '@tldraw/tldraw';
import { useCollab } from '../../collab/CollabProvider';

// Topic WITHOUT prefix — sendRaw/subscribeRaw in CollabProvider add/strip it automatically
const SYNC_TOPIC = 'tldraw:sync';

type SyncMessage =
  | { t: 'state-request' }
  | { t: 'state-full'; records: TLRecord[] }
  | { t: 'changes'; added: TLRecord[]; updated: TLRecord[]; removed: string[] };

function encodeMsg(msg: SyncMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(msg));
}

function decodeMsg(data: Uint8Array): SyncMessage | null {
  try {
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    return null;
  }
}

/** Validate that a string looks like a tldraw record ID (type:id format) */
function isValidRecordId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 2 && id.includes(':');
}

/**
 * Syncs a tldraw store over LiveKit data channel via CollabProvider.
 *
 * Protocol:
 * 1. On mount → wait for room connection → broadcast 'state-request'
 * 2. Existing participants respond with 'state-full' (all records)
 *    - Only ONE participant responds (the first one / "host") to avoid N responses
 * 3. New participant applies full state → store.clear() + store.put()
 * 4. Ongoing: 'changes' messages with added/updated/removed records
 *
 * Echo prevention: each participant skips messages from its own identity.
 */
export function useTldrawSync(store: TLStore | null): TLStoreWithStatus {
  const room = useRoomContext();
  const { sendRaw, subscribeRaw } = useCollab();
  const localIdentity = room?.localParticipant?.identity ?? '';
  const [status, setStatus] = React.useState<TLStoreWithStatus>({
    status: 'loading',
  });
  const syncedRef = React.useRef(false);
  const isApplyingRemoteRef = React.useRef(false);

  React.useEffect(() => {
    if (!store || !room) return;

    const unsubs: (() => void)[] = [];

    // ── Receive handler ──────────────────────────────────────────────────
    const handleData = (payload: Uint8Array, from: string) => {
      if (from === localIdentity) return; // skip own messages

      const msg = decodeMsg(payload);
      if (!msg) return;

      switch (msg.t) {
        case 'state-request': {
          // Only respond if we have data AND we're the "host" (first/longest participant).
          // This prevents N participants all sending state-full simultaneously.
          const records = store.allRecords();
          if (records.length === 0) return;

          // Check if we're the participant with the lowest identity (deterministic "host")
          const remoteParticipants = room.remoteParticipants;
          const allIdentities = [
            localIdentity,
            ...Array.from(remoteParticipants.values()).map((p) => p.identity),
          ];
          const isHost = localIdentity === [...allIdentities].sort()[0];
          if (!isHost) return;

          sendRaw(SYNC_TOPIC, encodeMsg({ t: 'state-full', records }));
          break;
        }

        case 'state-full': {
          // Full state from existing participant — apply it
          if (syncedRef.current) return; // already synced
          if (!Array.isArray(msg.records)) return; // validate

          isApplyingRemoteRef.current = true;
          try {
            store.mergeRemoteChanges(() => {
              const existing = store.allRecords();
              if (existing.length > 0) {
                store.remove(existing.map((r) => r.id));
              }
              store.put(msg.records);
            });
          } finally {
            isApplyingRemoteRef.current = false;
          }
          syncedRef.current = true;
          setStatus({ store, status: 'synced-remote', connectionStatus: 'online' });
          break;
        }

        case 'changes': {
          // Incremental changes from another participant
          // Validate removed IDs before casting
          const validRemoved = (msg.removed ?? []).filter(isValidRecordId);

          isApplyingRemoteRef.current = true;
          try {
            store.mergeRemoteChanges(() => {
              if (validRemoved.length > 0) {
                store.remove(validRemoved as TLRecord['id'][]);
              }
              const toPut = [...(msg.added ?? []), ...(msg.updated ?? [])];
              if (toPut.length > 0) {
                store.put(toPut);
              }
            });
          } finally {
            isApplyingRemoteRef.current = false;
          }
          break;
        }
      }
    };

    unsubs.push(subscribeRaw(SYNC_TOPIC, handleData));

    // ── Send local changes ───────────────────────────────────────────────
    const unsubStore = store.listen(
      ({ changes }) => {
        if (isApplyingRemoteRef.current) return; // skip remote echoes

        const added = Object.values(changes.added);
        const updated = Object.values(changes.updated).map(([_, record]) => record);
        const removed = Object.values(changes.removed).map((r) => r.id);

        if (added.length === 0 && updated.length === 0 && removed.length === 0) return;

        sendRaw(SYNC_TOPIC, encodeMsg({ t: 'changes', added, updated, removed }));
      },
      { source: 'user', scope: 'document' },
    );
    unsubs.push(unsubStore);

    // ── Initial sync: broadcast state-request when connected ─────────────
    // Use RoomEvent.Connected instead of arbitrary timeout (#4)
    const requestState = () => {
      if (syncedRef.current) return;
      sendRaw(SYNC_TOPIC, encodeMsg({ t: 'state-request' }));

      // If no response in 2s, assume we're the first participant — mark as synced
      const fallbackTimer = setTimeout(() => {
        if (!syncedRef.current) {
          syncedRef.current = true;
          setStatus({ store, status: 'synced-remote', connectionStatus: 'online' });
        }
      }, 2000);
      unsubs.push(() => clearTimeout(fallbackTimer));
    };

    // If already connected, request immediately. Otherwise wait for Connected event.
    if (room.state === 'connected') {
      requestState();
    } else {
      const onConnected = () => { requestState(); };
      room.on(RoomEvent.Connected, onConnected);
      unsubs.push(() => { room.off(RoomEvent.Connected, onConnected); });
    }

    // NOTE: do NOT set status here — keep 'loading' until state-full arrives
    // or the 2s fallback timeout fires (#1 in audit)

    return () => {
      unsubs.forEach((fn) => fn());
      unsubs.length = 0;
      syncedRef.current = false;
    };
  }, [store, room, localIdentity, sendRaw, subscribeRaw]);

  return status;
}

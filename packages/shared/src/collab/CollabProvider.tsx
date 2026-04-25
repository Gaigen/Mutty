// Collab sync provider — LiveKit data channel bridge for collab modules.

import * as React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';

const COLLAB_TOPIC_PREFIX = 'collab:';

interface CollabContextValue {
  sendUpdate: (moduleId: string, update: Uint8Array) => void;
  subscribe: (moduleId: string, handler: (update: Uint8Array, from: string) => void) => () => void;
  /** Send raw bytes on an arbitrary topic (prefix added automatically) */
  sendRaw: (topic: string, data: Uint8Array) => void;
  /** Subscribe to an arbitrary topic (prefix added automatically) */
  subscribeRaw: (topic: string, handler: (data: Uint8Array, from: string) => void) => () => void;
}

const CollabCtx = React.createContext<CollabContextValue | null>(null);

export function CollabProvider({ children }: { children: React.ReactNode }) {
  const room = useRoomContext();

  // Handler map keyed by topic-without-prefix.
  // Both subscribe() and subscribeRaw() store under keys that match
  // what handleData resolves incoming topics to.
  const handlersRef = React.useRef<Map<string, Set<(update: Uint8Array, from: string) => void>>>(
    new Map()
  );

  React.useEffect(() => {
    if (!room) return;

    const handleData = (
      payload: Uint8Array,
      participant: RemoteParticipant | any,
      _kind: any,
      topic?: string,
    ) => {
      if (!topic) return;

      // All topics have the prefix stripped to get the handler key.
      // subscribe('notes', h) stores under 'notes'
      // subscribeRaw('collab:notes:sync-req', h) stores under 'notes:sync-req'
      // Wire topic 'collab:notes' → key 'notes'
      // Wire topic 'collab:notes:sync-req' → key 'notes:sync-req'
      const key = topic.startsWith(COLLAB_TOPIC_PREFIX)
        ? topic.slice(COLLAB_TOPIC_PREFIX.length)
        : topic;

      const handlers = handlersRef.current.get(key);
      if (!handlers) return;

      const from = participant?.identity ?? 'unknown';
      handlers.forEach((h) => h(payload, from));
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  const sendUpdate = React.useCallback(
    (moduleId: string, update: Uint8Array) => {
      if (!room) {
        if (process.env.NODE_ENV === 'development') console.warn('[CollabProvider] sendUpdate: room is null');
        return;
      }
      room.localParticipant.publishData(update, {
        reliable: true,
        topic: `${COLLAB_TOPIC_PREFIX}${moduleId}`,
      });
    },
    [room]
  );

  const subscribe = React.useCallback(
    (moduleId: string, handler: (update: Uint8Array, from: string) => void) => {
      let set = handlersRef.current.get(moduleId);
      if (!set) {
        set = new Set();
        handlersRef.current.set(moduleId, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
        if (set?.size === 0) handlersRef.current.delete(moduleId);
      };
    },
    []
  );

  // sendRaw sends on the wire with the COLLAB_TOPIC_PREFIX prepended.
  // subscribeRaw registers under the key WITHOUT the prefix (matching handleData resolution).
  // Example: sendRaw('notes:sync-req', data) → wire topic 'collab:notes:sync-req'
  //          subscribeRaw('notes:sync-req', h) → key 'notes:sync-req'
  //          incoming 'collab:notes:sync-req' → handleData strips prefix → key 'notes:sync-req' ✓
  const sendRaw = React.useCallback(
    (topic: string, data: Uint8Array) => {
      if (!room) {
        if (process.env.NODE_ENV === 'development') console.warn('[CollabProvider] sendRaw: room is null');
        return;
      }
      // Always add prefix — the handler side always strips it
      const wireTopic = topic.startsWith(COLLAB_TOPIC_PREFIX)
        ? topic
        : `${COLLAB_TOPIC_PREFIX}${topic}`;
      room.localParticipant.publishData(data, { reliable: true, topic: wireTopic });
    },
    [room]
  );

  const subscribeRaw = React.useCallback(
    (topic: string, handler: (data: Uint8Array, from: string) => void) => {
      // Store under the key WITHOUT prefix — matches what handleData resolves to
      const key = topic.startsWith(COLLAB_TOPIC_PREFIX)
        ? topic.slice(COLLAB_TOPIC_PREFIX.length)
        : topic;
      let set = handlersRef.current.get(key);
      if (!set) {
        set = new Set();
        handlersRef.current.set(key, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
        if (set?.size === 0) handlersRef.current.delete(key);
      };
    },
    []
  );

  const value = React.useMemo(
    () => ({ sendUpdate, subscribe, sendRaw, subscribeRaw }),
    [sendUpdate, subscribe, sendRaw, subscribeRaw]
  );

  return <CollabCtx.Provider value={value}>{children}</CollabCtx.Provider>;
}

export function useCollab() {
  const ctx = React.useContext(CollabCtx);
  if (!ctx) throw new Error('useCollab must be inside CollabProvider');
  return ctx;
}

// Collab sync provider — Yjs + LiveKit data channel bridge.

import * as React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

const COLLAB_TOPIC_PREFIX = 'collab:';

interface CollabContextValue {
  sendUpdate: (moduleId: string, update: Uint8Array) => void;
  subscribe: (moduleId: string, handler: (update: Uint8Array, from: string) => void) => () => void;
  /** Send raw bytes on an arbitrary topic (topic used as-is, no prefix added) */
  sendRaw: (topic: string, data: Uint8Array) => void;
  /** Subscribe to an arbitrary topic (topic used as-is, no prefix added) */
  subscribeRaw: (topic: string, handler: (data: Uint8Array, from: string) => void) => () => void;
}

const CollabCtx = React.createContext<CollabContextValue | null>(null);

export function CollabProvider({ children }: { children: React.ReactNode }) {
  const room = useRoomContext();

  // Single handler map for both prefixed (collab:moduleId) and raw topics.
  // The key is always the full topic string so lookups are O(1) in both cases.
  const handlersRef = React.useRef<Map<string, Set<(update: Uint8Array, from: string) => void>>>(
    new Map()
  );

  React.useEffect(() => {
    if (!room) return;

    const handleData = (
      payload: Uint8Array,
      participant: any,
      _kind: any,
      topic?: string,
    ) => {
      if (!topic) return;

      // Prefixed topics (collab:moduleId) are stored under the moduleId key
      // for backwards-compat with existing subscribe() callers.
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
      if (!room) return;
      room.localParticipant.publishData(update, {
        reliable: true,
        topic: `${COLLAB_TOPIC_PREFIX}${moduleId}`,
      });
    },
    [room]
  );

  // subscribe() stores the handler under moduleId (without prefix) — matches
  // what handleData resolves prefixed topics to above.
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

  // sendRaw / subscribeRaw use the topic string verbatim — needed for the
  // Yjs sync protocol which uses topics like "collab:whiteboard:sync-req"
  // that must not get the prefix stripped (they don't match COLLAB_TOPIC_PREFIX
  // after the slice because they contain a second colon segment).
  const sendRaw = React.useCallback(
    (topic: string, data: Uint8Array) => {
      if (!room) return;
      room.localParticipant.publishData(data, { reliable: true, topic });
    },
    [room]
  );

  const subscribeRaw = React.useCallback(
    (topic: string, handler: (data: Uint8Array, from: string) => void) => {
      let set = handlersRef.current.get(topic);
      if (!set) {
        set = new Set();
        handlersRef.current.set(topic, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
        if (set?.size === 0) handlersRef.current.delete(topic);
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

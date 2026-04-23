// Collab sync provider — Yjs + LiveKit data channel bridge.

import * as React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

const COLLAB_TOPIC_PREFIX = 'collab:';

interface CollabContextValue {
  sendUpdate: (moduleId: string, update: Uint8Array) => void;
  subscribe: (moduleId: string, handler: (update: Uint8Array, from: string) => void) => () => void;
}

const CollabCtx = React.createContext<CollabContextValue | null>(null);

export function CollabProvider({ children }: { children: React.ReactNode }) {
  const room = useRoomContext();
  const handlersRef = React.useRef<Map<string, Set<(update: Uint8Array, from: string) => void>>>(new Map());

  React.useEffect(() => {
    if (!room) return;

    const handleData = (
      payload: Uint8Array,
      participant: any,
      _kind: any,
      topic?: string,
    ) => {
      if (!topic?.startsWith(COLLAB_TOPIC_PREFIX)) return;
      const moduleId = topic.slice(COLLAB_TOPIC_PREFIX.length);
      const handlers = handlersRef.current.get(moduleId);
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

  const value = React.useMemo(() => ({ sendUpdate, subscribe }), [sendUpdate, subscribe]);

  return <CollabCtx.Provider value={value}>{children}</CollabCtx.Provider>;
}

export function useCollab() {
  const ctx = React.useContext(CollabCtx);
  if (!ctx) throw new Error('useCollab must be inside CollabProvider');
  return ctx;
}

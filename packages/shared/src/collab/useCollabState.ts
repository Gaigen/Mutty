// Generic collab state hook — JSON actions over LiveKit (lightweight CRDT).

import * as React from 'react';
import { useCollab } from './CollabProvider';

export interface CollabAction<T = unknown> {
  type: string;
  payload: T;
  ts: number;
  author: string;
}

export function useCollabState<S, A extends CollabAction>(
  moduleId: string,
  reducer: (state: S, action: A) => S,
  initialState: S,
): [S, (action: Omit<A, 'ts' | 'author'>) => void] {
  const { sendUpdate, subscribe } = useCollab();
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const author = React.useMemo(() => `user-${Math.random().toString(36).slice(2, 8)}`, []);

  // Apply incoming actions
  React.useEffect(() => {
    const unsub = subscribe(moduleId, (payload) => {
      try {
        const action = JSON.parse(new TextDecoder().decode(payload)) as A;
        dispatch(action);
      } catch {
        // ignore malformed
      }
    });
    return unsub;
  }, [moduleId, subscribe]);

  // Broadcast local actions
  const broadcast = React.useCallback(
    (action: Omit<A, 'ts' | 'author'>) => {
      const full = { ...action, ts: Date.now(), author } as A;
      dispatch(full);
      const data = new TextEncoder().encode(JSON.stringify(full));
      sendUpdate(moduleId, data);
    },
    [moduleId, author, sendUpdate]
  );

  return [state, broadcast];
}

import { useSyncExternalStore } from 'react';

type Listener = () => void;

let hidden = new Set<string>();
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return hidden;
}

export function hiddenTrackKey(participantIdentity: string, source: string): string {
  return `${participantIdentity}::${source}`;
}

export function toggleHiddenTrack(key: string) {
  const next = new Set(hidden);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  hidden = next;
  notify();
}

export function useHiddenTracks() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

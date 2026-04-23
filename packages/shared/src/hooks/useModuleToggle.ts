import { useEffect, useRef } from 'react';

const DEFAULT_HOTKEYS = {
  whiteboard: 'ctrl+b',
  notes: 'ctrl+m',
} as const;

/** Detect Tauri desktop environment */
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

/** Minimum ms between toggles to prevent double-fires */
const TOGGLE_DEBOUNCE_MS = 300;

function matchHotkey(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  const key = parts.pop() ?? '';

  const needsCtrl = parts.includes('ctrl') || parts.includes('control');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt') || parts.includes('option');
  const needsMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command');

  if (needsCtrl !== e.ctrlKey) return false;
  if (needsShift !== e.shiftKey) return false;
  if (needsAlt !== e.altKey) return false;
  if (needsMeta !== e.metaKey) return false;

  const eventKey = e.key.toLowerCase();
  const eventCode = e.code.toLowerCase();
  return eventKey === key || eventCode === `key${key}` || eventCode === `digit${key}` || eventCode === key;
}

/**
 * Hook that toggles a floating module via hardcoded hotkey in web,
 * or via dispatched custom events in desktop.
 *
 * @param id - module id ('whiteboard' | 'notes')
 * @param toggle - function to call when hotkey fires
 */
export function useModuleToggle(id: keyof typeof DEFAULT_HOTKEYS, toggle: () => void) {
  const lastToggleRef = useRef(0);

  const safeToggle = useRef(() => {
    const now = Date.now();
    if (now - lastToggleRef.current > TOGGLE_DEBOUNCE_MS) {
      lastToggleRef.current = now;
      toggle();
    }
  });
  safeToggle.current = () => {
    const now = Date.now();
    if (now - lastToggleRef.current > TOGGLE_DEBOUNCE_MS) {
      lastToggleRef.current = now;
      toggle();
    }
  };

  // 1. Web fallback: hardcoded keydown listener (skipped in Tauri desktop — global shortcuts handled by Rust)
  useEffect(() => {
    if (isTauri) return;
    const combo = DEFAULT_HOTKEYS[id];
    const handler = (e: KeyboardEvent) => {
      if (matchHotkey(e, combo)) {
        e.preventDefault();
        e.stopPropagation();
        safeToggle.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [id, toggle]);

  // 2. Desktop global hotkey bridge: listen for custom events dispatched by HotkeyListener
  useEffect(() => {
    const eventName = `toggle-${id}`;
    const handler = () => safeToggle.current();
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [id, toggle]);
}

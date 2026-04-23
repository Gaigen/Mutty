// Configurable hotkeys for floating modules (whiteboard, notes, etc).
// Stored in localStorage so they persist across sessions.

import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '../config';

export interface ModuleHotkeySettings {
  toggleWhiteboard: string;
  toggleNotes: string;
}

export const DEFAULT_MODULE_HOTKEYS: ModuleHotkeySettings = {
  toggleWhiteboard: 'Ctrl+b',
  toggleNotes: 'Ctrl+n',
};

const STORAGE_KEY = LS_KEYS.hotkeySettings;

function loadSettings(): ModuleHotkeySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_MODULE_HOTKEYS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_MODULE_HOTKEYS };
}

function saveSettings(settings: ModuleHotkeySettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/**
 * Hook for module hotkey settings.
 *
 * Usage:
 *   const { settings, setHotkey, matchHotkey } = useModuleHotkeys();
 *
 *   useEffect(() => {
 *     const handler = (e: KeyboardEvent) => {
 *       if (matchHotkey(e, settings.toggleWhiteboard)) win.toggle();
 *     };
 *     window.addEventListener('keydown', handler);
 *     return () => window.removeEventListener('keydown', handler);
 *   }, [settings.toggleWhiteboard]);
 */
export function useModuleHotkeys() {
  const [settings, setSettingsState] = useState<ModuleHotkeySettings>(loadSettings);

  const setHotkey = useCallback(
    (key: keyof ModuleHotkeySettings, combo: string) => {
      const next = { ...settings, [key]: combo.trim().toLowerCase() };
      setSettingsState(next);
      saveSettings(next);
    },
    [settings]
  );

  const resetToDefaults = useCallback(() => {
    setSettingsState({ ...DEFAULT_MODULE_HOTKEYS });
    saveSettings({ ...DEFAULT_MODULE_HOTKEYS });
  }, []);

  return { settings, setHotkey, resetToDefaults };
}

/**
 * Check if a KeyboardEvent matches a hotkey combo string like "ctrl+b" or "ctrl+shift+n".
 */
export function matchHotkey(e: KeyboardEvent, combo: string): boolean {
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

  // Support both "b" and "keyb" forms
  const eventKey = e.key.toLowerCase();
  const eventCode = e.code.toLowerCase();
  return eventKey === key || eventCode === `key${key}` || eventCode === `digit${key}` || eventCode === key;
}

/** One-shot check without hook state (for use inside modules). */
export function getModuleHotkeys(): ModuleHotkeySettings {
  return loadSettings();
}

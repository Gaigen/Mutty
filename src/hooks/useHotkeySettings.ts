import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '../config';

export interface HotkeySettings {
  toggleMicrophone: string;
  toggleFullMute: string;
}

export const DEFAULT_HOTKEYS: HotkeySettings = {
  toggleMicrophone: 'Ctrl+KeyM',
  toggleFullMute: 'Ctrl+KeyF',
};

function loadSettings(): HotkeySettings {
  try {
    const stored = localStorage.getItem(LS_KEYS.hotkeySettings);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<HotkeySettings>;
      return { ...DEFAULT_HOTKEYS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load hotkey settings from localStorage:', e);
  }
  return { ...DEFAULT_HOTKEYS };
}

function saveSettings(settings: HotkeySettings) {
  try {
    localStorage.setItem(LS_KEYS.hotkeySettings, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save hotkey settings to localStorage:', e);
  }
}

let currentSettings: HotkeySettings = loadSettings();
const listeners = new Set<(settings: HotkeySettings) => void>();

export function useHotkeySettings() {
  const [settings, setSettingsState] = useState<HotkeySettings>(currentSettings);

  useEffect(() => {
    const listener = (s: HotkeySettings) => setSettingsState(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setSettings = useCallback(async (newSettings: Partial<HotkeySettings>) => {
    currentSettings = { ...currentSettings, ...newSettings };
    setSettingsState(currentSettings);
    saveSettings(currentSettings);
    listeners.forEach((listener) => listener(currentSettings));
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_global_hotkeys', {
        micHotkey: currentSettings.toggleMicrophone,
        fullMuteHotkey: currentSettings.toggleFullMute,
      });
    } catch {
      // Tauri not available (dev mode in browser), ignore
    }
  }, []);

  return { settings, setSettings };
}

export function getHotkeySettings(): HotkeySettings {
  return currentSettings;
}

import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '@shared/config';
import { usePlatform } from '@shared/platform';
import type { StorageAdapter } from '@shared/platform/storage';

export interface HotkeySettings {
  toggleMicrophone: string;
  toggleFullMute: string;
  toggleWhiteboard: string;
  toggleNotes: string;
}

export const DEFAULT_HOTKEYS: HotkeySettings = {
  toggleMicrophone: 'Ctrl+KeyM',
  toggleFullMute: 'Ctrl+KeyF',
  toggleWhiteboard: 'Ctrl+KeyB',
  toggleNotes: 'Ctrl+KeyN',
};

async function loadSettings(storage: StorageAdapter): Promise<HotkeySettings> {
  try {
    const stored = await storage.getAsync<Partial<HotkeySettings>>(LS_KEYS.hotkeySettings);
    if (stored) return { ...DEFAULT_HOTKEYS, ...stored };
  } catch (e) {
    console.warn('Failed to load hotkey settings from store:', e);
  }
  return { ...DEFAULT_HOTKEYS };
}

function saveSettings(storage: StorageAdapter, settings: HotkeySettings) {
  try {
    storage.set(LS_KEYS.hotkeySettings, settings);
  } catch (e) {
    console.warn('Failed to save hotkey settings to store:', e);
  }
}

let currentSettings: HotkeySettings = { ...DEFAULT_HOTKEYS };
const listeners = new Set<(settings: HotkeySettings) => void>();

export function useHotkeySettings() {
  const { storage } = usePlatform();
  const [settings, setSettingsState] = useState<HotkeySettings>(currentSettings);

    useEffect(() => {
    loadSettings(storage).then((s) => {
      currentSettings = s;
      setSettingsState(s);
      // Sync loaded hotkeys to Rust poller
      try {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('update_global_hotkeys', {
            micHotkey: s.toggleMicrophone,
            fullMuteHotkey: s.toggleFullMute,
            whiteboardHotkey: s.toggleWhiteboard,
            notesHotkey: s.toggleNotes,
          });
        });
      } catch {
        // Tauri not available, ignore
      }
    });
  }, [storage]);

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
    saveSettings(storage, currentSettings);
    listeners.forEach((listener) => listener(currentSettings));
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_global_hotkeys', {
        micHotkey: currentSettings.toggleMicrophone,
        fullMuteHotkey: currentSettings.toggleFullMute,
        whiteboardHotkey: currentSettings.toggleWhiteboard,
        notesHotkey: currentSettings.toggleNotes,
      });
    } catch {
      // Tauri not available (dev mode in browser), ignore
    }
  }, [storage]);

  return { settings, setSettings };
}

export function getHotkeySettings(): HotkeySettings {
  return currentSettings;
}

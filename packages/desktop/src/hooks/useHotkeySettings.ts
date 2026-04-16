import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '@shared/config';
import { usePlatform } from '@shared/platform';

export interface HotkeySettings {
  toggleMicrophone: string;
  toggleFullMute: string;
}

export const DEFAULT_HOTKEYS: HotkeySettings = {
  toggleMicrophone: 'Ctrl+KeyM',
  toggleFullMute: 'Ctrl+KeyF',
};

let currentSettings: HotkeySettings = { ...DEFAULT_HOTKEYS };
const listeners = new Set<(settings: HotkeySettings) => void>();

export function useHotkeySettings() {
  const { storage } = usePlatform();
  const [settings, setSettingsState] = useState<HotkeySettings>(currentSettings);

  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getAsync<Partial<HotkeySettings>>(LS_KEYS.hotkeySettings);
        if (stored) {
          currentSettings = { ...DEFAULT_HOTKEYS, ...stored };
        }
      } catch (e) {
        console.warn('Failed to load hotkey settings from store:', e);
      }
      setSettingsState(currentSettings);
      // Sync loaded hotkeys to Rust poller
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        invoke('update_global_hotkeys', {
          micHotkey: currentSettings.toggleMicrophone,
          fullMuteHotkey: currentSettings.toggleFullMute,
        });
      } catch {
        // Tauri not available, ignore
      }
    })();
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
    storage.set(LS_KEYS.hotkeySettings, currentSettings);
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
  }, [storage]);

  return { settings, setSettings };
}

export function getHotkeySettings(): HotkeySettings {
  return currentSettings;
}

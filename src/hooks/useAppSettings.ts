import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '../config';
import { storeGet, storeSet } from '../lib/store';

export interface AppSettings {
  minimizeToTray: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  minimizeToTray: true,
};

async function loadSettings(): Promise<AppSettings> {
  try {
    const stored = await storeGet<Partial<AppSettings>>(LS_KEYS.appSettings);
    if (stored) return { ...DEFAULT_SETTINGS, ...stored };
  } catch (e) {
    console.warn('Failed to load app settings from store:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(settings: AppSettings) {
  try {
    await storeSet(LS_KEYS.appSettings, settings);
  } catch (e) {
    console.warn('Failed to save app settings to store:', e);
  }
}

async function syncMinimizeToTray(enabled: boolean) {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_minimize_to_tray', { enabled });
  } catch {
    // Tauri not available (dev mode in browser), ignore
  }
}

async function loadMinimizeToTrayFromTauri(): Promise<boolean | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<boolean>('get_minimize_to_tray');
  } catch {
    return null;
  }
}

let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(settings: AppSettings) => void>();

export function useAppSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(currentSettings);

  useEffect(() => {
    loadSettings().then((s) => {
      currentSettings = s;
      setSettingsState(s);
      loadMinimizeToTrayFromTauri().then((val) => {
        if (val !== null) {
          currentSettings = { ...currentSettings, minimizeToTray: val };
          setSettingsState(currentSettings);
          saveSettings(currentSettings);
          listeners.forEach((listener) => listener(currentSettings));
        }
      });
    });
  }, []);

  useEffect(() => {
    const listener = (s: AppSettings) => setSettingsState(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    currentSettings = { ...currentSettings, ...newSettings };
    setSettingsState(currentSettings);
    saveSettings(currentSettings);
    listeners.forEach((listener) => listener(currentSettings));
    if (newSettings.minimizeToTray !== undefined) {
      await syncMinimizeToTray(newSettings.minimizeToTray);
    }
  }, []);

  return { settings, setSettings };
}

import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '../config';

export interface AppSettings {
  minimizeToTray: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  minimizeToTray: true,
};

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(LS_KEYS.appSettings);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load app settings from localStorage:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(LS_KEYS.appSettings, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save app settings to localStorage:', e);
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

let currentSettings: AppSettings = loadSettings();
const listeners = new Set<(settings: AppSettings) => void>();

export function useAppSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(currentSettings);

  useEffect(() => {
    loadMinimizeToTrayFromTauri().then((val) => {
      if (val !== null) {
        currentSettings = { ...currentSettings, minimizeToTray: val };
        setSettingsState(currentSettings);
        saveSettings(currentSettings);
        listeners.forEach((listener) => listener(currentSettings));
      }
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

import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '../config';
import { storeGet, storeSet } from '../lib/store';

export interface AppSettings {
  minimizeToTray: boolean;
  autostart: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  minimizeToTray: true,
  autostart: false,
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

async function syncAutostart(enabled: boolean) {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    if (enabled) {
      await invoke('plugin:autostart|enable');
    } else {
      await invoke('plugin:autostart|disable');
    }
  } catch {
    // Tauri not available (dev mode in browser), ignore
  }
}

async function loadAutostartFromTauri(): Promise<boolean | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<boolean>('plugin:autostart|is_enabled');
  } catch {
    return null;
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
      Promise.all([
        loadMinimizeToTrayFromTauri(),
        loadAutostartFromTauri(),
      ]).then(([trayVal, autoVal]) => {
        let changed = false;
        if (trayVal !== null) {
          currentSettings = { ...currentSettings, minimizeToTray: trayVal };
          changed = true;
        }
        if (autoVal !== null) {
          currentSettings = { ...currentSettings, autostart: autoVal };
          changed = true;
        }
        if (changed) {
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
    if (newSettings.autostart !== undefined) {
      await syncAutostart(newSettings.autostart);
    }
  }, []);

  return { settings, setSettings };
}

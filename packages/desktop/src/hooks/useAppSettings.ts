import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '@shared/config';
import { usePlatform } from '@shared/platform';

export interface AppSettings {
  minimizeToTray: boolean;
  autostart: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  minimizeToTray: true,
  autostart: false,
};

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

let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(settings: AppSettings) => void>();

export function useAppSettings() {
  const { storage } = usePlatform();
  const [settings, setSettingsState] = useState<AppSettings>(currentSettings);

  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getAsync<Partial<AppSettings>>(LS_KEYS.appSettings);
        if (stored) {
          currentSettings = { ...DEFAULT_SETTINGS, ...stored };
        }
      } catch (e) {
        console.warn('Failed to load app settings from store:', e);
      }
      setSettingsState(currentSettings);
      // Sync loaded values to Tauri/Rust state
      syncMinimizeToTray(currentSettings.minimizeToTray);
      const autoVal = await loadAutostartFromTauri();
      if (autoVal !== null) {
        currentSettings = { ...currentSettings, autostart: autoVal };
        setSettingsState(currentSettings);
        storage.set(LS_KEYS.appSettings, currentSettings);
        listeners.forEach((listener) => listener(currentSettings));
      }
    })();
  }, [storage]);

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
    storage.set(LS_KEYS.appSettings, currentSettings);
    listeners.forEach((listener) => listener(currentSettings));
    if (newSettings.minimizeToTray !== undefined) {
      await syncMinimizeToTray(newSettings.minimizeToTray);
    }
    if (newSettings.autostart !== undefined) {
      await syncAutostart(newSettings.autostart);
    }
  }, [storage]);

  return { settings, setSettings };
}

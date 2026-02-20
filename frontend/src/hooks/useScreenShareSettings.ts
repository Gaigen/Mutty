import { useState, useCallback } from 'react';

export interface ScreenShareSettings {
  resolution: {
    width: number;
    height: number;
  };
  frameRate: number;
}

const DEFAULT_SETTINGS: ScreenShareSettings = {
  resolution: { width: 1280, height: 720 },
  frameRate: 60,
};

const STORAGE_KEY = 'voice-app:screen-share-settings';

function loadSettings(): ScreenShareSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ScreenShareSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load screen share settings from localStorage:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: ScreenShareSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save screen share settings to localStorage:', e);
  }
}

// Глобальное состояние для настроек screen share (можно заменить на контекст если нужно)
let currentSettings: ScreenShareSettings = loadSettings();
const listeners = new Set<(settings: ScreenShareSettings) => void>();

export function useScreenShareSettings() {
  const [settings, setSettingsState] = useState<ScreenShareSettings>(currentSettings);

  const setSettings = useCallback((newSettings: Partial<ScreenShareSettings>) => {
    // Если передан полный объект с resolution, полностью заменяем resolution
    if (newSettings.resolution && typeof newSettings.resolution === 'object') {
      currentSettings = {
        ...currentSettings,
        ...newSettings,
        resolution: { ...newSettings.resolution }, // Полностью заменяем resolution
      };
    } else {
      currentSettings = { ...currentSettings, ...newSettings };
    }
    setSettingsState(currentSettings);
    saveSettings(currentSettings);
    listeners.forEach((listener) => listener(currentSettings));
  }, []);

  return { settings, setSettings };
}

export function getScreenShareSettings(): ScreenShareSettings {
  return currentSettings;
}


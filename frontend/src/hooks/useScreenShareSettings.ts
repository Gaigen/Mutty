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

// Глобальное состояние для настроек screen share (можно заменить на контекст если нужно)
let currentSettings: ScreenShareSettings = DEFAULT_SETTINGS;
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
    listeners.forEach((listener) => listener(currentSettings));
  }, []);

  return { settings, setSettings };
}

export function getScreenShareSettings(): ScreenShareSettings {
  return currentSettings;
}


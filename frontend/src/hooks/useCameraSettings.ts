import { useState, useCallback, useEffect } from 'react';
import { LS_KEYS } from '../config';
import type { VideoCodec } from './useScreenShareSettings';

export interface CameraSettings {
  videoCodec: VideoCodec;
  maxBitrate: number;   // bps
  maxFramerate: number;
  width: number;
  height: number;
}

const DEFAULT_SETTINGS: CameraSettings = {
  videoCodec: 'av1',
  maxBitrate: 2_500_000,
  maxFramerate: 60,
  width: 1280,
  height: 720,
};

function loadSettings(): CameraSettings {
  try {
    const stored = localStorage.getItem(LS_KEYS.cameraSettings);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as Partial<CameraSettings>) };
    }
  } catch (e) {
    console.warn('Failed to load camera settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: CameraSettings) {
  try { localStorage.setItem(LS_KEYS.cameraSettings, JSON.stringify(s)); }
  catch (e) { console.warn('Failed to save camera settings:', e); }
}

let currentSettings: CameraSettings = loadSettings();
const listeners = new Set<(s: CameraSettings) => void>();

export function useCameraSettings() {
  const [settings, setSettingsState] = useState<CameraSettings>(currentSettings);

  useEffect(() => {
    const listener = (s: CameraSettings) => setSettingsState(s);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const setSettings = useCallback((newSettings: Partial<CameraSettings>) => {
    currentSettings = { ...currentSettings, ...newSettings };
    setSettingsState(currentSettings);
    saveSettings(currentSettings);
    listeners.forEach((l) => l(currentSettings));
  }, []);

  return { settings, setSettings };
}

export function getCameraSettings(): CameraSettings {
  return currentSettings;
}

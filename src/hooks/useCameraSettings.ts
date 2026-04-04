import { useState, useCallback, useEffect } from 'react';
import { LS_KEYS } from '../config';
import { storeGet, storeSet } from '../lib/store';
import type { VideoCodec } from './useScreenShareSettings';

export interface CameraSettings {
  videoCodec: VideoCodec;
  maxBitrate: number;
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

async function loadSettings(): Promise<CameraSettings> {
  try {
    const stored = await storeGet<Partial<CameraSettings>>(LS_KEYS.cameraSettings);
    if (stored) return { ...DEFAULT_SETTINGS, ...stored };
  } catch (e) {
    console.warn('Failed to load camera settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(s: CameraSettings) {
  try { await storeSet(LS_KEYS.cameraSettings, s); }
  catch (e) { console.warn('Failed to save camera settings:', e); }
}

let currentSettings: CameraSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(s: CameraSettings) => void>();

export function useCameraSettings() {
  const [settings, setSettingsState] = useState<CameraSettings>(currentSettings);

  useEffect(() => {
    loadSettings().then((s) => {
      currentSettings = s;
      setSettingsState(s);
    });
  }, []);

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

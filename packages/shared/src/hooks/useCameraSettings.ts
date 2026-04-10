import { useState, useCallback, useEffect } from 'react';
import { LS_KEYS } from '../config';
import { usePlatform } from '../platform';
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

let currentSettings: CameraSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(s: CameraSettings) => void>();

export function useCameraSettings() {
  const { storage } = usePlatform();
  const [settings, setSettingsState] = useState<CameraSettings>(currentSettings);

  // Load settings from storage on mount
  useEffect(() => {
    try {
      const stored = storage.get<Partial<CameraSettings>>(LS_KEYS.cameraSettings);
      if (stored) {
        currentSettings = { ...DEFAULT_SETTINGS, ...stored };
        setSettingsState(currentSettings);
      }
    } catch (e) {
      console.warn('Failed to load camera settings:', e);
    }
  }, [storage]);

  useEffect(() => {
    const listener = (s: CameraSettings) => setSettingsState(s);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const setSettings = useCallback((newSettings: Partial<CameraSettings>) => {
    currentSettings = { ...currentSettings, ...newSettings };
    setSettingsState(currentSettings);
    try {
      storage.set(LS_KEYS.cameraSettings, currentSettings);
    } catch (e) {
      console.warn('Failed to save camera settings:', e);
    }
    listeners.forEach((l) => l(currentSettings));
  }, [storage]);

  return { settings, setSettings };
}

export function getCameraSettings(): CameraSettings {
  return currentSettings;
}

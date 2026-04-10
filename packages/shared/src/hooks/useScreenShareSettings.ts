import { useState, useCallback, useEffect } from 'react';
import { LS_KEYS } from '../config';
import { usePlatform } from '../platform';

export type VideoCodec = 'av1' | 'vp9' | 'h264' | 'vp8';
export type ContentHint = 'motion' | 'detail' | 'text';

export interface ScreenShareSettings {
  // Capture
  resolution: { width: number; height: number };
  frameRate: number;
  contentHint: ContentHint;
  // Publish
  videoCodec: VideoCodec;
  maxBitrate: number; // bps
}

const DEFAULT_SETTINGS: ScreenShareSettings = {
  resolution: { width: 1920, height: 1080 },
  frameRate: 60,
  contentHint: 'motion',
  videoCodec: 'av1',
  maxBitrate: 8_000_000,
};

let currentSettings: ScreenShareSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(s: ScreenShareSettings) => void>();

export function useScreenShareSettings() {
  const { storage } = usePlatform();
  const [settings, setSettingsState] = useState<ScreenShareSettings>(currentSettings);

  // Load settings from storage on mount
  useEffect(() => {
    try {
      const stored = storage.get<Partial<ScreenShareSettings>>(LS_KEYS.screenShareSettings);
      if (stored) {
        currentSettings = { ...DEFAULT_SETTINGS, ...stored };
        setSettingsState(currentSettings);
      }
    } catch (e) {
      console.warn('Failed to load screen share settings:', e);
    }
  }, [storage]);

  useEffect(() => {
    const listener = (s: ScreenShareSettings) => setSettingsState(s);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const setSettings = useCallback((newSettings: Partial<ScreenShareSettings>) => {
    currentSettings = {
      ...currentSettings,
      ...newSettings,
      ...(newSettings.resolution ? { resolution: { ...newSettings.resolution } } : {}),
    };
    setSettingsState(currentSettings);
    try {
      storage.set(LS_KEYS.screenShareSettings, currentSettings);
    } catch (e) {
      console.warn('Failed to save screen share settings:', e);
    }
    listeners.forEach((l) => l(currentSettings));
  }, [storage]);

  return { settings, setSettings };
}

export function getScreenShareSettings(): ScreenShareSettings {
  return currentSettings;
}

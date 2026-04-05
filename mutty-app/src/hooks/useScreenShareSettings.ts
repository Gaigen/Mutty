import { useState, useCallback, useEffect } from 'react';
import { LS_KEYS } from '../config';
import { storeGet, storeSet } from '../lib/store';

export type VideoCodec = 'av1' | 'vp9' | 'h264' | 'vp8';
export type ContentHint = 'motion' | 'detail' | 'text';

export interface ScreenShareSettings {
  resolution: { width: number; height: number };
  frameRate: number;
  contentHint: ContentHint;
  videoCodec: VideoCodec;
  maxBitrate: number;
}

const DEFAULT_SETTINGS: ScreenShareSettings = {
  resolution: { width: 1920, height: 1080 },
  frameRate: 60,
  contentHint: 'motion',
  videoCodec: 'av1',
  maxBitrate: 8_000_000,
};

async function loadSettings(): Promise<ScreenShareSettings> {
  try {
    const stored = await storeGet<Partial<ScreenShareSettings>>(LS_KEYS.screenShareSettings);
    if (stored) return { ...DEFAULT_SETTINGS, ...stored };
  } catch (e) {
    console.warn('Failed to load screen share settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(settings: ScreenShareSettings) {
  try {
    await storeSet(LS_KEYS.screenShareSettings, settings);
  } catch (e) {
    console.warn('Failed to save screen share settings:', e);
  }
}

let currentSettings: ScreenShareSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(s: ScreenShareSettings) => void>();

export function useScreenShareSettings() {
  const [settings, setSettingsState] = useState<ScreenShareSettings>(currentSettings);

  useEffect(() => {
    loadSettings().then((s) => {
      currentSettings = s;
      setSettingsState(s);
    });
  }, []);

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
    saveSettings(currentSettings);
    listeners.forEach((l) => l(currentSettings));
  }, []);

  return { settings, setSettings };
}

export function getScreenShareSettings(): ScreenShareSettings {
  return currentSettings;
}

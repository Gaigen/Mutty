import { useState, useCallback, useEffect } from 'react';
import { LS_KEYS } from '../config';

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

function loadSettings(): ScreenShareSettings {
  try {
    const stored = localStorage.getItem(LS_KEYS.screenShareSettings);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ScreenShareSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load screen share settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: ScreenShareSettings) {
  try {
    localStorage.setItem(LS_KEYS.screenShareSettings, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save screen share settings:', e);
  }
}

let currentSettings: ScreenShareSettings = loadSettings();
const listeners = new Set<(s: ScreenShareSettings) => void>();

export function useScreenShareSettings() {
  const [settings, setSettingsState] = useState<ScreenShareSettings>(currentSettings);

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

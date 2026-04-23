import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '../config';
import { storeGet, storeSet } from '../lib/store';

export interface AudioSettings {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  voiceIsolation: boolean;
  noiseGateEnabled: boolean;
  noiseGateThreshold: number;
  noiseGateAttack: number;
  noiseGateRelease: number;
  speakerDeviceId: string;
  outputVolume: number;
  joinLeaveSounds: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  voiceIsolation: false,
  noiseGateEnabled: false,
  noiseGateThreshold: -40,
  noiseGateAttack: 10,
  noiseGateRelease: 100,
  speakerDeviceId: '',
  outputVolume: 1,
  joinLeaveSounds: true,
};

async function loadSettings(): Promise<AudioSettings> {
  try {
    const stored = await storeGet<Partial<AudioSettings>>(LS_KEYS.audioSettings);
    if (stored) return { ...DEFAULT_SETTINGS, ...stored };
  } catch (e) {
    console.warn('Failed to load audio settings from store:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(settings: AudioSettings) {
  try {
    await storeSet(LS_KEYS.audioSettings, settings);
  } catch (e) {
    console.warn('Failed to save audio settings to store:', e);
  }
}

let currentSettings: AudioSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(settings: AudioSettings) => void>();

export function useAudioSettings() {
  const [settings, setSettingsState] = useState<AudioSettings>(currentSettings);

  useEffect(() => {
    loadSettings().then((s) => {
      currentSettings = s;
      setSettingsState(s);
    });
  }, []);

  useEffect(() => {
    const listener = (s: AudioSettings) => setSettingsState(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setSettings = useCallback((newSettings: Partial<AudioSettings>) => {
    currentSettings = { ...currentSettings, ...newSettings };
    setSettingsState(currentSettings);
    saveSettings(currentSettings);
    listeners.forEach((listener) => listener(currentSettings));
  }, []);

  return { settings, setSettings };
}

export function getAudioSettings(): AudioSettings {
  return currentSettings;
}

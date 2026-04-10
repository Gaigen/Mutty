import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '../config';
import { usePlatform } from '@/platform';

export interface AudioSettings {
  // Input (microphone)
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  voiceIsolation: boolean;

  // Noise Gate
  noiseGateEnabled: boolean;
  noiseGateThreshold: number; // dB, -60 to 0, default: -40
  noiseGateAttack: number;    // ms, 1-100, default: 10
  noiseGateRelease: number;   // ms, 20-500, default: 100

  // Output (speakers)
  speakerDeviceId: string;
  outputVolume: number; // 0 - 1, 1 = default

  // UI
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

let currentSettings: AudioSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(settings: AudioSettings) => void>();

export function useAudioSettings() {
  const { storage } = usePlatform();
  const [settings, setSettingsState] = useState<AudioSettings>(currentSettings);

  // Load settings from storage on mount (async-safe for both web and desktop)
  useEffect(() => {
    try {
      const stored = storage.get<Partial<AudioSettings>>(LS_KEYS.audioSettings);
      if (stored) {
        currentSettings = { ...DEFAULT_SETTINGS, ...stored };
        setSettingsState(currentSettings);
      }
    } catch (e) {
      console.warn('Failed to load audio settings from storage:', e);
    }
  }, [storage]);

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
    try {
      storage.set(LS_KEYS.audioSettings, currentSettings);
    } catch (e) {
      console.warn('Failed to save audio settings to storage:', e);
    }
    listeners.forEach((listener) => listener(currentSettings));
  }, [storage]);

  return { settings, setSettings };
}

export function getAudioSettings(): AudioSettings {
  return currentSettings;
}

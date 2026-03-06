import { useCallback, useEffect, useState } from 'react';
import { LS_KEYS } from '../config';

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

function loadSettings(): AudioSettings {
  try {
    const stored = localStorage.getItem(LS_KEYS.audioSettings);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AudioSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load audio settings from localStorage:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AudioSettings) {
  try {
    localStorage.setItem(LS_KEYS.audioSettings, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save audio settings to localStorage:', e);
  }
}

let currentSettings: AudioSettings = loadSettings();
const listeners = new Set<(settings: AudioSettings) => void>();

export function useAudioSettings() {
  const [settings, setSettingsState] = useState<AudioSettings>(currentSettings);

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

import { createContext, useCallback, useContext, useState } from 'react';
import { Track } from 'livekit-client';

type ParticipantVolumes = Record<string, number>;

const STORAGE_KEY = 'voice-app:participant-volumes';

export function participantVolumeKey(identity: string, source?: Track.Source): string {
  if (source === Track.Source.Microphone) return `${identity}::microphone`;
  if (source === Track.Source.ScreenShareAudio) return `${identity}::screen_share_audio`;
  return identity;
}

export function getParticipantVolume(
  volumes: ParticipantVolumes,
  identity: string,
  source?: Track.Source,
): number {
  const specificKey = participantVolumeKey(identity, source);
  return volumes[specificKey] ?? volumes[identity] ?? 1;
}

function loadVolumesFromStorage(): ParticipantVolumes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const result: ParticipantVolumes = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k === 'string' && typeof v === 'number' && v >= 0 && v <= 1) {
          result[k] = v;
        }
      }
      return result;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveVolumesToStorage(volumes: ParticipantVolumes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes));
  } catch {
    // ignore
  }
}

const ParticipantVolumesContext = createContext<{
  volumes: ParticipantVolumes;
  setVolume: (identity: string, volume: number, source?: Track.Source) => void;
} | null>(null);

export function ParticipantVolumesProvider({ children }: { children: React.ReactNode }) {
  const [volumes, setVolumes] = useState<ParticipantVolumes>(loadVolumesFromStorage);

  const setVolume = useCallback((identity: string, volume: number, source?: Track.Source) => {
    const clamped = Math.min(1, Math.max(0, volume));
    const key = participantVolumeKey(identity, source);
    setVolumes((prev) => {
      const next = { ...prev, [key]: clamped };
      saveVolumesToStorage(next);
      return next;
    });
  }, []);

  return (
    <ParticipantVolumesContext.Provider value={{ volumes, setVolume }}>
      {children}
    </ParticipantVolumesContext.Provider>
  );
}

export function useParticipantVolumes() {
  const ctx = useContext(ParticipantVolumesContext);
  if (!ctx) throw new Error('useParticipantVolumes must be used within ParticipantVolumesProvider');
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Track } from 'livekit-client';
import { usePlatform } from '@/platform';

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

const ParticipantVolumesContext = createContext<{
  volumes: ParticipantVolumes;
  setVolume: (identity: string, volume: number, source?: Track.Source) => void;
} | null>(null);

export function ParticipantVolumesProvider({ children }: { children: React.ReactNode }) {
  const { storage } = usePlatform();
  const [volumes, setVolumes] = useState<ParticipantVolumes>({});

  // Load volumes from storage on mount
  useEffect(() => {
    try {
      const raw = storage.get<Record<string, number>>(STORAGE_KEY);
      if (raw && typeof raw === 'object') {
        const result: ParticipantVolumes = {};
        for (const [k, v] of Object.entries(raw)) {
          if (typeof k === 'string' && typeof v === 'number' && v >= 0 && v <= 1) {
            result[k] = v;
          }
        }
        setVolumes(result);
      }
    } catch {
      // ignore
    }
  }, [storage]);

  const setVolume = useCallback((identity: string, volume: number, source?: Track.Source) => {
    const clamped = Math.min(1, Math.max(0, volume));
    const key = participantVolumeKey(identity, source);
    setVolumes((prev) => {
      const next = { ...prev, [key]: clamped };
      try {
        storage.set(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, [storage]);

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

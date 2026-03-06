import { createContext, useCallback, useContext, useState } from 'react';

type ParticipantVolumes = Record<string, number>;

const ParticipantVolumesContext = createContext<{
  volumes: ParticipantVolumes;
  setVolume: (identity: string, volume: number) => void;
} | null>(null);

export function ParticipantVolumesProvider({ children }: { children: React.ReactNode }) {
  const [volumes, setVolumes] = useState<ParticipantVolumes>({});

  const setVolume = useCallback((identity: string, volume: number) => {
    setVolumes((prev) => ({ ...prev, [identity]: volume }));
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

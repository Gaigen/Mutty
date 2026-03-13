import { createContext, useCallback, useContext, useState } from 'react';

const AudioMuteContext = createContext<{
  isAudioMuted: boolean;
  setAudioMuted: (v: boolean) => void;
  toggleAudioMuted: () => void;
} | null>(null);

export function AudioMuteProvider({ children }: { children: React.ReactNode }) {
  const [isAudioMuted, setAudioMutedState] = useState(false);

  const setAudioMuted = useCallback((v: boolean) => {
    setAudioMutedState(v);
  }, []);

  const toggleAudioMuted = useCallback(() => {
    setAudioMutedState((prev) => !prev);
  }, []);

  return (
    <AudioMuteContext.Provider value={{ isAudioMuted, setAudioMuted, toggleAudioMuted }}>
      {children}
    </AudioMuteContext.Provider>
  );
}

export function useAudioMute() {
  const ctx = useContext(AudioMuteContext);
  if (!ctx) throw new Error('useAudioMute must be used within AudioMuteProvider');
  return ctx;
}

import { createContext, useContext, type ReactNode } from 'react';
import { usePersistentUserChoices } from '@livekit/components-react';

interface UserChoicesContextValue {
  audioDeviceId: string;
  videoDeviceId: string;
  saveAudioInputDeviceId: (id: string) => void;
  saveVideoInputDeviceId: (id: string) => void;
  saveAudioInputEnabled: (enabled: boolean) => void;
  saveVideoInputEnabled: (enabled: boolean) => void;
}

const UserChoicesContext = createContext<UserChoicesContextValue | null>(null);

export function UserChoicesProvider({ children }: { children: ReactNode }) {
  const {
    userChoices,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ preventSave: false });

  const value: UserChoicesContextValue = {
    audioDeviceId: userChoices.audioDeviceId ?? 'default',
    videoDeviceId: userChoices.videoDeviceId ?? 'default',
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
  };

  return (
    <UserChoicesContext.Provider value={value}>
      {children}
    </UserChoicesContext.Provider>
  );
}

export function useUserChoicesContext() {
  return useContext(UserChoicesContext);
}

import { createContext, useContext, useRef, type ReactNode } from 'react';
import { usePersistentUserChoices } from '@livekit/components-react';

interface UserChoicesContextValue {
  audioDeviceId: string;
  videoDeviceId: string;
  saveAudioInputDeviceId: (id: string) => void;
  saveVideoInputDeviceId: (id: string) => void;
  saveAudioInputEnabled: (enabled: boolean) => void;
  saveVideoInputEnabled: (enabled: boolean) => void;
  /** Вызвать перед programmatic restart — блокирует следующий save на 400ms */
  skipNextAudioDeviceSave: () => void;
  skipNextVideoDeviceSave: () => void;
}

const UserChoicesContext = createContext<UserChoicesContextValue | null>(null);

export function UserChoicesProvider({ children }: { children: ReactNode }) {
  const skipUntilRef = useRef<{ audio: number; video: number }>({ audio: 0, video: 0 });

  const {
    userChoices,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId: saveAudio,
    saveVideoInputDeviceId: saveVideo,
  } = usePersistentUserChoices({ preventSave: false });

  const skipNextAudioDeviceSave = () => {
    skipUntilRef.current.audio = Date.now() + 400;
  };
  const skipNextVideoDeviceSave = () => {
    skipUntilRef.current.video = Date.now() + 400;
  };
  const shouldSkipAudioSave = () => {
    if (Date.now() < skipUntilRef.current.audio) {
      skipUntilRef.current.audio = 0;
      return true;
    }
    return false;
  };
  const shouldSkipVideoSave = () => {
    if (Date.now() < skipUntilRef.current.video) {
      skipUntilRef.current.video = 0;
      return true;
    }
    return false;
  };

  const saveAudioInputDeviceId = (id: string) => {
    if (!shouldSkipAudioSave()) saveAudio(id);
  };
  const saveVideoInputDeviceId = (id: string) => {
    if (!shouldSkipVideoSave()) saveVideo(id);
  };

  const value: UserChoicesContextValue = {
    audioDeviceId: userChoices.audioDeviceId ?? 'default',
    videoDeviceId: userChoices.videoDeviceId ?? 'default',
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    skipNextAudioDeviceSave,
    skipNextVideoDeviceSave,
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

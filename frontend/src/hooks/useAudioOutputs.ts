import { useEffect, useState } from 'react';

export function useAudioOutputs(): MediaDeviceInfo[] {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((list) => setDevices(list.filter((d) => d.kind === 'audiooutput')))
      .catch(() => {});
  }, []);

  return devices;
}

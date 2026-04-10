import { useEffect, useState } from 'react';

export function useAudioOutputs(): MediaDeviceInfo[] {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.enumerateDevices) return;

    let cancelled = false;

    const refresh = () => {
      md
        .enumerateDevices()
        .then((list) => {
          if (cancelled) return;
          setDevices(list.filter((d) => d.kind === 'audiooutput'));
        })
        .catch(() => {});
    };

    refresh();
    md.addEventListener('devicechange', refresh);
    return () => {
      cancelled = true;
      md.removeEventListener('devicechange', refresh);
    };
  }, []);

  return devices;
}

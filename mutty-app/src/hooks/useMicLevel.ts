import { Track } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';

export function useMicLevel(
  active: boolean,
  room: Room,
  audioSettings: { noiseGateEnabled: boolean; noiseGateThreshold: number },
): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);
  const settingsRef = useRef(audioSettings);
  settingsRef.current = audioSettings;

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }

    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const mediaTrack = pub?.track?.mediaStreamTrack;
    if (!mediaTrack || mediaTrack.readyState === 'ended') {
      setLevel(0);
      return;
    }

    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    ctx.createMediaStreamSource(new MediaStream([mediaTrack])).connect(analyser);

    const timeData = new Uint8Array(analyser.fftSize);
    const THRESHOLD = 0.02;
    let lastLevel = 0;

    function tick() {
      analyser.getByteTimeDomainData(timeData);
      let sum = 0;
      for (const v of timeData) {
        const n = (v - 128) / 128;
        sum += n * n;
      }
      const rms = Math.sqrt(sum / timeData.length);
      const dB = rms > 0.0001 ? 20 * Math.log10(rms) : -90;

      const s = settingsRef.current;
      const gatedDb = s.noiseGateEnabled && dB < s.noiseGateThreshold ? -90 : dB;

      const MIN_DB = -60;
      const next = Math.max(0, Math.min(1, (gatedDb - MIN_DB) / -MIN_DB));
      const shouldUpdate =
        next < 0.01 ||
        Math.abs(next - lastLevel) >= THRESHOLD;
      if (shouldUpdate) {
        lastLevel = next;
        setLevel(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ctx.close().catch(() => {});
    };
  }, [active, room.localParticipant]);

  return level;
}

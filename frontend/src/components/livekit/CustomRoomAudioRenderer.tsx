/**
 * Кастомный рендерер аудио с поддержкой per-participant volume.
 * RoomAudioRenderer передаёт один volume всем трекам (0–1), поэтому 200% не работало.
 * Здесь каждый участник получает свой volume (0–2+), умноженный на outputVolume.
 * Используем Web Audio API (GainNode) напрямую — поддерживает усиление > 100%.
 */
import { useTracks } from '@livekit/components-react';
import { getTrackReferenceId, isTrackReference } from '@livekit/components-core';
import { Track } from 'livekit-client';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';
import { useEffect, useRef } from 'react';
import { getSharedAudioContext } from '../../utils/audioContext';
import { useParticipantVolumes } from '../../context/ParticipantVolumesContext';

interface CustomRoomAudioRendererProps {
  outputVolume?: number;
}

/** Один трек: MediaStreamSource → GainNode → destination. Поддерживает volume > 1. */
function TrackVolumeRenderer({
  trackRef,
  volume,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  volume: number;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const track = trackRef.publication?.track;
    const mediaTrack = track?.mediaStreamTrack;
    if (!mediaTrack || track?.kind !== Track.Kind.Audio) return;

    const ctx = getSharedAudioContext();
    ctxRef.current = ctx;

    const source = ctx.createMediaStreamSource(new MediaStream([mediaTrack]));
    sourceRef.current = source;

    const gain = ctx.createGain();
    gainRef.current = gain;

    source.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(volume, ctx.currentTime);

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    return () => {
      source.disconnect();
      gain.disconnect();
      ctxRef.current = null;
      sourceRef.current = null;
      gainRef.current = null;
    };
  }, [trackRef.publication?.track?.sid ?? '', trackRef.participant.identity]);

  useEffect(() => {
    const gain = gainRef.current;
    const ctx = ctxRef.current;
    if (!gain || !ctx) return;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
  }, [volume]);

  return null;
}

export function CustomRoomAudioRenderer({ outputVolume = 1 }: CustomRoomAudioRendererProps) {
  const { volumes } = useParticipantVolumes();
  const tracks = useTracks(
    [Track.Source.Microphone, Track.Source.ScreenShareAudio, Track.Source.Unknown],
    { updateOnlyOn: [], onlySubscribed: true },
  )
    .filter((ref) => !ref.participant.isLocal && ref.publication.kind === Track.Kind.Audio)
    .filter(isTrackReference);

  const masterVolume = Math.min(1, Math.max(0, outputVolume));

  return (
    <div style={{ display: 'none' }}>
      {tracks.map((trackRef) => {
        const participantVolume = volumes[trackRef.participant.identity] ?? 1;
        const volume = participantVolume * masterVolume;
        return (
          <TrackVolumeRenderer
            key={getTrackReferenceId(trackRef)}
            trackRef={trackRef}
            volume={volume}
          />
        );
      })}
    </div>
  );
}

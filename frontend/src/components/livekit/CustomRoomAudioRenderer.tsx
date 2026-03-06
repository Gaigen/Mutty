/**
 * Кастомный рендерер аудио с поддержкой per-participant volume.
 * RoomAudioRenderer передаёт один volume всем трекам (0–1).
 * Здесь каждый участник получает свой volume, умноженный на outputVolume.
 * LiveKit AudioTrack ожидает volume 0–1, значения выше вызывают IndexSizeError.
 */
import { AudioTrack, useTracks } from '@livekit/components-react';
import { getTrackReferenceId, isTrackReference } from '@livekit/components-core';
import { Track } from 'livekit-client';
import { useParticipantVolumes } from '../../context/ParticipantVolumesContext';

interface CustomRoomAudioRendererProps {
  outputVolume?: number;
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
        const rawVolume = participantVolume * masterVolume;
        const volume = Math.min(1, Math.max(0, rawVolume));
        return (
          <AudioTrack
            key={getTrackReferenceId(trackRef)}
            trackRef={trackRef}
            volume={volume}
          />
        );
      })}
    </div>
  );
}

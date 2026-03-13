/**
 * Кастомный рендерер аудио с поддержкой per-participant volume.
 * При full mute: отписываемся от всех входящих аудио (setSubscribed(false)) — экономия трафика.
 * При unmute: подписываемся обратно.
 */
import { AudioTrack, useRoomContext, useTracks } from '@livekit/components-react';
import { getTrackReferenceId, isTrackReference } from '@livekit/components-core';
import { Track } from 'livekit-client';
import { useEffect } from 'react';
import { useAudioMute } from '../../context/AudioMuteContext';
import { useParticipantVolumes } from '../../context/ParticipantVolumesContext';

interface CustomRoomAudioRendererProps {
  outputVolume?: number;
}

export function CustomRoomAudioRenderer({ outputVolume = 1 }: CustomRoomAudioRendererProps) {
  const room = useRoomContext();
  const { volumes } = useParticipantVolumes();
  const { isAudioMuted } = useAudioMute();
  const tracks = useTracks(
    [Track.Source.Microphone, Track.Source.ScreenShareAudio, Track.Source.Unknown],
    { updateOnlyOn: [], onlySubscribed: !isAudioMuted },
  )
    .filter((ref) => !ref.participant.isLocal && ref.publication.kind === Track.Kind.Audio)
    .filter(isTrackReference);

  const participantKeys = room ? Array.from(room.remoteParticipants.keys()).join(',') : '';

  useEffect(() => {
    if (!room) return;
    const subscribe = !isAudioMuted;
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        pub.setSubscribed(subscribe);
      }
    }
  }, [room, isAudioMuted, participantKeys]);

  const masterVolume = Math.min(1, Math.max(0, outputVolume));

  return (
    <div style={{ display: 'none' }}>
      {!isAudioMuted &&
        tracks.map((trackRef) => {
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

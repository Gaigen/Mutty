/**
 * Custom audio renderer with per-participant volume support.
 * On full mute: unsubscribe from all incoming audio (setSubscribed(false)) — saves bandwidth.
 * On unmute: subscribe back.
 */
import { AudioTrack, useRoomContext, useTracks } from '@livekit/components-react';
import { getTrackReferenceId, isTrackReference } from '@livekit/components-core';
import { Track } from 'livekit-client';
import { useEffect } from 'react';
import { useAudioMute } from '../../context/AudioMuteContext';
import {
  getParticipantVolume,
  useParticipantVolumes,
} from '../../context/ParticipantVolumesContext';
import { hiddenTrackKey, useHiddenTracks } from '../../store/hiddenTracks';

interface CustomRoomAudioRendererProps {
  outputVolume?: number;
}

export function CustomRoomAudioRenderer({ outputVolume = 1 }: CustomRoomAudioRendererProps) {
  const room = useRoomContext();
  const { volumes } = useParticipantVolumes();
  const { isAudioMuted } = useAudioMute();
  const hiddenSet = useHiddenTracks();

  const tracks = useTracks(
    [Track.Source.Microphone, Track.Source.ScreenShareAudio, Track.Source.Unknown],
    { updateOnlyOn: [], onlySubscribed: !isAudioMuted },
  )
    .filter((ref) => !ref.participant.isLocal && ref.publication.kind === Track.Kind.Audio)
    .filter(isTrackReference)
    .filter((ref) => {
      if (ref.publication.source !== Track.Source.ScreenShareAudio) return true;
      return !hiddenSet.has(hiddenTrackKey(ref.participant.identity, Track.Source.ScreenShare));
    });

  const participantKeys = room ? Array.from(room.remoteParticipants.keys()).join(',') : '';

  useEffect(() => {
    if (!room) return;
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        const screenShareHidden =
          pub.source === Track.Source.ScreenShareAudio &&
          hiddenSet.has(hiddenTrackKey(p.identity, Track.Source.ScreenShare));
        pub.setSubscribed(!isAudioMuted && !screenShareHidden);
      }
    }
  }, [room, isAudioMuted, participantKeys, hiddenSet]);

  const masterVolume = Math.min(1, Math.max(0, outputVolume));

  return (
    <div style={{ display: 'none' }}>
      {!isAudioMuted &&
        tracks.map((trackRef) => {
          const participantVolume = getParticipantVolume(
            volumes,
            trackRef.participant.identity,
            trackRef.publication.source,
          );
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

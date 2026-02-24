import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { useEffect } from 'react';
import { useAudioSettings } from '../../hooks/useAudioSettings';

function applyVolumeToParticipant(p: import('livekit-client').RemoteParticipant, vol: number) {
  try {
    p.setVolume(vol, Track.Source.Microphone);
    p.setVolume(vol, Track.Source.ScreenShareAudio);
  } catch {
    // ignore
  }
}

/**
 * Applies output volume to all remote participants.
 * Must be rendered inside LiveKitRoom.
 */
export default function AudioSettingsHandler() {
  const room = useRoomContext();
  const { settings } = useAudioSettings();
  const vol = Math.max(0, Math.min(1.5, settings.outputVolume));

  useEffect(() => {
    if (!room) return;
    room.remoteParticipants.forEach((p) => applyVolumeToParticipant(p, vol));
  }, [room, vol]);

  useEffect(() => {
    if (!room) return;
    const onParticipant = () => room.remoteParticipants.forEach((p) => applyVolumeToParticipant(p, vol));
    const onTrackSubscribed = () => room.remoteParticipants.forEach((p) => applyVolumeToParticipant(p, vol));

    room.on('participantConnected', onParticipant);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);

    return () => {
      room.off('participantConnected', onParticipant);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    };
  }, [room, vol]);

  return null;
}

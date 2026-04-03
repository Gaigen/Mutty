import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, type RemoteParticipant } from 'livekit-client';
import { useEffect } from 'react';
import { useAudioSettings } from '../../hooks/useAudioSettings';
import { playJoinSound, playLeaveSound } from '../../utils/sounds';

/**
 * Invisible component: plays sound on participant join/leave.
 */
export default function SoundHandler() {
  const room = useRoomContext();
  const { settings } = useAudioSettings();

  useEffect(() => {
    if (!room) return;

    const onJoin = (_participant: RemoteParticipant) => {
      if (settings.joinLeaveSounds) playJoinSound();
    };
    const onLeave = (_participant: RemoteParticipant) => {
      if (settings.joinLeaveSounds) playLeaveSound();
    };

    room.on(RoomEvent.ParticipantConnected, onJoin);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
    };
  }, [room, settings.joinLeaveSounds]);

  return null;
}

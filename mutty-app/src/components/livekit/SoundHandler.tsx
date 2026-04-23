import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, Track, type LocalTrackPublication, type RemoteParticipant, type RemoteTrack, type RemoteTrackPublication } from 'livekit-client';
import { useCallback, useEffect, useRef } from 'react';
import { useAudioSettings } from '../../hooks/useAudioSettings';
import { playJoinSound, playLeaveSound, playScreenShareSound, playScreenShareStopSound } from '../../utils/sounds';

/**
 * Invisible component: plays sound on participant join/leave
 * and on screen share start/stop — both local and remote.
 */
export default function SoundHandler() {
  const room = useRoomContext();
  const { settings } = useAudioSettings();

  // Track which identities have an active screen share (to play sound only once per session)
  const screenShareActiveRef = useRef<Set<string>>(new Set());

  const handleScreenShareStart = useCallback((identity: string) => {
    if (screenShareActiveRef.current.has(identity)) return;
    screenShareActiveRef.current.add(identity);
    if (settings.joinLeaveSounds) playScreenShareSound();
  }, [settings.joinLeaveSounds]);

  const handleScreenShareStop = useCallback((identity: string) => {
    if (screenShareActiveRef.current.has(identity)) {
      if (settings.joinLeaveSounds) playScreenShareStopSound();
    }
    screenShareActiveRef.current.delete(identity);
  }, [settings.joinLeaveSounds]);

  // Check existing participants for active screen shares on mount
  const scanExistingScreenShares = useCallback(() => {
    if (!room) return;
    room.remoteParticipants.forEach((participant) => {
      const pub = participant.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.isSubscribed) {
        handleScreenShareStart(participant.identity);
      }
    });
  }, [room, handleScreenShareStart]);

  // Run once on mount — catch up on any existing screen shares
  useEffect(() => {
    scanExistingScreenShares();
  }, [scanExistingScreenShares]);

  useEffect(() => {
    if (!room) return;

    const onJoin = (_participant: RemoteParticipant) => {
      if (settings.joinLeaveSounds) playJoinSound();
    };
    const onLeave = (participant: RemoteParticipant) => {
      if (settings.joinLeaveSounds) playLeaveSound();
      handleScreenShareStop(participant.identity);
    };

    // Detect screen share start: remote participants
    const onTrackPublished = (_pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (_pub.source === Track.Source.ScreenShare && _pub.isSubscribed) {
        handleScreenShareStart(participant.identity);
      }
    };

    // Detect screen share start: remote track subscribed (works even if TrackPublished fires before subscribe)
    const onTrackSubscribed = (
      _track: RemoteTrack,
      pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (pub.source === Track.Source.ScreenShare) {
        handleScreenShareStart(participant.identity);
      }
    };

    // Detect screen share stop: remote track unsubscribed
    const onTrackUnsubscribed = (
      _track: RemoteTrack,
      pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (pub.source === Track.Source.ScreenShare) {
        handleScreenShareStop(participant.identity);
      }
    };

    // Detect screen share start/stop: local participant (you)
    const onLocalTrackPublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.ScreenShare) {
        handleScreenShareStart('local');
      }
    };

    const onLocalTrackUnpublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.ScreenShare) {
        handleScreenShareStop('local');
      }
    };

    room.on(RoomEvent.ParticipantConnected, onJoin);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    };
  }, [room, settings.joinLeaveSounds, handleScreenShareStart, handleScreenShareStop]);

  return null;
}

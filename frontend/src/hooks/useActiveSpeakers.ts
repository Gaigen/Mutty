import { RoomEvent } from 'livekit-client';
import { useEffect, useState } from 'react';
import type { Room, Participant } from 'livekit-client';

export function useActiveSpeakers(room: Room): Set<string> {
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handler = (speakers: Participant[]) => {
      setActiveSpeakerIds(new Set(speakers.map((s) => s.identity)));
    };
    room.on(RoomEvent.ActiveSpeakersChanged, handler);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handler);
    };
  }, [room]);

  return activeSpeakerIds;
}

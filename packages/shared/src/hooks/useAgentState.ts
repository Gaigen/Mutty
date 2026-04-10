import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '@/platform';
import { sendControlCommand, type AgentState, type AgentStatus, type Mode, type Quality, DEFAULT_STATUS } from '../lib/agent-control';
import { RoomEvent } from 'livekit-client';
import { useRoomContext, useRemoteParticipants } from '@livekit/components-react';
import { BOT_IDENTITY } from '../config';
import { parseStatusFromAttributes } from '../lib/agent-control';

export function useAgentState(roomName: string) {
  const { config } = usePlatform();
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [status, setStatus] = useState<AgentStatus>(DEFAULT_STATUS);
  const [error, setError] = useState<string | null>(null);

  // Find bot participant
  const botParticipant = remoteParticipants.find(
    p => p.identity === BOT_IDENTITY,
  );

  // Parse initial status from bot attributes
  useEffect(() => {
    const parsed = parseStatusFromAttributes(botParticipant?.attributes);
    if (parsed) setStatus(parsed);
  }, [botParticipant?.identity]);

  // Listen for attribute changes (live status updates)
  useEffect(() => {
    const onAttrsChanged = (
      changed: Record<string, string>,
      participant: { identity: string },
    ) => {
      if (participant.identity === BOT_IDENTITY && 'bot:status' in changed) {
        const parsed = parseStatusFromAttributes({ 'bot:status': changed['bot:status'] });
        if (parsed) setStatus(parsed);
      }
    };
    room.on(RoomEvent.ParticipantAttributesChanged, onAttrsChanged);
    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, onAttrsChanged);
    };
  }, [room]);

  // Sync agent state with bot presence
  useEffect(() => {
    if (botParticipant) {
      setAgentState(prev => (prev === 'loading-join' ? prev : 'active'));
    } else {
      setAgentState('idle');
      setStatus(DEFAULT_STATUS);
    }
  }, [botParticipant]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const callAgent = useCallback(async () => {
    setAgentState('loading-join');
    setError(null);
    try {
      const dispatchEndpoint = config.getDispatchEndpoint() ?? '';
      const res = await fetch(dispatchEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'dispatch failed');
      setAgentState('active');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setAgentState('idle');
    }
  }, [roomName, config]);

  const removeAgent = useCallback(() => {
    setAgentState('loading-leave');
    setError(null);
    sendControlCommand(room, { cmd: 'leave' });
  }, [room]);

  const stopPlayback = useCallback(() => {
    sendControlCommand(room, { cmd: 'stop' });
    setStatus(s => ({ ...s, playing: false, paused: false, title: null, url: null }));
  }, [room]);

  const setMode = useCallback(
    (mode: Mode) => {
      sendControlCommand(room, { cmd: 'mode', mode });
      setStatus(s => ({ ...s, mode }));
    },
    [room],
  );

  const setQuality = useCallback(
    (quality: Quality) => {
      sendControlCommand(room, { cmd: 'quality', quality });
      setStatus(s => ({ ...s, quality }));
    },
    [room],
  );

  const skipTrack = useCallback(() => {
    sendControlCommand(room, { cmd: 'skip' });
  }, [room]);

  const pausePlayback = useCallback(() => {
    sendControlCommand(room, { cmd: 'pause' });
    setStatus(s => ({ ...s, paused: true, playing: false }));
  }, [room]);

  const resumePlayback = useCallback(() => {
    sendControlCommand(room, { cmd: 'resume' });
    setStatus(s => ({ ...s, paused: false, playing: true }));
  }, [room]);

  const toggleRepeat = useCallback(() => {
    const next = !(status.repeat ?? false);
    sendControlCommand(room, { cmd: 'repeat', repeat: next });
    setStatus(s => ({ ...s, repeat: next }));
  }, [room, status.repeat]);

  const clearQueue = useCallback(() => {
    sendControlCommand(room, { cmd: 'clear' });
    setStatus(s => ({ ...s, queue_length: 0, queue_display: [] }));
  }, [room]);

  const shuffleQueue = useCallback(() => {
    sendControlCommand(room, { cmd: 'shuffle' });
  }, [room]);

  const addToQueue = useCallback(
    (url: string) => {
      const u = url.trim();
      if (!u) return;
      sendControlCommand(room, { cmd: 'queue', url: u });
    },
    [room],
  );

  return {
    agentState,
    status,
    error,
    setError,
    botParticipant,
    callAgent,
    removeAgent,
    stopPlayback,
    setMode,
    setQuality,
    skipTrack,
    pausePlayback,
    resumePlayback,
    toggleRepeat,
    clearQueue,
    shuffleQueue,
    addToQueue,
    setStatus,
  };
}

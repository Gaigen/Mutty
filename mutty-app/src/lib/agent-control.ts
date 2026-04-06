import { useRoomContext } from '@livekit/components-react';
import { appConfig } from '../config';

// ── Constants ─────────────────────────────────────────────────────────────────
export const AGENT_CONTROL_TOPIC = 'agent-control';

// ── Types ─────────────────────────────────────────────────────────────────────
export type AgentState = 'idle' | 'loading-join' | 'loading-leave' | 'active';
export type Mode = 'audio' | 'video';
export type Quality = '360p' | '480p' | '720p' | '1080p';

export const QUALITY_OPTIONS: Quality[] = ['360p', '480p', '720p', '1080p'];

export interface AgentStatus {
  active: boolean;
  mode: Mode;
  quality?: Quality;
  playing: boolean;
  paused?: boolean;
  repeat?: boolean;
  title: string | null;
  url: string | null;
  queue_display?: [string, string][];
  queue_length?: number;
}

export const DEFAULT_STATUS: AgentStatus = {
  active: false,
  mode: appConfig.agentDefaultMode,
  quality: '720p',
  playing: false,
  title: null,
  url: null,
};

// ── Functions ─────────────────────────────────────────────────────────────────
export function parseStatusFromAttributes(
  attrs: Record<string, string> | undefined
): AgentStatus | null {
  const raw = attrs?.['bot:status'];
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return {
      active: true,
      mode: (data.mode as Mode) || 'video',
      quality: (data.quality as Quality) || '720p',
      playing: !!data.playing,
      paused: !!data.paused,
      repeat: !!data.repeat,
      title: data.title ?? null,
      url: data.url ?? null,
      queue_length: data.queue_length ?? 0,
      queue_display: Array.isArray(data.queue_display) ? data.queue_display : [],
    };
  } catch {
    return null;
  }
}

export function sendControlCommand(
  room: ReturnType<typeof useRoomContext>,
  cmd: object,
): void {
  const data = new TextEncoder().encode(JSON.stringify(cmd));
  room.localParticipant.publishData(data, {
    reliable: true,
    topic: AGENT_CONTROL_TOPIC,
  });
}

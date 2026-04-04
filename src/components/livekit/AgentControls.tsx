import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRoomContext, useRemoteParticipants } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { config, appConfig, BOT_IDENTITY } from '../../config';
import {
  getParticipantVolume,
  useParticipantVolumes,
} from '../../context/ParticipantVolumesContext';

const AGENT_CONTROL_TOPIC = 'agent-control';

interface Props {
  roomName: string;
}

type AgentState = 'idle' | 'loading-join' | 'loading-leave' | 'active';
type Mode = 'audio' | 'video';
type Quality = '360p' | '480p' | '720p' | '1080p';

const QUALITY_OPTIONS: Quality[] = ['360p', '480p', '720p', '1080p'];

interface AgentStatus {
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

const DEFAULT_STATUS: AgentStatus = {
  active: false,
  mode: appConfig.agentDefaultMode,
  quality: '720p',
  playing: false,
  title: null,
  url: null,
};

function parseStatusFromAttributes(attrs: Record<string, string> | undefined): AgentStatus | null {
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

function sendControlCommand(room: ReturnType<typeof useRoomContext>, cmd: object) {
  const data = new TextEncoder().encode(JSON.stringify(cmd));
  room.localParticipant.publishData(data, { reliable: true, topic: AGENT_CONTROL_TOPIC });
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function BotIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="8" width="18" height="11" rx="2" strokeWidth={2} />
      <circle cx="9" cy="13.5" r="1.5" strokeWidth={1.5} />
      <circle cx="15" cy="13.5" r="1.5" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 8V4" />
      <circle cx="12" cy="3" r="1.2" strokeWidth={1.5} />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeWidth={2.5} strokeLinecap="round" d="M5 4l10 8-10 8V4z" />
      <path strokeWidth={2.5} strokeLinecap="round" d="M19 5v14" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"
      />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeWidth={2} strokeLinecap="round" d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      className="animate-spin inline-block"
      style={{
        width: 14,
        height: 14,
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
      }}
    />
  );
}


// ── Small reusable UI primitives ───────────────────────────────────────────────
function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0.4rem 0' }} />;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="lk-button"
      title={title}
      onClick={onClick}
      style={{
        flex: 1,
        fontSize: 11,
        padding: '0.3rem 0.4rem',
        borderRadius: 5,
        background: active
          ? 'var(--lk-control-active-bg, rgba(255,255,255,0.2))'
          : 'rgba(255,255,255,0.06)',
        border: active ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
        transition: 'background 0.15s, border 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function IconButton({
  onClick,
  children,
  title,
  active,
  disabled,
  danger,
}: {
  onClick: () => void;
  children: ReactNode;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className="lk-button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.3rem',
        padding: '0.35rem 0.6rem',
        fontSize: 11,
        borderRadius: 5,
        background: active
          ? 'var(--lk-control-active-bg, rgba(255,255,255,0.2))'
          : danger
          ? 'rgba(239,68,68,0.15)'
          : 'rgba(255,255,255,0.06)',
        border: active
          ? '1px solid rgba(255,255,255,0.25)'
          : danger
          ? '1px solid rgba(239,68,68,0.3)'
          : '1px solid transparent',
        color: danger ? '#f87171' : 'inherit',
        opacity: disabled ? 0.35 : 1,
        transition: 'background 0.15s, opacity 0.15s',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function FullWidthButton({
  onClick,
  children,
  title,
  danger,
}: {
  onClick: () => void;
  children: ReactNode;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className="lk-button"
      title={title}
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        justifyContent: 'flex-start',
        padding: '0.45rem 0.75rem',
        fontSize: 12,
        borderRadius: 0,
        color: danger ? '#f87171' : 'inherit',
        background: 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  );
}

// ── Animated playing indicator ─────────────────────────────────────────────────
function PlayingBars() {
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12, marginRight: 2 }}
      aria-label="Playing"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="agent-playing-bar"
          style={{ '--delay': `${i * 0.15}s` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AgentControls({ roomName }: Props) {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [status, setStatus] = useState<AgentStatus>(DEFAULT_STATUS);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueInput, setQueueInput] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const queueInputRef = useRef<HTMLInputElement>(null);
  const [dropdownBottom, setDropdownBottom] = useState(60);

  const botParticipant = remoteParticipants.find(
    (p) => p.identity === BOT_IDENTITY
  );
  const { volumes, setVolume: setParticipantVolume } = useParticipantVolumes();
  const botVoiceVolume = getParticipantVolume(volumes, BOT_IDENTITY, Track.Source.Microphone);
  const botScreenVolume = getParticipantVolume(volumes, BOT_IDENTITY, Track.Source.ScreenShareAudio);

  useEffect(() => {
    const parsed = parseStatusFromAttributes(botParticipant?.attributes);
    if (parsed) setStatus(parsed);
  }, [botParticipant?.identity]);

  useEffect(() => {
    const onAttrsChanged = (
      changed: Record<string, string>,
      participant: { identity: string }
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

  useEffect(() => {
    if (botParticipant) {
      setAgentState((prev) => (prev === 'loading-join' ? prev : 'active'));
    } else {
      setAgentState('idle');
      setStatus(DEFAULT_STATUS);
    }
  }, [botParticipant]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', onOutside, true);
    return () => document.removeEventListener('click', onOutside, true);
  }, [menuOpen]);

  // Calculate dropdown bottom based on button position to avoid burger overlap
  useEffect(() => {
    if (!menuOpen) return;
    const updatePosition = () => {
      const rect = menuRef.current?.getBoundingClientRect();
      if (!rect) return;
      const bottom = window.innerHeight - rect.top + 6;
      setDropdownBottom(bottom);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [menuOpen]);

  // Focus queue input when menu opens
  useEffect(() => {
    if (menuOpen) {
      setTimeout(() => queueInputRef.current?.focus(), 50);
    }
  }, [menuOpen]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const callAgent = useCallback(async () => {
    setAgentState('loading-join');
    setError(null);
    try {
      const res = await fetch(config.dispatchEndpoint, {
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
  }, [roomName]);

  const removeAgent = useCallback(() => {
    setAgentState('loading-leave');
    setMenuOpen(false);
    setError(null);
    sendControlCommand(room, { cmd: 'leave' });
  }, [room]);

  const stopPlayback = useCallback(() => {
    sendControlCommand(room, { cmd: 'stop' });
    setStatus((s) => ({ ...s, playing: false, paused: false, title: null, url: null }));
  }, [room]);

  const setMode = useCallback(
    (mode: Mode) => {
      sendControlCommand(room, { cmd: 'mode', mode });
      setStatus((s) => ({ ...s, mode }));
    },
    [room]
  );

  const setQuality = useCallback(
    (quality: Quality) => {
      sendControlCommand(room, { cmd: 'quality', quality });
      setStatus((s) => ({ ...s, quality }));
    },
    [room]
  );

  const skipTrack = useCallback(() => {
    sendControlCommand(room, { cmd: 'skip' });
  }, [room]);

  const pausePlayback = useCallback(() => {
    sendControlCommand(room, { cmd: 'pause' });
    setStatus((s) => ({ ...s, paused: true, playing: false }));
  }, [room]);

  const resumePlayback = useCallback(() => {
    sendControlCommand(room, { cmd: 'resume' });
    setStatus((s) => ({ ...s, paused: false, playing: true }));
  }, [room]);

  const toggleRepeat = useCallback(() => {
    const next = !(status.repeat ?? false);
    sendControlCommand(room, { cmd: 'repeat', repeat: next });
    setStatus((s) => ({ ...s, repeat: next }));
  }, [room, status.repeat]);

  const clearQueue = useCallback(() => {
    sendControlCommand(room, { cmd: 'clear' });
    setStatus((s) => ({ ...s, queue_length: 0, queue_display: [] }));
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
    [room]
  );

  const submitQueueInput = useCallback(() => {
    if (!queueInput.trim()) return;
    addToQueue(queueInput);
    setQueueInput('');
  }, [queueInput, addToQueue]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isActive = agentState === 'active';
  const isLoadingJoin = agentState === 'loading-join';
  const isLoadingLeave = agentState === 'loading-leave';
  const isLoading = isLoadingJoin || isLoadingLeave;
  const quality = status.quality ?? '720p';
  const queueLen = status.queue_length ?? 0;
  const isPlaying = status.playing;
  const isPaused = status.paused ?? false;
  const hasMedia = isPlaying || isPaused;
  const hasQueue = queueLen > 0;

  // ── Idle state ──────────────────────────────────────────────────────────────
  if (!isActive && !isLoading) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="lk-button"
          title="Invite YouTube agent"
          aria-label="Invite YouTube agent"
          onClick={callAgent}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <BotIcon />
        </button>
        {error && <ErrorTooltip>{error}</ErrorTooltip>}
      </div>
    );
  }

  if (isLoadingJoin) {
    return (
      <button
        type="button"
        className="lk-button"
        disabled
        aria-label="Connecting agent…"
        title="Connecting…"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}
      >
        <Spinner />
      </button>
    );
  }

  if (isLoadingLeave) {
    return (
      <button
        type="button"
        className="lk-button"
        disabled
        aria-label="Disconnecting agent…"
        title="Disconnecting…"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}
      >
        <Spinner />
      </button>
    );
  }

  // ── Active state ───────────────────────────────────────────────────────────
  return (
    <div ref={menuRef}>
      {/* Trigger button */}
      <button
        type="button"
        className="lk-button"
        title="Bot menu"
        aria-label="Bot menu"
        onClick={() => setMenuOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          backgroundColor: menuOpen
            ? 'var(--lk-control-active-bg, rgba(255,255,255,0.2))'
            : undefined,
        }}
      >
        <BotIcon />
        {/* Queue count badge */}
        {queueLen > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: 'var(--lk-accent, #0ea5e9)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 4px',
              lineHeight: '14px',
              minWidth: 14,
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            {queueLen > 99 ? '99+' : queueLen}
          </span>
        )}
      </button>

      {/* Dropdown menu — fixed, centered like StreamSettings */}
      {menuOpen && (
        <div
          className="mutty-agent-dropdown"
          style={{
            position: 'fixed',
            bottom: dropdownBottom,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '92vw',
            maxWidth: 320,
            background: 'var(--lk-bg2, #1e1e1e)',
            borderRadius: 10,
            boxShadow: '0 6px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
            zIndex: 999,
            overflow: 'hidden',
          }}
        >
          {/* ── Now Playing ───────────────────────────────────── */}
          {(hasMedia || status.title) && (
            <>
              <div style={{ padding: '0.6rem 0.75rem 0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  {isPlaying ? (
                    <PlayingBars />
                  ) : isPaused ? (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>⏸</span>
                  ) : null}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                    title={status.title ?? ''}
                  >
                    {status.title ?? 'Loading…'}
                  </span>
                </div>
                {status.url && (
                  <a
                    href={status.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 10,
                      color: 'var(--lk-accent, #0ea5e9)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      textDecoration: 'none',
                      opacity: 0.8,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <LinkIcon />
                    {(() => {
                      try {
                        return new URL(status.url).hostname.replace('www.', '');
                      } catch {
                        return status.url.slice(0, 40);
                      }
                    })()}
                  </a>
                )}
              </div>
              <Divider />
            </>
          )}

          {/* ── Playback controls ─────────────────────────────── */}
          <div style={{ padding: '0.4rem 0.6rem', display: 'flex', gap: 4 }}>
            {/* Pause / Resume */}
            {isPlaying && (
              <IconButton onClick={pausePlayback} title="Pause">
                <PauseIcon /> Pause
              </IconButton>
            )}
            {isPaused && status.url && (
              <IconButton onClick={resumePlayback} title="Resume">
                <PlayIcon /> Resume
              </IconButton>
            )}

            {/* Skip */}
            <IconButton
              onClick={skipTrack}
              title="Skip to next"
              disabled={!isPlaying && !hasQueue}
            >
              <SkipIcon /> Skip
            </IconButton>

            {/* Repeat */}
            <IconButton
              onClick={toggleRepeat}
              active={status.repeat}
              title={status.repeat ? 'Repeat: on' : 'Repeat: off'}
              disabled={!hasMedia && !hasQueue}
            >
              <RepeatIcon />
            </IconButton>

            {/* Stop */}
            <IconButton
              onClick={() => { stopPlayback(); }}
              title="Stop playback"
              disabled={!hasMedia}
            >
              <StopIcon />
            </IconButton>
          </div>

          <Divider />

          {/* ── Mode ──────────────────────────────────────────── */}
          <div style={{ padding: '0.4rem 0.6rem' }}>
            <SectionLabel>Mode</SectionLabel>
            <div style={{ display: 'flex', gap: 4 }}>
              <ToggleButton active={status.mode === 'audio'} onClick={() => setMode('audio')} title="Audio only">
                🎵 Audio
              </ToggleButton>
              <ToggleButton active={status.mode === 'video'} onClick={() => setMode('video')} title="Video + audio">
                🎬 Video
              </ToggleButton>
            </div>
          </div>

          {/* ── Quality (video mode only) ─────────────────────── */}
          {status.mode === 'video' && (
            <div style={{ padding: '0.4rem 0.6rem 0' }}>
              <SectionLabel>Quality</SectionLabel>
              <div style={{ display: 'flex', gap: 4 }}>
                {QUALITY_OPTIONS.map((q) => (
                  <ToggleButton key={q} active={quality === q} onClick={() => setQuality(q)}>
                    {q}
                  </ToggleButton>
                ))}
              </div>
            </div>
          )}

          <Divider />

          {/* ── Bot volume ────────────────────────────────────── */}
          <div style={{ padding: '0 0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <VolumeIcon />
              <SectionLabel>Volume</SectionLabel>
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', width: 48 }}>Voice</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={botVoiceVolume}
                  onChange={(e) =>
                    setParticipantVolume(BOT_IDENTITY, parseFloat(e.target.value), Track.Source.Microphone)
                  }
                  style={{ flex: 1, height: 4, accentColor: 'var(--lk-accent, #0ea5e9)' }}
                />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', width: 28 }}>
                  {Math.round(botVoiceVolume * 100)}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', width: 48 }}>Screen</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={botScreenVolume}
                  onChange={(e) =>
                    setParticipantVolume(BOT_IDENTITY, parseFloat(e.target.value), Track.Source.ScreenShareAudio)
                  }
                  style={{ flex: 1, height: 4, accentColor: 'var(--lk-accent, #0ea5e9)' }}
                />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', width: 28 }}>
                  {Math.round(botScreenVolume * 100)}%
                </span>
              </div>
            </div>
          </div>

          <Divider />

          {/* ── Queue ─────────────────────────────────────────── */}
          <div style={{ padding: '0.4rem 0.6rem 0.5rem' }}>
            {/* Queue header with Shuffle + Clear */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <SectionLabel>Queue{queueLen > 0 ? ` (${queueLen})` : ''}</SectionLabel>
              {queueLen >= 2 && (
                <div style={{ marginLeft: 'auto', marginBottom: 5, display: 'flex', gap: 3 }}>
                  <IconButton onClick={shuffleQueue} title="Shuffle queue">
                    <ShuffleIcon /> Shuffle
                  </IconButton>
                  <IconButton onClick={clearQueue} title="Clear queue" danger>
                    <TrashIcon /> Clear
                  </IconButton>
                </div>
              )}
              {queueLen === 1 && (
                <div style={{ marginLeft: 'auto', marginBottom: 5 }}>
                  <IconButton onClick={clearQueue} title="Clear queue" danger>
                    <TrashIcon /> Clear
                  </IconButton>
                </div>
              )}
            </div>

            {/* Add to queue input */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <input
                ref={queueInputRef}
                type="text"
                placeholder="URL or: youtube <query>"
                value={queueInput}
                onChange={(e) => setQueueInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitQueueInput();
                }}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.5rem',
                  fontSize: 11,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 5,
                  color: '#fff',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                className="lk-button"
                onClick={submitQueueInput}
                disabled={!queueInput.trim()}
                style={{
                  fontSize: 11,
                  padding: '0.35rem 0.6rem',
                  borderRadius: 5,
                  opacity: queueInput.trim() ? 1 : 0.4,
                }}
              >
                Add
              </button>
            </div>

            {/* Queue list */}
            {(status.queue_display ?? []).length > 0 && (
              <div
                style={{
                  maxHeight: 112,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {status.queue_display!.slice(0, 8).map((item, i) => {
                  const [title, link] = Array.isArray(item) ? item : [item, ''];
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 4px',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.04)',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 16, textAlign: 'right' }}>
                        {i + 1}.
                      </span>
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'inherit', textDecoration: 'none' }}
                            title={title}
                          >
                            {title}
                          </a>
                        ) : (
                          title
                        )}
                      </span>
                    </div>
                  );
                })}
                {queueLen > 8 && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', padding: '2px 4px' }}>
                    +{queueLen - 8} more in queue
                  </div>
                )}
              </div>
            )}

            {queueLen === 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                Queue is empty
              </div>
            )}
          </div>

          <Divider />

          {/* ── Remove agent ──────────────────────────────────── */}
          <FullWidthButton onClick={removeAgent} danger title="Disconnect the bot from this room">
            <BotIcon /> Remove agent
          </FullWidthButton>
        </div>
      )}

      {error && <ErrorTooltip>{error}</ErrorTooltip>}
    </div>
  );
}

function ErrorTooltip({ children }: { children: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '110%',
        right: 0,
        background: '#ef4444',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 11,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      {children}
    </div>
  );
}

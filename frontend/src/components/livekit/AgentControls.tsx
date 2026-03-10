import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { config, appConfig } from '../../config';
import { useParticipantVolumes } from '../../context/ParticipantVolumesContext';

const AGENT_CONTROL_TOPIC = 'agent-control';
const BOT_IDENTITY = 'youtube-bot';

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
  queue?: string[];
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
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeWidth={2} strokeLinecap="round" d="M5 4l10 8-10 8V4z" />
      <path strokeWidth={2} strokeLinecap="round" d="M19 5v14" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function RepeatIcon({ active }: { active?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
      style={active ? { opacity: 1 } : { opacity: 0.6 }}
    >
      <path
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"
      />
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

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ transform: up ? 'rotate(180deg)' : undefined }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function MenuButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="lk-button"
      onClick={onClick}
      style={{
        flex: 1,
        fontSize: 11,
        padding: '0.3rem 0.5rem',
        backgroundColor: active ? 'var(--lk-control-active-bg, rgba(255,255,255,0.2))' : undefined,
      }}
    >
      {children}
    </button>
  );
}

function MenuAction({
  onClick,
  children,
  style,
}: {
  onClick: () => void;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className="lk-button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        justifyContent: 'flex-start',
        padding: '0.4rem 0.75rem',
        fontSize: 12,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function sendControlCommand(room: ReturnType<typeof useRoomContext>, cmd: object) {
  const data = new TextEncoder().encode(JSON.stringify(cmd));
  room.localParticipant.publishData(data, { reliable: true, topic: AGENT_CONTROL_TOPIC });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AgentControls({ roomName }: Props) {
  const room = useRoomContext();
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [status, setStatus] = useState<AgentStatus>(DEFAULT_STATUS);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueInput, setQueueInput] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const botParticipant = Array.from(room.remoteParticipants.values()).find(
    (p) => p.identity === BOT_IDENTITY
  );
  const { volumes, setVolume: setParticipantVolume } = useParticipantVolumes();
  const botVolume = volumes[BOT_IDENTITY] ?? 1;

  const updateStatusFromBot = useCallback(() => {
    const parsed = parseStatusFromAttributes(botParticipant?.attributes);
    if (parsed) setStatus(parsed);
  }, [botParticipant?.attributes]);

  useEffect(() => {
    updateStatusFromBot();
  }, [updateStatusFromBot]);

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
      setAgentState((prev) => (prev === 'loading-leave' ? prev : 'active'));
    } else {
      setAgentState('idle');
      setStatus(DEFAULT_STATUS);
    }
  }, [botParticipant]);

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
    // agentState → idle when bot disconnects (useEffect on botParticipant)
  }, [room]);

  const stopPlayback = useCallback(() => {
    sendControlCommand(room, { cmd: 'stop' });
    setStatus((s) => ({ ...s, playing: false, title: null, url: null }));
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
    updateStatusFromBot();
  }, [room, updateStatusFromBot]);

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

  const addToQueue = useCallback(
    (url: string) => {
      const u = url.trim();
      if (!u) return;
      sendControlCommand(room, { cmd: 'queue', url: u });
      updateStatusFromBot();
    },
    [room, updateStatusFromBot]
  );

  if (unavailable) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          Service unavailable
        </span>
        <button
          type="button"
          className="lk-button"
          onClick={() => setUnavailable(false)}
          style={{ fontSize: 11, padding: '0.2rem 0.4rem' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const isActive = agentState === 'active';
  const isLoadingJoin = agentState === 'loading-join';
  const isLoadingLeave = agentState === 'loading-leave';
  const isLoading = isLoadingJoin || isLoadingLeave;

  if (!isActive && !isLoading) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="lk-button"
          title="Invite YouTube agent"
          onClick={callAgent}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <BotIcon />
          <span>Agent</span>
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
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: 0.6 }}
      >
        <Spinner />
        <span>Connecting...</span>
      </button>
    );
  }

  if (isLoadingLeave) {
    return (
      <button
        type="button"
        className="lk-button"
        disabled
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', opacity: 0.6 }}
      >
        <Spinner />
        <span>Disconnecting...</span>
      </button>
    );
  }

  const quality = status.quality ?? '720p';

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="lk-button"
        title="Bot menu"
        onClick={() => setMenuOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          backgroundColor: menuOpen ? 'var(--lk-control-active-bg, rgba(255,255,255,0.2))' : undefined,
        }}
      >
        <BotIcon />
        <span>Agent</span>
        <ChevronIcon up={menuOpen} />
      </button>

      {menuOpen && (
        <div
          className="lk-button-group-menu"
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 4,
            minWidth: 200,
            padding: '0.5rem 0',
            background: 'var(--lk-bg2, #1a1a1a)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 50,
          }}
        >
          {status.playing && status.title && (
            <>
              <div
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.6)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={status.url ?? ''}
              >
                {status.mode === 'audio' ? '🎵' : '🎬'} {status.title}
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '0.25rem 0' }} />
            </>
          )}

          <div style={{ padding: '0 0.5rem' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Mode</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <MenuButton active={status.mode === 'audio'} onClick={() => setMode('audio')}>
                🎵 Audio
              </MenuButton>
              <MenuButton active={status.mode === 'video'} onClick={() => setMode('video')}>
                🎬 Video
              </MenuButton>
            </div>
          </div>

          {status.mode === 'video' && (
            <div style={{ padding: '0.5rem 0.5rem 0' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                Quality
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {QUALITY_OPTIONS.map((q) => (
                  <MenuButton key={q} active={quality === q} onClick={() => setQuality(q)}>
                    {q}
                  </MenuButton>
                ))}
              </div>
            </div>
          )}

          <div style={{ padding: '0.5rem 0.5rem 0' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              Bot volume (saved per user)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={botVolume}
                onChange={(e) => setParticipantVolume(BOT_IDENTITY, parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  height: 6,
                  accentColor: 'var(--lk-accent, #0ea5e9)',
                }}
              />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', minWidth: 36 }}>
                {Math.round(botVolume * 100)}%
              </span>
            </div>
          </div>

          <div style={{ padding: '0.5rem 0.5rem 0' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              Queue {(status.queue_length ?? 0) > 0 && `(${status.queue_length})`}
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <input
                type="text"
                placeholder="URL or youtube/search"
                value={queueInput}
                onChange={(e) => setQueueInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addToQueue(queueInput);
                    setQueueInput('');
                  }
                }}
                style={{
                  flex: 1,
                  padding: '0.3rem 0.5rem',
                  fontSize: 11,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  color: '#fff',
                }}
              />
              <button
                type="button"
                className="lk-button"
                onClick={() => {
                  addToQueue(queueInput);
                  setQueueInput('');
                }}
                style={{ fontSize: 11, padding: '0.3rem 0.5rem' }}
              >
                Add
              </button>
            </div>
            {(status.queue_display ?? []).length > 0 && (
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.6)',
                  maxHeight: 60,
                  overflowY: 'auto',
                }}
              >
                {status.queue_display!.slice(0, 5).map((item, i) => {
                  const [title, link] = Array.isArray(item) ? item : [item, ''];
                  return (
                    <div
                      key={i}
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {i + 1}.{' '}
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--lk-accent, #0ea5e9)',
                            textDecoration: 'underline',
                          }}
                        >
                          {title}
                        </a>
                      ) : (
                        title
                      )}
                    </div>
                  );
                })}
                {(status.queue_length ?? 0) > 5 && (
                  <div style={{ color: 'rgba(255,255,255,0.5)' }}>
                    +{(status.queue_length ?? 0) - 5} more
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />

          {status.playing && (
            <MenuAction onClick={pausePlayback}>
              <PauseIcon /> Pause
            </MenuAction>
          )}
          {(status.paused ?? false) && status.url && (
            <MenuAction onClick={resumePlayback}>
              <PlayIcon /> Resume
            </MenuAction>
          )}
          {(status.playing || status.paused || (status.queue_length ?? 0) > 0) && (
            <MenuAction
              onClick={toggleRepeat}
              style={{
                backgroundColor: status.repeat
                  ? 'var(--lk-control-active-bg, rgba(255,255,255,0.2))'
                  : undefined,
              }}
            >
              <RepeatIcon active={status.repeat} /> Repeat
            </MenuAction>
          )}
          {(status.playing || (status.queue_length ?? 0) > 0) && (
            <MenuAction onClick={skipTrack}>
              <SkipIcon /> Skip
            </MenuAction>
          )}
          {(status.playing || status.paused) && (
            <MenuAction
              onClick={() => {
                stopPlayback();
                setMenuOpen(false);
              }}
            >
              <StopIcon /> Stop playback
            </MenuAction>
          )}
          <MenuAction
            onClick={() => {
              removeAgent();
              setMenuOpen(false);
            }}
          >
            <BotIcon /> Remove agent
          </MenuAction>
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

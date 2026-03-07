import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { config, appConfig } from '../../config';

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
  title: string | null;
  url: string | null;
  queue?: string[];
  queue_display?: [string, string][]; // [title, link] for hyperlinks
  queue_length?: number;
}

function agentHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.agentApiKey) h['X-API-Key'] = config.agentApiKey;
  return h;
}

const DEFAULT_STATUS: AgentStatus = {
  active: false,
  mode: appConfig.agentDefaultMode,
  quality: '720p',
  playing: false,
  title: null,
  url: null,
};

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
}: {
  onClick: () => void;
  children: ReactNode;
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
      }}
    >
      {children}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AgentControls({ roomName }: Props) {
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [status, setStatus] = useState<AgentStatus>(DEFAULT_STATUS);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueInput, setQueueInput] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `${config.agentEndpoint}/agent/status/${encodeURIComponent(roomName)}`,
        { headers: agentHeaders(), signal: AbortSignal.timeout(5_000) },
      );
      if (!res.ok) {
        if (res.status === 401) setUnavailable(true);
        else if (res.status !== 429) setUnavailable(true);
        return;
      }
      const data: AgentStatus = await res.json();
      setStatus(data);
      setAgentState((prev) => {
        if (prev === 'loading-join' || prev === 'loading-leave') return prev;
        return data.active ? 'active' : 'idle';
      });
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    }
  }, [roomName]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 5_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

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

  // ── Actions ──────────────────────────────────────────────────────────────
  const callAgent = useCallback(async () => {
    setAgentState('loading-join');
    setError(null);
    try {
      const res = await fetch(`${config.agentEndpoint}/agent/join`, {
        method: 'POST',
        headers: agentHeaders(),
        body: JSON.stringify({ room: roomName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'join failed');
      setAgentState('active');
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setAgentState('idle');
    }
  }, [roomName, fetchStatus]);

  const removeAgent = useCallback(async () => {
    setAgentState('loading-leave');
    setMenuOpen(false);
    setError(null);
    try {
      const res = await fetch(`${config.agentEndpoint}/agent/leave`, {
        method: 'POST',
        headers: agentHeaders(),
        body: JSON.stringify({ room: roomName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'leave failed');
      setAgentState('idle');
      setStatus(DEFAULT_STATUS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setAgentState('active');
    }
  }, [roomName]);

  const stopPlayback = useCallback(async () => {
    try {
      await fetch(`${config.agentEndpoint}/agent/stop`, {
        method: 'POST',
        headers: agentHeaders(),
        body: JSON.stringify({ room: roomName }),
      });
      setStatus((s) => ({ ...s, playing: false, title: null, url: null }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [roomName]);

  const setMode = useCallback(
    async (mode: Mode) => {
      try {
        await fetch(`${config.agentEndpoint}/agent/mode`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({ room: roomName, mode }),
        });
        setStatus((s) => ({ ...s, mode }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      }
    },
    [roomName],
  );

  const setQuality = useCallback(
    async (quality: Quality) => {
      try {
        await fetch(`${config.agentEndpoint}/agent/quality`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({ room: roomName, quality }),
        });
        setStatus((s) => ({ ...s, quality }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      }
    },
    [roomName],
  );

  const skipTrack = useCallback(async () => {
    try {
      await fetch(`${config.agentEndpoint}/agent/skip`, {
        method: 'POST',
        headers: agentHeaders(),
        body: JSON.stringify({ room: roomName }),
      });
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [roomName, fetchStatus]);

  const addToQueue = useCallback(
    async (url: string) => {
      const u = url.trim();
      if (!u) return;
      try {
        const res = await fetch(`${config.agentEndpoint}/agent/queue`, {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({ room: roomName, url: u }),
        });
        if (!res.ok) throw new Error((await res.json()).detail ?? 'Failed');
        await fetchStatus();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      }
    },
    [roomName, fetchStatus],
  );

  if (unavailable) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}
          title="Agent service unavailable or requires authorization"
        >
          Service unavailable
        </span>
        <button
          type="button"
          className="lk-button"
          onClick={() => {
            setUnavailable(false);
            fetchStatus();
          }}
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

  // ── Idle: single "Агент" button ────────────────────────────────────────────
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

  // ── Loading join ───────────────────────────────────────────────────────────
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

  // ── Loading leave ──────────────────────────────────────────────────────────
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

  // ── Active: Bot menu (dropdown) ───────────────────────────────────────────
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
              <MenuButton
                active={status.mode === 'audio'}
                onClick={() => setMode('audio')}
              >
                🎵 Audio
              </MenuButton>
              <MenuButton
                active={status.mode === 'video'}
                onClick={() => setMode('video')}
              >
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
            {(status.queue_display ?? status.queue ?? []).length > 0 && (
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.6)',
                  maxHeight: 60,
                  overflowY: 'auto',
                }}
              >
                {(status.queue_display ?? status.queue?.map((u) => [u.slice(0, 40) + (u.length > 40 ? '…' : ''), u] as [string, string]) ?? []).slice(0, 5).map((item, i) => {
                  const [title, link] = Array.isArray(item) ? item : [item, ''];
                  return (
                    <div key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i + 1}. {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lk-accent, #0ea5e9)', textDecoration: 'underline' }}>
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

          {(status.playing || (status.queue_length ?? 0) > 0) && (
            <MenuAction
              onClick={() => {
                skipTrack();
              }}
            >
              <SkipIcon /> Skip
            </MenuAction>
          )}
          {status.playing && (
            <MenuAction onClick={() => { stopPlayback(); setMenuOpen(false); }}>
              <StopIcon /> Stop playback
            </MenuAction>
          )}
          <MenuAction onClick={() => { removeAgent(); setMenuOpen(false); }}>
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

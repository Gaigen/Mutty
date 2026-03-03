import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  roomName: string;
}

type AgentState = 'idle' | 'loading-join' | 'loading-leave' | 'active';
type Mode = 'audio' | 'video';

interface AgentStatus {
  active: boolean;
  mode: Mode;
  playing: boolean;
  title: string | null;
  url: string | null;
}

const AGENT_ENDPOINT =
  (import.meta.env.VITE_AGENT_ENDPOINT as string | undefined) || 'http://localhost:5000';

const DEFAULT_STATUS: AgentStatus = {
  active: false,
  mode: 'video',
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function AgentControls({ roomName }: Props) {
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [status, setStatus] = useState<AgentStatus>(DEFAULT_STATUS);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `${AGENT_ENDPOINT}/agent/status/${encodeURIComponent(roomName)}`,
        { signal: AbortSignal.timeout(3_000) },
      );
      if (!res.ok) return;
      const data: AgentStatus = await res.json();
      setStatus(data);
      setAgentState((prev) => {
        if (prev === 'loading-join' || prev === 'loading-leave') return prev;
        return data.active ? 'active' : 'idle';
      });
    } catch {
      setHidden(true);
    }
  }, [roomName]);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 5_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const callAgent = useCallback(async () => {
    setAgentState('loading-join');
    setError(null);
    try {
      const res = await fetch(`${AGENT_ENDPOINT}/agent/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'join failed');
      setAgentState('active');
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
      setAgentState('idle');
    }
  }, [roomName, fetchStatus]);

  const removeAgent = useCallback(async () => {
    setAgentState('loading-leave');
    setError(null);
    try {
      const res = await fetch(`${AGENT_ENDPOINT}/agent/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'leave failed');
      setAgentState('idle');
      setStatus(DEFAULT_STATUS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
      setAgentState('active');
    }
  }, [roomName]);

  const stopPlayback = useCallback(async () => {
    try {
      await fetch(`${AGENT_ENDPOINT}/agent/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName }),
      });
      setStatus((s) => ({ ...s, playing: false, title: null, url: null }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  }, [roomName]);

  const setMode = useCallback(
    async (mode: Mode) => {
      try {
        await fetch(`${AGENT_ENDPOINT}/agent/mode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: roomName, mode }),
        });
        setStatus((s) => ({ ...s, mode }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка');
      }
    },
    [roomName],
  );

  if (hidden) return null;

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
          title="Вызвать YouTube-агента"
          onClick={callAgent}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <BotIcon />
          <span>Агент</span>
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
        <span>Подключаю...</span>
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
        <span>Отключаю...</span>
      </button>
    );
  }

  // ── Active panel ───────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', display: 'flex', gap: '0.375rem', alignItems: 'center' }}>

      {/* Now playing indicator */}
      {status.playing && status.title && (
        <span
          title={status.url ?? ''}
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {status.mode === 'audio' ? '🎵' : '🎬'} {status.title}
        </span>
      )}

      {/* Mode: Audio */}
      <button
        type="button"
        className="lk-button"
        title="Только аудио"
        onClick={() => setMode('audio')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.3rem 0.6rem',
          backgroundColor:
            status.mode === 'audio'
              ? 'var(--lk-control-active-bg, rgba(255,255,255,0.2))'
              : undefined,
        }}
      >
        <span>🎵</span>
        <span style={{ fontSize: 12 }}>Аудио</span>
      </button>

      {/* Mode: Video */}
      <button
        type="button"
        className="lk-button"
        title="Аудио + видео"
        onClick={() => setMode('video')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.3rem 0.6rem',
          backgroundColor:
            status.mode === 'video'
              ? 'var(--lk-control-active-bg, rgba(255,255,255,0.2))'
              : undefined,
        }}
      >
        <span>🎬</span>
        <span style={{ fontSize: 12 }}>Видео</span>
      </button>

      {/* Stop playback — only when playing */}
      {status.playing && (
        <button
          type="button"
          className="lk-button"
          title="Остановить воспроизведение"
          onClick={stopPlayback}
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.6rem' }}
        >
          <StopIcon />
          <span style={{ fontSize: 12 }}>Стоп</span>
        </button>
      )}

      {/* Remove agent */}
      <button
        type="button"
        className="lk-button"
        title="Убрать агента"
        onClick={removeAgent}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.3rem 0.6rem',
        }}
      >
        <BotIcon />
        <span style={{ fontSize: 12 }}>Убрать</span>
      </button>

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

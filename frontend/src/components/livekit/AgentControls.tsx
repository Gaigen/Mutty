import { useCallback, useEffect, useRef, useState } from 'react';
import { config, appConfig } from '../../config';

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

function agentHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.agentApiKey) h['X-API-Key'] = config.agentApiKey;
  return h;
}

const DEFAULT_STATUS: AgentStatus = {
  active: false,
  mode: appConfig.agentDefaultMode,
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
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        title="Audio only"
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
        <span style={{ fontSize: 12 }}>Audio</span>
      </button>

      {/* Mode: Video */}
      <button
        type="button"
        className="lk-button"
        title="Audio + video"
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
        <span style={{ fontSize: 12 }}>Video</span>
      </button>

      {/* Stop playback — only when playing */}
      {status.playing && (
        <button
          type="button"
          className="lk-button"
          title="Stop playback"
          onClick={stopPlayback}
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.6rem' }}
        >
          <StopIcon />
          <span style={{ fontSize: 12 }}>Stop</span>
        </button>
      )}

      {/* Remove agent */}
      <button
        type="button"
        className="lk-button"
        title="Remove agent"
        onClick={removeAgent}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.3rem 0.6rem',
        }}
      >
        <BotIcon />
        <span style={{ fontSize: 12 }}>Remove</span>
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

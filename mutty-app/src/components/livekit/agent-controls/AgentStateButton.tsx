import { useCallback, useState } from 'react';
import { Spinner } from '../../ui/icons/agent-icons';
import { ErrorTooltip } from '../../ui/agent-primitives';

interface Props {
  agentState: 'idle' | 'loading-join' | 'loading-leave' | 'active';
  queueLen: number;
  menuOpen: boolean;
  onCall: () => void;
  onToggleMenu: () => void;
}

export function AgentStateButton({ agentState, queueLen, menuOpen, onCall, onToggleMenu }: Props) {
  const [error, setLocalError] = useState<string | null>(null);

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
          aria-label="Invite YouTube agent"
          onClick={onCall}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <BotIcon />
        </button>
        {error && <ErrorTooltip>{error}</ErrorTooltip>}
      </div>
    );
  }

  if (isLoadingJoin || isLoadingLeave) {
    return (
      <button
        type="button"
        className="lk-button"
        disabled
        aria-label={isLoadingJoin ? 'Connecting agent…' : 'Disconnecting agent…'}
        title={isLoadingJoin ? 'Connecting…' : 'Disconnecting…'}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}
      >
        <Spinner />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="lk-button"
      title="Bot menu"
      aria-label="Bot menu"
      onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
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
  );
}

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

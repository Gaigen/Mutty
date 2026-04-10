import { BotIcon, Spinner } from '../../ui/icons/agent-icons';
import type { AgentState } from '../../../lib/agent-control';

interface Props {
  agentState: AgentState;
  queueLen: number;
  menuOpen: boolean;
  onCall: () => void;
  onToggleMenu: () => void;
}

export function AgentStateButton({ agentState, queueLen, menuOpen, onCall, onToggleMenu }: Props) {
  // Idle
  if (agentState === 'idle') {
    return (
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
    );
  }

  // Loading
  if (agentState === 'loading-join' || agentState === 'loading-leave') {
    const isJoining = agentState === 'loading-join';
    return (
      <button
        type="button"
        className="lk-button"
        disabled
        aria-label={isJoining ? 'Connecting agent…' : 'Disconnecting agent…'}
        title={isJoining ? 'Connecting…' : 'Disconnecting…'}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}
      >
        <Spinner />
      </button>
    );
  }

  // Active — button with badge
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

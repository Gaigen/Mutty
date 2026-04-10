import { AgentMenuDropdown } from './agent-controls/menu/AgentMenuDropdown';
import { AgentStateButton } from './agent-controls/AgentStateButton';
import { ErrorTooltip } from '../ui/agent-primitives';
import { useAgentControlMenu } from '../../hooks/useAgentControlMenu';
import { useAgentState } from '../../hooks/useAgentState';
import { useParticipantVolumes } from '../../context/ParticipantVolumesContext';

interface Props {
  roomName: string;
}

export default function AgentControls({ roomName }: Props) {
  const {
    agentState,
    status,
    error,
    setError,
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
  } = useAgentState(roomName);

  const { menuOpen, setMenuOpen, dropdownBottom, menuRef, queueInputRef } =
    useAgentControlMenu();

  const { volumes, setVolume: setParticipantVolume } = useParticipantVolumes();

  const isActive = agentState === 'active';
  const queueLen = status.queue_length ?? 0;

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <AgentStateButton
        agentState={agentState}
        queueLen={queueLen}
        menuOpen={menuOpen}
        onCall={callAgent}
        onToggleMenu={() =>
          setMenuOpen((o) => {
            if (!o) setError(null);
            return !o;
          })
        }
      />

      {menuOpen && (
        <AgentMenuDropdown
          status={status}
          dropdownBottom={dropdownBottom}
          queueInputRef={queueInputRef}
          volumes={volumes}
          setParticipantVolume={setParticipantVolume}
          onRemoveAgent={() => { setMenuOpen(false); removeAgent(); }}
          onSetMode={setMode}
          onSetQuality={setQuality}
          onStopPlayback={stopPlayback}
          onPausePlayback={pausePlayback}
          onResumePlayback={resumePlayback}
          onSkipTrack={skipTrack}
          onToggleRepeat={toggleRepeat}
          onClearQueue={clearQueue}
          onShuffleQueue={shuffleQueue}
          onAddToQueue={addToQueue}
        />
      )}

      {error && !menuOpen && isActive && <ErrorTooltip>{error}</ErrorTooltip>}
    </div>
  );
}

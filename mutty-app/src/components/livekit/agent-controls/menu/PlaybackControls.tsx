import { PauseIcon, PlayIcon, SkipIcon, RepeatIcon, StopIcon } from '../../../ui/icons/agent-icons';
import { IconButton } from '../../../ui/agent-primitives';

interface Props {
  isPlaying: boolean;
  isPaused: boolean;
  hasMedia: boolean;
  hasQueue: boolean;
  repeat?: boolean;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onToggleRepeat: () => void;
  onStop: () => void;
}

export function PlaybackControls({
  isPlaying,
  isPaused,
  hasMedia,
  hasQueue,
  repeat,
  onPause,
  onResume,
  onSkip,
  onToggleRepeat,
  onStop,
}: Props) {
  return (
    <div style={{ padding: '0.4rem 0.6rem', display: 'flex', gap: 4 }}>
      {isPlaying && (
        <IconButton onClick={onPause} title="Pause">
          <PauseIcon /> Pause
        </IconButton>
      )}
      {isPaused && (
        <IconButton onClick={onResume} title="Resume">
          <PlayIcon /> Resume
        </IconButton>
      )}

      <IconButton
        onClick={onSkip}
        title="Skip to next"
        disabled={!isPlaying && !hasQueue}
      >
        <SkipIcon /> Skip
      </IconButton>

      <IconButton
        onClick={onToggleRepeat}
        active={repeat}
        title={repeat ? 'Repeat: on' : 'Repeat: off'}
        disabled={!hasMedia && !hasQueue}
      >
        <RepeatIcon />
      </IconButton>

      <IconButton
        onClick={onStop}
        title="Stop playback"
        disabled={!hasMedia}
      >
        <StopIcon />
      </IconButton>
    </div>
  );
}

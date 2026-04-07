import type { AgentStatus, Mode, Quality } from '../../../../lib/agent-control';
import { Divider, FullWidthButton } from '../../../ui/agent-primitives';
import { BotIcon } from '../../../ui/icons/agent-icons';
import { NowPlayingSection } from './NowPlayingSection';
import { PlaybackControls } from './PlaybackControls';
import { ModeQualitySection } from './ModeQualitySection';
import { VolumeSection } from './VolumeSection';
import { QueueSection } from './QueueSection';
import { Track } from 'livekit-client';

interface Props {
  status: AgentStatus;
  dropdownBottom: number;
  queueInputRef: React.RefObject<HTMLInputElement | null>;
  onRemoveAgent: () => void;
  onSetMode: (mode: Mode) => void;
  onSetQuality: (quality: Quality) => void;
  onStopPlayback: () => void;
  onPausePlayback: () => void;
  onResumePlayback: () => void;
  onSkipTrack: () => void;
  onToggleRepeat: () => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
  onAddToQueue: (url: string) => void;
  setParticipantVolume: (identity: string, volume: number, source?: Track.Source) => void;
  volumes: Record<string, number>;
}

export function AgentMenuDropdown({
  status,
  dropdownBottom,
  queueInputRef,
  onRemoveAgent,
  onSetMode,
  onSetQuality,
  onStopPlayback,
  onPausePlayback,
  onResumePlayback,
  onSkipTrack,
  onToggleRepeat,
  onClearQueue,
  onShuffleQueue,
  onAddToQueue,
  setParticipantVolume,
  volumes,
}: Props) {
  const isPlaying = status.playing;
  const isPaused = status.paused ?? false;
  const hasMedia = isPlaying || isPaused;
  const hasQueue = (status.queue_length ?? 0) > 0;

  return (
    <div
      className="mutty-agent-dropdown"
      onClick={(e) => e.stopPropagation()}
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
      {/* Now Playing */}
      {(hasMedia || status.title) && (
        <NowPlayingSection
          isPlaying={isPlaying}
          isPaused={isPaused}
          title={status.title}
          url={status.url}
        />
      )}

      {/* Playback Controls */}
      <PlaybackControls
        isPlaying={isPlaying}
        isPaused={isPaused}
        hasMedia={hasMedia}
        hasQueue={hasQueue}
        repeat={status.repeat}
        onPause={onPausePlayback}
        onResume={onResumePlayback}
        onSkip={onSkipTrack}
        onToggleRepeat={onToggleRepeat}
        onStop={onStopPlayback}
      />
      <Divider />

      {/* Mode + Quality */}
      <ModeQualitySection
        mode={status.mode}
        quality={status.quality ?? '720p'}
        onModeChange={onSetMode}
        onQualityChange={onSetQuality}
      />

      {/* Volume */}
      <VolumeSection
        volumes={volumes}
        setParticipantVolume={setParticipantVolume}
      />

      {/* Queue */}
      <QueueSection
        queueLength={status.queue_length ?? 0}
        queueDisplay={status.queue_display}
        onShuffle={onShuffleQueue}
        onClear={onClearQueue}
        onAddToQueue={onAddToQueue}
        inputRef={queueInputRef}
      />
      <Divider />

      {/* Remove agent */}
      <FullWidthButton onClick={onRemoveAgent} danger title="Disconnect the bot from this room">
        <BotIcon /> Remove agent
      </FullWidthButton>
    </div>
  );
}

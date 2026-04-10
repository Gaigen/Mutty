import * as React from 'react';
import { useCallback, useState } from 'react';
import type { Participant } from 'livekit-client';
import { RemoteTrackPublication, Track } from 'livekit-client';
import type { ParticipantClickEvent, TrackReferenceOrPlaceholder } from '@livekit/components-core';
import { isEqualTrackRef, isTrackReference, isTrackReferencePinned } from '@livekit/components-core';
import {
  AudioTrack,
  ConnectionQualityIndicator,
  FocusToggle,
  LockLockedIcon,
  ParticipantContext,
  ParticipantName,
  ParticipantPlaceholder,
  ScreenShareIcon,
  TrackMutedIndicator,
  TrackRefContext,
  VideoTrack,
  useEnsureTrackRef,
  useFeatureContext,
  useIsEncrypted,
  useMaybeLayoutContext,
  useMaybeParticipantContext,
  useMaybeTrackRefContext,
  useParticipantTile,
} from '@livekit/components-react';
import { participantVolumeKey, useParticipantVolumes } from '../../context/ParticipantVolumesContext';
import { AVATAR_IDS, type AvatarId } from '../../config';
import { hiddenTrackKey, toggleHiddenTrack, useHiddenTracks } from '../../store/hiddenTracks';
import { ParticipantVolumeMenu } from './participant-volume-menu';

function parseAvatarFromMetadata(metadata: string | undefined): AvatarId | null {
  if (!metadata?.trim()) return null;
  try {
    const parsed = JSON.parse(metadata) as { avatar?: string };
    const a = parsed?.avatar;
    if (typeof a === 'string' && AVATAR_IDS.includes(a as AvatarId)) return a as AvatarId;
  } catch {
    /* ignore */
  }
  return null;
}

function AvatarPlaceholder() {
  const participant = useMaybeParticipantContext();
  const avatarId = participant?.metadata ? parseAvatarFromMetadata(participant.metadata) : null;

  if (avatarId) {
    return (
      <img
        src={`/avatars/${avatarId}.svg`}
        alt=""
        className="lk-participant-placeholder-avatar"
        style={{  objectFit: 'contain' }}
      />
    );
  }

  return <ParticipantPlaceholder />;
}

function TrackRefContextIfNeeded({
  trackRef,
  children,
}: React.PropsWithChildren<{ trackRef?: TrackReferenceOrPlaceholder }>) {
  const hasContext = !!useMaybeTrackRefContext();
  return trackRef && !hasContext ? (
    <TrackRefContext.Provider value={trackRef}>{children}</TrackRefContext.Provider>
  ) : (
    <>{children}</>
  );
}

function ParticipantContextIfNeeded({
  participant,
  children,
}: React.PropsWithChildren<{ participant?: Participant }>) {
  const hasContext = !!useMaybeParticipantContext();
  return participant && !hasContext ? (
    <ParticipantContext.Provider value={participant}>{children}</ParticipantContext.Provider>
  ) : (
    <>{children}</>
  );
}

interface HideTrackButtonProps {
  trackRef: TrackReferenceOrPlaceholder;
}

function HideTrackButton({ trackRef }: HideTrackButtonProps) {
  const identity = trackRef.participant.identity;
  const source = trackRef.source ?? Track.Source.Camera;
  const key = hiddenTrackKey(identity, source);
  const hiddenSet = useHiddenTracks();
  const isHidden = hiddenSet.has(key);

  return (
    <button
      className="lk-button lk-hide-track-button"
      title={isHidden ? 'Show video' : 'Hide video'}
      aria-label={isHidden ? 'Show video' : 'Hide video'}
      aria-pressed={isHidden}
      onClick={(e) => {
        e.stopPropagation();
        toggleHiddenTrack(key);
      }}
    >
      {isHidden ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function FullscreenEnterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function FullscreenExitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14v4h4M20 10V6h-4M4 10V6h4M20 14v4h-4" />
    </svg>
  );
}

export interface ParticipantTileWithActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  trackRef?: TrackReferenceOrPlaceholder;
  disableSpeakingIndicator?: boolean;
  onParticipantClick?: (event: ParticipantClickEvent) => void;
}

const ParticipantTileWithActionsInner = React.forwardRef<
  HTMLDivElement,
  ParticipantTileWithActionsProps
>(function ParticipantTileWithActionsInner(
  { trackRef, children, onParticipantClick, disableSpeakingIndicator, ...htmlProps },
  ref,
) {
  const trackReference = useEnsureTrackRef(trackRef);

  const { elementProps } = useParticipantTile<HTMLDivElement>({
    htmlProps,
    disableSpeakingIndicator,
    onParticipantClick,
    trackRef: trackReference,
  });

  const isEncrypted = useIsEncrypted(trackReference.participant);
  const layoutContext = useMaybeLayoutContext();
  const autoManageSubscription = useFeatureContext()?.autoSubscription;

  const identity = trackReference.participant.identity;
  const source = trackReference.source ?? Track.Source.Camera;
  const hiddenKey = hiddenTrackKey(identity, source);
  const hiddenSet = useHiddenTracks();
  const isVideoHidden = hiddenSet.has(hiddenKey);

  const { volumes, setVolume } = useParticipantVolumes();
  const voiceVolumeKey = participantVolumeKey(identity, Track.Source.Microphone);
  const screenVolumeKey = participantVolumeKey(identity, Track.Source.ScreenShareAudio);
  const voiceVolume = volumes[voiceVolumeKey] ?? 1;
  const screenVolume = volumes[screenVolumeKey] ?? 1;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [hasScreenShare, setHasScreenShare] = useState(false);

  const screenSharePub = trackReference.participant.getTrackPublication(Track.Source.ScreenShare);
  React.useEffect(() => {
    setHasScreenShare(!!screenSharePub);
  }, [screenSharePub]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (trackReference.participant.isLocal) return;
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [trackReference.participant.isLocal],
  );

  const handleVoiceVolumeChange = useCallback(
    (vol: number) => {
      setVolume(identity, vol, Track.Source.Microphone);
    },
    [identity, setVolume],
  );

  const handleScreenVolumeChange = useCallback(
    (vol: number) => {
      setVolume(identity, vol, Track.Source.ScreenShareAudio);
    },
    [identity, setVolume],
  );

  // Sync track subscription with hidden state for remote tracks (saves bandwidth)
  React.useEffect(() => {
    const pub = trackReference.publication;
    if (!pub || trackReference.participant.isLocal) return;
    if (pub instanceof RemoteTrackPublication) {
      pub.setSubscribed(!isVideoHidden);
    }
  }, [isVideoHidden, trackReference.publication, trackReference.participant.isLocal]);

  const handleSubscribe = React.useCallback(
    (subscribed: boolean) => {
      if (
        trackReference.source &&
        !subscribed &&
        layoutContext &&
        layoutContext.pin.dispatch &&
        isTrackReferencePinned(trackReference, layoutContext.pin.state)
      ) {
        layoutContext.pin.dispatch({ msg: 'clear_pin' });
      }
    },
    [trackReference, layoutContext],
  );

  const isVideoSource =
    isTrackReference(trackReference) &&
    (trackReference.publication?.kind === 'video' ||
      trackReference.source === Track.Source.Camera ||
      trackReference.source === Track.Source.ScreenShare);

  const streamShellRef = React.useRef<HTMLDivElement>(null);
  const [streamShellFullscreen, setStreamShellFullscreen] = React.useState(false);

  const isPinned =
    !!layoutContext?.pin.state &&
    isTrackReferencePinned(trackReference, layoutContext.pin.state);

  React.useEffect(() => {
    const shell = streamShellRef.current;
    const onFs = () => setStreamShellFullscreen(!!shell && document.fullscreenElement === shell);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  React.useEffect(() => {
    const shell = streamShellRef.current;
    if (!isPinned && shell && document.fullscreenElement === shell) {
      void document.exitFullscreen().catch(() => {});
    }
  }, [isPinned]);

  const toggleStreamFullscreen = React.useCallback(() => {
    const el = streamShellRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void el.requestFullscreen().catch(() => {});
    }
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }} {...elementProps} onContextMenu={trackReference.participant.isLocal ? undefined : handleContextMenu}>
      <TrackRefContextIfNeeded trackRef={trackReference}>
        <ParticipantContextIfNeeded participant={trackReference.participant}>
          {children ?? (
            <>
              <div ref={streamShellRef} className="lk-participant-stream-shell">
                {isVideoSource ? (
                  <VideoTrack
                    trackRef={trackReference}
                    onSubscriptionStatusChanged={handleSubscribe}
                    manageSubscription={autoManageSubscription}
                    style={isVideoHidden ? { visibility: 'hidden' } : undefined}
                  />
                ) : (
                  isTrackReference(trackReference) && (
                    <AudioTrack
                      trackRef={trackReference}
                      onSubscriptionStatusChanged={handleSubscribe}
                    />
                  )
                )}

                <div
                  className="lk-participant-placeholder"
                  style={isVideoHidden && isVideoSource ? { opacity: 1 } : undefined}
                >
                  <AvatarPlaceholder />
                </div>

                {isVideoHidden && isVideoSource && (
                  <div className="lk-hidden-video-overlay" aria-hidden="true">
                    <EyeOffIcon />
                    <span>Video hidden</span>
                  </div>
                )}

                {isPinned && isVideoSource && streamShellFullscreen && (
                  <button
                    type="button"
                    className="lk-button lk-stream-fs-exit"
                    title="Exit fullscreen"
                    aria-label="Exit fullscreen"
                    onClick={(e) => {
                      e.stopPropagation();
                      void document.exitFullscreen().catch(() => {});
                    }}
                  >
                    <FullscreenExitIcon />
                  </button>
                )}
              </div>

              <div className="lk-participant-metadata">
                <div className="lk-participant-metadata-item">
                  {trackReference.source === Track.Source.Camera ? (
                    <>
                      {isEncrypted && <LockLockedIcon style={{ marginRight: '0.25rem' }} />}
                      <TrackMutedIndicator
                        trackRef={{
                          participant: trackReference.participant,
                          source: Track.Source.Microphone,
                        }}
                        show={'muted'}
                      />
                      <ParticipantName />
                    </>
                  ) : (
                    <>
                      <ScreenShareIcon style={{ marginRight: '0.25rem' }} />
                      <ParticipantName>&apos;s screen</ParticipantName>
                    </>
                  )}
                </div>
                <ConnectionQualityIndicator className="lk-participant-metadata-item" />
              </div>
            </>
          )}

          <div className="lk-tile-controls lk-tile-controls-cluster">
            {isPinned && isVideoSource && (
              <button
                type="button"
                className="lk-button lk-hide-track-button lk-tile-fs-btn"
                title={streamShellFullscreen ? 'Exit fullscreen' : 'Fullscreen (stream only)'}
                aria-label={streamShellFullscreen ? 'Exit fullscreen' : 'Fullscreen stream'}
                aria-pressed={streamShellFullscreen}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStreamFullscreen();
                }}
              >
                {streamShellFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
              </button>
            )}
            {isVideoSource && <HideTrackButton trackRef={trackReference} />}
            <FocusToggle trackRef={trackReference} />
          </div>
        </ParticipantContextIfNeeded>
      </TrackRefContextIfNeeded>

      {contextMenu && (
        <ParticipantVolumeMenu
          x={contextMenu.x}
          y={contextMenu.y}
          voiceVolume={voiceVolume}
          screenVolume={screenVolume}
          hasScreenShare={hasScreenShare}
          participantName={trackReference.participant.name || trackReference.participant.identity || 'Unknown'}
          onVoiceVolumeChange={handleVoiceVolumeChange}
          onScreenVolumeChange={handleScreenVolumeChange}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
});

function participantTilePropsAreEqual(
  prev: ParticipantTileWithActionsProps,
  next: ParticipantTileWithActionsProps,
): boolean {
  if (prev.trackRef !== next.trackRef) {
    if (!prev.trackRef || !next.trackRef) return false;
    return isEqualTrackRef(prev.trackRef, next.trackRef);
  }
  return prev.disableSpeakingIndicator === next.disableSpeakingIndicator;
}

export const ParticipantTileWithActions = React.memo(ParticipantTileWithActionsInner, participantTilePropsAreEqual);

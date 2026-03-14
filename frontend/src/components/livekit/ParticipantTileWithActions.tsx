import * as React from 'react';
import type { Participant } from 'livekit-client';
import { RemoteTrackPublication, Track } from 'livekit-client';
import type { ParticipantClickEvent, TrackReferenceOrPlaceholder } from '@livekit/components-core';
import { isTrackReference, isTrackReferencePinned } from '@livekit/components-core';
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
import { hiddenTrackKey, toggleHiddenTrack, useHiddenTracks } from '../../store/hiddenTracks';

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

export interface ParticipantTileWithActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  trackRef?: TrackReferenceOrPlaceholder;
  disableSpeakingIndicator?: boolean;
  onParticipantClick?: (event: ParticipantClickEvent) => void;
}

export const ParticipantTileWithActions = React.forwardRef<
  HTMLDivElement,
  ParticipantTileWithActionsProps
>(function ParticipantTileWithActions(
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

  return (
    <div ref={ref} style={{ position: 'relative' }} {...elementProps}>
      <TrackRefContextIfNeeded trackRef={trackReference}>
        <ParticipantContextIfNeeded participant={trackReference.participant}>
          {children ?? (
            <>
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

              {/* Placeholder when video muted OR manually hidden */}
              <div
                className="lk-participant-placeholder"
                style={isVideoHidden && isVideoSource ? { opacity: 1 } : undefined}
              >
                <ParticipantPlaceholder />
              </div>

              {/* Overlay shown when video is manually hidden */}
              {isVideoHidden && isVideoSource && (
                <div className="lk-hidden-video-overlay" aria-hidden="true">
                  <EyeOffIcon />
                  <span>Video hidden</span>
                </div>
              )}

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

          {/* Action buttons group: hide toggle + focus toggle */}
          <div className="lk-tile-controls">
            {isVideoSource && <HideTrackButton trackRef={trackReference} />}
            <FocusToggle trackRef={trackReference} />
          </div>
        </ParticipantContextIfNeeded>
      </TrackRefContextIfNeeded>
    </div>
  );
});

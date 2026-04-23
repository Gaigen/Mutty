import { useRoomContext } from '@livekit/components-react';
import { type ScreenShareCaptureOptions, type TrackPublishOptions } from 'livekit-client';
import { useEffect } from 'react';
import { getScreenShareSettings } from '../../hooks/useScreenShareSettings';

/**
 * Applies screen share settings (resolution, fps, codec) on each share start.
 * publishOptions with videoCodec passed explicitly — otherwise LiveKit may fall back to VP8.
 */
export default function ScreenShareHandler() {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;

    const lp = room.localParticipant;
    const origCreateScreenTracks = lp.createScreenTracks.bind(lp);
    const origSetScreenShareEnabled = lp.setScreenShareEnabled.bind(lp);

    lp.createScreenTracks = async function (options?: ScreenShareCaptureOptions) {
      const s = getScreenShareSettings();
      return origCreateScreenTracks({
        ...options,
        resolution: {
          width: s.resolution.width,
          height: s.resolution.height,
          frameRate: s.frameRate,
          ...options?.resolution,
        },
        contentHint: options?.contentHint ?? s.contentHint,
      });
    };

    lp.setScreenShareEnabled = async function (
      enabled: boolean,
      captureOptions?: ScreenShareCaptureOptions,
      publishOptions?: TrackPublishOptions,
    ) {
      if (!enabled) return origSetScreenShareEnabled(enabled, captureOptions, publishOptions);

      const s = getScreenShareSettings();
      const mergedCapture: ScreenShareCaptureOptions = captureOptions ?? {
        resolution: {
          width: s.resolution.width,
          height: s.resolution.height,
          frameRate: s.frameRate,
        },
        contentHint: s.contentHint,
      };
      // Explicitly set videoCodec to avoid falling back to VP8
      const mergedPublish: TrackPublishOptions = {
        videoCodec: s.videoCodec,
        videoEncoding: {
          maxBitrate: s.maxBitrate,
          maxFramerate: s.frameRate,
        },
        ...publishOptions,
      };
      return origSetScreenShareEnabled(enabled, mergedCapture, mergedPublish);
    };

    return () => {
      lp.createScreenTracks = origCreateScreenTracks;
      lp.setScreenShareEnabled = origSetScreenShareEnabled;
    };
  }, [room]);

  return null;
}

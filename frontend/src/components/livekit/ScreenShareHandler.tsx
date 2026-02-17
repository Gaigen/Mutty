import { useRoomContext } from '@livekit/components-react';
import { type ScreenShareCaptureOptions } from 'livekit-client';
import { useEffect } from 'react';
import { getScreenShareSettings } from '../../hooks/useScreenShareSettings';

/**
 * Компонент для применения настроек screen share
 */
export default function ScreenShareHandler() {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;

    const localParticipant = room.localParticipant;
    const originalCreateScreenTracks = localParticipant.createScreenTracks.bind(localParticipant);
    const originalSetScreenShareEnabled = localParticipant.setScreenShareEnabled.bind(localParticipant);

    localParticipant.createScreenTracks = async function (options?: ScreenShareCaptureOptions) {
      const settings = getScreenShareSettings();
      const mergedOptions: ScreenShareCaptureOptions = {
        ...options,
        resolution: {
          ...settings.resolution,
          frameRate: settings.frameRate,
          ...options?.resolution,
        },
        contentHint: options?.contentHint ?? 'motion',
      };
      return originalCreateScreenTracks(mergedOptions);
    };

    localParticipant.setScreenShareEnabled = async function (
      enabled: boolean,
      options?: ScreenShareCaptureOptions,
      publishOptions?: any,
    ) {
      if (enabled && !options) {
        const settings = getScreenShareSettings();
        options = {
          resolution: { ...settings.resolution, frameRate: settings.frameRate },
          contentHint: 'motion',
        };
      }
      return originalSetScreenShareEnabled(enabled, options, publishOptions);
    };

    return () => {
      localParticipant.createScreenTracks = originalCreateScreenTracks;
      localParticipant.setScreenShareEnabled = originalSetScreenShareEnabled;
    };
  }, [room]);

  return null;
}

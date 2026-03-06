import { Track } from 'livekit-client';
import * as React from 'react';
import {
  MediaDeviceMenu,
  DisconnectButton,
  TrackToggle,
  ChatToggle,
  StartMediaButton,
  useLocalParticipantPermissions,
} from '@livekit/components-react';
import { useUserChoicesContext } from '../../context/UserChoicesContext';
import { supportsScreenSharing } from '@livekit/components-core';

type CustomControlBarControls = {
  microphone?: boolean;
  camera?: boolean;
  chat?: boolean;
  screenShare?: boolean;
  leave?: boolean;
};

export interface CustomControlBarProps extends React.HTMLAttributes<HTMLDivElement> {
  controls?: CustomControlBarControls;
  rightControls?: React.ReactNode;
}

const trackSourceToProtocol = (source: Track.Source) => {
  switch (source) {
    case Track.Source.Camera:
      return 1;
    case Track.Source.Microphone:
      return 2;
    case Track.Source.ScreenShare:
      return 3;
    default:
      return 0;
  }
};

export function CustomControlBar({ controls, rightControls, style, ...props }: CustomControlBarProps) {
  const visibleControls: CustomControlBarControls = { leave: true, ...controls };

  const localPermissions = useLocalParticipantPermissions();

  if (!localPermissions) {
    visibleControls.camera = false;
    visibleControls.chat = false;
    visibleControls.microphone = false;
    visibleControls.screenShare = false;
  } else {
    const canPublishSource = (source: Track.Source) => {
      return (
        localPermissions.canPublish &&
        (localPermissions.canPublishSources.length === 0 ||
          localPermissions.canPublishSources.includes(trackSourceToProtocol(source)))
      );
    };

    visibleControls.camera ??= canPublishSource(Track.Source.Camera);
    visibleControls.microphone ??= canPublishSource(Track.Source.Microphone);
    visibleControls.screenShare ??= canPublishSource(Track.Source.ScreenShare);
    visibleControls.chat ??= localPermissions.canPublishData && (controls?.chat ?? true);
  }

  const browserSupportsScreenSharing = supportsScreenSharing();

  const [isScreenShareEnabled, setIsScreenShareEnabled] = React.useState(false);

  const onScreenShareChange = React.useCallback((enabled: boolean) => {
    setIsScreenShareEnabled(enabled);
  }, []);

  const userChoices = useUserChoicesContext();
  const saveAudioInputEnabled = userChoices?.saveAudioInputEnabled ?? (() => {});
  const saveVideoInputEnabled = userChoices?.saveVideoInputEnabled ?? (() => {});
  const saveAudioInputDeviceId = userChoices?.saveAudioInputDeviceId ?? (() => {});
  const saveVideoInputDeviceId = userChoices?.saveVideoInputDeviceId ?? (() => {});

  const microphoneOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) => {
      if (isUserInitiated) {
        saveAudioInputEnabled(enabled);
      }
    },
    [saveAudioInputEnabled],
  );

  const cameraOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) => {
      if (isUserInitiated) {
        saveVideoInputEnabled(enabled);
      }
    },
    [saveVideoInputEnabled],
  );

  return (
    <div
      className="lk-control-bar"
      style={{
        ...(style || {}),
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}
      {...props}
    >
      {visibleControls.microphone && (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon
            onChange={microphoneOnChange}
          >
            Microphone
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="audioinput"
              onActiveDeviceChange={(_kind, deviceId) =>
                saveAudioInputDeviceId(deviceId ?? 'default')
              }
            />
          </div>
        </div>
      )}

      {visibleControls.camera && (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Camera}
            showIcon
            onChange={cameraOnChange}
          >
            Camera
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="videoinput"
              onActiveDeviceChange={(_kind, deviceId) =>
                saveVideoInputDeviceId(deviceId ?? 'default')
              }
            />
          </div>
        </div>
      )}

      {visibleControls.screenShare && browserSupportsScreenSharing && (
        <TrackToggle
          source={Track.Source.ScreenShare}
          captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
          showIcon
          onChange={onScreenShareChange}
        >
          {isScreenShareEnabled ? 'Stop screen share' : 'Share screen'}
        </TrackToggle>
      )}

      {visibleControls.chat && (
        <ChatToggle>
          Chat
        </ChatToggle>
      )}

      {visibleControls.leave && <DisconnectButton>Leave</DisconnectButton>}

      {rightControls && (
        <div
          style={{
            right: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {rightControls}
        </div>
      )}

      <StartMediaButton />
    </div>
  );
}


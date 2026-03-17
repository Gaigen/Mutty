import { Track } from 'livekit-client';
import * as React from 'react';
import {
  MediaDeviceMenu,
  DisconnectButton,
  TrackToggle,
  ChatToggle,
  StartMediaButton,
  useLocalParticipantPermissions,
  useRoomContext,
} from '@livekit/components-react';
import { useUserChoicesContext } from '../../context/UserChoicesContext';
import { useAudioMute } from '../../context/AudioMuteContext';
import { supportsScreenSharing } from '@livekit/components-core';

function HeadphoneMuteIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="1em"
      height="1em"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden
      style={{ overflow: 'visible' }}
    >
      <path d="M8 3a5 5 0 0 0-5 5v1h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a6 6 0 1 1 12 0v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1V8a5 5 0 0 0-5-5" />
      {muted && (
        <line
          x1="2"
          y1="2"
          x2="14"
          y2="14"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

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
  const room = useRoomContext();
  const { isAudioMuted, toggleAudioMuted } = useAudioMute();
  const micEnabledBeforeFullMute = React.useRef<boolean | null>(null);

  const localPermissions = useLocalParticipantPermissions();

  React.useEffect(() => {
    if (!room) return;
    if (isAudioMuted) {
      micEnabledBeforeFullMute.current = room.localParticipant.isMicrophoneEnabled;
      room.localParticipant.setMicrophoneEnabled(false);
    } else {
      if (micEnabledBeforeFullMute.current !== null) {
        room.localParticipant.setMicrophoneEnabled(micEnabledBeforeFullMute.current);
        micEnabledBeforeFullMute.current = null;
      }
    }
  }, [room, isAudioMuted]);

  React.useEffect(() => {
    if (!room || !isAudioMuted) return;
    if (room.localParticipant.isMicrophoneEnabled) {
      room.localParticipant.setMicrophoneEnabled(false);
    }
  });

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

  const onAudioDeviceChange = React.useCallback(
    (_kind: MediaDeviceKind, deviceId: string | undefined) => {
      saveAudioInputDeviceId(deviceId ?? 'default');
    },
    [saveAudioInputDeviceId],
  );

  const onVideoDeviceChange = React.useCallback(
    (_kind: MediaDeviceKind, deviceId: string | undefined) => {
      saveVideoInputDeviceId(deviceId ?? 'default');
    },
    [saveVideoInputDeviceId],
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
            <MediaDeviceMenu kind="audioinput" onActiveDeviceChange={onAudioDeviceChange} />
          </div>
        </div>
      )}

      {visibleControls.microphone && (
        <button
          type="button"
          className="lk-button lk-chat-toggle"
          aria-pressed={isAudioMuted}
          aria-label={isAudioMuted ? 'Unmute all audio' : 'Mute all audio'}
          title={isAudioMuted ? 'Unmute all audio (incoming + outgoing)' : 'Mute all audio (incoming + outgoing)'}
          onClick={toggleAudioMuted}
          style={{ padding: '0.9rem 1rem', minWidth: '2.5rem' }}
        >
          <HeadphoneMuteIcon muted={isAudioMuted} />
        </button>
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
            <MediaDeviceMenu kind="videoinput" onActiveDeviceChange={onVideoDeviceChange} />
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


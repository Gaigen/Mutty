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
  useLocalParticipant,
} from '@livekit/components-react';
import {
  Mic, MicOff,
  Video, VideoOff,
  Headphones, HeadphoneOff,
  ScreenShare, ScreenShareOff,
  MessageSquare,
  LogOut,
} from 'lucide-react';
import { useUserChoicesContext } from '../../context/UserChoicesContext';
import { useAudioMute } from '../../context/AudioMuteContext';
import { supportsScreenSharing } from '@livekit/components-core';
import { useOverflowControls, type ControlDef } from '../../hooks/useOverflowControls';
import { BurgerMenu } from './BurgerMenu';

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
    case Track.Source.Camera:      return 1;
    case Track.Source.Microphone:  return 2;
    case Track.Source.ScreenShare: return 3;
    default:                       return 0;
  }
};

const CONTROL_DEFS: ControlDef[] = [
  { id: 'microphone',    priority: 0, estimatedWidth: 80 },
  { id: 'camera',        priority: 0, estimatedWidth: 80 },
  { id: 'headphones',    priority: 0, estimatedWidth: 42 },
  { id: 'leave',         priority: 0, estimatedWidth: 42 },
  { id: 'screenShare',   priority: 1, estimatedWidth: 42 },
  { id: 'chat',          priority: 2, estimatedWidth: 42 },
  { id: 'rightControls', priority: 3, estimatedWidth: 120 },
];

export function CustomControlBar({ controls, rightControls, style, ...props }: CustomControlBarProps) {
  const visibleControls: CustomControlBarControls = { leave: true, ...controls };
  const room = useRoomContext();
  const { isAudioMuted, toggleAudioMuted } = useAudioMute();
  const { isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
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
    const canPublishSource = (source: Track.Source) =>
      localPermissions.canPublish &&
      (localPermissions.canPublishSources.length === 0 ||
        localPermissions.canPublishSources.includes(trackSourceToProtocol(source)));

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
  const saveAudioInputEnabled  = userChoices?.saveAudioInputEnabled  ?? (() => {});
  const saveVideoInputEnabled  = userChoices?.saveVideoInputEnabled  ?? (() => {});
  const saveAudioInputDeviceId = userChoices?.saveAudioInputDeviceId ?? (() => {});
  const saveVideoInputDeviceId = userChoices?.saveVideoInputDeviceId ?? (() => {});

  const microphoneOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) => {
      if (isUserInitiated) saveAudioInputEnabled(enabled);
    },
    [saveAudioInputEnabled],
  );

  const cameraOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) => {
      if (isUserInitiated) saveVideoInputEnabled(enabled);
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

  // Filter control defs to only those that are actually enabled
  const activeDefs = React.useMemo(() => {
    return CONTROL_DEFS.filter((def) => {
      switch (def.id) {
        case 'microphone':  return visibleControls.microphone;
        case 'camera':      return visibleControls.camera;
        case 'headphones':  return visibleControls.microphone;
        case 'screenShare': return visibleControls.screenShare && browserSupportsScreenSharing;
        case 'chat':        return visibleControls.chat;
        case 'rightControls': return !!rightControls;
        case 'leave':       return visibleControls.leave;
        default:            return false;
      }
    });
  }, [visibleControls, browserSupportsScreenSharing, rightControls]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const { visibleIds, burgerIds, showBurger } = useOverflowControls(containerRef, activeDefs);

  const hasBurgerContent = (
    burgerIds.has('screenShare') ||
    burgerIds.has('chat') ||
    burgerIds.has('rightControls')
  );

  return (
    <div
      ref={containerRef}
      className="lk-control-bar mutty-cb"
      style={{ ...(style || {}), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
      {...props}
    >
      {/* Mic + device picker */}
      {visibleControls.microphone && (
        <div className="lk-button-group mutty-split" data-control-id="microphone">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon={false}
            onChange={microphoneOnChange}
            aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
            title={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isMicrophoneEnabled ? <Mic size={18} aria-hidden /> : <MicOff size={18} aria-hidden />}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu kind="audioinput" onActiveDeviceChange={onAudioDeviceChange} />
          </div>
        </div>
      )}

      {/* Camera + device picker */}
      {visibleControls.camera && (
        <div className="lk-button-group mutty-split" data-control-id="camera">
          <TrackToggle
            source={Track.Source.Camera}
            showIcon={false}
            onChange={cameraOnChange}
            aria-label={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
            title={isCameraEnabled ? 'Turn on camera' : 'Turn on camera'}
          >
            {isCameraEnabled ? <Video size={18} aria-hidden /> : <VideoOff size={18} aria-hidden />}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu kind="videoinput" onActiveDeviceChange={onVideoDeviceChange} />
          </div>
        </div>
      )}

      {/* Mute all audio (headphones) */}
      {visibleControls.microphone && (
        <div data-control-id="headphones">
          <button
            type="button"
            className="lk-button"
            aria-pressed={isAudioMuted}
            aria-label={isAudioMuted ? 'Unmute all audio' : 'Mute all audio'}
            title={isAudioMuted ? 'Unmute all audio' : 'Mute all audio'}
            onClick={toggleAudioMuted}
          >
            {isAudioMuted
              ? <HeadphoneOff size={18} aria-hidden />
              : <Headphones size={18} aria-hidden />}
          </button>
        </div>
      )}

      {/* Screen share — visible in main bar */}
      {visibleControls.screenShare && browserSupportsScreenSharing && visibleIds.has('screenShare') && (
        <div data-control-id="screenShare">
          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
            showIcon={false}
            onChange={onScreenShareChange}
            aria-label={isScreenShareEnabled ? 'Stop screen share' : 'Share screen'}
            title={isScreenShareEnabled ? 'Stop screen share' : 'Share screen'}
          >
            {isScreenShareEnabled
              ? <ScreenShareOff size={18} aria-hidden />
              : <ScreenShare size={18} aria-hidden />}
          </TrackToggle>
        </div>
      )}

      {/* Chat — visible in main bar */}
      {visibleControls.chat && visibleIds.has('chat') && (
        <div data-control-id="chat">
          <ChatToggle
            aria-label="Toggle chat"
            title="Chat"
          >
            <MessageSquare size={18} aria-hidden />
          </ChatToggle>
        </div>
      )}

      {/* Leave */}
      {visibleControls.leave && (
        <div data-control-id="leave">
          <DisconnectButton
            aria-label="Leave room"
            title="Leave room"
            className="lk-button mutty-danger"
          >
            <LogOut size={18} aria-hidden />
          </DisconnectButton>
        </div>
      )}

      {/* Right controls — visible in main bar */}
      {rightControls && visibleIds.has('rightControls') && (
        <>
          <div className="mutty-cb-divider" />
          <div className="mutty-cb-secondary" data-control-id="rightControls">
            {rightControls}
          </div>
        </>
      )}

      {/* Burger menu for overflowed controls */}
      {showBurger && hasBurgerContent && (
        <BurgerMenu>
          {burgerIds.has('screenShare') && visibleControls.screenShare && browserSupportsScreenSharing && (
            <div className="mutty-burger-item-wrap">
              <TrackToggle
                source={Track.Source.ScreenShare}
                captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
                showIcon={false}
                onChange={onScreenShareChange}
                className="mutty-burger-lk-button"
              >
                {isScreenShareEnabled
                  ? <ScreenShareOff size={16} aria-hidden />
                  : <ScreenShare size={16} aria-hidden />}
                <span className="mutty-burger-item-label">{isScreenShareEnabled ? 'Stop screen share' : 'Share screen'}</span>
              </TrackToggle>
            </div>
          )}
          {burgerIds.has('chat') && visibleControls.chat && (
            <div className="mutty-burger-item-wrap">
              <ChatToggle className="mutty-burger-lk-button">
                <MessageSquare size={16} aria-hidden />
                <span className="mutty-burger-item-label">Chat</span>
              </ChatToggle>
            </div>
          )}
          {burgerIds.has('rightControls') && rightControls && (
            <div className="mutty-burger-right">
              {rightControls}
            </div>
          )}
        </BurgerMenu>
      )}

      <StartMediaButton />
    </div>
  );
}

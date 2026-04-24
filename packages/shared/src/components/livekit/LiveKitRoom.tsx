import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import { type RoomOptions, DisconnectReason } from 'livekit-client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { appConfig } from '../../config';
import { usePlatform } from '../../platform';
import { useAudioSettings, getAudioSettings } from '../../hooks/useAudioSettings';
import { getCameraSettings } from '../../hooks/useCameraSettings';
import { getScreenShareSettings } from '../../hooks/useScreenShareSettings';
import { AudioMuteProvider } from '../../context/AudioMuteContext';
import { UserChoicesProvider } from '../../context/UserChoicesContext';
import { ParticipantVolumesProvider } from '../../context/ParticipantVolumesContext';
import { useTheme } from '../../context/ThemeContext';
import AgentControls from './AgentControls';
import { InviteRoomButton } from './invite-room-button';
import AudioHandler from './AudioHandler';
import ScreenShareHandler from './ScreenShareHandler';
import SoundHandler from './SoundHandler';
import StreamSettings from './StreamSettings';
import { VideoConferenceWithVolume } from './VideoConferenceWithVolume';
import { CollabProvider } from '../../collab';
import { WhiteboardModule } from '../../modules/whiteboard/WhiteboardModule';
import { NotesModule } from '../../modules/notes/NotesModule';

interface LiveKitRoomProps {
  roomName: string;
  identity?: string;
  avatar?: string;
  onLeave: () => void;
  /** Extra components rendered inside LiveKitRoom (e.g. TrayStateSync, HotkeyListener on desktop) */
  extraComponents?: React.ReactNode;
  /** Extra tabs for StreamSettings (e.g. hotkeys, app settings on desktop) */
  extraSettingsTabs?: Array<{ id: string; label: string; content: React.ReactNode }>;
}

function disconnectReasonMessage(reason: DisconnectReason): string {
  switch (reason) {
    case DisconnectReason.DUPLICATE_IDENTITY:  return 'Another device joined with the same name.';
    case DisconnectReason.SERVER_SHUTDOWN:     return 'Server was stopped.';
    case DisconnectReason.PARTICIPANT_REMOVED: return 'You were removed from the room.';
    case DisconnectReason.ROOM_DELETED:        return 'Room was deleted.';
    case DisconnectReason.ROOM_CLOSED:         return 'Room is closed.';
    case DisconnectReason.CONNECTION_TIMEOUT:  return 'Connection timed out.';
    case DisconnectReason.MEDIA_FAILURE:       return 'Media connection failed.';
    case DisconnectReason.JOIN_FAILURE:        return 'Failed to join the room.';
    case DisconnectReason.SIGNAL_CLOSE:        return 'Lost connection to server.';
    default:                                   return 'Connection was unexpectedly closed.';
  }
}


interface MemoizedRightControlsProps {
  roomName: string;
  showStreamSettings: boolean;
  onToggleSettings: () => void;
}

const MemoizedRightControls = React.memo(function MemoizedRightControls({
  roomName,
  showStreamSettings,
  onToggleSettings,
}: MemoizedRightControlsProps) {
  return (
    <>
      <InviteRoomButton roomName={roomName} />
      <AgentControls roomName={roomName} />
      {appConfig.showSettingsButton && (
        <button
          type="button"
          className="lk-button"
          title="Stream Settings"
          aria-label="Stream Settings"
          aria-pressed={showStreamSettings}
          onClick={onToggleSettings}
        >
          <Settings size={15} aria-hidden />
        </button>
      )}
    </>
  );
});

export default function LiveKitRoomComponent({
  roomName,
  identity: providedIdentity,
  avatar,
  onLeave,
  extraComponents,
  extraSettingsTabs,
}: LiveKitRoomProps) {
  const { config } = usePlatform();
  const { resolvedTheme } = useTheme();
  const tokenEndpoint = config.getTokenEndpoint();

  // Desktop may not have a server configured yet
  if (!tokenEndpoint) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        <div className="text-center space-y-4">
          <h2 className="text-xl text-yellow-400">No server configured</h2>
          <p className="text-gray-300 text-sm">Please set up your server URL on the home page.</p>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition"
            onClick={onLeave}
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  // Identity задаётся при монтировании. При навигации RoomPage передаёт identity из URL,
  // поэтому providedIdentity стабилен в рамках сессии комнаты.
  const identity = useMemo(
    () => providedIdentity || `dev-${(crypto.randomUUID?.() ?? Math.random().toString(36)).slice(0, 8)}`,
    [providedIdentity],
  );

  const [connection, setConnection] = useState<{ token: string; serverUrl: string } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [disconnectReason, setDisconnectReason] = useState<DisconnectReason | null>(null);
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const toggleStreamSettings = useCallback(() => setShowStreamSettings((p) => !p), []);
  const { settings: audioSettings } = useAudioSettings();

  const rightControls = useMemo(
    () => (
      <MemoizedRightControls
        roomName={roomName}
        showStreamSettings={showStreamSettings}
        onToggleSettings={toggleStreamSettings}
      />
    ),
    [roomName, showStreamSettings, toggleStreamSettings],
  );

  const fetchToken = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setConnection(null);
    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, identity, avatar: avatar || undefined }),
      });
      if (!response.ok) throw new Error(`Token request failed with status ${response.status}`);
      const data = await response.json();
      if (!data.token) throw new Error('Token payload is empty');
      const wsUrl = typeof data.wsUrl === 'string' ? data.wsUrl.trim() : '';
      if (!wsUrl) throw new Error('Token response missing wsUrl');
      setConnection({ token: data.token, serverUrl: wsUrl });
      setStatus('idle');
    } catch (err) {
      console.error('Failed to get LiveKit token', err);
      setError('Failed to get LiveKit token. Check that the token server is running.');
      setStatus('error');
    }
  }, [tokenEndpoint, roomName, identity, avatar]);

  const handleDisconnected = useCallback((reason?: DisconnectReason) => {
    setConnection(null);
    if (!reason || reason === DisconnectReason.CLIENT_INITIATED) {
      onLeave();
      return;
    }
    setDisconnectReason(reason);
  }, [onLeave]);

  const handleReconnect = useCallback(() => {
    setDisconnectReason(null);
    fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Все defaults читаем из сохранённых настроек — без хардкода
  const roomOptions: RoomOptions = useMemo(() => {
    const audio = getAudioSettings();
    const cam = getCameraSettings();
    const screen = getScreenShareSettings();
    return {
      audioCaptureDefaults: {
        noiseSuppression: audio.noiseSuppression,
        echoCancellation: audio.echoCancellation,
        autoGainControl: audio.autoGainControl,
        voiceIsolation: audio.voiceIsolation,
      },
      videoCaptureDefaults: {
        resolution: { width: cam.width, height: cam.height, frameRate: cam.maxFramerate },
      },
      publishDefaults: {
        videoCodec: cam.videoCodec,
        videoEncoding: { maxBitrate: cam.maxBitrate, maxFramerate: cam.maxFramerate },
        screenShareEncoding: { maxBitrate: screen.maxBitrate, maxFramerate: screen.frameRate },
        simulcast: appConfig.simulcast,
      },
    };
  }, []);

  if (disconnectReason !== null) {
    const message = disconnectReasonMessage(disconnectReason);
    return (
      <div className="flex items-center justify-center h-full text-white">
        <div className="text-center space-y-4">
          <h2 className="text-xl text-yellow-400">Connection lost</h2>
          <p className="text-gray-300 text-sm">{message}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition"
              onClick={handleReconnect}
            >
              Reconnect
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
              onClick={onLeave}
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'loading' || (status === 'idle' && !connection)) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        <div className="text-center space-y-3">
          <h2 className="text-xl">Connecting to LiveKit...</h2>
          <p className="text-gray-400 text-sm">
            Fetching token from {tokenEndpoint}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error' || !connection) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        <div className="text-center space-y-3">
          <h2 className="text-xl text-red-400">Connection error</h2>
          <p className="text-red-400 text-sm">{error}</p>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition"
            onClick={fetchToken}
          >
            Retry
          </button>
          <div className="text-xs text-gray-400">
            Make sure the token server and LiveKit server are running.
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={appConfig.showVideo}
      audio={appConfig.showAudio}
      token={connection.token}
      serverUrl={connection.serverUrl}
      // LiveKit only ships "default" (dark) and "huddle" themes.
      // "default-dark" does not exist and breaks layout variables.
      data-lk-theme={resolvedTheme === 'dark' ? 'default' : 'default'}
      style={{ height: '100vh' }}
      onDisconnected={handleDisconnected}
      options={roomOptions}
    >
      <UserChoicesProvider>
      <ParticipantVolumesProvider>
      <AudioMuteProvider>
      <CollabProvider>
      <VideoConferenceWithVolume
        outputVolume={audioSettings.outputVolume}
        rightControls={rightControls}
      />
      <WhiteboardModule />
      <NotesModule />
      <AudioHandler />
      <SoundHandler />
      <ScreenShareHandler />

      {/* Platform-specific components (e.g. TrayStateSync, HotkeyListener on desktop) */}
      {extraComponents}

      {appConfig.showSettingsButton && (
        <StreamSettings
          isOpen={showStreamSettings}
          onClose={() => setShowStreamSettings(false)}
          extraTabs={extraSettingsTabs}
        />
      )}
      </CollabProvider>
      </AudioMuteProvider>
      </ParticipantVolumesProvider>
      </UserChoicesProvider>
    </LiveKitRoom>
  );
}

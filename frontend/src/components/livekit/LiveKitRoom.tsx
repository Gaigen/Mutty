import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import { type RoomOptions, DisconnectReason } from 'livekit-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAudioSettings, getAudioSettings } from '../../hooks/useAudioSettings';
import AudioHandler from './AudioHandler';
import ScreenShareHandler from './ScreenShareHandler';
import SoundHandler from './SoundHandler';
import StreamSettings from './StreamSettings';
import { VideoConferenceWithVolume } from './VideoConferenceWithVolume';

interface LiveKitRoomProps {
  roomName: string;
  identity?: string;
  onLeave: () => void;
}

function disconnectReasonMessage(reason: DisconnectReason): string {
  switch (reason) {
    case DisconnectReason.DUPLICATE_IDENTITY:  return 'Другое устройство подключилось с тем же именем.';
    case DisconnectReason.SERVER_SHUTDOWN:     return 'Сервер был остановлен.';
    case DisconnectReason.PARTICIPANT_REMOVED: return 'Вас удалили из комнаты.';
    case DisconnectReason.ROOM_DELETED:        return 'Комната была удалена.';
    case DisconnectReason.ROOM_CLOSED:         return 'Комната закрыта.';
    case DisconnectReason.CONNECTION_TIMEOUT:  return 'Превышено время ожидания соединения.';
    case DisconnectReason.MEDIA_FAILURE:       return 'Ошибка медиа-соединения.';
    case DisconnectReason.JOIN_FAILURE:        return 'Не удалось войти в комнату.';
    case DisconnectReason.SIGNAL_CLOSE:        return 'Потеряна связь с сервером.';
    default:                                   return 'Соединение неожиданно прервалось.';
  }
}

function GearIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default function LiveKitRoomComponent({ roomName, identity: providedIdentity, onLeave }: LiveKitRoomProps) {
  const defaultServerUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://127.0.0.1:7880';
  const tokenEndpoint = import.meta.env.VITE_TOKEN_ENDPOINT || 'http://127.0.0.1:4000/api/token';

  // Стабильный identity — вычисляется один раз, не пересоздаётся на каждом рендере
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const identity = useMemo(
    () => providedIdentity || `dev-${(crypto.randomUUID?.() ?? Math.random().toString(36)).slice(0, 8)}`,
    [],
  );

  const [connection, setConnection] = useState<{ token: string; serverUrl: string } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [disconnectReason, setDisconnectReason] = useState<DisconnectReason | null>(null);
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const { settings: audioSettings } = useAudioSettings();

  const fetchToken = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setConnection(null);
    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, identity }),
      });
      if (!response.ok) throw new Error(`Token request failed with status ${response.status}`);
      const data = await response.json();
      if (!data.token) throw new Error('Token payload is empty');
      setConnection({ token: data.token, serverUrl: data.wsUrl || defaultServerUrl });
      setStatus('idle');
    } catch (err) {
      console.error('Failed to get LiveKit token', err);
      setError('Не удалось получить токен LiveKit. Проверь dev token сервер.');
      setStatus('error');
    }
  }, [tokenEndpoint, roomName, identity, defaultServerUrl]);

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

  // audioCaptureDefaults читаем из сохранённых настроек, чтобы первый захват микрофона
  // сразу использовал правильные параметры, а не дефолты браузера
  const roomOptions: RoomOptions = useMemo(() => {
    const audio = getAudioSettings();
    return {
      audioCaptureDefaults: {
        noiseSuppression: audio.noiseSuppression,
        echoCancellation: audio.echoCancellation,
        autoGainControl: audio.autoGainControl,
        voiceIsolation: audio.voiceIsolation,
      },
      publishDefaults: {
        videoCodec: 'av1',
        videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 60 },
        screenShareEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
        simulcast: false,
      },
    };
  }, []);

  if (disconnectReason !== null) {
    const message = disconnectReasonMessage(disconnectReason);
    return (
      <div className="flex items-center justify-center h-full text-white">
        <div className="text-center space-y-4">
          <h2 className="text-xl text-yellow-400">Соединение разорвано</h2>
          <p className="text-gray-300 text-sm">{message}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition"
              onClick={handleReconnect}
            >
              Переподключиться
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
              onClick={onLeave}
            >
              На главную
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
          <h2 className="text-xl">Подключаемся к LiveKit...</h2>
          <p className="text-gray-400 text-sm">
            Получаем токен из dev token сервера ({tokenEndpoint}).
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error' || !connection) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        <div className="text-center space-y-3">
          <h2 className="text-xl text-red-400">Ошибка подключения</h2>
          <p className="text-red-400 text-sm">{error}</p>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition"
            onClick={fetchToken}
          >
            Повторить попытку
          </button>
          <div className="text-xs text-gray-400">
            Убедись, что `npm run dev:token` и LiveKit сервер запущены.
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={{
        frameRate: { min: 30, ideal: 60, max: 60 },
        resolution: { width: 1280, height: 720 },
      }}
      audio={true}
      token={connection.token}
      serverUrl={connection.serverUrl}
      data-lk-theme="default"
      style={{ height: '100vh' }}
      onDisconnected={handleDisconnected}
      options={roomOptions}
    >
      <VideoConferenceWithVolume outputVolume={audioSettings.outputVolume} />
      <AudioHandler />
      <SoundHandler />
      <ScreenShareHandler />

      {/* Кнопка настроек — React-элемент поверх control bar, без DOM-хаков */}
      <button
        type="button"
        className="lk-button"
        title="Stream Settings"
        aria-label="Stream Settings"
        aria-pressed={showStreamSettings}
        onClick={() => setShowStreamSettings((p) => !p)}
        style={{
          position: 'fixed',
          bottom: '0.75rem',
          right: '0.75rem',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          backgroundColor: showStreamSettings
            ? 'var(--lk-control-active-bg, rgba(255,255,255,0.15))'
            : undefined,
        }}
      >
        <GearIcon />
        <span>Settings</span>
      </button>

      <StreamSettings isOpen={showStreamSettings} onClose={() => setShowStreamSettings(false)} />
    </LiveKitRoom>
  );
}

import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { type RoomOptions } from 'livekit-client';
import { useCallback, useEffect, useState } from 'react';
import ScreenShareHandler from './ScreenShareHandler';
import StreamSettings from './StreamSettings';
import { useScreenShareSettings } from '../../hooks/useScreenShareSettings';

interface LiveKitRoomProps {
  roomName: string;
  identity?: string;
  onLeave: () => void;
}

export default function LiveKitRoomComponent({ roomName, identity: providedIdentity, onLeave }: LiveKitRoomProps) {
  const defaultServerUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://127.0.0.1:7880';
  const tokenEndpoint = import.meta.env.VITE_TOKEN_ENDPOINT || 'http://127.0.0.1:4000/api/token';
  const identity = providedIdentity || `dev-${(crypto.randomUUID?.() ?? Math.random().toString(36)).slice(0, 8)}`;
  const [connection, setConnection] = useState<{ token: string; serverUrl: string } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const { settings: screenShareSettings } = useScreenShareSettings();

  // Интеграция кнопки в панель управления LiveKit
  useEffect(() => {
    if (!connection) return;

    const addStreamSettingsButton = () => {
      const controlBar = document.querySelector('.lk-control-bar');
      if (!controlBar || controlBar.querySelector('.stream-settings-btn')) return;

      const button = document.createElement('button');
      button.className = 'lk-button lk-button-control stream-settings-btn';
      button.title = 'Stream Settings';
      button.setAttribute('aria-label', 'Stream Settings');
      
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'w-4 h-4');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.style.width = '1rem';
      icon.style.height = '1rem';
      
      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path1.setAttribute('stroke-linecap', 'round');
      path1.setAttribute('stroke-linejoin', 'round');
      path1.setAttribute('stroke-width', '2');
      path1.setAttribute('d', 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z');
      
      const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path2.setAttribute('stroke-linecap', 'round');
      path2.setAttribute('stroke-linejoin', 'round');
      path2.setAttribute('stroke-width', '2');
      path2.setAttribute('d', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z');
      
      icon.appendChild(path1);
      icon.appendChild(path2);
      
      const text = document.createElement('span');
      text.textContent = 'Stream Settings';
      text.style.marginLeft = '0.5rem';
      
      button.appendChild(icon);
      button.appendChild(text);
      button.style.display = 'flex';
      button.style.alignItems = 'center';
      button.style.gap = '0.5rem';
      button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowStreamSettings((prev) => !prev);
      };
      
      controlBar.appendChild(button);
    };

    // Пробуем добавить кнопку с задержкой для рендера панели
    const timer1 = setTimeout(addStreamSettingsButton, 100);
    const timer2 = setTimeout(addStreamSettingsButton, 500);
    
    // Слушаем изменения DOM
    const observer = new MutationObserver(() => {
      addStreamSettingsButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      observer.disconnect();
      const btn = document.querySelector('.stream-settings-btn');
      btn?.remove();
    };
  }, [connection, showStreamSettings]);

  const fetchToken = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setConnection(null);
    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room: roomName,
          identity,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!data.token) {
        throw new Error('Token payload is empty');
      }

      setConnection({
        token: data.token,
        serverUrl: data.wsUrl || defaultServerUrl,
      });
      setStatus('idle');
    } catch (err) {
      console.error('Failed to get LiveKit token', err);
      setError('Не удалось получить токен LiveKit. Проверь dev token сервер.');
      setStatus('error');
    }
  }, [tokenEndpoint, roomName, identity, defaultServerUrl]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  if (status === 'loading' || !connection) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        <div className="text-center space-y-3">
          <h2 className="text-xl">Подключаемся к LiveKit...</h2>
          {error ? (
            <>
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
            </>
          ) : (
            <p className="text-gray-400 text-sm">
              Получаем токен из dev token сервера ({tokenEndpoint}).
            </p>
          )}
        </div>
      </div>
    );
  }

  const roomOptions: RoomOptions = {
    publishDefaults: {
      videoCodec: 'av1',
      videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 60 },
      screenShareEncoding: {
        maxBitrate: 8_000_000,
        maxFramerate: screenShareSettings.frameRate,
      },
      simulcast: false,
    },
  };

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
      onDisconnected={onLeave}
      options={roomOptions as RoomOptions}
    >
      <VideoConference />
      
      <ScreenShareHandler />
      
      {/* Stream Settings Panel */}
      <StreamSettings isOpen={showStreamSettings} onClose={() => setShowStreamSettings(false)} />
    </LiveKitRoom>
  );
}


import React, { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import LiveKitRoomComponent from '../components/livekit/LiveKitRoom';

export interface RoomPageProps {
  /** Extra components rendered inside LiveKitRoom (e.g. TrayStateSync, HotkeyListener on desktop) */
  extraComponents?: React.ReactNode;
  /** Extra tabs for StreamSettings (e.g. hotkeys, app settings on desktop) */
  extraSettingsTabs?: Array<{ id: string; label: string; content: React.ReactNode }>;
}

export default function RoomPage({ extraComponents, extraSettingsTabs }: RoomPageProps = {}) {
  const { roomName } = useParams<{ roomName: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomName) {
      navigate('/');
    }
  }, [roomName, navigate]);

  useEffect(() => {
    if (!roomName) return;
    document.title = `Mutty · ${roomName}`;
    return () => {
      document.title = 'Mutty';
    };
  }, [roomName]);

  if (!roomName) {
    return null;
  }

  const identity = searchParams.get('identity') || undefined;
  const avatar = searchParams.get('avatar') || undefined;

  return (
    <div className="h-screen w-full bg-black">
      <ErrorBoundary onReset={() => navigate('/')}>
        <LiveKitRoomComponent
          roomName={roomName}
          identity={identity}
          avatar={avatar}
          onLeave={() => navigate('/')}
          extraComponents={extraComponents}
          extraSettingsTabs={extraSettingsTabs}
        />
      </ErrorBoundary>
    </div>
  );
}

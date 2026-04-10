import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';

export interface RoomPageProps {
  /**
   * Optional override for the LiveKitRoom component.
   * If not provided, a placeholder is shown (the real component will be
   * wired once LiveKitRoom is moved to shared or each platform provides it).
   */
  LiveKitRoom?: React.ComponentType<{
    roomName: string;
    identity?: string;
    avatar?: string;
    onLeave: () => void;
  }>;
}

export default function RoomPage({ LiveKitRoom }: RoomPageProps = {}) {
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
        {LiveKitRoom ? (
          <LiveKitRoom roomName={roomName} identity={identity} avatar={avatar} onLeave={() => navigate('/')} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            LiveKitRoom component not provided
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}

import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import LiveKitRoomComponent from '@/components/livekit/LiveKitRoom';

export default function RoomPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomName) {
      navigate('/');
    }
  }, [roomName, navigate]);

  if (!roomName) {
    return null;
  }

  const identity = searchParams.get('identity') || undefined;
  const avatar = searchParams.get('avatar') || undefined;

  return (
    <div className="h-screen w-full bg-black">
      <ErrorBoundary onReset={() => navigate('/')}>
        <LiveKitRoomComponent roomName={roomName} identity={identity} avatar={avatar} onLeave={() => navigate('/')} />
      </ErrorBoundary>
    </div>
  );
}


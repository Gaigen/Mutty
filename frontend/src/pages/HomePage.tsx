import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LS_KEYS, appConfig } from '../config';
import { initOnUserGesture } from '../utils/audioContext';
import { generateRandomNickname } from '../utils/randomNickname';

function loadRecentRooms(): string[] {
  try {
    const stored = localStorage.getItem(LS_KEYS.recentRooms);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentRoom(name: string) {
  const rooms = loadRecentRooms().filter((r) => r !== name);
  rooms.unshift(name);
  localStorage.setItem(LS_KEYS.recentRooms, JSON.stringify(rooms.slice(0, appConfig.maxRecentRooms)));
}

export default function HomePage() {
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const savedIdentity = localStorage.getItem(LS_KEYS.identity);
    if (savedIdentity) setDisplayName(savedIdentity);
    setRecentRooms(loadRecentRooms());
  }, []);

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const room = roomName.trim();
    if (!room) return;

    initOnUserGesture();

    const identity = displayName.trim() || generateRandomNickname();
    localStorage.setItem(LS_KEYS.identity, identity);
    saveRecentRoom(room);

    navigate(`/room/${room}?identity=${encodeURIComponent(identity)}`);
  };

  const handleRandomNick = () => {
    setDisplayName(generateRandomNickname());
  };

  const selectRecentRoom = (name: string) => {
    setRoomName(name);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950">
      <div className="p-8 bg-gray-900 rounded-lg border border-gray-800 shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          Voice App
        </h1>

        <form onSubmit={joinRoom} className="flex flex-col gap-4">
          {/* Room name */}
          <div>
            <label htmlFor="room" className="block text-sm font-medium text-gray-400 mb-1">
              Room Name
            </label>
            <input
              type="text"
              id="room"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-500"
              placeholder="Enter room name"
              required
            />
            {/* Recent rooms */}
            {recentRooms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recentRooms.map((room) => (
                  <button
                    key={room}
                    type="button"
                    onClick={() => selectRecentRoom(room)}
                    className="px-2.5 py-0.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-full text-gray-300 hover:text-white transition-colors"
                  >
                    {room}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Display name */}
          <div>
            <label htmlFor="display-name" className="block text-sm font-medium text-gray-400 mb-1">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-purple-500 focus:outline-none text-white placeholder-gray-500"
                placeholder="Leave empty for random nickname"
              />
              <button
                type="button"
                onClick={handleRandomNick}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-400 hover:text-white transition-colors text-lg"
                title="Random nickname"
              >
                🎲
              </button>
            </div>
            {!displayName && (
              <p className="mt-1 text-[11px] text-gray-600">
                Empty = random nickname on join
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition-colors"
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}

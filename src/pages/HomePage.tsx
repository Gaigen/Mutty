import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LS_KEYS, appConfig, AVATAR_IDS, type AvatarId, getServerConfig, setServerUrl, clearServerUrl, isValidServerUrl } from '../config';
import { generateRandomNickname } from '../utils/randomNickname';
import { Settings, X } from 'lucide-react';

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

function isValidAvatarId(id: string): id is AvatarId {
  return AVATAR_IDS.includes(id as AvatarId);
}

export default function HomePage() {
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<AvatarId | ''>('');
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  const [serverUrl, setServerUrlInput] = useState('');
  const [serverError, setServerError] = useState('');
  const [showServerInput, setShowServerInput] = useState(false);
  const [serverConfigured, setServerConfigured] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Mutty';
    const config = getServerConfig();
    if (config) {
      setServerConfigured(true);
      setServerUrlInput(config.serverUrl);
    }
    const savedIdentity = localStorage.getItem(LS_KEYS.identity);
    if (savedIdentity) setDisplayName(savedIdentity);
    const savedAvatar = localStorage.getItem(LS_KEYS.avatar);
    if (savedAvatar && isValidAvatarId(savedAvatar)) setAvatar(savedAvatar);
    setRecentRooms(loadRecentRooms());
  }, []);

  const handleServerSave = () => {
    if (!isValidServerUrl(serverUrl)) {
      setServerError('Please enter a valid URL (e.g. https://your-server.com)');
      return;
    }
    setServerError('');
    setServerUrl(serverUrl.trim());
    setServerConfigured(true);
    setShowServerInput(false);
  };

  const handleChangeServer = () => {
    clearServerUrl();
    setServerConfigured(false);
    setShowServerInput(true);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const room = roomName.trim();
    if (!room) return;

    const identity = displayName.trim() || generateRandomNickname();
    localStorage.setItem(LS_KEYS.identity, identity);
    if (avatar) localStorage.setItem(LS_KEYS.avatar, avatar);
    saveRecentRoom(room);

    const params = new URLSearchParams({ identity });
    if (avatar) params.set('avatar', avatar);
    navigate(`/room/${room}?${params.toString()}`);
  };

  const handleRandomNick = () => {
    setDisplayName(generateRandomNickname());
  };

  const selectRecentRoom = (name: string) => {
    setRoomName(name);
  };

  if (!serverConfigured && !showServerInput) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-950">
        <div className="p-8 bg-gray-900 rounded-lg border border-gray-800 shadow-xl w-full max-w-md">
          <h1 className="text-2xl font-bold mb-2 text-center bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            Mutty
          </h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            Enter your server URL to get started
          </p>

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="server-url" className="block text-sm font-medium text-gray-400 mb-1">
                Server URL
              </label>
              <input
                type="text"
                id="server-url"
                value={serverUrl}
                onChange={(e) => { setServerUrlInput(e.target.value); setServerError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleServerSave(); }}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-500"
                placeholder="https://your-server.com"
                autoFocus
              />
              {serverError && (
                <p className="mt-1 text-xs text-red-400">{serverError}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleServerSave}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition-colors"
            >
              Connect
            </button>

            <p className="text-xs text-gray-600 text-center">
              This should be the URL of your LiveKit token server
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950">
      <div className="p-8 bg-gray-900 rounded-lg border border-gray-800 shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            Mutty
          </h1>
          <button
            type="button"
            onClick={handleChangeServer}
            className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded hover:bg-gray-800"
            title="Change server"
          >
            <Settings size={16} />
          </button>
        </div>

        {showServerInput && (
          <div className="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="server-url" className="text-sm font-medium text-gray-400">
                Server URL
              </label>
              <button
                type="button"
                onClick={() => { setShowServerInput(false); setServerError(''); }}
                className="text-gray-500 hover:text-gray-300"
              >
                <X size={14} />
              </button>
            </div>
            <input
              type="text"
              id="server-url"
              value={serverUrl}
              onChange={(e) => { setServerUrlInput(e.target.value); setServerError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleServerSave(); }}
              className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-500 text-sm"
              placeholder="https://your-server.com"
              autoFocus
            />
            {serverError && (
              <p className="mt-1 text-xs text-red-400">{serverError}</p>
            )}
            <button
              type="button"
              onClick={handleServerSave}
              className="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition-colors"
            >
              Save
            </button>
          </div>
        )}

        <form onSubmit={joinRoom} className="flex flex-col gap-4">
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

          <div>
            <span className="block text-sm font-medium text-gray-400 mb-2">Avatar</span>
            <div className="flex flex-wrap gap-2">
              {AVATAR_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAvatar((prev) => (prev === id ? '' : id))}
                  title={id}
                  className={`w-10 h-10 rounded-lg border-2 transition flex items-center justify-center overflow-hidden ${
                    avatar === id
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                  aria-pressed={avatar === id}
                  aria-label={`Select ${id} avatar`}
                >
                  <img
                    src={`/avatars/${id}.svg`}
                    alt=""
                    className="w-7 h-7 object-contain"
                  />
                </button>
              ))}
            </div>
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

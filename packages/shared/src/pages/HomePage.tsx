import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatform } from '../platform';
import { LS_KEYS, appConfig, AVATAR_IDS, type AvatarId } from '../config';
import { generateRandomNickname } from '../utils/randomNickname';

function isValidAvatarId(id: string): id is AvatarId {
  return AVATAR_IDS.includes(id as AvatarId);
}

export interface HomePageProps {
  /**
   * Optional slot rendered above the room form (e.g. server URL input on desktop).
   * Receives `{ configured: boolean }` so it can conditionally block the form.
   */
  serverUrlSection?: ReactNode;
  /**
   * When true the main join form is hidden (e.g. server not configured yet on desktop).
   * @default false
   */
  hideForm?: boolean;
}

export default function HomePage({ serverUrlSection, hideForm = false }: HomePageProps = {}) {
  const platform = usePlatform();
  const { storage } = platform;
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<AvatarId | ''>('');
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Mutty';

    // Load saved values via storage adapter
    const loadData = async () => {
      const [identity, savedAvatar, rooms] = await Promise.all([
        storage.getAsync<string>(LS_KEYS.identity),
        storage.getAsync<string>(LS_KEYS.avatar),
        storage.getAsync<string[]>(LS_KEYS.recentRooms),
      ]);
      if (identity) setDisplayName(identity);
      if (savedAvatar && isValidAvatarId(savedAvatar)) setAvatar(savedAvatar as AvatarId);
      if (rooms) setRecentRooms(rooms);
    };

    loadData();
  }, [storage]);

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const room = roomName.trim();
    if (!room) return;

    const identity = displayName.trim() || generateRandomNickname();
    storage.set(LS_KEYS.identity, identity);
    if (avatar) storage.set(LS_KEYS.avatar, avatar);

    // Update recent rooms
    const filtered = recentRooms.filter((r) => r !== room);
    filtered.unshift(room);
    const updated = filtered.slice(0, appConfig.maxRecentRooms);
    storage.set(LS_KEYS.recentRooms, updated);

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

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[var(--mutty-stream-shell)]">
      <div className="p-8 bg-[var(--mutty-dropdown-bg)] rounded-lg border border-[var(--mutty-border-1)] shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          Mutty
        </h1>

        {/* Optional server URL section (desktop only) */}
        {serverUrlSection}

        {!hideForm && (
          <form onSubmit={joinRoom} className="flex flex-col gap-4">
            {/* Room name */}
            <div>
              <label htmlFor="room" className="block text-sm font-medium text-[var(--mutty-fg-2)] mb-1">
                Room Name
              </label>
              <input
                type="text"
                id="room"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--mutty-surface-1)] border border-[var(--mutty-border-2)] rounded focus:ring-2 focus:ring-[var(--mutty-accent-1)] focus:outline-none text-[var(--mutty-fg-1)] placeholder-[var(--mutty-fg-3)]"
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
                      className="px-2.5 py-0.5 text-xs bg-[var(--mutty-surface-1)] hover:bg-[var(--mutty-surface-3)] border border-[var(--mutty-border-2)] hover:border-[var(--mutty-border-4)] rounded-full text-[var(--mutty-fg-2)] hover:text-[var(--mutty-fg-1)] transition-colors"
                    >
                      {room}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Display name */}
            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-[var(--mutty-fg-2)] mb-1">
                Display Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 px-4 py-2 bg-[var(--mutty-surface-1)] border border-[var(--mutty-border-2)] rounded focus:ring-2 focus:ring-[var(--mutty-accent-1)] focus:outline-none text-[var(--mutty-fg-1)] placeholder-[var(--mutty-fg-3)]"
                  placeholder="Leave empty for random nickname"
                />
                <button
                  type="button"
                  onClick={handleRandomNick}
                  className="px-3 py-2 bg-[var(--mutty-surface-1)] hover:bg-[var(--mutty-surface-3)] border border-[var(--mutty-border-2)] rounded text-[var(--mutty-fg-2)] hover:text-[var(--mutty-fg-1)] transition-colors text-lg"
                  title="Random nickname"
                >
                  🎲
                </button>
              </div>
              {!displayName && (
                <p className="mt-1 text-[11px] text-[var(--mutty-fg-3)]">
                  Empty = random nickname on join
                </p>
              )}
            </div>

            {/* Avatar picker */}
            <div>
              <span className="block text-sm font-medium text-[var(--mutty-fg-2)] mb-2">Avatar</span>
              <div className="flex flex-wrap gap-2">
                {AVATAR_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAvatar((prev) => (prev === id ? '' : id))}
                    title={id}
                    className={`w-10 h-10 rounded-lg border-2 transition flex items-center justify-center overflow-hidden ${
                      avatar === id
                        ? 'border-[var(--mutty-accent-1)] bg-[color-mix(in_oklch,var(--mutty-accent-1)_20%,transparent)]'
                        : 'border-[var(--mutty-border-2)] bg-[var(--mutty-surface-1)] hover:border-[var(--mutty-border-4)]'
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
              className="w-full py-2 bg-[var(--mutty-accent-1)] hover:bg-[var(--mutty-accent-2)] text-[var(--mutty-fg-10)] font-semibold rounded transition-colors"
            >
              Join Room
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import { useCallback, useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { AVATAR_IDS, LS_KEYS, getServerConfig } from '../../config';
import { generateRandomNickname } from '../../utils/randomNickname';
import { storeGetSync } from '../../lib/store';

function getWebAppUrl(): string {
  const saved = storeGetSync<string>(LS_KEYS.webAppUrl);
  if (saved) return saved;
  const serverConfig = getServerConfig();
  if (serverConfig) return serverConfig.webAppUrl;
  return import.meta.env.VITE_WEB_APP_URL || '';
}

export function InviteRoomButton({ roomName }: { roomName: string }) {
  const [copied, setCopied] = useState(false);

  const buildUrl = useCallback(() => {
    const identity = generateRandomNickname();
    const avatar = AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]!;
    const params = new URLSearchParams();
    params.set('identity', identity);
    params.set('avatar', avatar);
    return `${getWebAppUrl()}/room/${encodeURIComponent(roomName)}?${params.toString()}`;
  }, [roomName]);

  const onClick = async () => {
    const url = buildUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this invite link:', url);
    }
  };

  return (
    <button
      type="button"
      className="lk-button"
      onClick={onClick}
      aria-label="Copy invite link"
      title="Copy invite link (random guest name and avatar for each new link)"
    >
      {copied
        ? <Check size={15} aria-hidden />
        : <UserPlus size={15} aria-hidden />}
    </button>
  );
}

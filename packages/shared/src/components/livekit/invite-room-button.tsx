import { useCallback, useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { AVATAR_IDS } from '../../config';
import { generateRandomNickname } from '../../utils/randomNickname';
import { usePlatform } from '../../platform';

export function InviteRoomButton({ roomName }: { roomName: string }) {
  const { config } = usePlatform();
  const [copied, setCopied] = useState(false);

  const buildUrl = useCallback(() => {
    const identity = generateRandomNickname();
    const avatar = AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]!;
    const params = new URLSearchParams();
    params.set('identity', identity);
    params.set('avatar', avatar);
    const baseUrl = config.getWebAppUrl() || window.location.origin;
    return `${baseUrl}/room/${encodeURIComponent(roomName)}?${params.toString()}`;
  }, [roomName, config]);

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

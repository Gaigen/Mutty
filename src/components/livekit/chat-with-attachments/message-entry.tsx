import type { ReactNode } from 'react';
import type { ChatMessageRow } from './types';

const AVATAR_POOL = [
  'axsolotle', 'bear', 'capybara', 'fox', 'frog',
  'hamster', 'hedgehog', 'monkey', 'otter', 'penguin',
  'raccoon', 'shark', 'skunk',
];

function getAvatar(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = ((hash << 5) - hash) + identity.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_POOL[Math.abs(hash) % AVATAR_POOL.length];
}

export function MessageEntry({
  msg,
  hideName,
  formatter,
}: {
  msg: ChatMessageRow;
  hideName: boolean;
  hideTimestamp: boolean;
  formatter: (m: string) => ReactNode;
}) {
  const isLocal = !!msg.from?.isLocal;
  const identity = msg.from?.identity ?? msg.from?.name ?? '';
  const name = msg.from?.name ?? msg.from?.identity ?? '';
  const ts = new Date(msg.timestamp ?? 0);
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const isEdited = !!msg.editTimestamp;
  const timeStr = ts.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const avatarName = getAvatar(identity);

  return (
    <div
      className="lk-chat-entry"
      data-lk-message-origin={isLocal ? 'local' : 'remote'}
    >
      <div className="msg-row" data-origin={isLocal ? 'local' : 'remote'}>
        <div className="msg-avatar">
          <img src={`/avatars/${avatarName}.svg`} alt={name} />
        </div>

        <div className="msg-bubble" data-origin={isLocal ? 'local' : 'remote'}>
          {!isLocal && !hideName && (
            <div className="msg-name">{name}</div>
          )}
          <div className="msg-text">{formatter(msg.message)}</div>
          <div className="msg-time">
            {isEdited && 'edited '}
            {timeStr}
          </div>
        </div>
      </div>
    </div>
  );
}

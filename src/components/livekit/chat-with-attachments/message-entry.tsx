import * as React from 'react';
import type { ReactNode } from 'react';
import type { ChatMessageRow } from './types';
import type { AvatarId } from '../../../config';

const AVATAR_POOL: AvatarId[] = [
  'axsolotle', 'bear', 'capybara', 'fox', 'frog',
  'hamster', 'hedgehog', 'monkey', 'otter', 'penguin',
  'raccoon', 'shark', 'skunk',
];

function getFallbackAvatar(identity: string): AvatarId {
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
  hideAvatar,
  formatter,
  avatarMap,
}: {
  msg: ChatMessageRow;
  hideName: boolean;
  hideAvatar: boolean;
  hideTimestamp: boolean;
  formatter: (m: string) => ReactNode;
  avatarMap: Map<string, string>;
}) {
  const isLocal = !!msg.from?.isLocal;
  const identity = msg.from?.identity ?? msg.from?.name ?? '';
  const name = msg.from?.name ?? msg.from?.identity ?? '';
  const ts = new Date(msg.timestamp ?? 0);
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const isEdited = !!msg.editTimestamp;
  const timeStr = ts.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  const avatarName = avatarMap.get(identity) ?? getFallbackAvatar(identity);
  const [copied, setCopied] = React.useState(false);

  const handleDoubleClick = React.useCallback(() => {
    navigator.clipboard.writeText(msg.message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  }, [msg.message]);

  return (
    <div
      className="lk-chat-entry"
      data-lk-message-origin={isLocal ? 'local' : 'remote'}
    >
      <div className="msg-row" data-origin={isLocal ? 'local' : 'remote'}>
        {!hideAvatar && (
          <div className="msg-avatar">
            <img src={`/avatars/${avatarName}.svg`} alt={name} />
          </div>
        )}

        <div
          className={`msg-bubble${copied ? ' msg-bubble-copied' : ''}`}
          data-origin={isLocal ? 'local' : 'remote'}
          onDoubleClick={handleDoubleClick}
          title="Double-click to copy"
        >
          {!isLocal && !hideName && (
            <div className="msg-name">{name}</div>
          )}
          <div className="msg-text">{formatter(msg.message)}</div>
          <div className="msg-time">
            {isEdited && 'edited '}
            {timeStr}
          </div>
          {copied && <span className="msg-copied-badge">Copied!</span>}
        </div>
      </div>
    </div>
  );
}

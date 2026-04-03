import type { ReactNode } from 'react';
import type { ChatMessageRow } from './types';

export function MessageEntry({
  msg,
  hideName,
  hideTimestamp,
  formatter,
}: {
  msg: ChatMessageRow;
  hideName: boolean;
  hideTimestamp: boolean;
  formatter: (m: string) => ReactNode;
}) {
  const isLocal = !!msg.from?.isLocal;
  const name = msg.from?.name ?? msg.from?.identity ?? '';
  const ts = new Date(msg.timestamp ?? 0);
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const isEdited = !!msg.editTimestamp;
  const showMeta = !hideName || !hideTimestamp || isEdited;

  return (
    <li
      className="lk-chat-entry"
      title={ts.toLocaleTimeString(lang, { timeStyle: 'full' })}
      data-lk-message-origin={isLocal ? 'local' : 'remote'}
    >
      {showMeta && (
        <span className="lk-meta-data">
          {!hideName && <strong className="lk-participant-name">{name}</strong>}
          {(!hideTimestamp || isEdited) && (
            <span className="lk-timestamp">
              {isEdited && 'edited '}
              {ts.toLocaleTimeString(lang, { timeStyle: 'short' })}
            </span>
          )}
        </span>
      )}
      <div className="lk-message-body">{formatter(msg.message)}</div>
    </li>
  );
}

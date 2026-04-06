import { useCallback, useState } from 'react';
import { ShuffleIcon, TrashIcon } from '../../../ui/icons/agent-icons';
import { IconButton, SectionLabel } from '../../../ui/agent-primitives';

interface QueueSectionProps {
  queueLength: number;
  queueDisplay: [string, string][] | undefined;
  onShuffle: () => void;
  onClear: () => void;
  onAddToQueue: (url: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function QueueSection({ queueLength, queueDisplay, onShuffle, onClear, onAddToQueue, inputRef }: QueueSectionProps) {
  const [queueInput, setQueueInput] = useState('');

  const submitQueueInput = useCallback(() => {
    if (!queueInput.trim()) return;
    onAddToQueue(queueInput);
    setQueueInput('');
  }, [queueInput, onAddToQueue]);

  return (
    <div style={{ padding: '0.4rem 0.6rem 0.5rem' }}>
      {/* Queue header with Shuffle + Clear */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <SectionLabel>Queue{queueLength > 0 ? ` (${queueLength})` : ''}</SectionLabel>
        {queueLength >= 2 && (
          <div style={{ marginLeft: 'auto', marginBottom: 5, display: 'flex', gap: 3 }}>
            <IconButton onClick={onShuffle} title="Shuffle queue">
              <ShuffleIcon /> Shuffle
            </IconButton>
            <IconButton onClick={onClear} title="Clear queue" danger>
              <TrashIcon /> Clear
            </IconButton>
          </div>
        )}
        {queueLength === 1 && (
          <div style={{ marginLeft: 'auto', marginBottom: 5 }}>
            <IconButton onClick={onClear} title="Clear queue" danger>
              <TrashIcon /> Clear
            </IconButton>
          </div>
        )}
      </div>

      {/* Add to queue input */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="URL or: youtube <query>"
          value={queueInput}
          onChange={(e) => setQueueInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitQueueInput();
          }}
          style={{
            flex: 1,
            padding: '0.35rem 0.5rem',
            fontSize: 11,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 5,
            color: '#fff',
            outline: 'none',
          }}
        />
        <button
          type="button"
          className="lk-button"
          onClick={submitQueueInput}
          disabled={!queueInput.trim()}
          style={{
            fontSize: 11,
            padding: '0.35rem 0.6rem',
            borderRadius: 5,
            opacity: queueInput.trim() ? 1 : 0.4,
          }}
        >
          Add
        </button>
      </div>

      {/* Queue list */}
      {(queueDisplay ?? []).length > 0 && (
        <div
          style={{
            maxHeight: 112,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {queueDisplay!.slice(0, 8).map((item, i) => {
            const [title, link] = Array.isArray(item) ? item : [item, ''];
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 4px',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.04)',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 16, textAlign: 'right' }}>
                  {i + 1}.
                </span>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                      title={title}
                    >
                      {title}
                    </a>
                  ) : (
                    title
                  )}
                </span>
              </div>
            );
          })}
          {queueLength > 8 && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', padding: '2px 4px' }}>
              +{queueLength - 8} more in queue
            </div>
          )}
        </div>
      )}

      {queueLength === 0 && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
          Queue is empty
        </div>
      )}
    </div>
  );
}

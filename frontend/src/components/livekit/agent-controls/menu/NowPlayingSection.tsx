import { LinkIcon, PlayingBars } from '../../../ui/icons/agent-icons';
import { Divider } from '../../../ui/agent-primitives';

interface Props {
  isPlaying: boolean;
  isPaused: boolean;
  title: string | null;
  url: string | null;
}

export function NowPlayingSection({ isPlaying, isPaused, title, url }: Props) {
  return (
    <>
      <div style={{ padding: '0.6rem 0.75rem 0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {isPlaying ? (
            <PlayingBars />
          ) : isPaused ? (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>⏸</span>
          ) : null}
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
            title={title ?? ''}
          >
            {title ?? 'Loading…'}
          </span>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10,
              color: 'var(--lk-accent, #0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              textDecoration: 'none',
              opacity: 0.8,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <LinkIcon />
            {(() => {
              try {
                return new URL(url).hostname.replace('www.', '');
                } catch {
                return url.slice(0, 40);
              }
            })()}
          </a>
        )}
      </div>
      <Divider />
    </>
  );
}

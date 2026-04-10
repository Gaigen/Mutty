export function BotIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="8" width="18" height="11" rx="2" strokeWidth={2} />
      <circle cx="9" cy="13.5" r="1.5" strokeWidth={1.5} />
      <circle cx="15" cy="13.5" r="1.5" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 8V4" />
      <circle cx="12" cy="3" r="1.2" strokeWidth={1.5} />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

export function SkipIcon() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeWidth={2.5} strokeLinecap="round" d="M5 4l10 8-10 8V4z" />
      <path strokeWidth={2.5} strokeLinecap="round" d="M19 5v14" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function RepeatIcon() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"
      />
    </svg>
  );
}

export function ShuffleIcon() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
      />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
      />
    </svg>
  );
}

export function VolumeIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeWidth={2}
        strokeLinecap="round"
        d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"
      />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
      />
    </svg>
  );
}

export function Spinner() {
  return (
    <span
      className="animate-spin inline-block"
      style={{
        width: 14,
        height: 14,
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
      }}
    />
  );
}

export function PlayingBars() {
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12, marginRight: 2 }}
      aria-label="Playing"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="agent-playing-bar"
          style={{ '--delay': `${i * 0.15}s` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

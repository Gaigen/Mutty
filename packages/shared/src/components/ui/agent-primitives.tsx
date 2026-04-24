import type { ReactNode } from 'react';

export function Divider() {
  return <div style={{ height: 1, background: 'var(--mutty-border-1)', margin: '0.4rem 0' }} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: 'var(--mutty-fg-7)',
        marginBottom: 5,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {children}
    </div>
  );
}

export function ToggleButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="lk-button"
      title={title}
      onClick={onClick}
      style={{
        flex: 1,
        fontSize: 11,
        padding: '0.3rem 0.4rem',
        borderRadius: 5,
        background: active
          ? 'var(--mutty-surface-3)'
          : 'var(--mutty-surface-2)',
        border: active ? '1px solid var(--mutty-border-2)' : '1px solid transparent',
        color: 'var(--mutty-fg-1)',
        transition: 'background 0.15s, border 0.15s',
      }}
    >
      {children}
    </button>
  );
}

export function IconButton({
  onClick,
  children,
  title,
  active,
  disabled,
  danger,
}: {
  onClick: () => void;
  children: ReactNode;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className="lk-button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.3rem',
        padding: '0.35rem 0.6rem',
        fontSize: 11,
        borderRadius: 5,
        background: active
          ? 'var(--mutty-surface-3)'
          : danger
            ? 'var(--mutty-danger-soft)'
            : 'var(--mutty-surface-2)',
        border: active
          ? '1px solid var(--mutty-border-2)'
          : danger
            ? '1px solid var(--mutty-danger-soft)'
            : '1px solid transparent',
        color: danger ? 'var(--mutty-danger)' : 'var(--mutty-fg-1)',
        opacity: disabled ? 0.35 : 1,
        transition: 'background 0.15s, opacity 0.15s',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function FullWidthButton({
  onClick,
  children,
  title,
  danger,
}: {
  onClick: () => void;
  children: ReactNode;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className="lk-button"
      title={title}
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        justifyContent: 'flex-start',
        padding: '0.45rem 0.75rem',
        fontSize: 12,
        borderRadius: 0,
        color: danger ? 'var(--mutty-danger)' : 'var(--mutty-fg-1)',
        background: 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  );
}

export function ErrorTooltip({ children }: { children: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '110%',
        right: 0,
        background: '#ef4444',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 11,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      {children}
    </div>
  );
}

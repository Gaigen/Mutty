import * as React from 'react';
import ReactDOM from 'react-dom';
import { CloseIcon } from './icons';

export function FullscreenImageOverlay({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image fullscreen"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.93)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 16,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close fullscreen"
        style={{
          position: 'absolute',
          top: 'clamp(8px, 2vh, 20px)',
          right: 'clamp(8px, 2vw, 20px)',
          width: 'clamp(52px, 5vw, 72px)',
          height: 'clamp(44px, 4vw, 60px)',
          borderRadius: 'clamp(26px, 3vw, 36px)',
          border: 'none',
          background: 'rgba(0,0,0,0.55)',
          cursor: 'pointer',
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.82)')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.55)')
        }
      >
        <CloseIcon />
      </button>
      <img
        src={src}
        alt="Fullscreen"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          borderRadius: 8,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      />
    </div>,
    document.body,
  );
}

import * as React from 'react';
import { FullscreenImageOverlay } from './fullscreen-overlay';

export function FileThumbnail({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = React.useState('');
  const [fullscreen, setFullscreen] = React.useState(false);

  React.useEffect(() => {
    const objUrl = URL.createObjectURL(file);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [file]);

  return (
    <>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={url}
          alt={file.name}
          title={`Click to preview — ${file.name}`}
          onClick={() => setFullscreen(true)}
          style={{
            width: 52,
            height: 52,
            objectFit: 'cover',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'block',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="Remove"
          style={{
            position: 'absolute',
            top: -5,
            right: -5,
            width: 17,
            height: 17,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            fontSize: 11,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            zIndex: 1,
          }}
        >
          ×
        </button>
      </div>
      {fullscreen && (
        <FullscreenImageOverlay src={url} onClose={() => setFullscreen(false)} />
      )}
    </>
  );
}

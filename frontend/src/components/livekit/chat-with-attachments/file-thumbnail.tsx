import * as React from 'react';

export function FileThumbnail({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    const objUrl = URL.createObjectURL(file);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [file]);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <img
        src={url}
        alt={file.name}
        title={file.name}
        style={{
          width: 52,
          height: 52,
          objectFit: 'cover',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'block',
        }}
      />
      <button
        type="button"
        onClick={onRemove}
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
        }}
      >
        ×
      </button>
    </div>
  );
}

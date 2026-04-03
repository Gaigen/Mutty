import * as React from 'react';

export function YouTubePreview({ videoId }: { videoId: string }) {
  const [clicked, setClicked] = React.useState(false);

  if (!clicked) {
    return (
      <div
        className="link-preview-youtube"
        onClick={() => setClicked(true)}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <img
          src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
          alt="YouTube video"
          style={{ width: '100%', borderRadius: 8, display: 'block' }}
        />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)', borderRadius: 8,
        }}>
          <div style={{
            width: 60, height: 42, background: 'rgba(255,0,0,0.9)',
            borderRadius: 12, display: 'flex', alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              width: 0, height: 0,
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderLeft: '16px solid white',
              marginLeft: 3,
            }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="link-preview-youtube-embed">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{
          width: '100%', aspectRatio: '16/9', borderRadius: 8,
          border: 'none',
        }}
      />
    </div>
  );
}

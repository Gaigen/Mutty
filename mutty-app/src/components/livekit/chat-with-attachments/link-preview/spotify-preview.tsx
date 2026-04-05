export function SpotifyPreview({ type, id }: { type: string; id: string }) {
  return (
    <div className="link-preview-spotify">
      <iframe
        src={`https://open.spotify.com/embed/${type}/${id}`}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        style={{
          width: '100%', height: type === 'playlist' ? 352 : 155,
          borderRadius: 12, border: 'none',
        }}
      />
    </div>
  );
}

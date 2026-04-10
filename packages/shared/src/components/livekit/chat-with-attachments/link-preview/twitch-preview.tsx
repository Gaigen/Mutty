type TwitchInfo =
  | { type: 'channel'; channel: string }
  | { type: 'clip'; slug: string }
  | { type: 'video'; id: string };

export function TwitchPreview({ info }: { info: TwitchInfo }) {
  const parent = window.location.hostname || 'localhost';

  let src: string;
  if (info.type === 'channel') {
    src = `https://player.twitch.tv/?channel=${info.channel}&parent=${parent}&autoplay=false`;
  } else if (info.type === 'clip') {
    src = `https://clips.twitch.tv/embed?clip=${info.slug}&parent=${parent}&autoplay=false`;
  } else {
    src = `https://player.twitch.tv/?video=${info.id}&parent=${parent}&autoplay=false`;
  }

  return (
    <div className="link-preview-twitch">
      <iframe
        src={src}
        allowFullScreen
        style={{
          width: '100%', aspectRatio: '16/9',
          borderRadius: 8, border: 'none',
        }}
      />
    </div>
  );
}

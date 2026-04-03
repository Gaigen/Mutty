import { detectProvider, extractVideoId, extractTwitterInfo, extractSpotifyInfo, extractTwitchInfo, extractGitHubRepo } from './helpers';
import { YouTubePreview } from './youtube-preview';
import { TwitterPreview } from './twitter-preview';
import { SpotifyPreview } from './spotify-preview';
import { TwitchPreview } from './twitch-preview';
import { GitHubPreview } from './github-preview';
import { GenericPreview } from './generic-preview';

const ACCENT_COLORS: Record<string, string> = {
  youtube: '#ff0000',
  twitter: '#1d9bf0',
  spotify: '#1db954',
  twitch: '#9146ff',
  github: '#c9d1d9',
  generic: '#555',
};

export function LinkPreview({ url }: { url: string }) {
  const provider = detectProvider(url);
  const accent = ACCENT_COLORS[provider] ?? ACCENT_COLORS.generic;

  const wrapper = (child: React.ReactNode) => (
    <div
      className="link-preview-card"
      style={{ borderLeftColor: accent } as React.CSSProperties}
    >
      {child}
    </div>
  );

  switch (provider) {
    case 'youtube': {
      const videoId = extractVideoId(url);
      return wrapper(videoId ? <YouTubePreview videoId={videoId} /> : <GenericPreview url={url} />);
    }
    case 'twitter': {
      const info = extractTwitterInfo(url);
      return wrapper(info ? <TwitterPreview url={url} /> : <GenericPreview url={url} />);
    }
    case 'spotify': {
      const info = extractSpotifyInfo(url);
      return wrapper(info ? <SpotifyPreview type={info.type} id={info.id} /> : <GenericPreview url={url} />);
    }
    case 'twitch': {
      const info = extractTwitchInfo(url);
      return wrapper(info ? <TwitchPreview info={info} /> : <GenericPreview url={url} />);
    }
    case 'github': {
      const info = extractGitHubRepo(url);
      return wrapper(info ? <GitHubPreview owner={info.owner} repo={info.repo} /> : <GenericPreview url={url} />);
    }
    default:
      return wrapper(<GenericPreview url={url} />);
  }
}

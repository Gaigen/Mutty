const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const TWITTER_RE = /(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/;
const SPOTIFY_RE = /open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/;
const TWITCH_RE = /twitch\.tv\/(?:(videos)\/(\d+)|([a-zA-Z0-9_]+)(?:\/clip\/([a-zA-Z0-9_-]+))?)/;
const GITHUB_REPO_RE = /github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/;
const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

export type LinkProvider = 'youtube' | 'twitter' | 'spotify' | 'twitch' | 'github' | 'generic';

export function detectProvider(url: string): LinkProvider {
  if (YOUTUBE_RE.test(url)) return 'youtube';
  if (TWITTER_RE.test(url)) return 'twitter';
  if (SPOTIFY_RE.test(url)) return 'spotify';
  if (TWITCH_RE.test(url)) return 'twitch';
  if (GITHUB_REPO_RE.test(url)) return 'github';
  return 'generic';
}

export function extractVideoId(url: string): string | null {
  const m = url.match(YOUTUBE_RE);
  return m?.[1] ?? null;
}

export function extractTwitterInfo(url: string) {
  const m = url.match(TWITTER_RE);
  return m ? { username: m[1], statusId: m[2] } : null;
}

export function extractSpotifyInfo(url: string) {
  const m = url.match(SPOTIFY_RE);
  return m ? { type: m[1], id: m[2] } : null;
}

export function extractTwitchInfo(url: string) {
  const m = url.match(TWITCH_RE);
  if (!m) return null;
  if (m[1] === 'videos' && m[2]) return { type: 'video' as const, id: m[2] };
  if (m[5]) return { type: 'clip' as const, slug: m[5] };
  if (m[3]) return { type: 'channel' as const, channel: m[3] };
  return null;
}

export function extractGitHubRepo(url: string) {
  const m = url.match(GITHUB_REPO_RE);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export function findFirstUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[0] : null;
}

export function hasMultipleUrls(text: string): boolean {
  const matches = text.match(URL_RE);
  return matches ? matches.length > 1 : false;
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

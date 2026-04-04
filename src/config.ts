/**
 * Application configuration.
 */

// ── LocalStorage keys ────────────────────────────────────────────────────────

export const LS_KEYS = {
  serverUrl: 'voice-app:server-url',
  audioSettings: 'voice-app:audio-settings',
  cameraSettings: 'voice-app:camera-settings',
  screenShareSettings: 'voice-app:screen-share-settings',
  identity: 'voice-app:identity',
  avatar: 'voice-app:avatar',
  recentRooms: 'voice-app:recent-rooms',
  chatWidth: 'voice-app:chat-width',
  webAppUrl: 'voice-app:web-app-url',
  appSettings: 'voice-app:app-settings',
  hotkeySettings: 'voice-app:hotkey-settings',
} as const;

// ── Server config ────────────────────────────────────────────────────────────

export interface ServerConfig {
  serverUrl: string;
  tokenEndpoint: string;
  livekitUrl: string;
  webAppUrl: string;
  dispatchEndpoint: string;
}

function normalizeBaseUrl(url: string): string {
  let base = url.replace(/\/+$/, '');
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return base;
  }
  return `https://${base}`;
}

export function getServerConfig(): ServerConfig | null {
  const saved = localStorage.getItem(LS_KEYS.serverUrl);
  if (!saved) return null;

  const baseUrl = normalizeBaseUrl(saved);
  const tokenBase = baseUrl;

  return {
    serverUrl: baseUrl,
    tokenEndpoint: `${tokenBase}/api/token`,
    livekitUrl: import.meta.env.VITE_LIVEKIT_URL || baseUrl.replace(/^http/, 'ws'),
    webAppUrl: import.meta.env.VITE_WEB_APP_URL || tokenBase,
    dispatchEndpoint: `${tokenBase}/api/agent/dispatch`,
  };
}

export function setServerUrl(url: string): void {
  localStorage.setItem(LS_KEYS.serverUrl, url);
}

export function clearServerUrl(): void {
  localStorage.removeItem(LS_KEYS.serverUrl);
}

export function isValidServerUrl(url: string): boolean {
  if (!url.trim()) return false;
  const normalized = normalizeBaseUrl(url);
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ── Static config (toggles, limits) ─────────────────────────────────────────

export const BOT_IDENTITY = 'youtube-bot';

export const AVATAR_IDS = [
  'bear',
  'shark',
  'hedgehog',
  'otter',
  'penguin',
  'skunk',
  'raccoon',
  'capybara',
  'frog',
  'hamster',
  'axsolotle',
  'fox',
  'monkey',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const appConfig = {
  maxRecentRooms: 5,
  simulcast: false,
  showVideo: false,
  showAudio: true,
  showChat: true,
  showChatAttachments: true,
  showLeave: true,
  showSettingsButton: true,
  agentDefaultMode: 'video' as const,
  chatNotificationRareChance: 0.05,
  chatNotificationRareSrc: '/sounds/rare-sound.m4a',
} as const;

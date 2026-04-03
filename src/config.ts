/**
 * Application configuration.
 */

// ── Env (VITE_* available only in frontend) ───────────────────────────────────

const tokenEndpoint = import.meta.env.VITE_TOKEN_ENDPOINT || 'https://token.meety.smetrix.ru/api/token';
const tokenBase = tokenEndpoint.replace(/\/api\/token$/, '');

// Пытаемся угадать URL веб-приложения из URL токен-сервера
// (убираем поддомен token. если есть)
const defaultWebAppUrl = tokenBase.replace('token.', '');
const webAppUrl = import.meta.env.VITE_WEB_APP_URL || defaultWebAppUrl;

export const config = {
  /** LiveKit WebSocket URL */
  livekitUrl: import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.smetrix.ru',

  /** Endpoint for token retrieval (POST room, identity) */
  tokenEndpoint,

  /** Base URL for the web app (used in invite links) */
  webAppUrl,

  /** Endpoint for dispatch agent (POST room) — LiveKit Agent Server */
  dispatchEndpoint: tokenBase ? `${tokenBase}/api/agent/dispatch` : '',
} as const;

// ── LocalStorage keys ────────────────────────────────────────────────────────

export const LS_KEYS = {
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

// ── Toggles and limits ────────────────────────────────────────────────────────

export const BOT_IDENTITY = 'youtube-bot';

export const appConfig = {
  /** Max number of recent rooms on home page */
  maxRecentRooms: 5,

  /** Simulcast in LiveKit (false = single layer, simpler) */
  simulcast: false,

  /** Enable video on room entry (false = camera enabled only on click) */
  showVideo: false,

  /** Enable audio on room entry */
  showAudio: true,

  /** Show chat in control bar */
  showChat: true,

  /** Allow sending images in chat */
  showChatAttachments: true,

  /** Show Leave button */
  showLeave: true,

  /** Show Settings button (gear icon) */
  showSettingsButton: true,

  /** Agent default mode: 'audio' | 'video' */
  agentDefaultMode: 'video' as const,
  /** Notification sound probability for new message */
  chatNotificationRareChance: 0.05,
  /** Notification sound source for new message */
  chatNotificationRareSrc: '/sounds/rare-sound.m4a',
} as const;

/**
 * Конфигурация приложения.
 */

// ── Env (VITE_* доступны только в frontend) ───────────────────────────────────

const tokenEndpoint = import.meta.env.VITE_TOKEN_ENDPOINT || 'http://127.0.0.1:4000/api/token';
const tokenBase = tokenEndpoint.replace(/\/api\/token$/, '');

export const config = {
  /** Endpoint для получения токена (POST room, identity); ответ содержит wsUrl для LiveKit */
  tokenEndpoint,

  /** Endpoint для dispatch агента (POST room) — LiveKit Agent Server */
  dispatchEndpoint: `${tokenBase}/api/agent/dispatch`,
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

// ── Переключатели и лимиты ────────────────────────────────────────────────────

export const BOT_IDENTITY = 'youtube-bot';

export const appConfig = {
  /** Макс. кол-во недавних комнат на главной */
  maxRecentRooms: 5,

  /** Simulcast в LiveKit (false = один слой, проще) */
  simulcast: false,

  /** Включить видео при входе в комнату (false = камера включается только по клику) */
  showVideo: false,

  /** Включить аудио при входе в комнату */
  showAudio: true,

  /** Показывать чат в control bar */
  showChat: true,

  /** Разрешить отправку картинок в чате */
  showChatAttachments: true,

  /** Показывать кнопку Leave */
  showLeave: true,

  /** Показывать кнопку Settings (шестерёнка) */
  showSettingsButton: true,

  /** Режим агента по умолчанию: 'audio' | 'video' */
  agentDefaultMode: 'video' as const,
  /** Вероятность звука уведомления о новом сообщении */
  chatNotificationRareChance: 0.05,
  /** Источник звука уведомления о новом сообщении */
  chatNotificationRareSrc: '/sounds/rare-sound.m4a',
} as const;

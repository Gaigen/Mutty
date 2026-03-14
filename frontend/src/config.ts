/**
 * Централизованная конфигурация приложения.
 * Env-переменные и переключатели — всё в одном месте.
 */

// ── Env (VITE_* доступны только в frontend) ───────────────────────────────────

const tokenEndpoint = import.meta.env.VITE_TOKEN_ENDPOINT || 'http://127.0.0.1:4000/api/token';
const tokenBase = tokenEndpoint.replace(/\/api\/token$/, '');

export const config = {
  /** LiveKit WebSocket URL */
  livekitUrl: import.meta.env.VITE_LIVEKIT_URL || 'ws://127.0.0.1:7880',

  /** Endpoint для получения токена (POST room, identity) */
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
  recentRooms: 'voice-app:recent-rooms',
  chatWidth: 'voice-app:chat-width',
} as const;

// ── Переключатели и лимиты ────────────────────────────────────────────────────

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
} as const;

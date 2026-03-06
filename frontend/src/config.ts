/**
 * Централизованная конфигурация приложения.
 * Env-переменные и переключатели — всё в одном месте.
 */

// ── Env (VITE_* доступны только в frontend) ───────────────────────────────────

export const config = {
  /** LiveKit WebSocket URL */
  livekitUrl: import.meta.env.VITE_LIVEKIT_URL || 'ws://127.0.0.1:7880',

  /** Endpoint для получения токена (POST room, identity) */
  tokenEndpoint: import.meta.env.VITE_TOKEN_ENDPOINT || 'http://127.0.0.1:4000/api/token',

  /** YouTube Bot agent API */
  agentEndpoint:
    (import.meta.env.VITE_AGENT_ENDPOINT as string | undefined) || 'http://localhost:5000',

  /** API-ключ для agent (если задан на сервере — задай тот же во frontend) */
  agentApiKey: import.meta.env.VITE_AGENT_API_KEY as string | undefined,
} as const;

// ── LocalStorage keys ────────────────────────────────────────────────────────

export const LS_KEYS = {
  audioSettings: 'voice-app:audio-settings',
  cameraSettings: 'voice-app:camera-settings',
  screenShareSettings: 'voice-app:screen-share-settings',
  identity: 'voice-app:identity',
  recentRooms: 'voice-app:recent-rooms',
} as const;

// ── Переключатели и лимиты ────────────────────────────────────────────────────

export const appConfig = {
  /** Макс. кол-во недавних комнат на главной */
  maxRecentRooms: 5,

  /** Simulcast в LiveKit (false = один слой, проще) */
  simulcast: false,

  /** Включить видео при входе в комнату */
  showVideo: true,

  /** Включить аудио при входе в комнату */
  showAudio: true,

  /** Показывать чат в control bar */
  showChat: true,

  /** Показывать кнопку Leave */
  showLeave: true,

  /** Показывать кнопку Settings (шестерёнка) */
  showSettingsButton: true,

  /** Режим агента по умолчанию: 'audio' | 'video' */
  agentDefaultMode: 'video' as const,
} as const;

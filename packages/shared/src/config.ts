/**
 * Shared configuration constants.
 * Platform-specific config (server URL, token endpoint) lives in ConfigAdapter.
 */

// ── LocalStorage / Store keys ────────────────────────────────────────────────

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

// ── Avatars ──────────────────────────────────────────────────────────────────

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

// ── Bot identity ─────────────────────────────────────────────────────────────

export const BOT_IDENTITY = 'youtube-bot';

// ── App toggles & limits ─────────────────────────────────────────────────────

export const appConfig = {
  /** Max recent rooms shown on home page */
  maxRecentRooms: 5,

  /** LiveKit simulcast (false = single layer, simpler) */
  simulcast: false,

  /** Enable video on room join */
  showVideo: false,

  /** Enable audio on room join */
  showAudio: true,

  /** Show chat in control bar */
  showChat: true,

  /** Allow image attachments in chat */
  showChatAttachments: true,

  /** Show Leave button */
  showLeave: true,

  /** Show Settings (gear) button */
  showSettingsButton: true,

  /** Default agent mode: 'audio' | 'video' */
  agentDefaultMode: 'video' as const,

  /** Probability of rare chat notification sound */
  chatNotificationRareChance: 0.05,

  /** Source for rare notification sound */
  chatNotificationRareSrc: '/sounds/rare-sound.m4a',
} as const;

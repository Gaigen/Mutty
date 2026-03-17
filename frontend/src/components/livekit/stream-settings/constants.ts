import type { VideoCodec, ContentHint } from '../../../hooks/useScreenShareSettings';

export const SCREEN_RESOLUTION_PRESETS = {
  '4K': { width: 3840, height: 2160 },
  '1440p': { width: 2560, height: 1440 },
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '540p': { width: 960, height: 540 },
  '480p': { width: 854, height: 480 },
  '360p': { width: 640, height: 360 },
} as const;

export const SCREEN_FPS_PRESETS = [60, 30, 24, 15, 10, 5] as const;

export const CAMERA_PRESETS = {
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
  '360p': { width: 640, height: 360 },
} as const;

export const CODECS: { value: VideoCodec; label: string; desc: string }[] = [
  { value: 'av1', label: 'AV1', desc: 'Best quality & compression. Requires server support.' },
  { value: 'vp9', label: 'VP9', desc: 'Good quality, wide compatibility.' },
  { value: 'h264', label: 'H.264', desc: 'Maximum compatibility, larger size.' },
  { value: 'vp8', label: 'VP8', desc: 'Legacy, compatibility only.' },
];

export const CONTENT_HINTS: { value: ContentHint; label: string; desc: string }[] = [
  { value: 'motion', label: 'Motion', desc: 'Video, games — prioritize smoothness.' },
  { value: 'detail', label: 'Detail', desc: 'Code, design — prioritize sharpness.' },
  { value: 'text', label: 'Text', desc: 'Documents, spreadsheets — max text clarity.' },
];

export const PING_HISTORY_SIZE = 60;

import type { VideoSenderStats, VideoReceiverStats } from 'livekit-client';

export function computeBitrate(
  current: VideoSenderStats | VideoReceiverStats,
  prev?: VideoSenderStats | VideoReceiverStats,
): number {
  if (!prev) return 0;
  const bytesNow =
    'bytesReceived' in current
      ? (current as VideoReceiverStats).bytesReceived
      : (current as VideoSenderStats).bytesSent;
  const bytesPrev =
    'bytesReceived' in prev
      ? (prev as VideoReceiverStats).bytesReceived
      : (prev as VideoSenderStats).bytesSent;
  if (
    bytesNow === undefined ||
    bytesPrev === undefined ||
    !current.timestamp ||
    !prev.timestamp
  )
    return 0;
  return ((bytesNow - bytesPrev) * 8 * 1000) / (current.timestamp - prev.timestamp);
}

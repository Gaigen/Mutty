import { useRoomContext } from '@livekit/components-react';
import { VideoSenderStats, VideoReceiverStats, Track } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';

// Вычисление битрейта на основе разницы байтов и времени
function computeBitrate(
  currentStats: VideoSenderStats | VideoReceiverStats,
  prevStats?: VideoSenderStats | VideoReceiverStats,
): number {
  if (!prevStats) {
    return 0;
  }
  const cur = currentStats as unknown as Record<string, unknown>;
  const prev = prevStats as unknown as Record<string, unknown>;
  const bytesNow = (cur.bytesReceived as number | undefined) ?? (cur.bytesSent as number | undefined);
  const bytesPrev = (prev.bytesReceived as number | undefined) ?? (prev.bytesSent as number | undefined);
  if (
    bytesNow === undefined ||
    bytesPrev === undefined ||
    currentStats.timestamp === undefined ||
    prevStats.timestamp === undefined
  ) {
    return 0;
  }
  return ((bytesNow - bytesPrev) * 8 * 1000) / (currentStats.timestamp - prevStats.timestamp);
}

interface DebugStatsProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function DebugStats({ isVisible, onClose }: DebugStatsProps) {
  const room = useRoomContext();
  const [senderStats, setSenderStats] = useState<VideoSenderStats[]>([]);
  const [receiverStats, setReceiverStats] = useState<VideoReceiverStats[]>([]);
  const prevSenderStatsRef = useRef<VideoSenderStats[]>([]);
  const prevReceiverStatsRef = useRef<VideoReceiverStats[]>([]);
  const senderStatsRef = useRef<VideoSenderStats[]>([]);
  const receiverStatsRef = useRef<VideoReceiverStats[]>([]);

  useEffect(() => {
    if (!isVisible || !room) return;

    const interval = setInterval(async () => {
      try {
        const allSenderStats: VideoSenderStats[] = [];
        const allReceiverStats: VideoReceiverStats[] = [];

        // Получаем статистику из локальных треков (исходящие потоки)
        const localParticipant = room.localParticipant;
        for (const publication of localParticipant.videoTrackPublications.values()) {
          // Фильтруем только screen share
          if (publication.source === Track.Source.ScreenShare && publication.track) {
            const track = publication.track;
            // LocalVideoTrack имеет метод getSenderStats
            if (track.kind === Track.Kind.Video && 'getSenderStats' in track) {
              try {
                const stats = await (track as any).getSenderStats();
                if (stats && Array.isArray(stats)) {
                  allSenderStats.push(...stats);
                }
              } catch (e) {
                console.warn('Failed to get sender stats for screen share:', e);
              }
            }
          }
        }

        // Получаем статистику из удаленных треков (входящие потоки)
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.videoTrackPublications.values()) {
            // Фильтруем только screen share
            if (publication.source === Track.Source.ScreenShare && publication.track) {
              const track = publication.track;
              // RemoteVideoTrack имеет метод getReceiverStats
              if (track.kind === Track.Kind.Video && 'getReceiverStats' in track) {
                try {
                  const stats = await (track as any).getReceiverStats();
                  if (stats) {
                    allReceiverStats.push(stats);
                  }
                } catch (e) {
                  console.warn('Failed to get receiver stats for screen share:', e);
                }
              }
            }
          }
        }

        // Сохраняем текущие статистики как предыдущие перед обновлением
        if (senderStatsRef.current.length > 0) {
          prevSenderStatsRef.current = senderStatsRef.current;
        }
        if (receiverStatsRef.current.length > 0) {
          prevReceiverStatsRef.current = receiverStatsRef.current;
        }

        senderStatsRef.current = allSenderStats;
        receiverStatsRef.current = allReceiverStats;
        setSenderStats(allSenderStats);
        setReceiverStats(allReceiverStats);
      } catch (error) {
        console.error('Failed to get stats:', error);
      }
    }, 1000); // Обновляем каждую секунду

    return () => clearInterval(interval);
  }, [isVisible, room]);

  if (!isVisible || !room) return null;

  return (
    <div className="fixed top-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-4 text-white text-xs font-mono max-w-md max-h-[80vh] overflow-y-auto z-50 shadow-xl">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-blue-400">Screen Share Stats</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* Sender Stats (исходящий поток) */}
        {senderStats.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-green-400 mb-2">📤 Screen Share Outgoing</h4>
            {senderStats.map((stat, idx) => {
              const prev = prevSenderStatsRef.current[idx];
              const bitrate = computeBitrate(stat, prev);
              return (
                <div key={idx} className="bg-gray-800 rounded p-2 mb-2 space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-500">Resolution:</span>{' '}
                      <span className="text-white">
                        {stat.frameWidth}×{stat.frameHeight}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">FPS:</span>{' '}
                      <span className="text-white">{stat.framesPerSecond.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bitrate:</span>{' '}
                      <span className="text-white">{(bitrate / 1000).toFixed(0)} kbps</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Target:</span>{' '}
                      <span className="text-white">{(stat.targetBitrate / 1000).toFixed(0)} kbps</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Frames Sent:</span>{' '}
                      <span className="text-white">{stat.framesSent}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">RID:</span>{' '}
                      <span className="text-white">{stat.rid}</span>
                    </div>
                    {stat.qualityLimitationReason && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Quality Limit:</span>{' '}
                        <span className="text-yellow-400">{stat.qualityLimitationReason}</span>
                      </div>
                    )}
                    {stat.packetsLost !== undefined && (
                      <div>
                        <span className="text-gray-500">Packets Lost:</span>{' '}
                        <span className="text-red-400">{stat.packetsLost}</span>
                      </div>
                    )}
                    {stat.roundTripTime !== undefined && (
                      <div>
                        <span className="text-gray-500">RTT:</span>{' '}
                        <span className="text-white">{stat.roundTripTime.toFixed(0)} ms</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Receiver Stats (входящий поток) */}
        {receiverStats.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-blue-400 mb-2">📥 Screen Share Incoming</h4>
            {receiverStats.map((stat, idx) => {
              const prev = prevReceiverStatsRef.current[idx];
              const bitrate = computeBitrate(stat, prev);
              const fps = prev && stat.timestamp && prev.timestamp
                ? ((stat.framesDecoded - prev.framesDecoded) * 1000) / (stat.timestamp - prev.timestamp)
                : 0;
              
              return (
                <div key={idx} className="bg-gray-800 rounded p-2 mb-2 space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    {stat.frameWidth && stat.frameHeight && (
                      <div>
                        <span className="text-gray-500">Resolution:</span>{' '}
                        <span className="text-white">
                          {stat.frameWidth}×{stat.frameHeight}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">FPS:</span>{' '}
                      <span className="text-white">{fps.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bitrate:</span>{' '}
                      <span className="text-white">{(bitrate / 1000).toFixed(0)} kbps</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Frames Decoded:</span>{' '}
                      <span className="text-white">{stat.framesDecoded}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Frames Dropped:</span>{' '}
                      <span className="text-red-400">{stat.framesDropped}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Frames Received:</span>{' '}
                      <span className="text-white">{stat.framesReceived}</span>
                    </div>
                    {stat.mimeType && (
                      <div>
                        <span className="text-gray-500">Codec:</span>{' '}
                        <span className="text-white">{stat.mimeType}</span>
                      </div>
                    )}
                    {stat.decoderImplementation && (
                      <div>
                        <span className="text-gray-500">Decoder:</span>{' '}
                        <span className="text-white text-[10px]">{stat.decoderImplementation}</span>
                      </div>
                    )}
                    {stat.packetsLost !== undefined && (
                      <div>
                        <span className="text-gray-500">Packets Lost:</span>{' '}
                        <span className="text-red-400">{stat.packetsLost}</span>
                      </div>
                    )}
                    {stat.jitter !== undefined && (
                      <div>
                        <span className="text-gray-500">Jitter:</span>{' '}
                        <span className="text-white">{stat.jitter.toFixed(2)} ms</span>
                      </div>
                    )}
                    {stat.jitterBufferDelay !== undefined && (
                      <div>
                        <span className="text-gray-500">Buffer Delay:</span>{' '}
                        <span className="text-white">{stat.jitterBufferDelay.toFixed(0)} ms</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {senderStats.length === 0 && receiverStats.length === 0 && (
          <div className="text-gray-500 text-center py-4">
            Нет активных screen share потоков
            <div className="text-[10px] mt-2 text-gray-600">
              Запустите screen share, чтобы увидеть статистику
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


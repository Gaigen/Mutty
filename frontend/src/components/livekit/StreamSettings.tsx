import { useRoomContext } from '@livekit/components-react';
import { VideoSenderStats, VideoReceiverStats, Track } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { useScreenShareSettings } from '../../hooks/useScreenShareSettings';

const PRESETS = {
  '720p@60': { resolution: { width: 1280, height: 720 }, frameRate: 60 },
  '720p@30': { resolution: { width: 1280, height: 720 }, frameRate: 30 },
  '1080p@60': { resolution: { width: 1920, height: 1080 }, frameRate: 60 },
  '1080p@30': { resolution: { width: 1920, height: 1080 }, frameRate: 30 },
} as const;

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

interface StreamSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StreamSettings({ isOpen, onClose }: StreamSettingsProps) {
  const room = useRoomContext();
  const { settings, setSettings } = useScreenShareSettings();
  const [activeTab, setActiveTab] = useState<'settings' | 'stats'>('settings');
  const [senderStats, setSenderStats] = useState<VideoSenderStats[]>([]);
  const [receiverStats, setReceiverStats] = useState<VideoReceiverStats[]>([]);
  const prevSenderStatsRef = useRef<VideoSenderStats[]>([]);
  const prevReceiverStatsRef = useRef<VideoReceiverStats[]>([]);
  const senderStatsRef = useRef<VideoSenderStats[]>([]);
  const receiverStatsRef = useRef<VideoReceiverStats[]>([]);

  // Находим текущий пресет по настройкам
  const currentPresetKey = Object.entries(PRESETS).find(
    ([_, preset]) =>
      preset.resolution.width === settings.resolution.width &&
      preset.resolution.height === settings.resolution.height &&
      preset.frameRate === settings.frameRate
  )?.[0] || '';

  // Сбор статистики для debug
  useEffect(() => {
    if (!isOpen || activeTab !== 'stats' || !room) return;

    const interval = setInterval(async () => {
      try {
        const allSenderStats: VideoSenderStats[] = [];
        const allReceiverStats: VideoReceiverStats[] = [];

        // Получаем статистику из локальных треков (исходящие потоки)
        const localParticipant = room.localParticipant;
        for (const publication of localParticipant.videoTrackPublications.values()) {
          if (publication.source === Track.Source.ScreenShare && publication.track) {
            const track = publication.track;
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
            if (publication.source === Track.Source.ScreenShare && publication.track) {
              const track = publication.track;
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
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, activeTab, room]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl z-50 w-[90vw] max-w-md">
      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'settings'
                ? 'bg-[#2a2a2a] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#252525]'
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'stats'
                ? 'bg-[#2a2a2a] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#252525]'
            }`}
          >
            Stats
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Контент */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {activeTab === 'settings' ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Screen Share Quality</h3>
              
              {/* Presets */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(PRESETS).map(([key, preset]) => {
                  const isActive = currentPresetKey === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSettings(preset)}
                      className={`
                        px-3 py-2.5 rounded text-xs font-medium transition-all
                        ${isActive 
                          ? 'bg-[#3a3a3a] text-white border border-[#4a4a4a]' 
                          : 'bg-[#252525] text-gray-300 hover:bg-[#2a2a2a] hover:text-white border border-[#2a2a2a]'
                        }
                      `}
                    >
                      <div className="font-semibold">{key.split('@')[0]}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{preset.frameRate} FPS</div>
                    </button>
                  );
                })}
              </div>

              {/* Advanced settings */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none py-2 flex items-center gap-2">
                  <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Advanced Settings
                </summary>
                <div className="mt-3 space-y-3 pt-3 border-t border-[#2a2a2a]">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Width</label>
                      <input
                        type="number"
                        value={settings.resolution.width}
                        onChange={(e) =>
                          setSettings({
                            resolution: { ...settings.resolution, width: parseInt(e.target.value) || 1280 },
                          })
                        }
                        className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a] focus:ring-1 focus:ring-[#3a3a3a]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Height</label>
                      <input
                        type="number"
                        value={settings.resolution.height}
                        onChange={(e) =>
                          setSettings({
                            resolution: { ...settings.resolution, height: parseInt(e.target.value) || 720 },
                          })
                        }
                        className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a] focus:ring-1 focus:ring-[#3a3a3a]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Frame Rate (FPS)</label>
                    <input
                      type="number"
                      value={settings.frameRate}
                      onChange={(e) =>
                        setSettings({ frameRate: parseInt(e.target.value) || 60 })
                      }
                      min="1"
                      max="60"
                      className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a] focus:ring-1 focus:ring-[#3a3a3a]"
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sender Stats */}
            {senderStats.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-2">
                  <span>📤</span> Outgoing Stream
                </h4>
                {senderStats.map((stat, idx) => {
                  const prev = prevSenderStatsRef.current[idx];
                  const bitrate = computeBitrate(stat, prev);
                  return (
                    <div key={idx} className="bg-[#252525] rounded p-3 mb-2 space-y-2 border border-[#2a2a2a]">
                      <div className="grid grid-cols-2 gap-2 text-xs">
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
                        {stat.packetsLost !== undefined && (
                          <div>
                            <span className="text-gray-500">Lost:</span>{' '}
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

            {/* Receiver Stats */}
            {receiverStats.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <span>📥</span> Incoming Stream
                </h4>
                {receiverStats.map((stat, idx) => {
                  const prev = prevReceiverStatsRef.current[idx];
                  const bitrate = computeBitrate(stat, prev);
                  const fps = prev && stat.timestamp && prev.timestamp
                    ? ((stat.framesDecoded - prev.framesDecoded) * 1000) / (stat.timestamp - prev.timestamp)
                    : 0;
                  
                  return (
                    <div key={idx} className="bg-[#252525] rounded p-3 mb-2 space-y-2 border border-[#2a2a2a]">
                      <div className="grid grid-cols-2 gap-2 text-xs">
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
                          <span className="text-gray-500">Decoded:</span>{' '}
                          <span className="text-white">{stat.framesDecoded}</span>
                        </div>
                        {stat.framesDropped !== undefined && (
                          <div>
                            <span className="text-gray-500">Dropped:</span>{' '}
                            <span className="text-red-400">{stat.framesDropped}</span>
                          </div>
                        )}
                        {stat.jitter !== undefined && (
                          <div>
                            <span className="text-gray-500">Jitter:</span>{' '}
                            <span className="text-white">{stat.jitter.toFixed(2)} ms</span>
                          </div>
                        )}
                        {stat.mimeType && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Codec:</span>{' '}
                            <span className="text-white">{stat.mimeType}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {senderStats.length === 0 && receiverStats.length === 0 && (
              <div className="text-gray-500 text-center py-8">
                <div className="text-sm mb-2">No active screen share streams</div>
                <div className="text-xs text-gray-600">
                  Start screen share to see statistics
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

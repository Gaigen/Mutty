import { useRoomContext, useRemoteParticipants } from '@livekit/components-react';
import { VideoSenderStats, VideoReceiverStats, Track, type LocalVideoTrack, type RemoteVideoTrack, type RemoteAudioTrack } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { useAudioSettings } from '../../hooks/useAudioSettings';
import { useScreenShareSettings } from '../../hooks/useScreenShareSettings';

const PRESETS = {
  '720p@60': { resolution: { width: 1280, height: 720 }, frameRate: 60 },
  '720p@30': { resolution: { width: 1280, height: 720 }, frameRate: 30 },
  '1080p@60': { resolution: { width: 1920, height: 1080 }, frameRate: 60 },
  '1080p@30': { resolution: { width: 1920, height: 1080 }, frameRate: 30 },
} as const;

function computeBitrate(
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
    current.timestamp === undefined ||
    prev.timestamp === undefined
  ) {
    return 0;
  }
  return ((bytesNow - bytesPrev) * 8 * 1000) / (current.timestamp - prev.timestamp);
}

interface StreamSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StreamSettings({ isOpen, onClose }: StreamSettingsProps) {
  const room = useRoomContext();
  const { settings, setSettings } = useScreenShareSettings();
  const { settings: audioSettings, setSettings: setAudioSettings } = useAudioSettings();
  const [activeTab, setActiveTab] = useState<'audio' | 'settings' | 'stats' | 'people'>('audio');
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const remoteParticipants = useRemoteParticipants();
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});

  // Stats — state для рендера, prev ref для вычисления битрейта
  const [senderStats, setSenderStats] = useState<VideoSenderStats[]>([]);
  const [receiverStats, setReceiverStats] = useState<VideoReceiverStats[]>([]);
  const prevSenderRef = useRef<VideoSenderStats[]>([]);
  const prevReceiverRef = useRef<VideoReceiverStats[]>([]);

  const onParticipantVolume = (identity: string, volume: number) => {
    setParticipantVolumes((prev) => ({ ...prev, [identity]: volume }));
    const participant = room?.remoteParticipants.get(identity);
    if (!participant) return;
    const pub = participant.getTrackPublication(Track.Source.Microphone);
    const audioTrack = pub?.audioTrack as RemoteAudioTrack | undefined;
    audioTrack?.setVolume(volume);
  };

  // Загружаем только выходные устройства — входные выбираются через кнопку Microphone
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) return;
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Сбор статистики — только когда открыта вкладка Stats
  useEffect(() => {
    if (!isOpen || activeTab !== 'stats' || !room) return;

    const interval = setInterval(async () => {
      try {
        const allSender: VideoSenderStats[] = [];
        const allReceiver: VideoReceiverStats[] = [];

        for (const pub of room.localParticipant.videoTrackPublications.values()) {
          if (pub.source === Track.Source.ScreenShare && pub.track) {
            const track = pub.track;
            if (track.kind === Track.Kind.Video && 'getSenderStats' in track) {
              try {
                const stats = await (track as LocalVideoTrack).getSenderStats();
                if (Array.isArray(stats)) allSender.push(...stats);
              } catch (e) {
                console.warn('getSenderStats failed:', e);
              }
            }
          }
        }

        for (const participant of room.remoteParticipants.values()) {
          for (const pub of participant.videoTrackPublications.values()) {
            if (pub.source === Track.Source.ScreenShare && pub.track) {
              const track = pub.track;
              if (track.kind === Track.Kind.Video && 'getReceiverStats' in track) {
                try {
                  const stats = await (track as RemoteVideoTrack).getReceiverStats();
                  if (stats) allReceiver.push(stats);
                } catch (e) {
                  console.warn('getReceiverStats failed:', e);
                }
              }
            }
          }
        }

        // Функциональные обновления гарантируют актуальное предыдущее значение в замыкании
        setSenderStats((prev) => { prevSenderRef.current = prev; return allSender; });
        setReceiverStats((prev) => { prevReceiverRef.current = prev; return allReceiver; });
      } catch (e) {
        console.error('Stats collection failed:', e);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, activeTab, room]);

  // Находим активный пресет
  const currentPresetKey = Object.entries(PRESETS).find(
    ([, preset]) =>
      preset.resolution.width === settings.resolution.width &&
      preset.resolution.height === settings.resolution.height &&
      preset.frameRate === settings.frameRate,
  )?.[0] ?? '';

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl z-50 w-[90vw] max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex gap-1">
          {(
            [
              { id: 'audio', label: 'Audio' },
              { id: 'settings', label: 'Screen' },
              { id: 'people', label: `People${remoteParticipants.length > 0 ? ` (${remoteParticipants.length})` : ''}` },
              { id: 'stats', label: 'Stats' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === id
                  ? 'bg-[#2a2a2a] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[#252525]'
              }`}
            >
              {label}
            </button>
          ))}
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

      {/* Content */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {activeTab === 'audio' && (
          <div className="space-y-6">
            {/* Microphone options */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                <span>🎤</span> Microphone (Input)
              </h3>
              <p className="text-[10px] text-gray-500 mb-3">
                Device: use the Microphone button dropdown in the control bar
              </p>
              <div className="space-y-2">
                {(
                  [
                    { key: 'noiseSuppression' as const, label: 'Noise suppression', desc: 'Reduces background noise' },
                    { key: 'echoCancellation' as const, label: 'Echo cancellation', desc: 'Removes echo from speakers' },
                    { key: 'autoGainControl' as const, label: 'Auto gain', desc: 'Normalizes microphone level' },
                    { key: 'voiceIsolation' as const, label: 'Voice isolation', desc: 'Stronger noise reduction (experimental)' },
                  ] as const
                ).map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                    <div>
                      <span className="text-xs text-white">{label}</span>
                      <span className="block text-[10px] text-gray-500">{desc}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={audioSettings[key]}
                      onClick={() => setAudioSettings({ [key]: !audioSettings[key] })}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        audioSettings[key] ? 'bg-blue-600' : 'bg-[#3a3a3a]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          audioSettings[key] ? 'left-4' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>

            {/* Noise Gate */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                <span>🚪</span> Noise Gate
              </h3>
              <p className="text-[10px] text-gray-500 mb-3">
                Blocks mic when silent — cuts background noise in pauses between speech
              </p>
              <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer mb-3">
                <div>
                  <span className="text-xs text-white">Enable Noise Gate</span>
                  <span className="block text-[10px] text-gray-500">
                    {audioSettings.noiseGateEnabled ? 'Active — mic muted below threshold' : 'Inactive'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={audioSettings.noiseGateEnabled}
                  onClick={() => setAudioSettings({ noiseGateEnabled: !audioSettings.noiseGateEnabled })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    audioSettings.noiseGateEnabled ? 'bg-blue-600' : 'bg-[#3a3a3a]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      audioSettings.noiseGateEnabled ? 'left-4' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>

              {audioSettings.noiseGateEnabled && (
                <div className="space-y-3 pl-1 border-l-2 border-[#2a2a2a]">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      Threshold: {audioSettings.noiseGateThreshold} dB
                      <span className="text-[10px] text-gray-600 ml-1">(lower = more aggressive)</span>
                    </label>
                    <input
                      type="range" min="-60" max="0" step="1"
                      value={audioSettings.noiseGateThreshold}
                      onChange={(e) => setAudioSettings({ noiseGateThreshold: parseInt(e.target.value) })}
                      className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                      <span>-60 dB</span><span>-30 dB</span><span>0 dB</span>
                    </div>
                  </div>

                  <details className="group">
                    <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-400 select-none flex items-center gap-1.5 py-1">
                      <svg className="w-2.5 h-2.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Advanced (Attack / Release)
                    </summary>
                    <div className="mt-2 space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          Attack: {audioSettings.noiseGateAttack} ms
                          <span className="text-[10px] text-gray-600 ml-1">(how fast gate opens)</span>
                        </label>
                        <input
                          type="range" min="1" max="100" step="1"
                          value={audioSettings.noiseGateAttack}
                          onChange={(e) => setAudioSettings({ noiseGateAttack: parseInt(e.target.value) })}
                          className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                          <span>1 ms</span><span>100 ms</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          Release: {audioSettings.noiseGateRelease} ms
                          <span className="text-[10px] text-gray-600 ml-1">(how fast gate closes)</span>
                        </label>
                        <input
                          type="range" min="20" max="500" step="10"
                          value={audioSettings.noiseGateRelease}
                          onChange={(e) => setAudioSettings({ noiseGateRelease: parseInt(e.target.value) })}
                          className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                          <span>20 ms</span><span>500 ms</span>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* Speakers */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                <span>🔊</span> Speakers (Output)
              </h3>
              <div className="space-y-3">
                {audioOutputs.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Output device</label>
                    <select
                      value={audioSettings.speakerDeviceId}
                      onChange={(e) => setAudioSettings({ speakerDeviceId: e.target.value })}
                      className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
                    >
                      <option value="">Default</option>
                      {audioOutputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    Speaker volume: {Math.round(audioSettings.outputVolume * 100)}%
                  </label>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={Math.min(1, audioSettings.outputVolume)}
                    onChange={(e) => setAudioSettings({ outputVolume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Sounds */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                <span>🔔</span> Notifications
              </h3>
              <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                <div>
                  <span className="text-xs text-white">Join / Leave sounds</span>
                  <span className="block text-[10px] text-gray-500">Звук при входе и выходе участников</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={audioSettings.joinLeaveSounds}
                  onClick={() => setAudioSettings({ joinLeaveSounds: !audioSettings.joinLeaveSounds })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    audioSettings.joinLeaveSounds ? 'bg-blue-600' : 'bg-[#3a3a3a]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      audioSettings.joinLeaveSounds ? 'left-4' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Screen Share Quality</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setSettings(preset)}
                    className={`px-3 py-2.5 rounded text-xs font-medium transition-all border ${
                      currentPresetKey === key
                        ? 'bg-[#3a3a3a] text-white border-[#4a4a4a]'
                        : 'bg-[#252525] text-gray-300 hover:bg-[#2a2a2a] hover:text-white border-[#2a2a2a]'
                    }`}
                  >
                    <div className="font-semibold">{key.split('@')[0]}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{preset.frameRate} FPS</div>
                  </button>
                ))}
              </div>

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
                          setSettings({ resolution: { ...settings.resolution, width: parseInt(e.target.value) || 1280 } })
                        }
                        className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Height</label>
                      <input
                        type="number"
                        value={settings.resolution.height}
                        onChange={(e) =>
                          setSettings({ resolution: { ...settings.resolution, height: parseInt(e.target.value) || 720 } })
                        }
                        className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Frame Rate (FPS)</label>
                    <input
                      type="number"
                      value={settings.frameRate}
                      onChange={(e) => setSettings({ frameRate: parseInt(e.target.value) || 60 })}
                      min="1" max="60"
                      className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}

        {activeTab === 'people' && (
          <div className="space-y-3">
            <p className="text-[10px] text-gray-500 mb-1">
              Громкость каждого участника. Выше 100% — усилить тихий голос.
            </p>
            {remoteParticipants.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                <div className="text-sm mb-1">Нет других участников</div>
                <div className="text-xs text-gray-600">Участники появятся здесь когда войдут в комнату</div>
              </div>
            ) : (
              remoteParticipants.map((participant) => {
                const name = participant.name || participant.identity;
                const volume = participantVolumes[participant.identity] ?? 1;
                return (
                  <div key={participant.identity} className="bg-[#252525] rounded p-3 border border-[#2a2a2a]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white font-medium truncate max-w-[60%]">{name}</span>
                      <span className="text-[10px] text-gray-500">{Math.round(volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={volume}
                      onChange={(e) => onParticipantVolume(participant.identity, parseFloat(e.target.value))}
                      className="w-full h-2 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-4">
            {senderStats.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-2">
                  <span>📤</span> Outgoing Stream
                </h4>
                {senderStats.map((stat, idx) => {
                  const bitrate = computeBitrate(stat, prevSenderRef.current[idx]);
                  return (
                    <div key={idx} className="bg-[#252525] rounded p-3 mb-2 border border-[#2a2a2a]">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">Resolution:</span>{' '}<span className="text-white">{stat.frameWidth}×{stat.frameHeight}</span></div>
                        <div><span className="text-gray-500">FPS:</span>{' '}<span className="text-white">{stat.framesPerSecond.toFixed(1)}</span></div>
                        <div><span className="text-gray-500">Bitrate:</span>{' '}<span className="text-white">{(bitrate / 1000).toFixed(0)} kbps</span></div>
                        <div><span className="text-gray-500">Target:</span>{' '}<span className="text-white">{(stat.targetBitrate / 1000).toFixed(0)} kbps</span></div>
                        {stat.packetsLost !== undefined && (
                          <div><span className="text-gray-500">Lost:</span>{' '}<span className="text-red-400">{stat.packetsLost}</span></div>
                        )}
                        {stat.roundTripTime !== undefined && (
                          <div><span className="text-gray-500">RTT:</span>{' '}<span className="text-white">{stat.roundTripTime.toFixed(0)} ms</span></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {receiverStats.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <span>📥</span> Incoming Stream
                </h4>
                {receiverStats.map((stat, idx) => {
                  const bitrate = computeBitrate(stat, prevReceiverRef.current[idx]);
                  const prev = prevReceiverRef.current[idx];
                  const fps =
                    prev && stat.timestamp && prev.timestamp
                      ? ((stat.framesDecoded - prev.framesDecoded) * 1000) / (stat.timestamp - prev.timestamp)
                      : 0;
                  return (
                    <div key={idx} className="bg-[#252525] rounded p-3 mb-2 border border-[#2a2a2a]">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {stat.frameWidth && stat.frameHeight && (
                          <div><span className="text-gray-500">Resolution:</span>{' '}<span className="text-white">{stat.frameWidth}×{stat.frameHeight}</span></div>
                        )}
                        <div><span className="text-gray-500">FPS:</span>{' '}<span className="text-white">{fps.toFixed(1)}</span></div>
                        <div><span className="text-gray-500">Bitrate:</span>{' '}<span className="text-white">{(bitrate / 1000).toFixed(0)} kbps</span></div>
                        <div><span className="text-gray-500">Decoded:</span>{' '}<span className="text-white">{stat.framesDecoded}</span></div>
                        {stat.framesDropped !== undefined && (
                          <div><span className="text-gray-500">Dropped:</span>{' '}<span className="text-red-400">{stat.framesDropped}</span></div>
                        )}
                        {stat.jitter !== undefined && (
                          <div><span className="text-gray-500">Jitter:</span>{' '}<span className="text-white">{stat.jitter.toFixed(2)} ms</span></div>
                        )}
                        {stat.mimeType && (
                          <div className="col-span-2"><span className="text-gray-500">Codec:</span>{' '}<span className="text-white">{stat.mimeType}</span></div>
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
                <div className="text-xs text-gray-600">Start screen share to see statistics</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

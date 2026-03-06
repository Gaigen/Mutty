import { useRoomContext, useRemoteParticipants } from '@livekit/components-react';
import { useParticipantVolumes } from '../../context/ParticipantVolumesContext';
import { VideoSenderStats, VideoReceiverStats, Track, type LocalVideoTrack, type RemoteVideoTrack } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { useAudioSettings } from '../../hooks/useAudioSettings';
import { useCameraSettings } from '../../hooks/useCameraSettings';
import { useScreenShareSettings, type VideoCodec, type ContentHint } from '../../hooks/useScreenShareSettings';

const SCREEN_RESOLUTION_PRESETS = {
  '4K':    { width: 3840, height: 2160 },
  '1440p': { width: 2560, height: 1440 },
  '1080p': { width: 1920, height: 1080 },
  '720p':  { width: 1280, height: 720  },
  '540p':  { width: 960,  height: 540  },
  '480p':  { width: 854,  height: 480  },
  '360p':  { width: 640,  height: 360  },
} as const;

const SCREEN_FPS_PRESETS = [60, 30, 24, 15, 10, 5] as const;

const CAMERA_PRESETS = {
  '1080p': { width: 1920, height: 1080 },
  '720p':  { width: 1280, height: 720  },
  '480p':  { width: 854,  height: 480  },
  '360p':  { width: 640,  height: 360  },
} as const;

const CODECS: { value: VideoCodec; label: string; desc: string }[] = [
  { value: 'av1',  label: 'AV1',  desc: 'Best quality, best compression. Requires server support.' },
  { value: 'vp9',  label: 'VP9',  desc: 'Good quality, wide compatibility.' },
  { value: 'h264', label: 'H.264', desc: 'Maximum compatibility, larger file size.' },
  { value: 'vp8',  label: 'VP8',  desc: 'Legacy, compatibility only.' },
];

const CONTENT_HINTS: { value: ContentHint; label: string; desc: string }[] = [
  { value: 'motion', label: 'Motion',  desc: 'Video, games — prioritize smoothness.' },
  { value: 'detail', label: 'Detail',  desc: 'Code, design — prioritize sharpness.' },
  { value: 'text',   label: 'Text',    desc: 'Documents, spreadsheets — maximum text clarity.' },
];

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
  const { settings: screenSettings, setSettings: setScreenSettings } = useScreenShareSettings();
  const { settings: camSettings, setSettings: setCamSettings } = useCameraSettings();
  const { settings: audioSettings, setSettings: setAudioSettings } = useAudioSettings();
  const [activeTab, setActiveTab] = useState<'audio' | 'screen' | 'camera' | 'people' | 'stats'>('audio');
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const remoteParticipants = useRemoteParticipants();
  const { volumes: participantVolumes, setVolume: setParticipantVolume } = useParticipantVolumes();

  // Stats — state для рендера, prev ref для вычисления битрейта
  const [senderStats, setSenderStats] = useState<VideoSenderStats[]>([]);
  const [receiverStats, setReceiverStats] = useState<VideoReceiverStats[]>([]);
  const prevSenderRef = useRef<VideoSenderStats[]>([]);
  const prevReceiverRef = useRef<VideoReceiverStats[]>([]);

  const onParticipantVolume = (identity: string, volume: number) => {
    setParticipantVolume(identity, volume);
  };

  // Находим активные пресеты экрана
  const currentResolutionPreset = Object.entries(SCREEN_RESOLUTION_PRESETS).find(
    ([, p]) => p.width === screenSettings.resolution.width && p.height === screenSettings.resolution.height,
  )?.[0] ?? '';

  // Находим активный пресет камеры
  const currentCamPreset = Object.entries(CAMERA_PRESETS).find(
    ([, p]) => p.width === camSettings.width && p.height === camSettings.height,
  )?.[0] ?? '';

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

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl z-50 w-[90vw] max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex gap-1 flex-wrap">
          {(
            [
              { id: 'audio',  label: 'Audio' },
              { id: 'screen', label: 'Screen' },
              { id: 'camera', label: 'Camera' },
              { id: 'people', label: remoteParticipants.length > 0 ? `People (${remoteParticipants.length})` : 'People' },
              { id: 'stats',  label: 'Stats' },
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
                Device: use the Microphone dropdown in the control bar
              </p>
              <div className="space-y-2">
                {(
                  [
                    { key: 'noiseSuppression' as const, label: 'Noise suppression', desc: 'Reduce background noise' },
                    { key: 'echoCancellation' as const, label: 'Echo cancellation', desc: 'Remove echo' },
                    { key: 'autoGainControl' as const, label: 'Auto gain', desc: 'Normalize mic level' },
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
                Mute mic when silent to cut background noise between speech
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
                  <span className="block text-[10px] text-gray-500">Chime when participants join or leave</span>
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

        {activeTab === 'screen' && (
          <div className="space-y-5">
            {/* Resolution presets */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Resolution</h3>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(SCREEN_RESOLUTION_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setScreenSettings({ resolution: { width: preset.width, height: preset.height } })}
                    className={`px-2 py-2 rounded text-xs font-medium transition-all border ${
                      currentResolutionPreset === key
                        ? 'bg-[#3a3a3a] text-white border-[#4a4a4a]'
                        : 'bg-[#252525] text-gray-300 hover:bg-[#2a2a2a] hover:text-white border-[#2a2a2a]'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            {/* FPS presets */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Frame rate (FPS)</h3>
              <div className="flex flex-wrap gap-2">
                {SCREEN_FPS_PRESETS.map((fps) => (
                  <button
                    key={fps}
                    onClick={() => setScreenSettings({ frameRate: fps })}
                    className={`px-3 py-2 rounded text-xs font-medium transition-all border ${
                      screenSettings.frameRate === fps
                        ? 'bg-[#3a3a3a] text-white border-[#4a4a4a]'
                        : 'bg-[#252525] text-gray-300 hover:bg-[#2a2a2a] hover:text-white border-[#2a2a2a]'
                    }`}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>

            {/* Codec */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Codec</h3>
              <div className="space-y-1.5">
                {CODECS.map(({ value, label, desc }) => (
                  <label key={value} className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="screen-codec"
                      value={value}
                      checked={screenSettings.videoCodec === value}
                      onChange={() => setScreenSettings({ videoCodec: value })}
                      className="mt-0.5 accent-blue-500 shrink-0"
                    />
                    <div>
                      <span className="text-xs text-white font-medium">{label}</span>
                      <span className="block text-[10px] text-gray-500">{desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Content hint */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Content Type</h3>
              <div className="space-y-1.5">
                {CONTENT_HINTS.map(({ value, label, desc }) => (
                  <label key={value} className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="content-hint"
                      value={value}
                      checked={screenSettings.contentHint === value}
                      onChange={() => setScreenSettings({ contentHint: value })}
                      className="mt-0.5 accent-blue-500 shrink-0"
                    />
                    <div>
                      <span className="text-xs text-white font-medium">{label}</span>
                      <span className="block text-[10px] text-gray-500">{desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Bitrate */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Max Bitrate</h3>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1000000"
                  max="20000000"
                  step="500000"
                  value={screenSettings.maxBitrate}
                  onChange={(e) => setScreenSettings({ maxBitrate: parseInt(e.target.value) })}
                  className="flex-1 h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs text-white w-16 text-right shrink-0">
                  {(screenSettings.maxBitrate / 1_000_000).toFixed(1)} Mbps
                </span>
              </div>
              <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                <span>1 Mbps</span><span>20 Mbps</span>
              </div>
            </div>

            {/* Custom resolution */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none py-2 flex items-center gap-2">
                <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Custom Resolution
              </summary>
              <div className="mt-3 space-y-3 pt-3 border-t border-[#2a2a2a]">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Width</label>
                    <input
                      type="number"
                      value={screenSettings.resolution.width}
                      onChange={(e) =>
                        setScreenSettings({ resolution: { ...screenSettings.resolution, width: parseInt(e.target.value) || 1920 } })
                      }
                      className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Height</label>
                    <input
                      type="number"
                      value={screenSettings.resolution.height}
                      onChange={(e) =>
                        setScreenSettings({ resolution: { ...screenSettings.resolution, height: parseInt(e.target.value) || 1080 } })
                      }
                      className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">FPS</label>
                    <input
                      type="number"
                      value={screenSettings.frameRate}
                      onChange={(e) => setScreenSettings({ frameRate: parseInt(e.target.value) || 60 })}
                      min="1" max="60"
                      className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
                    />
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}

        {activeTab === 'camera' && (
          <div className="space-y-5">
            <p className="text-[10px] text-gray-500">Applied on next room join.</p>

            {/* Resolution presets */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Resolution</h3>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(CAMERA_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setCamSettings({ width: preset.width, height: preset.height })}
                    className={`px-2 py-2 rounded text-xs font-medium transition-all border ${
                      currentCamPreset === key
                        ? 'bg-[#3a3a3a] text-white border-[#4a4a4a]'
                        : 'bg-[#252525] text-gray-300 hover:bg-[#2a2a2a] hover:text-white border-[#2a2a2a]'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            {/* FPS */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Frame Rate</h3>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="15" max="60" step="5"
                  value={camSettings.maxFramerate}
                  onChange={(e) => setCamSettings({ maxFramerate: parseInt(e.target.value) })}
                  className="flex-1 h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs text-white w-12 text-right shrink-0">{camSettings.maxFramerate} FPS</span>
              </div>
            </div>

            {/* Codec */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Codec</h3>
              <div className="space-y-1.5">
                {CODECS.map(({ value, label, desc }) => (
                  <label key={value} className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="camera-codec"
                      value={value}
                      checked={camSettings.videoCodec === value}
                      onChange={() => setCamSettings({ videoCodec: value })}
                      className="mt-0.5 accent-blue-500 shrink-0"
                    />
                    <div>
                      <span className="text-xs text-white font-medium">{label}</span>
                      <span className="block text-[10px] text-gray-500">{desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Bitrate */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Max Bitrate</h3>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="500000"
                  max="8000000"
                  step="250000"
                  value={camSettings.maxBitrate}
                  onChange={(e) => setCamSettings({ maxBitrate: parseInt(e.target.value) })}
                  className="flex-1 h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs text-white w-16 text-right shrink-0">
                  {(camSettings.maxBitrate / 1_000_000).toFixed(2)} Mbps
                </span>
              </div>
              <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                <span>0.5 Mbps</span><span>8 Mbps</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'people' && (
          <div className="space-y-3">
            <p className="text-[10px] text-gray-500 mb-1">
              Per-participant volume. Above 100% boosts quiet voices.
            </p>
            {remoteParticipants.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                <div className="text-sm mb-1">No other participants</div>
                <div className="text-xs text-gray-600">Participants will appear here when they join</div>
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

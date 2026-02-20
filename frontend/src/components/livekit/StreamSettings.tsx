import { useRoomContext } from '@livekit/components-react';
import { VideoSenderStats, VideoReceiverStats, Track } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioSettings } from '../../hooks/useAudioSettings';
import { useScreenShareSettings } from '../../hooks/useScreenShareSettings';
import {
  createNoiseGateProcessor,
  type NoiseGateProcessorRef,
} from '../../utils/NoiseGateProcessor';

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
  const { settings: audioSettings, setSettings: setAudioSettings } = useAudioSettings();
  const [activeTab, setActiveTab] = useState<'audio' | 'settings' | 'stats'>('audio');
  const [audioDevices, setAudioDevices] = useState<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }>({
    inputs: [],
    outputs: [],
  });
  const [senderStats, setSenderStats] = useState<VideoSenderStats[]>([]);
  const [receiverStats, setReceiverStats] = useState<VideoReceiverStats[]>([]);
  const prevSenderStatsRef = useRef<VideoSenderStats[]>([]);
  const prevReceiverStatsRef = useRef<VideoReceiverStats[]>([]);
  const senderStatsRef = useRef<VideoSenderStats[]>([]);
  const receiverStatsRef = useRef<VideoReceiverStats[]>([]);

  // Noise Gate processor ref — хранит ссылку на AudioWorkletNode для обновления параметров
  const noiseGateRef = useRef<NoiseGateProcessorRef>({
    node: null,
    options: {
      threshold: audioSettings.noiseGateThreshold,
      attack: audioSettings.noiseGateAttack,
      release: audioSettings.noiseGateRelease,
    },
  });

  // Load audio devices
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) return;
        setAudioDevices({
          inputs: devices.filter((d) => d.kind === 'audioinput'),
          outputs: devices.filter((d) => d.kind === 'audiooutput'),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply microphone capture options when changed (restart track)
  // Устройство микрофона — через кнопку Microphone в панели LiveKit
  const applyMicOptions = useCallback(async () => {
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = pub?.track;
    if (!track || track.kind !== Track.Kind.Audio) {
      // Трек не существует — настройки применятся при следующем включении микрофона
      return;
    }
    
    const localTrack = track as import('livekit-client').LocalAudioTrack;
    const wasMuted = localTrack.isMuted;
    
    const newOptions = {
      noiseSuppression: audioSettings.noiseSuppression,
      echoCancellation: audioSettings.echoCancellation,
      autoGainControl: audioSettings.autoGainControl,
      voiceIsolation: audioSettings.voiceIsolation,
    };
    
    console.log('[AudioSettings] Applying mic options:', newOptions);
    
    try {
      // Если трек muted, временно unmute для применения настроек
      if (wasMuted) {
        await localTrack.unmute();
      }
      
      await localTrack.restartTrack(newOptions);
      console.log('[AudioSettings] Mic options applied successfully');
      
      // Возвращаем mute состояние если было muted
      if (wasMuted) {
        await localTrack.mute();
      }
    } catch (e) {
      console.error('[AudioSettings] Failed to apply mic options:', e);
      // Восстанавливаем mute состояние при ошибке
      if (wasMuted && !localTrack.isMuted) {
        try {
          await localTrack.mute();
        } catch {
          // ignore
        }
      }
    }
  }, [room, audioSettings.noiseSuppression, audioSettings.echoCancellation, audioSettings.autoGainControl, audioSettings.voiceIsolation]);

  // Apply speaker device when changed
  const applySpeakerDevice = useCallback(() => {
    if (!room || !audioSettings.speakerDeviceId) return;
    try {
      console.log('[AudioSettings] Applying speaker device:', audioSettings.speakerDeviceId);
      room.switchActiveDevice('audiooutput', audioSettings.speakerDeviceId);
    } catch (e) {
      console.warn('[AudioSettings] Failed to apply speaker device:', e);
    }
  }, [room, audioSettings.speakerDeviceId]);

  // Применяем устройство динамиков при изменении
  useEffect(() => {
    if (!audioSettings.speakerDeviceId) return;
    applySpeakerDevice();
  }, [audioSettings.speakerDeviceId, applySpeakerDevice]);

  // Применяем устройство динамиков при инициализации комнаты
  useEffect(() => {
    if (!room || !audioSettings.speakerDeviceId) return;
    // Небольшая задержка для инициализации комнаты
    const timer = setTimeout(() => {
      console.log('[AudioSettings] Applying saved speaker device on init');
      applySpeakerDevice();
    }, 500);
    return () => clearTimeout(timer);
  }, [room, applySpeakerDevice]); // Зависим от room и applySpeakerDevice

  // Apply mic options when capture settings change
  const prevMicSettingsRef = useRef({
    noiseSuppression: audioSettings.noiseSuppression,
    echoCancellation: audioSettings.echoCancellation,
    autoGainControl: audioSettings.autoGainControl,
    voiceIsolation: audioSettings.voiceIsolation,
  });

  // Применяем настройки микрофона при изменении настроек
  useEffect(() => {
    if (!room) return;
    
    const hasChanged =
      prevMicSettingsRef.current.noiseSuppression !== audioSettings.noiseSuppression ||
      prevMicSettingsRef.current.echoCancellation !== audioSettings.echoCancellation ||
      prevMicSettingsRef.current.autoGainControl !== audioSettings.autoGainControl ||
      prevMicSettingsRef.current.voiceIsolation !== audioSettings.voiceIsolation;

    if (hasChanged) {
      prevMicSettingsRef.current = {
        noiseSuppression: audioSettings.noiseSuppression,
        echoCancellation: audioSettings.echoCancellation,
        autoGainControl: audioSettings.autoGainControl,
        voiceIsolation: audioSettings.voiceIsolation,
      };
      applyMicOptions();
    }
  }, [
    room,
    audioSettings.noiseSuppression,
    audioSettings.echoCancellation,
    audioSettings.autoGainControl,
    audioSettings.voiceIsolation,
    applyMicOptions,
  ]);

  // Применяем настройки микрофона при инициализации (если трек уже существует)
  // и при появлении нового трека микрофона
  useEffect(() => {
    if (!room) return;

    // Применяем настройки сразу, если трек уже существует
    const checkAndApply = () => {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (pub?.track) {
        console.log('[AudioSettings] Applying saved mic settings on init/track appear');
        applyMicOptions();
      }
    };

    // Проверяем сразу
    checkAndApply();

    // Слушаем появление треков микрофона
    const handleTrackPublished = (publication: import('livekit-client').LocalTrackPublication) => {
      if (publication.source === Track.Source.Microphone && publication.track) {
        console.log('[AudioSettings] Microphone track published, applying saved settings');
        // Небольшая задержка, чтобы трек точно был готов
        setTimeout(() => {
          applyMicOptions();
        }, 100);
      }
    };

    room.on('localTrackPublished', handleTrackPublished);

    return () => {
      room.off('localTrackPublished', handleTrackPublished);
    };
  }, [room, applyMicOptions]);

  // Применяем устройство динамиков при инициализации
  useEffect(() => {
    if (!room || !audioSettings.speakerDeviceId) return;
    // Небольшая задержка для инициализации комнаты
    const timer = setTimeout(() => {
      console.log('[AudioSettings] Applying saved speaker device on init');
      applySpeakerDevice();
    }, 500);
    return () => clearTimeout(timer);
  }, [room]); // Только при монтировании комнаты, не при каждом изменении speakerDeviceId

  // ─── Noise Gate ──────────────────────────────────────────────────────────

  /** Возвращает LocalAudioTrack микрофона или null */
  function getMicTrack() {
    if (!room) return null;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = pub?.track;
    if (!track || track.kind !== Track.Kind.Audio) return null;
    return track as import('livekit-client').LocalAudioTrack;
  }

  // Включение / выключение noise gate
  useEffect(() => {
    if (!room) return;

    async function applyNoiseGate(enabled: boolean) {
      const track = getMicTrack();
      if (!track) return;

      if (enabled) {
        // Не устанавливаем дважды
        if (track.getProcessor()) {
          console.log('[NoiseGate] processor already set, skipping');
          return;
        }
        console.log('[NoiseGate] enabling processor');
        // Синхронизируем опции из актуальных настроек
        noiseGateRef.current.options = {
          threshold: audioSettings.noiseGateThreshold,
          attack: audioSettings.noiseGateAttack,
          release: audioSettings.noiseGateRelease,
        };
        const proc = createNoiseGateProcessor(noiseGateRef.current);
        try {
          await track.setProcessor(proc);
          console.log('[NoiseGate] processor enabled successfully');
        } catch (e) {
          console.error('[NoiseGate] failed to set processor:', e);
        }
      } else {
        if (!track.getProcessor()) return;
        console.log('[NoiseGate] disabling processor');
        try {
          await track.stopProcessor();
          noiseGateRef.current.node = null;
          console.log('[NoiseGate] processor disabled successfully');
        } catch (e) {
          console.error('[NoiseGate] failed to stop processor:', e);
        }
      }
    }

    applyNoiseGate(audioSettings.noiseGateEnabled);

    // Также применяем при появлении трека (пользователь включил мик после открытия настроек)
    const handleTrackPublished = (publication: import('livekit-client').LocalTrackPublication) => {
      if (publication.source === Track.Source.Microphone && audioSettings.noiseGateEnabled) {
        setTimeout(() => applyNoiseGate(true), 150);
      }
    };
    room.on('localTrackPublished', handleTrackPublished);
    return () => {
      room.off('localTrackPublished', handleTrackPublished);
    };
  }, [room, audioSettings.noiseGateEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Обновление параметров noise gate без перезапуска processor
  useEffect(() => {
    noiseGateRef.current.options = {
      threshold: audioSettings.noiseGateThreshold,
      attack: audioSettings.noiseGateAttack,
      release: audioSettings.noiseGateRelease,
    };
    if (noiseGateRef.current.node) {
      noiseGateRef.current.node.port.postMessage({
        threshold: Math.pow(10, audioSettings.noiseGateThreshold / 20),
        attackMs: audioSettings.noiseGateAttack,
        releaseMs: audioSettings.noiseGateRelease,
      });
    }
  }, [audioSettings.noiseGateThreshold, audioSettings.noiseGateAttack, audioSettings.noiseGateRelease]);

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
            onClick={() => setActiveTab('audio')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'audio'
                ? 'bg-[#2a2a2a] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#252525]'
            }`}
          >
            Audio
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'settings'
                ? 'bg-[#2a2a2a] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#252525]'
            }`}
          >
            Screen
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
        {activeTab === 'audio' ? (
          <div className="space-y-6">
            {/* Input (microphone) — устройство выбирается на кнопке Microphone в панели */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                <span>🎤</span> Microphone (Input)
              </h3>
              <p className="text-[10px] text-gray-500 mb-3">
                Device: use the Microphone button dropdown in the control bar
              </p>
              <div className="space-y-2">
                  {[
                    { key: 'noiseSuppression' as const, label: 'Noise suppression', desc: 'Reduces background noise' },
                    { key: 'echoCancellation' as const, label: 'Echo cancellation', desc: 'Removes echo from speakers' },
                    { key: 'autoGainControl' as const, label: 'Auto gain', desc: 'Normalizes microphone level' },
                    { key: 'voiceIsolation' as const, label: 'Voice isolation', desc: 'Stronger noise reduction (experimental)' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} className="flex items-center justify-between gap-3 py-1.5 cursor-pointer group">
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

              {/* Enable toggle */}
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

              {/* Parameters — shown only when enabled */}
              {audioSettings.noiseGateEnabled && (
                <div className="space-y-3 pl-1 border-l-2 border-[#2a2a2a]">
                  {/* Threshold */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      Threshold: {audioSettings.noiseGateThreshold} dB
                      <span className="text-[10px] text-gray-600 ml-1">(lower = more aggressive)</span>
                    </label>
                    <input
                      type="range"
                      min="-60"
                      max="0"
                      step="1"
                      value={audioSettings.noiseGateThreshold}
                      onChange={(e) => setAudioSettings({ noiseGateThreshold: parseInt(e.target.value) })}
                      className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                      <span>-60 dB</span>
                      <span>-30 dB</span>
                      <span>0 dB</span>
                    </div>
                  </div>

                  {/* Advanced (attack/release) */}
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
                          type="range"
                          min="1"
                          max="100"
                          step="1"
                          value={audioSettings.noiseGateAttack}
                          onChange={(e) => setAudioSettings({ noiseGateAttack: parseInt(e.target.value) })}
                          className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                          <span>1 ms</span>
                          <span>100 ms</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          Release: {audioSettings.noiseGateRelease} ms
                          <span className="text-[10px] text-gray-600 ml-1">(how fast gate closes)</span>
                        </label>
                        <input
                          type="range"
                          min="20"
                          max="500"
                          step="10"
                          value={audioSettings.noiseGateRelease}
                          onChange={(e) => setAudioSettings({ noiseGateRelease: parseInt(e.target.value) })}
                          className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                          <span>20 ms</span>
                          <span>500 ms</span>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* Output (speakers) */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                <span>🔊</span> Speakers (Output)
              </h3>
              <div className="space-y-3">
                {audioDevices.outputs.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Output device</label>
                    <select
                      value={audioSettings.speakerDeviceId}
                      onChange={(e) => setAudioSettings({ speakerDeviceId: e.target.value })}
                      className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
                    >
                      <option value="">Default</option>
                      {audioDevices.outputs.map((d) => (
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
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={Math.min(1, audioSettings.outputVolume)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setAudioSettings({ outputVolume: Math.max(0, Math.min(1, val)) });
                    }}
                    className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Note: HTML audio volume is limited to 0-100%
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'settings' ? (
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

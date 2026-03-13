import { useRoomContext, useRemoteParticipants } from '@livekit/components-react';
import { useParticipantVolumes } from '../../context/ParticipantVolumesContext';
import {
  VideoSenderStats,
  VideoReceiverStats,
  Track,
  RoomEvent,
  ConnectionState,
  type LocalVideoTrack,
  type RemoteVideoTrack,
  type Participant,
} from 'livekit-client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioSettings } from '../../hooks/useAudioSettings';
import { useCameraSettings } from '../../hooks/useCameraSettings';
import { useScreenShareSettings, type VideoCodec, type ContentHint } from '../../hooks/useScreenShareSettings';

const BOT_IDENTITY = 'youtube-bot';

// ── Constants ─────────────────────────────────────────────────────────────────
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
  { value: 'av1',  label: 'AV1',   desc: 'Best quality & compression. Requires server support.' },
  { value: 'vp9',  label: 'VP9',   desc: 'Good quality, wide compatibility.' },
  { value: 'h264', label: 'H.264', desc: 'Maximum compatibility, larger size.' },
  { value: 'vp8',  label: 'VP8',   desc: 'Legacy, compatibility only.' },
];

const CONTENT_HINTS: { value: ContentHint; label: string; desc: string }[] = [
  { value: 'motion', label: 'Motion', desc: 'Video, games — prioritize smoothness.' },
  { value: 'detail', label: 'Detail', desc: 'Code, design — prioritize sharpness.' },
  { value: 'text',   label: 'Text',   desc: 'Documents, spreadsheets — max text clarity.' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function computeBitrate(
  current: VideoSenderStats | VideoReceiverStats,
  prev?: VideoSenderStats | VideoReceiverStats,
): number {
  if (!prev) return 0;
  const bytesNow = 'bytesReceived' in current
    ? (current as VideoReceiverStats).bytesReceived
    : (current as VideoSenderStats).bytesSent;
  const bytesPrev = 'bytesReceived' in prev
    ? (prev as VideoReceiverStats).bytesReceived
    : (prev as VideoSenderStats).bytesSent;
  if (bytesNow === undefined || bytesPrev === undefined || !current.timestamp || !prev.timestamp) return 0;
  return ((bytesNow - bytesPrev) * 8 * 1000) / (current.timestamp - prev.timestamp);
}

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#f97316', '#ef4444',
];

function getAvatarColor(identity: string): string {
  let hash = 0;
  for (const c of identity) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

// ── Small UI helpers ──────────────────────────────────────────────────────────
function SectionHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2">
      <span>{emoji}</span> {label}
    </h3>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-[#3a3a3a]'}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'left-4' : 'left-0.5'
        }`}
      />
    </button>
  );
}

// ── Mic level meter hook ───────────────────────────────────────────────────────
/**
 * Strategy: always attach to the raw mediaStreamTrack (browser noise-suppression
 * and echo-cancellation are already applied there via applyConstraints).
 * Noise-gate threshold is emulated in each tick via a settings ref — no
 * re-initialisation needed when settings change, avoiding all race conditions
 * with the async noise-gate worklet setup in AudioHandler.
 */
function useMicLevel(
  active: boolean,
  room: ReturnType<typeof useRoomContext>,
  audioSettings: { noiseGateEnabled: boolean; noiseGateThreshold: number },
): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);
  // Always-fresh settings without re-init
  const settingsRef = useRef(audioSettings);
  settingsRef.current = audioSettings;

  useEffect(() => {
    if (!active) { setLevel(0); return; }

    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const mediaTrack = pub?.track?.mediaStreamTrack;
    if (!mediaTrack || mediaTrack.readyState === 'ended') { setLevel(0); return; }

    let ctx: AudioContext;
    try { ctx = new AudioContext(); } catch { return; }

    const analyser = ctx.createAnalyser();
    // Larger fftSize gives better RMS resolution
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    ctx.createMediaStreamSource(new MediaStream([mediaTrack])).connect(analyser);

    const timeData = new Uint8Array(analyser.fftSize);

    function tick() {
      // Time-domain RMS → dB conversion reflects browser processing (NS/EC/AGC)
      analyser.getByteTimeDomainData(timeData);
      let sum = 0;
      for (const v of timeData) {
        const n = (v - 128) / 128; // normalize to -1..1
        sum += n * n;
      }
      const rms = Math.sqrt(sum / timeData.length);
      // dB: 0 dB = full scale, silence ≈ -90 dB
      const dB = rms > 0.0001 ? 20 * Math.log10(rms) : -90;

      // Apply noise gate threshold in display using the always-fresh ref
      const s = settingsRef.current;
      const gatedDb = s.noiseGateEnabled && dB < s.noiseGateThreshold ? -90 : dB;

      // Normalise -60 dB … 0 dB → 0 … 1
      const MIN_DB = -60;
      setLevel(Math.max(0, Math.min(1, (gatedDb - MIN_DB) / -MIN_DB)));
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ctx.close().catch(() => {});
    };
  }, [active, room.localParticipant]); // only re-init when track changes

  return level;
}

// ── MicLevelBar component ──────────────────────────────────────────────────────
/**
 * level        — 0..1 (0 = silence, 1 = 0 dB full scale)
 * gateThreshold — noise gate threshold in dB (-60..0), shown as a tick mark
 * gateEnabled   — whether to show the threshold line
 */
function MicLevelBar({
  level,
  gateThreshold,
  gateEnabled,
}: {
  level: number;
  gateThreshold: number;
  gateEnabled: boolean;
}) {
  const pct = Math.round(level * 100);
  const color = pct < 50 ? '#22c55e' : pct < 80 ? '#f59e0b' : '#ef4444';
  // Threshold normalised to bar width (MIN_DB = -60)
  const threshPct = Math.max(0, Math.min(100, ((gateThreshold - (-60)) / 60) * 100));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">Input level</span>
        <span className="text-[10px] text-gray-500">{pct}%</span>
      </div>
      <div className="relative h-2 bg-[#252525] rounded-full overflow-hidden border border-[#2a2a2a]">
        <div
          className="h-full rounded-full transition-[width] duration-75"
          style={{ width: `${pct}%`, background: color }}
        />
        {/* Noise gate threshold marker */}
        {gateEnabled && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-orange-400 opacity-80"
            style={{ left: `${threshPct}%` }}
            title={`Noise gate: ${gateThreshold} dB`}
          />
        )}
      </div>
      <div className="flex justify-between mt-0.5">
        <p className="text-[10px] text-gray-600">
          {pct === 0 ? 'Silent / gated' : pct < 8 ? 'Very quiet' : 'Active'}
        </p>
        {gateEnabled && (
          <p className="text-[10px] text-orange-400 opacity-70">
            gate: {gateThreshold} dB
          </p>
        )}
      </div>
    </div>
  );
}

// ── Ping history chart ────────────────────────────────────────────────────────
const PING_HISTORY_SIZE = 60; // keep 60 seconds of readings

function PingChart({ history }: { history: (number | null)[] }) {
  const W = 100; // viewBox units, scales with CSS width
  const H = 40;
  const PAD = 2;

  const valid = history.filter((v): v is number => v !== null);
  if (valid.length < 2) {
    return (
      <div className="flex items-center justify-center h-10 text-[10px] text-gray-600">
        Collecting data…
      </div>
    );
  }

  const maxVal = Math.max(300, ...valid);
  const innerH = H - PAD * 2;
  const innerW = W - PAD * 2;

  // Build polyline points — skip null slots
  const pts: string[] = [];
  history.forEach((v, i) => {
    if (v === null) return;
    const x = PAD + (i / (PING_HISTORY_SIZE - 1)) * innerW;
    const y = PAD + innerH - (v / maxVal) * innerH;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });

  // Color based on latest value
  const latest = valid[valid.length - 1];
  const lineColor = latest < 100 ? '#22c55e' : latest < 250 ? '#f59e0b' : '#ef4444';

  // Grid: 100 ms and 200 ms lines
  const gridLines = [100, 200].filter((v) => v < maxVal);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 48, display: 'block' }}
      >
        {/* Grid lines */}
        {gridLines.map((v) => {
          const y = PAD + innerH - (v / maxVal) * innerH;
          return (
            <g key={v}>
              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#2a2a2a" strokeWidth={0.5} />
              <text x={PAD + 1} y={y - 1} fontSize={4} fill="#555">{v}ms</text>
            </g>
          );
        })}
        {/* Data line */}
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        {/* Latest point dot */}
        {pts.length > 0 && (() => {
          const last = pts[pts.length - 1].split(',');
          return (
            <circle cx={last[0]} cy={last[1]} r={1.5} fill={lineColor} />
          );
        })()}
      </svg>
      <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
        <span>60s ago</span>
        <span>now</span>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface StreamSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function StreamSettings({ isOpen, onClose }: StreamSettingsProps) {
  const room = useRoomContext();
  const { settings: screenSettings, setSettings: setScreenSettings } = useScreenShareSettings();
  const { settings: camSettings, setSettings: setCamSettings } = useCameraSettings();
  const { settings: audioSettings, setSettings: setAudioSettings } = useAudioSettings();
  const [activeTab, setActiveTab] = useState<'audio' | 'screen' | 'camera' | 'people' | 'stats'>('audio');
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const remoteParticipants = useRemoteParticipants();
  const { volumes: participantVolumes, setVolume: setParticipantVolume } = useParticipantVolumes();

  // Active speakers
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const handler = (speakers: Participant[]) => {
      setActiveSpeakerIds(new Set(speakers.map((s) => s.identity)));
    };
    room.on(RoomEvent.ActiveSpeakersChanged, handler);
    return () => { room.off(RoomEvent.ActiveSpeakersChanged, handler); };
  }, [room]);

  // Mic level (only when audio tab is open)
  const micLevel = useMicLevel(isOpen && activeTab === 'audio', room, audioSettings);

  // Stats
  const [senderStats, setSenderStats] = useState<VideoSenderStats[]>([]);
  const [receiverStats, setReceiverStats] = useState<VideoReceiverStats[]>([]);
  const prevSenderRef = useRef<VideoSenderStats[]>([]);
  const prevReceiverRef = useRef<VideoReceiverStats[]>([]);

  const [pingMs, setPingMs] = useState<number | null>(null);
  const [pingHistory, setPingHistory] = useState<(number | null)[]>([]);
  const pingHistoryRef = useRef<(number | null)[]>([]);

  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput')))
      .catch(() => {});
  }, []);

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
              } catch { /* ignore */ }
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
                } catch { /* ignore */ }
              }
            }
          }
        }

        setSenderStats((prev) => { prevSenderRef.current = prev; return allSender; });
        setReceiverStats((prev) => { prevReceiverRef.current = prev; return allReceiver; });

        let newPing: number | null = null;
        try {
          const clientRtt = room.engine.client.rtt;
          if (typeof clientRtt === 'number' && clientRtt > 0) {
            newPing = Math.round(clientRtt);
          }
        } catch { /* ignore */ }

        if (newPing === null) {
          try {
            const eng = room.engine as unknown as {
              pcManager?: { publisher?: { pc?: RTCPeerConnection }; subscriber?: { pc?: RTCPeerConnection } };
            };
            const pc = eng.pcManager?.publisher?.pc ?? eng.pcManager?.subscriber?.pc;
            if (pc) {
              const stats = await pc.getStats();
              stats.forEach((s: RTCStats) => {
                if (s.type === 'candidate-pair') {
                  const pair = s as RTCIceCandidatePairStats;
                  if (pair.nominated && pair.state === 'succeeded' &&
                      pair.currentRoundTripTime !== undefined) {
                    const rtt = pair.currentRoundTripTime;
                    newPing = rtt > 1 ? Math.round(rtt) : Math.round(rtt * 1000);
                  }
                }
              });
            }
          } catch { /* ignore */ }
        }
        setPingMs(newPing);
        const next = [...pingHistoryRef.current, newPing].slice(-PING_HISTORY_SIZE);
        pingHistoryRef.current = next;
        setPingHistory(next);
      } catch { /* ignore */ }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, activeTab, room]);

  const currentResolutionPreset = Object.entries(SCREEN_RESOLUTION_PRESETS).find(
    ([, p]) => p.width === screenSettings.resolution.width && p.height === screenSettings.resolution.height,
  )?.[0] ?? '';

  const currentCamPreset = Object.entries(CAMERA_PRESETS).find(
    ([, p]) => p.width === camSettings.width && p.height === camSettings.height,
  )?.[0] ?? '';

  const humanParticipants = remoteParticipants.filter((p) => p.identity !== BOT_IDENTITY);

  const resetVolume = useCallback(
    (identity: string) => setParticipantVolume(identity, 1),
    [setParticipantVolume],
  );

  if (!isOpen) return null;

  const tabs = [
    { id: 'audio'  as const, label: 'Audio' },
    { id: 'screen' as const, label: 'Screen' },
    { id: 'camera' as const, label: 'Camera' },
    {
      id: 'people' as const,
      label: humanParticipants.length > 0 ? `People (${humanParticipants.length})` : 'People',
    },
    { id: 'stats'  as const, label: 'Stats' },
  ];

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 w-[92vw] max-w-[460px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-2.5">
        <div className="flex gap-0.5 flex-wrap">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === id
                  ? 'bg-[#2a2a2a] text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-[#222]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1 ml-2 rounded hover:bg-[#2a2a2a]"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[62vh] overflow-y-auto space-y-5">

        {/* ── AUDIO ─────────────────────────────────────────── */}
        {activeTab === 'audio' && (
          <>
            {/* Mic level meter */}
            <div className="bg-[#222] rounded-lg p-3 border border-[#2a2a2a]">
              <SectionHeader emoji="🎤" label="Microphone Input" />
              <MicLevelBar
                level={micLevel}
                gateThreshold={audioSettings.noiseGateThreshold}
                gateEnabled={audioSettings.noiseGateEnabled}
              />
              <p className="text-[10px] text-gray-600 mt-2">
                Device: use the Microphone dropdown in the control bar
              </p>
            </div>

            {/* Processing */}
            <div>
              <SectionHeader emoji="🎛" label="Processing" />
              <div className="space-y-2">
                {(
                  [
                    { key: 'noiseSuppression' as const, label: 'Noise suppression',  desc: 'Reduce background noise' },
                    { key: 'echoCancellation' as const, label: 'Echo cancellation',  desc: 'Remove echo' },
                    { key: 'autoGainControl' as const,  label: 'Auto gain control',  desc: 'Normalize mic level' },
                    { key: 'voiceIsolation'  as const,  label: 'Voice isolation',    desc: 'Stronger noise reduction (experimental)' },
                  ]
                ).map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                    <div>
                      <span className="text-xs text-white">{label}</span>
                      <span className="block text-[10px] text-gray-500">{desc}</span>
                    </div>
                    <Toggle
                      checked={audioSettings[key]}
                      onChange={(v) => setAudioSettings({ [key]: v })}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Noise Gate */}
            <div>
              <SectionHeader emoji="🚪" label="Noise Gate" />
              <p className="text-[10px] text-gray-500 mb-3">
                Mutes mic when silent to cut background noise between speech
              </p>
              <label className="flex items-center justify-between gap-3 py-1 cursor-pointer mb-3">
                <div>
                  <span className="text-xs text-white">Enable Noise Gate</span>
                  <span className="block text-[10px] text-gray-500">
                    {audioSettings.noiseGateEnabled ? 'Active — mic muted below threshold' : 'Inactive'}
                  </span>
                </div>
                <Toggle
                  checked={audioSettings.noiseGateEnabled}
                  onChange={(v) => setAudioSettings({ noiseGateEnabled: v })}
                />
              </label>

              {audioSettings.noiseGateEnabled && (
                <div className="space-y-3 pl-3 border-l-2 border-[#2a2a2a]">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">
                      Threshold: <span className="text-white">{audioSettings.noiseGateThreshold} dB</span>
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
                      Advanced — Attack / Release
                    </summary>
                    <div className="mt-2 space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          Attack: <span className="text-white">{audioSettings.noiseGateAttack} ms</span>
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
                          Release: <span className="text-white">{audioSettings.noiseGateRelease} ms</span>
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
              <SectionHeader emoji="🔊" label="Speakers (Output)" />
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
                    Speaker volume: <span className="text-white">{Math.round(audioSettings.outputVolume * 100)}%</span>
                  </label>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={Math.min(1, audioSettings.outputVolume)}
                    onChange={(e) => setAudioSettings({ outputVolume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <SectionHeader emoji="🔔" label="Notifications" />
              <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                <div>
                  <span className="text-xs text-white">Join / Leave sounds</span>
                  <span className="block text-[10px] text-gray-500">Chime when participants join or leave</span>
                </div>
                <Toggle
                  checked={audioSettings.joinLeaveSounds}
                  onChange={(v) => setAudioSettings({ joinLeaveSounds: v })}
                />
              </label>
            </div>
          </>
        )}

        {/* ── SCREEN ────────────────────────────────────────── */}
        {activeTab === 'screen' && (
          <>
            <div>
              <SectionHeader emoji="📐" label="Resolution" />
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

            <div>
              <SectionHeader emoji="🎞" label="Frame Rate" />
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

            <div>
              <SectionHeader emoji="🗜" label="Codec" />
              <div className="space-y-1.5">
                {CODECS.map(({ value, label, desc }) => (
                  <label key={value} className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio" name="screen-codec" value={value}
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

            <div>
              <SectionHeader emoji="🎯" label="Content Type" />
              <div className="space-y-1.5">
                {CONTENT_HINTS.map(({ value, label, desc }) => (
                  <label key={value} className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio" name="content-hint" value={value}
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

            <div>
              <SectionHeader emoji="📡" label="Max Bitrate" />
              <div className="flex items-center gap-3">
                <input
                  type="range" min="1000000" max="20000000" step="500000"
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

            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none py-2 flex items-center gap-2">
                <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Custom Resolution
              </summary>
              <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-[#2a2a2a]">
                {(
                  [
                    { label: 'Width',  key: 'width'     as const, def: 1920, min: 160, max: 3840 },
                    { label: 'Height', key: 'height'    as const, def: 1080, min: 90,  max: 2160 },
                    { label: 'FPS',    key: 'frameRate' as const, def: 60,   min: 1,   max: 60   },
                  ] as const
                ).map(({ label, key, def, min, max }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-400 mb-1">{label}</label>
                    <input
                      type="number" min={min} max={max}
                      value={key === 'frameRate' ? screenSettings.frameRate : screenSettings.resolution[key as 'width' | 'height']}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || def;
                        if (key === 'frameRate') setScreenSettings({ frameRate: v });
                        else setScreenSettings({ resolution: { ...screenSettings.resolution, [key]: v } });
                      }}
                      className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
                    />
                  </div>
                ))}
              </div>
            </details>
          </>
        )}

        {/* ── CAMERA ────────────────────────────────────────── */}
        {activeTab === 'camera' && (
          <>
            <div className="bg-[#222] rounded-lg px-3 py-2 border border-[#2a2a2a] text-[10px] text-gray-500">
              Changes take effect on the next room join.
            </div>

            <div>
              <SectionHeader emoji="📐" label="Resolution" />
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

            <div>
              <SectionHeader emoji="🎞" label="Frame Rate" />
              <div className="flex items-center gap-3">
                <input
                  type="range" min="15" max="60" step="5"
                  value={camSettings.maxFramerate}
                  onChange={(e) => setCamSettings({ maxFramerate: parseInt(e.target.value) })}
                  className="flex-1 h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs text-white w-12 text-right shrink-0">{camSettings.maxFramerate} FPS</span>
              </div>
            </div>

            <div>
              <SectionHeader emoji="🗜" label="Codec" />
              <div className="space-y-1.5">
                {CODECS.map(({ value, label, desc }) => (
                  <label key={value} className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio" name="camera-codec" value={value}
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

            <div>
              <SectionHeader emoji="📡" label="Max Bitrate" />
              <div className="flex items-center gap-3">
                <input
                  type="range" min="500000" max="8000000" step="250000"
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
          </>
        )}

        {/* ── PEOPLE ────────────────────────────────────────── */}
        {activeTab === 'people' && (
          <>
            <p className="text-[10px] text-gray-500">
              Per-participant volume. Bot volume is in the Agent menu.
            </p>

            {humanParticipants.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-2xl mb-2">👥</div>
                <div className="text-sm text-gray-400 mb-1">No other participants</div>
                <div className="text-xs text-gray-600">People will appear here when they join</div>
              </div>
            ) : (
              <div className="space-y-2">
                {humanParticipants.map((participant) => {
                  const name = participant.name || participant.identity;
                  const volume = participantVolumes[participant.identity] ?? 1;
                  const isSpeaking = activeSpeakerIds.has(participant.identity);
                  const color = getAvatarColor(participant.identity);
                  const initials = getInitials(name);
                  const isAtDefault = Math.abs(volume - 1) < 0.01;

                  return (
                    <div
                      key={participant.identity}
                      className="bg-[#252525] rounded-lg p-3 border transition-colors"
                      style={{
                        borderColor: isSpeaking ? color + '66' : '#2a2a2a',
                      }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {/* Avatar */}
                        <div
                          className="relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white select-none"
                          style={{ background: color }}
                        >
                          {initials}
                          {/* Active speaker pulse ring */}
                          {isSpeaking && (
                            <span
                              className="absolute inset-0 rounded-full animate-ping"
                              style={{ background: color, opacity: 0.35 }}
                            />
                          )}
                        </div>

                        {/* Name + speaking indicator */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-white font-medium truncate">{name}</span>
                            {isSpeaking && (
                              <span className="text-[9px] text-green-400 font-medium shrink-0">● speaking</span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500">{participant.identity}</span>
                        </div>

                        {/* Volume % + reset */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round(volume * 100)}%</span>
                          {!isAtDefault && (
                            <button
                              type="button"
                              title="Reset to 100%"
                              onClick={() => resetVolume(participant.identity)}
                              className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded bg-[#333] hover:bg-[#3a3a3a] transition-colors"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Volume slider */}
                      <input
                        type="range" min="0" max="1" step="0.01"
                        value={volume}
                        onChange={(e) => setParticipantVolume(participant.identity, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer"
                        style={{ accentColor: color }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── STATS ─────────────────────────────────────────── */}
        {activeTab === 'stats' && (
          <>
            {/* Room info */}
            <div className="bg-[#222] rounded-lg p-3 border border-[#2a2a2a]">
              <SectionHeader emoji="🏠" label="Room" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-gray-500">Room</div>
                <div className="text-white font-mono truncate">{room.name || '—'}</div>
                <div className="text-gray-500">Participants</div>
                <div className="text-white">{room.numParticipants ?? '—'}</div>
                <div className="text-gray-500">Connection</div>
                <div className={`font-medium ${
                  room.state === ConnectionState.Connected     ? 'text-green-400' :
                  room.state === ConnectionState.Reconnecting  ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {room.state === ConnectionState.Connected    ? 'Connected' :
                   room.state === ConnectionState.Reconnecting ? 'Reconnecting' : 'Disconnected'}
                </div>
                <div className="text-gray-500">RTT (ping)</div>
                <div className={`font-medium ${
                  pingMs === null ? 'text-gray-600' :
                  pingMs < 100 ? 'text-green-400' : pingMs < 250 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {pingMs !== null ? `${pingMs} ms` : '—'}
                </div>
              </div>
            </div>

            {/* Ping graph */}
            <div className="bg-[#222] rounded-lg p-3 border border-[#2a2a2a]">
              <div className="flex items-center justify-between mb-2">
                <SectionHeader emoji="📈" label="RTT History" />
                {pingMs !== null && (
                  <span className={`text-xs font-mono font-semibold mb-3 ${
                    pingMs < 100 ? 'text-green-400' : pingMs < 250 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {pingMs} ms
                  </span>
                )}
              </div>
              <PingChart history={pingHistory} />
            </div>

            {/* Video stats */}
            {senderStats.length > 0 && (
              <div>
                <SectionHeader emoji="📤" label="Outgoing Stream" />
                {senderStats.map((stat, idx) => {
                  const bitrate = computeBitrate(stat, prevSenderRef.current[idx]);
                  return (
                    <div key={idx} className="bg-[#252525] rounded-lg p-3 mb-2 border border-[#2a2a2a]">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">Resolution: </span><span className="text-white">{stat.frameWidth}×{stat.frameHeight}</span></div>
                        <div><span className="text-gray-500">FPS: </span><span className="text-white">{stat.framesPerSecond?.toFixed(1)}</span></div>
                        <div><span className="text-gray-500">Bitrate: </span><span className="text-white">{(bitrate / 1000).toFixed(0)} kbps</span></div>
                        <div><span className="text-gray-500">Target: </span><span className="text-white">{(stat.targetBitrate / 1000).toFixed(0)} kbps</span></div>
                        {stat.packetsLost !== undefined && (
                          <div><span className="text-gray-500">Lost: </span><span className="text-red-400">{stat.packetsLost}</span></div>
                        )}
                        {stat.roundTripTime !== undefined && (
                          <div><span className="text-gray-500">RTT: </span><span className="text-white">{stat.roundTripTime.toFixed(0)} ms</span></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {receiverStats.length > 0 && (
              <div>
                <SectionHeader emoji="📥" label="Incoming Stream" />
                {receiverStats.map((stat, idx) => {
                  const bitrate = computeBitrate(stat, prevReceiverRef.current[idx]);
                  const prev = prevReceiverRef.current[idx];
                  const fps = prev && stat.timestamp && prev.timestamp
                    ? ((stat.framesDecoded - prev.framesDecoded) * 1000) / (stat.timestamp - prev.timestamp)
                    : 0;
                  return (
                    <div key={idx} className="bg-[#252525] rounded-lg p-3 mb-2 border border-[#2a2a2a]">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {stat.frameWidth && stat.frameHeight && (
                          <div><span className="text-gray-500">Resolution: </span><span className="text-white">{stat.frameWidth}×{stat.frameHeight}</span></div>
                        )}
                        <div><span className="text-gray-500">FPS: </span><span className="text-white">{fps.toFixed(1)}</span></div>
                        <div><span className="text-gray-500">Bitrate: </span><span className="text-white">{(bitrate / 1000).toFixed(0)} kbps</span></div>
                        <div><span className="text-gray-500">Decoded: </span><span className="text-white">{stat.framesDecoded}</span></div>
                        {stat.framesDropped !== undefined && (
                          <div><span className="text-gray-500">Dropped: </span><span className="text-red-400">{stat.framesDropped}</span></div>
                        )}
                        {stat.jitter !== undefined && (
                          <div><span className="text-gray-500">Jitter: </span><span className="text-white">{stat.jitter.toFixed(2)} ms</span></div>
                        )}
                        {stat.mimeType && (
                          <div className="col-span-2"><span className="text-gray-500">Codec: </span><span className="text-white">{stat.mimeType}</span></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {senderStats.length === 0 && receiverStats.length === 0 && (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">📊</div>
                <div className="text-sm text-gray-400 mb-1">No active screen share streams</div>
                <div className="text-xs text-gray-600">Start screen share to see stream statistics</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

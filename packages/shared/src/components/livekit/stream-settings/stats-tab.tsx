import { ConnectionState } from 'livekit-client';
import type { Room, VideoSenderStats, VideoReceiverStats } from 'livekit-client';
import type { MutableRefObject } from 'react';
import { computeBitrate } from '../../../lib/stream-stats';
import { SectionHeader, PingChart } from './ui';

interface StatsTabProps {
  room: Room;
  pingMs: number | null;
  pingHistory: (number | null)[];
  senderStats: VideoSenderStats[];
  receiverStats: VideoReceiverStats[];
  prevSenderRef: MutableRefObject<VideoSenderStats[]>;
  prevReceiverRef: MutableRefObject<VideoReceiverStats[]>;
}

function pingColor(ms: number | null) {
  if (ms === null) return 'text-gray-600';
  if (ms < 100) return 'text-green-400';
  if (ms < 250) return 'text-yellow-400';
  return 'text-red-400';
}

export function StatsTab({
  room,
  pingMs,
  pingHistory,
  senderStats,
  receiverStats,
  prevSenderRef,
  prevReceiverRef,
}: StatsTabProps) {
  const connLabel =
    room.state === ConnectionState.Connected
      ? 'Connected'
      : room.state === ConnectionState.Reconnecting
        ? 'Reconnecting'
        : 'Disconnected';
  const connClass =
    room.state === ConnectionState.Connected
      ? 'text-green-400'
      : room.state === ConnectionState.Reconnecting
        ? 'text-yellow-400'
        : 'text-red-400';

  const headcount =
    room.numParticipants != null ? `${room.numParticipants} in room` : null;

  return (
    <>
      <div className="rounded-lg border border-[var(--mutty-border-2)] bg-[var(--mutty-surface-1)] p-3 [&_h3]:mb-0">
        <SectionHeader emoji="📈" label="Network" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--mutty-border-2)] pb-2">
          <p className="min-w-0 text-xs leading-snug text-[var(--mutty-fg-3)]">
            <span className={`font-medium ${connClass}`}>{connLabel}</span>
            {headcount && (
              <>
                <span className="text-gray-600"> · </span>
                <span className="text-[var(--mutty-fg-3)]">{headcount}</span>
              </>
            )}
          </p>
          {pingMs !== null && (
            <span className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${pingColor(pingMs)}`}>
              {pingMs} ms
            </span>
          )}
        </div>
        <div className="mt-2">
          <PingChart history={pingHistory} />
        </div>
      </div>

      {senderStats.length > 0 && (
        <div>
          <SectionHeader emoji="📤" label="Outgoing Stream" />
          {senderStats.map((stat, idx) => {
            const bitrate = computeBitrate(stat, prevSenderRef.current[idx]);
            return (
              <div key={idx} className="bg-[var(--mutty-surface-1)] rounded-lg p-3 mb-2 border border-[var(--mutty-border-2)]">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[var(--mutty-fg-3)]">Resolution: </span><span className="text-[var(--mutty-fg-1)]">{stat.frameWidth}×{stat.frameHeight}</span></div>
                  <div><span className="text-[var(--mutty-fg-3)]">FPS: </span><span className="text-[var(--mutty-fg-1)]">{stat.framesPerSecond?.toFixed(1)}</span></div>
                  <div><span className="text-[var(--mutty-fg-3)]">Bitrate: </span><span className="text-[var(--mutty-fg-1)]">{(bitrate / 1000).toFixed(0)} kbps</span></div>
                  <div>
                    <span className="text-[var(--mutty-fg-3)]">Target: </span>
                    <span className="text-[var(--mutty-fg-1)]">
                      {stat.targetBitrate != null &&
                      !Number.isNaN(stat.targetBitrate) &&
                      stat.targetBitrate > 0
                        ? `${(stat.targetBitrate / 1000).toFixed(0)} kbps`
                        : '—'}
                    </span>
                  </div>
                  {stat.packetsLost !== undefined && (
                    <div><span className="text-[var(--mutty-fg-3)]">Lost: </span><span className="text-red-400">{stat.packetsLost}</span></div>
                  )}
                  {stat.roundTripTime !== undefined && (
                    <div><span className="text-[var(--mutty-fg-3)]">RTT: </span><span className="text-[var(--mutty-fg-1)]">{stat.roundTripTime.toFixed(0)} ms</span></div>
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
            const fps =
              prev && stat.timestamp && prev.timestamp
                ? ((stat.framesDecoded - prev.framesDecoded) * 1000) / (stat.timestamp - prev.timestamp)
                : 0;
            return (
              <div key={idx} className="bg-[var(--mutty-surface-1)] rounded-lg p-3 mb-2 border border-[var(--mutty-border-2)]">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {stat.frameWidth && stat.frameHeight && (
                    <div><span className="text-[var(--mutty-fg-3)]">Resolution: </span><span className="text-[var(--mutty-fg-1)]">{stat.frameWidth}×{stat.frameHeight}</span></div>
                  )}
                  <div><span className="text-[var(--mutty-fg-3)]">FPS: </span><span className="text-[var(--mutty-fg-1)]">{fps.toFixed(1)}</span></div>
                  <div><span className="text-[var(--mutty-fg-3)]">Bitrate: </span><span className="text-[var(--mutty-fg-1)]">{(bitrate / 1000).toFixed(0)} kbps</span></div>
                  <div><span className="text-[var(--mutty-fg-3)]">Decoded: </span><span className="text-[var(--mutty-fg-1)]">{stat.framesDecoded}</span></div>
                  {stat.framesDropped !== undefined && (
                    <div><span className="text-[var(--mutty-fg-3)]">Dropped: </span><span className="text-red-400">{stat.framesDropped}</span></div>
                  )}
                  {stat.jitter !== undefined && (
                    <div><span className="text-[var(--mutty-fg-3)]">Jitter: </span><span className="text-[var(--mutty-fg-1)]">{stat.jitter.toFixed(2)} ms</span></div>
                  )}
                  {stat.mimeType && (
                    <div className="col-span-2"><span className="text-[var(--mutty-fg-3)]">Codec: </span><span className="text-[var(--mutty-fg-1)]">{stat.mimeType}</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {senderStats.length === 0 && receiverStats.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--mutty-border-2)] bg-[var(--mutty-surface-1)]/60 px-3 py-4 text-center">
          <div className="mb-1 text-lg opacity-80" aria-hidden>
            📊
          </div>
          <div className="text-xs text-[var(--mutty-fg-3)]">No screen-share stats yet</div>
          <div className="mt-0.5 text-[10px] text-gray-600">Share your screen to see bitrate and codec</div>
        </div>
      )}
    </>
  );
}

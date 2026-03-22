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
  return (
    <>
      <div className="bg-[#222] rounded-lg p-3 border border-[#2a2a2a]">
        <SectionHeader emoji="🏠" label="Room" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-gray-500">Room</div>
          <div className="text-white font-mono truncate">{room.name || '—'}</div>
          <div className="text-gray-500">Participants</div>
          <div className="text-white">{room.numParticipants ?? '—'}</div>
          <div className="text-gray-500">Connection</div>
          <div className={`font-medium ${
            room.state === ConnectionState.Connected    ? 'text-green-400' :
            room.state === ConnectionState.Reconnecting ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {room.state === ConnectionState.Connected    ? 'Connected' :
             room.state === ConnectionState.Reconnecting ? 'Reconnecting' : 'Disconnected'}
          </div>
          <div className="text-gray-500">RTT (ping)</div>
          <div className={`font-medium ${pingColor(pingMs)}`}>
            {pingMs !== null ? `${pingMs} ms` : '—'}
          </div>
        </div>
      </div>

      <div className="bg-[#222] rounded-lg p-4 border border-[#2a2a2a]">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
            <span aria-hidden>📈</span> RTT History
          </h3>
          {pingMs !== null && (
            <span className={`text-base font-mono font-semibold tabular-nums shrink-0 ${pingColor(pingMs)}`}>
              {pingMs} ms
            </span>
          )}
        </div>
        <PingChart history={pingHistory} />
      </div>

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
            const fps =
              prev && stat.timestamp && prev.timestamp
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
  );
}

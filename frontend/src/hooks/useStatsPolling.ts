import { Track } from 'livekit-client';
import type {
  Room,
  VideoSenderStats,
  VideoReceiverStats,
  LocalVideoTrack,
  RemoteVideoTrack,
} from 'livekit-client';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { PING_HISTORY_SIZE } from '../components/livekit/stream-settings/constants';

export function useStatsPolling(
  room: Room | null,
  isActive: boolean,
): {
  senderStats: VideoSenderStats[];
  receiverStats: VideoReceiverStats[];
  pingMs: number | null;
  pingHistory: (number | null)[];
  prevSenderRef: MutableRefObject<VideoSenderStats[]>;
  prevReceiverRef: MutableRefObject<VideoReceiverStats[]>;
} {
  const [senderStats, setSenderStats] = useState<VideoSenderStats[]>([]);
  const [receiverStats, setReceiverStats] = useState<VideoReceiverStats[]>([]);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [pingHistory, setPingHistory] = useState<(number | null)[]>([]);
  const prevSenderRef = useRef<VideoSenderStats[]>([]);
  const prevReceiverRef = useRef<VideoReceiverStats[]>([]);
  const pingHistoryRef = useRef<(number | null)[]>([]);

  useEffect(() => {
    if (!isActive || !room) return;

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
              } catch {
                /* ignore */
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
                } catch {
                  /* ignore */
                }
              }
            }
          }
        }

        setSenderStats((prev) => {
          prevSenderRef.current = prev;
          return allSender;
        });
        setReceiverStats((prev) => {
          prevReceiverRef.current = prev;
          return allReceiver;
        });

        let newPing: number | null = null;
        try {
          const clientRtt = room.engine.client.rtt;
          if (typeof clientRtt === 'number' && clientRtt > 0) {
            newPing = Math.round(clientRtt);
          }
        } catch {
          /* ignore */
        }

        if (newPing === null) {
          try {
            const eng = room.engine as unknown as {
              pcManager?: {
                publisher?: { pc?: RTCPeerConnection };
                subscriber?: { pc?: RTCPeerConnection };
              };
            };
            const pc = eng.pcManager?.publisher?.pc ?? eng.pcManager?.subscriber?.pc;
            if (pc) {
              const stats = await pc.getStats();
              stats.forEach((s: RTCStats) => {
                if (s.type === 'candidate-pair') {
                  const pair = s as RTCIceCandidatePairStats;
                  if (
                    pair.nominated &&
                    pair.state === 'succeeded' &&
                    pair.currentRoundTripTime !== undefined
                  ) {
                    const rtt = pair.currentRoundTripTime;
                    newPing = rtt > 1 ? Math.round(rtt) : Math.round(rtt * 1000);
                  }
                }
              });
            }
          } catch {
            /* ignore */
          }
        }
        setPingMs(newPing);
        const next = [...pingHistoryRef.current, newPing].slice(-PING_HISTORY_SIZE);
        pingHistoryRef.current = next;
        setPingHistory(next);
      } catch {
        /* ignore */
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, room]);

  return {
    senderStats,
    receiverStats,
    pingMs,
    pingHistory,
    prevSenderRef,
    prevReceiverRef,
  };
}

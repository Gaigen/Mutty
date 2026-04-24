import type { RemoteParticipant, Room } from 'livekit-client';
import { Track } from 'livekit-client';
import { getParticipantVolume } from '../../../context/ParticipantVolumesContext';
import { getAvatarColor, getInitials } from '../../../lib/avatar-utils';
import { useActiveSpeakers } from '../../../hooks/useActiveSpeakers';

interface PeopleTabProps {
  room: Room;
  humanParticipants: RemoteParticipant[];
  participantVolumes: Record<string, number>;
  setParticipantVolume: (identity: string, volume: number, source?: Track.Source) => void;
}

export function PeopleTab({
  room,
  humanParticipants,
  participantVolumes,
  setParticipantVolume,
}: PeopleTabProps) {
  const activeSpeakerIds = useActiveSpeakers(room);
  if (humanParticipants.length === 0) {
    return (
      <>
        <p className="text-[10px] text-[var(--mutty-fg-3)]">
          Per-participant volume. Bot volume is in the Agent menu.
        </p>
        <div className="text-center py-10">
          <div className="text-2xl mb-2">👥</div>
          <div className="text-sm text-[var(--mutty-fg-3)] mb-1">No other participants</div>
          <div className="text-xs text-[var(--mutty-fg-3)]">People will appear here when they join</div>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-[10px] text-[var(--mutty-fg-3)]">
        Per-participant volume. Bot volume is in the Agent menu.
      </p>
      <div className="space-y-2">
        {humanParticipants.map((participant) => {
          const name = participant.name || participant.identity;
          const voiceVolume = getParticipantVolume(
            participantVolumes,
            participant.identity,
            Track.Source.Microphone,
          );
          const screenVolume = getParticipantVolume(
            participantVolumes,
            participant.identity,
            Track.Source.ScreenShareAudio,
          );
          const isSpeaking = activeSpeakerIds.has(participant.identity);
          const color = getAvatarColor(participant.identity);
          const initials = getInitials(name);
          const voiceAtDefault = Math.abs(voiceVolume - 1) < 0.01;
          const screenAtDefault = Math.abs(screenVolume - 1) < 0.01;

          return (
            <div
              key={participant.identity}
              className="bg-[var(--mutty-surface-1)] rounded-lg p-3 border transition-colors"
              style={{ borderColor: isSpeaking ? color + '66' : 'var(--mutty-border-2)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-[var(--mutty-fg-1)] select-none"
                  style={{ background: color }}
                >
                  {initials}
                  {isSpeaking && (
                    <span
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ background: color, opacity: 0.35 }}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--mutty-fg-1)] font-medium truncate">{name}</span>
                    {isSpeaking && (
                      <span className="text-[9px] text-green-400 font-medium shrink-0">● speaking</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--mutty-fg-3)]">{participant.identity}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--mutty-fg-3)] w-20 shrink-0">Voice</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(voiceVolume * 100)}
                    onChange={(e) =>
                      setParticipantVolume(participant.identity, Number(e.target.value) / 100, Track.Source.Microphone)
                    }
                    className="flex-1 h-2 bg-[var(--mutty-surface-1)] rounded-lg appearance-none cursor-pointer"
                    style={{ '--thumb-color': color } as React.CSSProperties}
                  />
                  <span className="text-[10px] text-[var(--mutty-fg-3)] w-8 text-right">{Math.round(voiceVolume * 100)}%</span>
                    <button
                      type="button"
                      title="Reset to 100%"
                      onClick={() => setParticipantVolume(participant.identity, 1, Track.Source.Microphone)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${voiceAtDefault ? 'invisible' : 'text-[var(--mutty-fg-3)] hover:text-[var(--mutty-fg-1)] bg-[var(--mutty-surface-3)] hover:bg-[var(--mutty-surface-3)]'}`}
                    >
                      ↺
                    </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--mutty-fg-3)] w-20 shrink-0">Screen</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(screenVolume * 100)}
                    onChange={(e) =>
                      setParticipantVolume(
                        participant.identity,
                        Number(e.target.value) / 100,
                        Track.Source.ScreenShareAudio,
                      )
                    }
                    className="flex-1 h-2 bg-[var(--mutty-surface-1)] rounded-lg appearance-none cursor-pointer"
                    style={{ '--thumb-color': color } as React.CSSProperties}
                  />
                  <span className="text-[10px] text-[var(--mutty-fg-3)] w-8 text-right">{Math.round(screenVolume * 100)}%</span>
                    <button
                      type="button"
                      title="Reset to 100%"
                      onClick={() => setParticipantVolume(participant.identity, 1, Track.Source.ScreenShareAudio)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${screenAtDefault ? 'invisible' : 'text-[var(--mutty-fg-3)] hover:text-[var(--mutty-fg-1)] bg-[var(--mutty-surface-3)] hover:bg-[var(--mutty-surface-3)]'}`}
                    >
                      ↺
                    </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

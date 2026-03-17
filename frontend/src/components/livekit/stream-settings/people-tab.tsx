import type { RemoteParticipant } from 'livekit-client';
import { getAvatarColor, getInitials } from '../../../lib/avatar-utils';

interface PeopleTabProps {
  humanParticipants: RemoteParticipant[];
  participantVolumes: Record<string, number>;
  activeSpeakerIds: Set<string>;
  setParticipantVolume: (identity: string, volume: number) => void;
}

export function PeopleTab({
  humanParticipants,
  participantVolumes,
  activeSpeakerIds,
  setParticipantVolume,
}: PeopleTabProps) {
  if (humanParticipants.length === 0) {
    return (
      <>
        <p className="text-[10px] text-gray-500">
          Per-participant volume. Bot volume is in the Agent menu.
        </p>
        <div className="text-center py-10">
          <div className="text-2xl mb-2">👥</div>
          <div className="text-sm text-gray-400 mb-1">No other participants</div>
          <div className="text-xs text-gray-600">People will appear here when they join</div>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-[10px] text-gray-500">
        Per-participant volume. Bot volume is in the Agent menu.
      </p>
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
              style={{ borderColor: isSpeaking ? color + '66' : '#2a2a2a' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white select-none"
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
                    <span className="text-xs text-white font-medium truncate">{name}</span>
                    {isSpeaking && (
                      <span className="text-[9px] text-green-400 font-medium shrink-0">● speaking</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">{participant.identity}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round(volume * 100)}%</span>
                  {!isAtDefault && (
                    <button
                      type="button"
                      title="Reset to 100%"
                      onClick={() => setParticipantVolume(participant.identity, 1)}
                      className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded bg-[#333] hover:bg-[#3a3a3a] transition-colors"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>

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
    </>
  );
}

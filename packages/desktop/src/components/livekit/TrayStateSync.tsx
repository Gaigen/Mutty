import { useEffect, useRef } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { useAudioMute } from '@shared/context/AudioMuteContext';

export function TrayStateSync() {
  const { isAudioMuted, toggleAudioMuted } = useAudioMute();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const prevState = useRef<{ muted: boolean; micEnabled: boolean } | null>(null);

  // Listen for tray mute toggle (uses global function set in main.tsx for hidden window support)
  useEffect(() => {
    const cleanup = (window as any).__registerTrayMute?.(() => {
      toggleAudioMuted();
    });
    return () => { cleanup?.(); };
  }, []);

  // Send tray state on mute/room changes
  useEffect(() => {
    const micEnabled = localParticipant.isMicrophoneEnabled ?? true;
    const muted = isAudioMuted || !micEnabled;

    if (prevState.current !== null && prevState.current.muted === muted && prevState.current.micEnabled === micEnabled) return;
    prevState.current = { muted, micEnabled };

    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_tray_state', {
          state: {
            in_room: true,
            room_name: room.name || undefined,
            is_muted: muted,
          },
        });
      } catch {
        // Not in Tauri
      }
    })();
  }, [isAudioMuted, localParticipant.isMicrophoneEnabled, room.name]);

  return null;
}

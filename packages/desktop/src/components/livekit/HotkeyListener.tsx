import { useEffect } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { useAudioMute } from '@shared/context/AudioMuteContext';
import { useHotkeySettings } from '../../hooks/useHotkeySettings';
import { playMicMuteSound, playMicUnmuteSound } from '@shared/utils/sounds';

function matchesHotkey(e: KeyboardEvent, raw: string): boolean {
  if (!raw) return false;
  const parts = raw.split('+');
  const mainCode = parts[parts.length - 1];
  const mods = parts.slice(0, -1);

  if (e.code !== mainCode) return false;

  const hasCtrl = mods.includes('Ctrl');
  const hasAlt = mods.includes('Alt');
  const hasShift = mods.includes('Shift');
  const hasMeta = mods.includes('Meta');

  if (hasCtrl && !e.ctrlKey) return false;
  if (hasAlt && !e.altKey) return false;
  if (hasShift && !e.shiftKey) return false;
  if (hasMeta && !e.metaKey) return false;

  if (!hasCtrl && e.ctrlKey) return false;
  if (!hasAlt && e.altKey) return false;
  if (!hasShift && e.shiftKey) return false;
  if (!hasMeta && e.metaKey) return false;

  return true;
}

/**
 * Listens for global hotkeys via Tauri events (works even when app is not focused)
 * with a fallback to browser keydown events for dev mode.
 */
export function HotkeyListener() {
  const { localParticipant } = useLocalParticipant();
  const { toggleAudioMuted } = useAudioMute();
  const { settings } = useHotkeySettings();

  useEffect(() => {
    let unlistenMic: (() => void) | undefined;
    let unlistenFullMute: (() => void) | undefined;
    let cleanup = false;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenMic = await listen('global-hotkey-mic', () => {
          if (cleanup) return;
          const wasEnabled = localParticipant.isMicrophoneEnabled;
          localParticipant.setMicrophoneEnabled(!wasEnabled);
          if (wasEnabled) playMicMuteSound();
          else playMicUnmuteSound();
        });
        unlistenFullMute = await listen('global-hotkey-full-mute', () => {
          if (cleanup) return;
          toggleAudioMuted();
        });
        console.log('[HotkeyListener] Tauri event listeners registered');
      } catch {
        // Tauri not available — fallback to browser keydown
        const handler = (e: KeyboardEvent) => {
          if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLSelectElement
          ) return;

          if (matchesHotkey(e, settings.toggleMicrophone)) {
            const wasEnabled = localParticipant.isMicrophoneEnabled;
            localParticipant.setMicrophoneEnabled(!wasEnabled);
            if (wasEnabled) playMicMuteSound();
            else playMicUnmuteSound();
          } else if (matchesHotkey(e, settings.toggleFullMute)) {
            toggleAudioMuted();
          }
        };
        window.addEventListener('keydown', handler);
        unlistenMic = () => window.removeEventListener('keydown', handler);
      }
    })();

    return () => {
      cleanup = true;
      unlistenMic?.();
      unlistenFullMute?.();
    };
  }, [localParticipant, toggleAudioMuted, settings]);

  return null;
}

import { useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { useAudioMute } from '@shared/context/AudioMuteContext';
import { useHotkeySettings } from '../../hooks/useHotkeySettings';
import { playMicMuteSound, playMicUnmuteSound } from '@shared/utils/sounds';

function matchesHotkey(e: KeyboardEvent, raw: string): boolean {
  if (!raw) return false;
  const parts = raw.split('+');
  const mainCode = parts[parts.length - 1];
  const mods = parts.slice(0, -1);

  // Mouse hotkeys handled by Rust poller
  if (mainCode.startsWith('Mouse')) return false;

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
 * Listens for hotkeys via Tauri events (Rust poller — keyboard + mouse, global)
 * with browser fallback for keyboard-only in dev mode.
 */
export function HotkeyListener() {
  const { localParticipant } = useLocalParticipant();
  const { toggleAudioMuted } = useAudioMute();
  const { settings } = useHotkeySettings();

  // Refs for stable handlers
  const localParticipantRef = useRef(localParticipant);
  const toggleAudioMutedRef = useRef(toggleAudioMuted);
  localParticipantRef.current = localParticipant;
  toggleAudioMutedRef.current = toggleAudioMuted;

  // Effect 1: Tauri events (Rust poller handles keyboard + mouse globally)
  useEffect(() => {
    let unlistenMic: (() => void) | undefined;
    let unlistenFullMute: (() => void) | undefined;
    let cleanup = false;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenMic = await listen('global-hotkey-mic', () => {
          if (cleanup) return;
          const lp = localParticipantRef.current;
          const wasEnabled = lp.isMicrophoneEnabled;
          lp.setMicrophoneEnabled(!wasEnabled);
          if (wasEnabled) playMicMuteSound();
          else playMicUnmuteSound();
        });
        unlistenFullMute = await listen('global-hotkey-full-mute', () => {
          if (cleanup) return;
          toggleAudioMutedRef.current();
        });
        console.log('[HotkeyListener] Tauri global hotkeys active');
      } catch {
        // Tauri not available — browser fallback for keyboard
        console.log('[HotkeyListener] Browser fallback mode');
      }
    })();

    return () => {
      cleanup = true;
      unlistenMic?.();
      unlistenFullMute?.();
    };
  }, []);

  // Effect 2: Browser fallback keyboard (only if Tauri not available)
  useEffect(() => {
    let tauriAvailable = false;
    import('@tauri-apps/api/event').then(() => { tauriAvailable = true; }).catch(() => {});

    const timer = setTimeout(() => {
      if (tauriAvailable) return; // Rust handles everything

      const handleKey = (e: KeyboardEvent) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) return;

        if (matchesHotkey(e, settings.toggleMicrophone)) {
          const lp = localParticipantRef.current;
          const wasEnabled = lp.isMicrophoneEnabled;
          lp.setMicrophoneEnabled(!wasEnabled);
          if (wasEnabled) playMicMuteSound();
          else playMicUnmuteSound();
        } else if (matchesHotkey(e, settings.toggleFullMute)) {
          toggleAudioMutedRef.current();
        }
      };

      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }, 100);

    return () => clearTimeout(timer);
  }, [settings]);

  return null;
}

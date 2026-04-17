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

  // Mouse hotkeys handled by matchesMouseHotkey
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

function matchesMouseHotkey(e: MouseEvent, raw: string): boolean {
  if (!raw) return false;
  const parts = raw.split('+');
  const mainCode = parts[parts.length - 1];
  const mods = parts.slice(0, -1);

  if (!mainCode.startsWith('Mouse')) return false;

  // Map mouse button number to name
  const buttonName = e.button === 3 ? 'MouseBack'
    : e.button === 4 ? 'MouseForward'
    : `Mouse${e.button}`;

  if (buttonName !== mainCode) return false;

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
 * Listens for global hotkeys via Tauri events (keyboard, works when unfocused)
 * plus browser mousedown events (mouse buttons, works when focused).
 */
export function HotkeyListener() {
  const { localParticipant } = useLocalParticipant();
  const { toggleAudioMuted } = useAudioMute();
  const { settings } = useHotkeySettings();

  // Keep refs to latest values for stable event handlers
  const localParticipantRef = useRef(localParticipant);
  const toggleAudioMutedRef = useRef(toggleAudioMuted);
  const settingsRef = useRef(settings);
  localParticipantRef.current = localParticipant;
  toggleAudioMutedRef.current = toggleAudioMuted;
  settingsRef.current = settings;

  // Effect 1: Tauri global keyboard hotkeys (works when app not focused)
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
        console.log('[HotkeyListener] Tauri global hotkeys registered');
      } catch {
        // Tauri not available — browser fallback keyboard
        console.log('[HotkeyListener] Browser fallback mode');
      }
    })();

    return () => {
      cleanup = true;
      unlistenMic?.();
      unlistenFullMute?.();
    };
  }, []);

  // Effect 2: Mouse button hotkeys (always, via browser mousedown)
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (e.button < 3) return; // ignore left/right/middle
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;

      const s = settingsRef.current;
      if (matchesMouseHotkey(e, s.toggleMicrophone)) {
        const lp = localParticipantRef.current;
        const wasEnabled = lp.isMicrophoneEnabled;
        lp.setMicrophoneEnabled(!wasEnabled);
        if (wasEnabled) playMicMuteSound();
        else playMicUnmuteSound();
      } else if (matchesMouseHotkey(e, s.toggleFullMute)) {
        toggleAudioMutedRef.current();
      }
    };

    window.addEventListener('mousedown', handleMouse);
    return () => window.removeEventListener('mousedown', handleMouse);
  }, []);

  // Effect 3: Browser fallback keyboard hotkeys (when Tauri not available)
  useEffect(() => {
    // Check if Tauri is available
    let tauriAvailable = false;
    import('@tauri-apps/api/event').then(() => { tauriAvailable = true; }).catch(() => {});

    // Small delay to let Tauri check complete
    const timer = setTimeout(() => {
      if (tauriAvailable) return; // Tauri handles keyboard

      const handleKey = (e: KeyboardEvent) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) return;

        const s = settingsRef.current;
        if (matchesHotkey(e, s.toggleMicrophone)) {
          const lp = localParticipantRef.current;
          const wasEnabled = lp.isMicrophoneEnabled;
          lp.setMicrophoneEnabled(!wasEnabled);
          if (wasEnabled) playMicMuteSound();
          else playMicUnmuteSound();
        } else if (matchesHotkey(e, s.toggleFullMute)) {
          toggleAudioMutedRef.current();
        }
      };

      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return null;
}

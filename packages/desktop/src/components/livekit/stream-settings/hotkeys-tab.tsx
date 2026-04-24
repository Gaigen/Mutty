import { useState, useCallback, useEffect } from 'react';
import type { HotkeySettings } from '../../../hooks/useHotkeySettings';

interface HotkeysTabProps {
  settings: HotkeySettings;
  setSettings: (s: Partial<HotkeySettings>) => void;
}

const HOTKEY_ACTIONS: { key: keyof HotkeySettings; label: string; description: string }[] = [
  { key: 'toggleMicrophone', label: 'Toggle Microphone', description: 'Mute/unmute your mic' },
  { key: 'toggleFullMute', label: 'Toggle Full Mute', description: 'Mute/unmute all incoming audio' },
  { key: 'toggleWhiteboard', label: 'Toggle Whiteboard', description: 'Open/close collaborative whiteboard' },
  { key: 'toggleNotes', label: 'Toggle Notes', description: 'Open/close shared notepad' },
];

const MODIFIER_KEYS = new Set(['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight']);

function displayKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return code.slice(6);
  const map: Record<string, string> = {
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Backslash: '\\\\', Semicolon: ';', Quote: "'", Comma: ',',
    Period: '.', Slash: '/', Backquote: '`', Space: 'Space',
    Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace',
    Delete: 'Del', Insert: 'Ins', Escape: 'Esc',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
    MouseBack: '🖱 Back', MouseForward: '🖱 Forward',
    Mouse4: '🖱 Btn4', Mouse5: '🖱 Btn5', Mouse6: '🖱 Btn6',
    Mouse7: '🖱 Btn7', Mouse8: '🖱 Btn8',
  };
  return map[code] || code;
}

function formatHotkey(raw: string): string {
  if (!raw) return 'None';
  const parts = raw.split('+');
  const mainKey = displayKey(parts[parts.length - 1] || '');
  const mods = parts.slice(0, -1).map(m => {
    if (m === 'Ctrl') return 'Ctrl';
    if (m === 'Alt') return 'Alt';
    if (m === 'Shift') return 'Shift';
    if (m === 'Meta') return 'Win';
    return m;
  });
  return [...mods, mainKey].join(' + ');
}

function HotkeyRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const [recording, setRecording] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        setRecording(false);
        return;
      }

      if (MODIFIER_KEYS.has(e.code)) return;

      const modifiers: string[] = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.metaKey) modifiers.push('Meta');

      const hotkey = modifiers.length > 0
        ? modifiers.join('+') + '+' + e.code
        : e.code;

      onChange(hotkey);
      setRecording(false);
    },
    [onChange],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // Only capture extra mouse buttons (button >= 3)
      if (e.button < 3) return;
      e.preventDefault();
      e.stopPropagation();

      // button 3=Back, 4=Forward, 5+=Mouse5, Mouse6, etc.
      const buttonName = e.button === 3 ? 'MouseBack'
        : e.button === 4 ? 'MouseForward'
        : `Mouse${e.button}`;

      const modifiers: string[] = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.metaKey) modifiers.push('Meta');

      const hotkey = modifiers.length > 0
        ? modifiers.join('+') + '+' + buttonName
        : buttonName;

      onChange(hotkey);
      setRecording(false);
    },
    [onChange],
  );

  useEffect(() => {
    if (recording) {
      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('mousedown', handleMouseDown, true);
      return () => {
        window.removeEventListener('keydown', handleKeyDown, true);
        window.removeEventListener('mousedown', handleMouseDown, true);
      };
    }
  }, [recording, handleKeyDown, handleMouseDown]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setRecording(!recording)}
        className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors min-w-[100px] text-center ${
          recording
            ? 'border-[var(--mutty-accent-1)] bg-[var(--mutty-accent-4)] text-[var(--mutty-accent-2)] animate-pulse'
            : 'border-[var(--mutty-border-3)] bg-[var(--mutty-surface-1)] text-[var(--mutty-fg-2)] hover:border-[var(--mutty-border-4)]'
        }`}
        title="Click to record, Escape to cancel"
      >
        {recording ? '...' : formatHotkey(value)}
      </button>
    </div>
  );
}

export function HotkeysTab({ settings, setSettings }: HotkeysTabProps) {
  const hasConflict = settings.toggleMicrophone === settings.toggleFullMute;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--mutty-fg-1)] mb-3">Global Hotkeys</h3>
      <p className="text-xs text-[var(--mutty-fg-3)] mb-4">
        Works even when the app is not in focus. Does not block input — keys still work in other apps.
        <br />
        <span className="text-[var(--mutty-fg-3)]">Click to record · Escape to cancel</span>
      </p>
      <div className="space-y-1">
        {HOTKEY_ACTIONS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--mutty-surface-1)] transition-colors"
          >
            <div className="flex flex-col">
              <span className="text-sm text-[var(--mutty-fg-2)]">{label}</span>
              <span className="text-xs text-[var(--mutty-fg-3)]">{description}</span>
            </div>
            <HotkeyRecorder
              value={settings[key]}
              onChange={(k) => setSettings({ [key]: k })}
            />
          </div>
        ))}
      </div>
      {hasConflict && (
        <p className="text-xs text-[var(--mutty-danger)] mt-2 px-3">
          Warning: Both hotkeys are the same.
        </p>
      )}
    </div>
  );
}

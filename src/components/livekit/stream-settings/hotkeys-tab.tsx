import { useState, useCallback, useEffect } from 'react';
import type { HotkeySettings } from '../../../hooks/useHotkeySettings';

interface HotkeysTabProps {
  settings: HotkeySettings;
  setSettings: (s: Partial<HotkeySettings>) => void;
}

const HOTKEY_ACTIONS: { key: keyof HotkeySettings; label: string; description: string }[] = [
  { key: 'toggleMicrophone', label: 'Toggle Microphone', description: 'Mute/unmute your mic' },
  { key: 'toggleFullMute', label: 'Toggle Full Mute', description: 'Mute/unmute all incoming audio' },
];

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
      const key = e.key.toUpperCase();
      const isFunctionKey = /^F(1[0-2]|[1-9])$/.test(key);
      if (/^[A-Z0-9]$/.test(key) || isFunctionKey) {
        onChange(key);
        setRecording(false);
      }
    },
    [onChange],
  );

  useEffect(() => {
    if (recording) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [recording, handleKeyDown]);

  return (
    <button
      type="button"
      onClick={() => setRecording(!recording)}
      className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors min-w-[60px] text-center ${
        recording
          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 animate-pulse'
          : 'border-[#3a3a3a] bg-[#222] text-gray-300 hover:border-[#555]'
      }`}
      title="Click to record, Escape to cancel"
    >
      {recording ? '...' : value || 'None'}
    </button>
  );
}

export function HotkeysTab({ settings, setSettings }: HotkeysTabProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-white mb-3">Global Hotkeys</h3>
      <p className="text-xs text-gray-400 mb-4">
        Works even when the app is not in focus. Does not block input — keys still work in other apps.
        <br />
        <span className="text-gray-500">Click to record · Escape to cancel</span>
      </p>
      <div className="space-y-1">
        {HOTKEY_ACTIONS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#222] transition-colors"
          >
            <div className="flex flex-col">
              <span className="text-sm text-gray-300">{label}</span>
              <span className="text-xs text-gray-500">{description}</span>
            </div>
            <HotkeyRecorder
              value={settings[key]}
              onChange={(k) => setSettings({ [key]: k })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

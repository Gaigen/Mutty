import type { AppSettings } from '../../../hooks/useAppSettings';

interface AppSettingsTabProps {
  settings: AppSettings;
  setSettings: (s: Partial<AppSettings>) => void;
}

export function AppSettingsTab({ settings, setSettings }: AppSettingsTabProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-white mb-3">App Settings</h3>
      <div className="space-y-1">
        <label className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#222] cursor-pointer transition-colors">
          <div className="flex flex-col text-gray-300">
            <span className="text-sm">Minimize to Tray</span>
            <span className="text-xs text-gray-500">Close button minimizes to system tray instead of quitting</span>
          </div>
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={(e) => setSettings({ minimizeToTray: e.target.checked })}
            className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
          />
        </label>
        <label className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#222] cursor-pointer transition-colors">
          <div className="flex flex-col text-gray-300">
            <span className="text-sm">Start with System</span>
            <span className="text-xs text-gray-500">Launch Mutty automatically when you log in</span>
          </div>
          <input
            type="checkbox"
            checked={settings.autostart}
            onChange={(e) => setSettings({ autostart: e.target.checked })}
            className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}

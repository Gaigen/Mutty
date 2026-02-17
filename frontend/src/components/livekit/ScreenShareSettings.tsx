import { useScreenShareSettings } from '../../hooks/useScreenShareSettings';

const PRESETS = {
  '720p@60': { resolution: { width: 1280, height: 720 }, frameRate: 60 },
  '720p@30': { resolution: { width: 1280, height: 720 }, frameRate: 30 },
  '1080p@60': { resolution: { width: 1920, height: 1080 }, frameRate: 60 },
  '1080p@30': { resolution: { width: 1920, height: 1080 }, frameRate: 30 },
} as const;

export default function ScreenShareSettings() {
  const { settings, setSettings } = useScreenShareSettings();

  // Находим текущий пресет по настройкам
  const currentPresetKey = Object.entries(PRESETS).find(
    ([_, preset]) =>
      preset.resolution.width === settings.resolution.width &&
      preset.resolution.height === settings.resolution.height &&
      preset.frameRate === settings.frameRate
  )?.[0] || '';

  return (
    <div className="fixed top-4 left-4 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm z-50 shadow-xl min-w-[280px]">
      <h3 className="font-bold mb-3 text-xs uppercase tracking-wide text-gray-400">Screen Share</h3>
      
      <div className="space-y-3">
        {/* Пресеты в виде кнопок */}
        <div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PRESETS).map(([key, preset]) => {
              const isActive = currentPresetKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setSettings(preset)}
                  className={`
                    px-3 py-2 rounded text-xs font-medium transition-all
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-lg scale-105' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <div className="font-semibold">{key.split('@')[0]}</div>
                  <div className="text-[10px] opacity-75">{preset.frameRate} FPS</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Детальные настройки - сворачиваемые */}
        <details className="group">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none">
            Детальные настройки
          </summary>
          <div className="mt-2 space-y-2 pt-2 border-t border-gray-700">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Width</label>
                <input
                  type="number"
                  value={settings.resolution.width}
                  onChange={(e) =>
                    setSettings({
                      resolution: { ...settings.resolution, width: parseInt(e.target.value) || 1280 },
                    })
                  }
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Height</label>
                <input
                  type="number"
                  value={settings.resolution.height}
                  onChange={(e) =>
                    setSettings({
                      resolution: { ...settings.resolution, height: parseInt(e.target.value) || 720 },
                    })
                  }
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Frame Rate (FPS)</label>
              <input
                type="number"
                value={settings.frameRate}
                onChange={(e) =>
                  setSettings({ frameRate: parseInt(e.target.value) || 60 })
                }
                min="1"
                max="60"
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}


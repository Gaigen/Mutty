import type { ScreenShareSettings } from '../../../hooks/useScreenShareSettings';
import { SCREEN_RESOLUTION_PRESETS, SCREEN_FPS_PRESETS, CODECS, CONTENT_HINTS } from './constants';
import { SectionHeader } from './ui';

interface ScreenTabProps {
  screenSettings: ScreenShareSettings;
  setScreenSettings: (s: Partial<ScreenShareSettings>) => void;
  currentResolutionPreset: string;
}

export function ScreenTab({ screenSettings, setScreenSettings, currentResolutionPreset }: ScreenTabProps) {
  return (
    <>
      <div>
        <SectionHeader emoji="📐" label="Resolution" />
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(SCREEN_RESOLUTION_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => setScreenSettings({ resolution: { width: preset.width, height: preset.height } })}
              className={`px-2 py-2 rounded text-xs font-medium transition-all border ${
                currentResolutionPreset === key
                  ? 'bg-[#3a3a3a] text-white border-[#4a4a4a]'
                  : 'bg-[#252525] text-gray-300 hover:bg-[#2a2a2a] hover:text-white border-[#2a2a2a]'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader emoji="🎞" label="Frame Rate" />
        <div className="flex flex-wrap gap-2">
          {SCREEN_FPS_PRESETS.map((fps) => (
            <button
              key={fps}
              onClick={() => setScreenSettings({ frameRate: fps })}
              className={`px-3 py-2 rounded text-xs font-medium transition-all border ${
                screenSettings.frameRate === fps
                  ? 'bg-[#3a3a3a] text-white border-[#4a4a4a]'
                  : 'bg-[#252525] text-gray-300 hover:bg-[#2a2a2a] hover:text-white border-[#2a2a2a]'
              }`}
            >
              {fps} FPS
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader emoji="🗜" label="Codec" />
        <div className="space-y-1.5">
          {CODECS.map(({ value, label, desc }) => (
            <label key={value} className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="radio" name="screen-codec" value={value}
                checked={screenSettings.videoCodec === value}
                onChange={() => setScreenSettings({ videoCodec: value })}
                className="mt-0.5 accent-blue-500 shrink-0"
              />
              <div>
                <span className="text-xs text-white font-medium">{label}</span>
                <span className="block text-[10px] text-gray-500">{desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader emoji="🎯" label="Content Type" />
        <div className="space-y-1.5">
          {CONTENT_HINTS.map(({ value, label, desc }) => (
            <label key={value} className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio" name="content-hint" value={value}
                checked={screenSettings.contentHint === value}
                onChange={() => setScreenSettings({ contentHint: value })}
                className="mt-0.5 accent-blue-500 shrink-0"
              />
              <div>
                <span className="text-xs text-white font-medium">{label}</span>
                <span className="block text-[10px] text-gray-500">{desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader emoji="📡" label="Max Bitrate" />
        <div className="flex items-center gap-3">
          <input
            type="range" min="1000000" max="20000000" step="500000"
            value={screenSettings.maxBitrate}
            onChange={(e) => setScreenSettings({ maxBitrate: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-xs text-white w-16 text-right shrink-0">
            {(screenSettings.maxBitrate / 1_000_000).toFixed(1)} Mbps
          </span>
        </div>
        <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
          <span>1 Mbps</span><span>20 Mbps</span>
        </div>
      </div>

      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none py-2 flex items-center gap-2">
          <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Custom Resolution
        </summary>
        <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-[#2a2a2a]">
          {(
            [
              { label: 'Width',  key: 'width'     as const, def: 1920, min: 160, max: 3840 },
              { label: 'Height', key: 'height'    as const, def: 1080, min: 90,  max: 2160 },
              { label: 'FPS',    key: 'frameRate' as const, def: 60,   min: 1,   max: 60   },
            ] as const
          ).map(({ label, key, def, min, max }) => (
            <div key={key}>
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              <input
                type="number" min={min} max={max}
                value={key === 'frameRate' ? screenSettings.frameRate : screenSettings.resolution[key as 'width' | 'height']}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || def;
                  if (key === 'frameRate') setScreenSettings({ frameRate: v });
                  else setScreenSettings({ resolution: { ...screenSettings.resolution, [key]: v } });
                }}
                className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
              />
            </div>
          ))}
        </div>
      </details>
    </>
  );
}

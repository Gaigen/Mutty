import type { CameraSettings } from '../../../hooks/useCameraSettings';
import { CAMERA_PRESETS, CODECS } from './constants';
import { SectionHeader } from './ui';

interface CameraTabProps {
  camSettings: CameraSettings;
  setCamSettings: (s: Partial<CameraSettings>) => void;
  currentCamPreset: string;
}

export function CameraTab({ camSettings, setCamSettings, currentCamPreset }: CameraTabProps) {
  return (
    <>
      <div className="bg-[var(--mutty-surface-1)] rounded-lg px-3 py-2 border border-[var(--mutty-border-2)] text-[10px] text-[var(--mutty-fg-3)]">
        Changes take effect on the next room join.
      </div>

      <div>
        <SectionHeader emoji="📐" label="Resolution" />
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(CAMERA_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => setCamSettings({ width: preset.width, height: preset.height })}
              className={`px-2 py-2 rounded text-xs font-medium transition-all border ${
                currentCamPreset === key
                  ? 'bg-[var(--mutty-surface-3)] text-[var(--mutty-fg-1)] border-[var(--mutty-border-4)]'
                  : 'bg-[var(--mutty-surface-1)] text-[var(--mutty-fg-2)] hover:bg-[var(--mutty-surface-2)] hover:text-[var(--mutty-fg-1)] border-[var(--mutty-border-2)]'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader emoji="🎞" label="Frame Rate" />
        <div className="flex items-center gap-3">
          <input
            type="range" min="15" max="60" step="5"
            value={camSettings.maxFramerate}
            onChange={(e) => setCamSettings({ maxFramerate: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-[var(--mutty-surface-1)] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-xs text-[var(--mutty-fg-1)] w-12 text-right shrink-0">{camSettings.maxFramerate} FPS</span>
        </div>
      </div>

      <div>
        <SectionHeader emoji="🗜" label="Codec" />
        <div className="space-y-1.5">
          {CODECS.map(({ value, label, desc }) => (
            <label key={value} className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio" name="camera-codec" value={value}
                checked={camSettings.videoCodec === value}
                onChange={() => setCamSettings({ videoCodec: value })}
                className="mt-0.5 accent-blue-500 shrink-0"
              />
              <div>
                <span className="text-xs text-[var(--mutty-fg-1)] font-medium">{label}</span>
                <span className="block text-[10px] text-[var(--mutty-fg-3)]">{desc}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader emoji="📡" label="Max Bitrate" />
        <div className="flex items-center gap-3">
          <input
            type="range" min="500000" max="8000000" step="250000"
            value={camSettings.maxBitrate}
            onChange={(e) => setCamSettings({ maxBitrate: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-[var(--mutty-surface-1)] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-xs text-[var(--mutty-fg-1)] w-16 text-right shrink-0">
            {(camSettings.maxBitrate / 1_000_000).toFixed(2)} Mbps
          </span>
        </div>
        <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
          <span>0.5 Mbps</span><span>8 Mbps</span>
        </div>
      </div>
    </>
  );
}

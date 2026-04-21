import type { AudioSettings } from '../../../hooks/useAudioSettings';
import { Switch } from '../../ui/switch';
import { SectionHeader, MicLevelBar } from './ui';

interface AudioTabProps {
  micLevel: number;
  audioSettings: AudioSettings;
  setAudioSettings: (s: Partial<AudioSettings>) => void;
  audioOutputs: MediaDeviceInfo[];
}

const PROCESSING_TOGGLES: {
  key: keyof Pick<AudioSettings, 'noiseSuppression' | 'echoCancellation' | 'autoGainControl' | 'voiceIsolation'>;
  label: string;
  desc: string;
}[] = [
  { key: 'noiseSuppression', label: 'Noise suppression', desc: 'Reduce background noise' },
  { key: 'echoCancellation', label: 'Echo cancellation', desc: 'Remove echo' },
  { key: 'autoGainControl', label: 'Auto gain control', desc: 'Normalize mic level' },
  { key: 'voiceIsolation', label: 'Voice isolation', desc: 'Stronger noise reduction (experimental)' },
];

export function AudioTab({ micLevel, audioSettings, setAudioSettings, audioOutputs }: AudioTabProps) {
  return (
    <>
      <div>
        <SectionHeader emoji="🎤" label="Microphone Input" />
        <div className="rounded-lg border border-[#2a2a2a] bg-[#222] p-3">
          <MicLevelBar
            level={micLevel}
            gateThreshold={audioSettings.noiseGateThreshold}
            gateEnabled={audioSettings.noiseGateEnabled}
          />
          <p className="mt-2 text-[10px] text-gray-600">
            Device: use the Microphone dropdown in the control bar
          </p>
        </div>
      </div>

      <div>
        <SectionHeader emoji="🎛" label="Processing" />
        <div className="space-y-2">
          {PROCESSING_TOGGLES.map(({ key, label, desc }) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-3 py-1">
              <div className="min-w-0 flex-1 pr-1">
                <span className="text-xs text-white">{label}</span>
                <span className="block text-[10px] text-gray-500">{desc}</span>
              </div>
              <Switch
                checked={audioSettings[key]}
                onCheckedChange={(v) => setAudioSettings({ [key]: v })}
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader emoji="🚪" label="Noise Gate" />
        <p className="text-[10px] text-gray-500 mb-3">
          Mutes mic when silent to cut background noise between speech
        </p>
        <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 py-1">
          <div className="min-w-0 flex-1 pr-1">
            <span className="text-xs text-white">Enable Noise Gate</span>
            <span className="block text-[10px] text-gray-500">
              {audioSettings.noiseGateEnabled ? 'Active — mic muted below threshold' : 'Inactive'}
            </span>
          </div>
          <Switch
            checked={audioSettings.noiseGateEnabled}
            onCheckedChange={(v) => setAudioSettings({ noiseGateEnabled: v })}
          />
        </label>

        {audioSettings.noiseGateEnabled && (
          <div className="mt-2 space-y-3 rounded-lg border border-[#2a2a2a] bg-[#1e1e1e]/90 p-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Threshold: <span className="text-white">{audioSettings.noiseGateThreshold} dB</span>
                <span className="text-[10px] text-gray-600 ml-1">(lower = more aggressive)</span>
              </label>
              <input
                type="range" min="-60" max="0" step="1"
                value={audioSettings.noiseGateThreshold}
                onChange={(e) => setAudioSettings({ noiseGateThreshold: parseInt(e.target.value) })}
                className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                <span>-60 dB</span><span>-30 dB</span><span>0 dB</span>
              </div>
            </div>

            <details className="group">
              <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-400 select-none flex items-center gap-1.5 py-1">
                <svg className="w-2.5 h-2.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Advanced — Attack / Release
              </summary>
              <div className="mt-2 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    Attack: <span className="text-white">{audioSettings.noiseGateAttack} ms</span>
                    <span className="text-[10px] text-gray-600 ml-1">(how fast gate opens)</span>
                  </label>
                  <input
                    type="range" min="1" max="100" step="1"
                    value={audioSettings.noiseGateAttack}
                    onChange={(e) => setAudioSettings({ noiseGateAttack: parseInt(e.target.value) })}
                    className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                    <span>1 ms</span><span>100 ms</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">
                    Release: <span className="text-white">{audioSettings.noiseGateRelease} ms</span>
                    <span className="text-[10px] text-gray-600 ml-1">(how fast gate closes)</span>
                  </label>
                  <input
                    type="range" min="20" max="500" step="10"
                    value={audioSettings.noiseGateRelease}
                    onChange={(e) => setAudioSettings({ noiseGateRelease: parseInt(e.target.value) })}
                    className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                    <span>20 ms</span><span>500 ms</span>
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

      <div>
        <SectionHeader emoji="🔊" label="Speakers (Output)" />
        <div className="space-y-3">
          {audioOutputs.length > 0 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Output device</label>
              <select
                value={audioSettings.speakerDeviceId}
                onChange={(e) => setAudioSettings({ speakerDeviceId: e.target.value })}
                className="w-full bg-[#252525] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#3a3a3a]"
              >
                <option value="">Default</option>
                {audioOutputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Speaker volume: <span className="text-white">{Math.round(audioSettings.outputVolume * audioSettings.outputVolume * 100)}%</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.01"
              value={Math.min(1, audioSettings.outputVolume)}
              onChange={(e) => setAudioSettings({ outputVolume: parseFloat(e.target.value) })}
              className="w-full h-2 bg-[#252525] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      </div>

      <div>
        <SectionHeader emoji="🔔" label="Notifications" />
        <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
          <div className="min-w-0 flex-1 pr-1">
            <span className="text-xs text-white">Join / Leave sounds</span>
            <span className="block text-[10px] text-gray-500">Chime when participants join or leave</span>
          </div>
          <Switch
            checked={audioSettings.joinLeaveSounds}
            onCheckedChange={(v) => setAudioSettings({ joinLeaveSounds: v })}
          />
        </label>
      </div>
    </>
  );
}

import { ToggleButton, Divider, SectionLabel } from '../../../ui/agent-primitives';
import type { Mode, Quality } from '../../../../lib/agent-control';
import { QUALITY_OPTIONS } from '../../../../lib/agent-control';

interface ModeQualityProps {
  mode: Mode;
  quality: Quality;
  onModeChange: (mode: Mode) => void;
  onQualityChange: (quality: Quality) => void;
}

export function ModeQualitySection({ mode, quality, onModeChange, onQualityChange }: ModeQualityProps) {
  return (
    <>
      <div style={{ padding: '0.4rem 0.6rem' }}>
        <SectionLabel>Mode</SectionLabel>
        <div style={{ display: 'flex', gap: 4 }}>
          <ToggleButton
            active={mode === 'audio'}
            onClick={() => onModeChange('audio')}
            title="Audio only"
          >
            🎵 Audio
          </ToggleButton>
          <ToggleButton
            active={mode === 'video'}
            onClick={() => onModeChange('video')}
            title="Video + audio"
          >
            🎬 Video
          </ToggleButton>
        </div>
      </div>

      {mode === 'video' && (
        <div style={{ padding: '0.4rem 0.6rem 0' }}>
          <SectionLabel>Quality</SectionLabel>
          <div style={{ display: 'flex', gap: 4 }}>
            {QUALITY_OPTIONS.map((q) => (
              <ToggleButton key={q} active={quality === q} onClick={() => onQualityChange(q)}>
                {q}
              </ToggleButton>
            ))}
          </div>
        </div>
      )}
      <Divider />
    </>
  );
}

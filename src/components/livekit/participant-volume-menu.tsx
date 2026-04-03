import { useEffect, useRef } from 'react';
import { Volume2, Volume1, VolumeX, Monitor } from 'lucide-react';

interface ParticipantVolumeMenuProps {
  x: number;
  y: number;
  voiceVolume: number;
  screenVolume: number;
  hasScreenShare: boolean;
  participantName: string;
  onVoiceVolumeChange: (volume: number) => void;
  onScreenVolumeChange: (volume: number) => void;
  onClose: () => void;
}

function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <VolumeX size={14} />;
  if (volume < 0.5) return <Volume1 size={14} />;
  return <Volume2 size={14} />;
}

function VolumeSlider({
  icon,
  label,
  volume,
  onChange,
  sliderRef,
}: {
  icon: React.ReactNode;
  label: string;
  volume: number;
  onChange: (v: number) => void;
  sliderRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const displayVolume = Math.round(volume * 100);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(volume === 0 ? 1 : 0)}
        className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
        title={volume === 0 ? 'Unmute' : 'Mute'}
      >
        {icon}
      </button>
      <span className="text-xs text-gray-500 w-10 flex-shrink-0">{label}</span>
      <input
        ref={sliderRef}
        type="range"
        min="0"
        max="100"
        value={displayVolume}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="flex-1 h-1 accent-indigo-500 cursor-pointer"
        style={{ appearance: 'auto' }}
      />
      <span className="text-xs text-gray-500 w-8 text-right tabular-nums">{displayVolume}%</span>
    </div>
  );
}

export function ParticipantVolumeMenu({
  x,
  y,
  voiceVolume,
  screenVolume,
  hasScreenShare,
  participantName,
  onVoiceVolumeChange,
  onScreenVolumeChange,
  onClose,
}: ParticipantVolumeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const voiceSliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    voiceSliderRef.current?.focus();
  }, []);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-[#1e1e1e] border border-[#333] rounded-lg shadow-xl w-64 overflow-hidden"
      style={{
        left: Math.min(x, window.innerWidth - 272),
        top: Math.min(y, window.innerHeight - 160),
      }}
    >
      <div className="px-3 py-2 border-b border-[#2a2a2a]">
        <span className="text-xs font-medium text-gray-300 truncate block">{participantName}</span>
      </div>
      <div className="px-3 py-3 space-y-3">
        <VolumeSlider
          icon={<VolumeIcon volume={voiceVolume} />}
          label="Voice"
          volume={voiceVolume}
          onChange={onVoiceVolumeChange}
          sliderRef={voiceSliderRef}
        />
        {hasScreenShare && (
          <VolumeSlider
            icon={<Monitor size={14} />}
            label="Screen"
            volume={screenVolume}
            onChange={onScreenVolumeChange}
            sliderRef={{ current: null }}
          />
        )}
      </div>
    </div>
  );
}

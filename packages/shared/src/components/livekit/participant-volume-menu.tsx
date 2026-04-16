import React, { useEffect, useRef } from 'react';
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={() => onChange(volume === 0 ? 1 : 0)}
        style={{
          background: 'none',
          border: 'none',
          color: '#9ca3af',
          cursor: 'pointer',
          display: 'flex',
          flexShrink: 0,
          padding: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
        title={volume === 0 ? 'Unmute' : 'Mute'}
      >
        {icon}
      </button>
      <span style={{ fontSize: 11, color: '#6b7280', width: 36, flexShrink: 0 }}>{label}</span>
      <input
        ref={sliderRef}
        type="range"
        min="0"
        max="100"
        value={displayVolume}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ flex: 1, height: 4, cursor: 'pointer', '--thumb-color': '#6366f1', minWidth: 0 } as React.CSSProperties}
      />
      <span style={{ fontSize: 11, color: '#6b7280', width: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{displayVolume}%</span>
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
      style={{
        position: 'fixed',
        zIndex: 9999,
        background: '#1e1e1e',
        border: '1px solid #333',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        width: 256,
        overflow: 'hidden',
        left: Math.min(x, window.innerWidth - 272),
        top: Math.min(y, window.innerHeight - 160),
      }}
    >
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2a2a' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#d1d5db', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {participantName}
        </span>
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
    </div>
  );
}

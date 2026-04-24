import React from 'react';
import { Track } from 'livekit-client';
import { BOT_IDENTITY } from '../../../../config';
import { VolumeIcon } from '../../../ui/icons/agent-icons';
import { Divider, SectionLabel } from '../../../ui/agent-primitives';
import { getParticipantVolume } from '../../../../context/ParticipantVolumesContext';

interface Props {
  volumes: Record<string, number>;
  setParticipantVolume: (identity: string, volume: number, source?: Track.Source) => void;
}

export function VolumeSection({ volumes, setParticipantVolume }: Props) {
  const botVoiceVolume = getParticipantVolume(volumes, BOT_IDENTITY, Track.Source.Microphone);
  const botScreenVolume = getParticipantVolume(volumes, BOT_IDENTITY, Track.Source.ScreenShareAudio);

  return (
    <div style={{ padding: '0 0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <VolumeIcon />
        <SectionLabel>Volume</SectionLabel>
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--mutty-fg-6)', width: 48 }}>Voice</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={botVoiceVolume}
            onChange={(e) =>
              setParticipantVolume(BOT_IDENTITY, parseFloat(e.target.value), Track.Source.Microphone)
            }
            style={{ flex: 1, height: 4, '--thumb-color': 'var(--mutty-accent-3)' } as React.CSSProperties}
          />
          <span style={{ fontSize: 10, color: 'var(--mutty-fg-7)', width: 28 }}>
            {Math.round(botVoiceVolume * botVoiceVolume * 100)}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--mutty-fg-6)', width: 48 }}>Screen</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={botScreenVolume}
            onChange={(e) =>
              setParticipantVolume(BOT_IDENTITY, parseFloat(e.target.value), Track.Source.ScreenShareAudio)
            }
            style={{ flex: 1, height: 4, '--thumb-color': 'var(--mutty-accent-3)' } as React.CSSProperties}
          />
          <span style={{ fontSize: 10, color: 'var(--mutty-fg-7)', width: 28 }}>
            {Math.round(botScreenVolume * botScreenVolume * 100)}%
          </span>
        </div>
      </div>
      <Divider />
    </div>
  );
}

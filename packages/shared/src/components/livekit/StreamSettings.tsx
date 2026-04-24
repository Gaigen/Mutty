import { useRoomContext, useRemoteParticipants } from '@livekit/components-react';
import { useParticipantVolumes } from '../../context/ParticipantVolumesContext';
import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAudioSettings } from '../../hooks/useAudioSettings';
import { useCameraSettings } from '../../hooks/useCameraSettings';
import { useScreenShareSettings } from '../../hooks/useScreenShareSettings';
import { useMicLevel } from '../../hooks/useMicLevel';
import { useAudioOutputs } from '../../hooks/useAudioOutputs';
import { useStatsPolling } from '../../hooks/useStatsPolling';
import { BOT_IDENTITY } from '../../config';
import { CAMERA_PRESETS, SCREEN_RESOLUTION_PRESETS } from './stream-settings/constants';
import { AudioTab } from './stream-settings/audio-tab';
import { ScreenTab } from './stream-settings/screen-tab';
import { CameraTab } from './stream-settings/camera-tab';
import { PeopleTab } from './stream-settings/people-tab';
import { StatsTab } from './stream-settings/stats-tab';

type BuiltinTabId = 'audio' | 'screen' | 'camera' | 'people' | 'stats';

interface ExtraTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface StreamSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  /** Extra tabs injected by platform (e.g. hotkeys, app settings on desktop) */
  extraTabs?: ExtraTab[];
}

export default function StreamSettings({ isOpen, onClose, extraTabs }: StreamSettingsProps) {
  const room = useRoomContext();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { settings: screenSettings, setSettings: setScreenSettings } = useScreenShareSettings();
  const { settings: camSettings, setSettings: setCamSettings } = useCameraSettings();
  const { settings: audioSettings, setSettings: setAudioSettings } = useAudioSettings();
  const [activeTab, setActiveTab] = useState<string>('audio');
  const audioOutputs = useAudioOutputs();
  const remoteParticipants = useRemoteParticipants();
  const { volumes: participantVolumes, setVolume: setParticipantVolume } = useParticipantVolumes();
  const micLevel = useMicLevel(isOpen && activeTab === 'audio', room, audioSettings);
  const statsPolling = useStatsPolling(room, isOpen && activeTab === 'stats');

  const currentResolutionPreset =
    Object.entries(SCREEN_RESOLUTION_PRESETS).find(
      ([, p]) => p.width === screenSettings.resolution.width && p.height === screenSettings.resolution.height,
    )?.[0] ?? '';

  const currentCamPreset =
    Object.entries(CAMERA_PRESETS).find(
      ([, p]) => p.width === camSettings.width && p.height === camSettings.height,
    )?.[0] ?? '';

  const humanParticipants = remoteParticipants.filter((p) => p.identity !== BOT_IDENTITY);

  if (!isOpen) return null;

  const builtinTabs: { id: BuiltinTabId; label: string }[] = [
    { id: 'audio',  label: 'Audio' },
    { id: 'screen', label: 'Screen' },
    { id: 'camera', label: 'Camera' },
    { id: 'people', label: humanParticipants.length > 0 ? `People (${humanParticipants.length})` : 'People' },
    { id: 'stats',  label: 'Stats' },
  ];

  const allTabs: { id: string; label: string }[] = [
    ...builtinTabs,
    ...(extraTabs?.map((t) => ({ id: t.id, label: t.label })) ?? []),
  ];

  // Find the active extra tab content (if any)
  const activeExtraTab = extraTabs?.find((t) => t.id === activeTab);

  return (
    <div className="stream-settings-panel bg-[var(--mutty-dropdown-bg)] border border-[var(--mutty-border-2)] rounded-xl shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--mutty-border-2)] px-4 py-2.5">
        <div className="flex gap-0.5 flex-wrap">
          {allTabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === id
                  ? 'bg-[var(--mutty-surface-2)] text-[var(--mutty-fg-1)]'
                  : 'text-[var(--mutty-fg-3)] hover:text-[var(--mutty-fg-2)] hover:bg-[var(--mutty-surface-1)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={toggleTheme}
          className="text-[var(--mutty-fg-3)] hover:text-[var(--mutty-fg-1)] transition-colors p-1 rounded hover:bg-[var(--mutty-surface-2)]"
          aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={onClose}
          className="text-[var(--mutty-fg-3)] hover:text-[var(--mutty-fg-1)] transition-colors p-1 ml-1 rounded hover:bg-[var(--mutty-surface-2)]"
          aria-label="Close"
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="min-w-0 max-h-[62vh] space-y-5 overflow-y-auto px-4 py-4">
        {activeTab === 'audio' && (
          <AudioTab
            micLevel={micLevel}
            audioSettings={audioSettings}
            setAudioSettings={setAudioSettings}
            audioOutputs={audioOutputs}
          />
        )}
        {activeTab === 'screen' && (
          <ScreenTab
            screenSettings={screenSettings}
            setScreenSettings={setScreenSettings}
            currentResolutionPreset={currentResolutionPreset}
          />
        )}
        {activeTab === 'camera' && (
          <CameraTab
            camSettings={camSettings}
            setCamSettings={setCamSettings}
            currentCamPreset={currentCamPreset}
          />
        )}
        {activeTab === 'people' && (
          <PeopleTab
            room={room}
            humanParticipants={humanParticipants}
            participantVolumes={participantVolumes}
            setParticipantVolume={setParticipantVolume}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab room={room} {...statsPolling} />
        )}
        {/* Render platform-injected extra tab content */}
        {activeExtraTab && activeExtraTab.content}
      </div>
    </div>
  );
}

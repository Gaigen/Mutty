import { useRoomContext, useRemoteParticipants } from '@livekit/components-react';
import { useParticipantVolumes } from '../../context/ParticipantVolumesContext';
import { useState } from 'react';
import { useAudioSettings } from '../../hooks/useAudioSettings';
import { useCameraSettings } from '../../hooks/useCameraSettings';
import { useScreenShareSettings } from '../../hooks/useScreenShareSettings';
import { useMicLevel } from '../../hooks/useMicLevel';
import { useActiveSpeakers } from '../../hooks/useActiveSpeakers';
import { useAudioOutputs } from '../../hooks/useAudioOutputs';
import { useStatsPolling } from '../../hooks/useStatsPolling';
import { BOT_IDENTITY } from '../../config';
import { CAMERA_PRESETS, SCREEN_RESOLUTION_PRESETS } from './stream-settings/constants';
import { AudioTab } from './stream-settings/audio-tab';
import { ScreenTab } from './stream-settings/screen-tab';
import { CameraTab } from './stream-settings/camera-tab';
import { PeopleTab } from './stream-settings/people-tab';
import { StatsTab } from './stream-settings/stats-tab';

type TabId = 'audio' | 'screen' | 'camera' | 'people' | 'stats';

interface StreamSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StreamSettings({ isOpen, onClose }: StreamSettingsProps) {
  const room = useRoomContext();
  const { settings: screenSettings, setSettings: setScreenSettings } = useScreenShareSettings();
  const { settings: camSettings, setSettings: setCamSettings } = useCameraSettings();
  const { settings: audioSettings, setSettings: setAudioSettings } = useAudioSettings();
  const [activeTab, setActiveTab] = useState<TabId>('audio');
  const audioOutputs = useAudioOutputs();
  const remoteParticipants = useRemoteParticipants();
  const { volumes: participantVolumes, setVolume: setParticipantVolume } = useParticipantVolumes();
  const activeSpeakerIds = useActiveSpeakers(room);
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

  const tabs: { id: TabId; label: string }[] = [
    { id: 'audio',  label: 'Audio' },
    { id: 'screen', label: 'Screen' },
    { id: 'camera', label: 'Camera' },
    { id: 'people', label: humanParticipants.length > 0 ? `People (${humanParticipants.length})` : 'People' },
    { id: 'stats',  label: 'Stats' },
  ];

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 w-[92vw] max-w-[460px]">
      <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-2.5">
        <div className="flex gap-0.5 flex-wrap">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === id
                  ? 'bg-[#2a2a2a] text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-[#222]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1 ml-2 rounded hover:bg-[#2a2a2a]"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 max-h-[62vh] overflow-y-auto space-y-5">
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
            humanParticipants={humanParticipants}
            participantVolumes={participantVolumes}
            activeSpeakerIds={activeSpeakerIds}
            setParticipantVolume={setParticipantVolume}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab room={room} {...statsPolling} />
        )}
      </div>
    </div>
  );
}

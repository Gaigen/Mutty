import { useState, useCallback, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from '@shared/pages/HomePage';
import RoomPage from '@shared/pages/RoomPage';
import ServerUrlSection from './components/ServerUrlSection';
import { HotkeyListener } from './components/livekit/HotkeyListener';
import { TrayStateSync } from './components/livekit/TrayStateSync';
import { HotkeysTab } from './components/livekit/stream-settings/hotkeys-tab';
import { AppSettingsTab } from './components/livekit/stream-settings/app-tab';
import { useHotkeySettings } from './hooks/useHotkeySettings';
import { useAppSettings } from './hooks/useAppSettings';

function DesktopRoomPage() {
  const { settings: hotkeySettings, setSettings: setHotkeySettings } = useHotkeySettings();
  const { settings: appSettings, setSettings: setAppSettings } = useAppSettings();

  const extraComponents = useMemo(
    () => (
      <>
        <HotkeyListener />
        <TrayStateSync />
      </>
    ),
    [],
  );

  const extraSettingsTabs = useMemo(
    () => [
      {
        id: 'hotkeys',
        label: 'Hotkeys',
        content: <HotkeysTab settings={hotkeySettings} setSettings={setHotkeySettings} />,
      },
      {
        id: 'controls',
        label: 'Controls',
        content: <AppSettingsTab settings={appSettings} setSettings={setAppSettings} />,
      },
    ],
    [hotkeySettings, setHotkeySettings, appSettings, setAppSettings],
  );

  return (
    <RoomPage
      extraComponents={extraComponents}
      extraSettingsTabs={extraSettingsTabs}
    />
  );
}

export default function App() {
  const [serverConfigured, setServerConfigured] = useState(false);

  const handleConfigured = useCallback((configured: boolean) => {
    setServerConfigured(configured);
  }, []);

  return (
    <div className="min-h-screen w-full">
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              serverUrlSection={<ServerUrlSection onConfigured={handleConfigured} />}
              hideForm={!serverConfigured}
            />
          }
        />
        <Route path="/room/:roomName" element={<DesktopRoomPage />} />
      </Routes>
    </div>
  );
}

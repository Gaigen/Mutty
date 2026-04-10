import { useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from '@shared/pages/HomePage';
import RoomPage from '@shared/pages/RoomPage';
import ServerUrlSection from './components/ServerUrlSection';

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
        <Route path="/room/:roomName" element={<RoomPage />} />
      </Routes>
    </div>
  );
}

import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { migrateFromLocalStorage } from './lib/store'
import { LS_KEYS } from './config'

// Global event bus for Tauri events (works even when window is hidden)
const trayMuteListeners: Set<() => void> = new Set();
(window as any).__trayMuteToggle = () => {
  trayMuteListeners.forEach(fn => fn());
};
(window as any).__registerTrayMute = (fn: () => void) => {
  trayMuteListeners.add(fn);
  return () => { trayMuteListeners.delete(fn); };
};

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950">
      <div className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent mb-4">
        Mutty
      </div>
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Root() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    migrateFromLocalStorage([
      LS_KEYS.serverUrl,
      LS_KEYS.audioSettings,
      LS_KEYS.cameraSettings,
      LS_KEYS.screenShareSettings,
      LS_KEYS.identity,
      LS_KEYS.avatar,
      LS_KEYS.recentRooms,
      LS_KEYS.chatWidth,
      LS_KEYS.webAppUrl,
      LS_KEYS.appSettings,
      LS_KEYS.hotkeySettings,
    ]).then(() => setReady(true)).catch(console.error);
  }, []);

  if (!ready) return <LoadingScreen />;

  return (
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);

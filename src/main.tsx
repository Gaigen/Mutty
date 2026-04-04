import { StrictMode } from 'react'
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

// Migrate from localStorage to Tauri store on first run
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
]).catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

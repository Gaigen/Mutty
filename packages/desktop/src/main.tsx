import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PlatformProvider } from '@shared/platform';
import { ThemeProvider } from '@shared/context';
import type { Platform } from '@shared/platform';
import { createDesktopPlatform } from './platform';
import App from './App';
import '@shared/index.css';
import './desktop.css';
import '@fontsource-variable/geist';

// ── Global event bus for tray mute toggle (works even when window is hidden) ──
const trayMuteListeners: Set<() => void> = new Set();
(window as any).__trayMuteToggle = () => {
  trayMuteListeners.forEach(fn => fn());
};
(window as any).__registerTrayMute = (fn: () => void) => {
  trayMuteListeners.add(fn);
  return () => { trayMuteListeners.delete(fn); };
};

// ── Loading screen shown while platform initialises ──────────────────────────
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
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    createDesktopPlatform()
      .then(setPlatform)
      .catch(console.error);
  }, []);

  if (!platform) return <LoadingScreen />;

  return (
    <React.StrictMode>
      <ThemeProvider storage={platform.storage}>
        <PlatformProvider value={platform}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </PlatformProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);

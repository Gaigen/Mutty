import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

// Global event bus for Tauri events (works even when window is hidden)
const trayMuteListeners: Set<() => void> = new Set();
(window as any).__trayMuteToggle = () => {
  trayMuteListeners.forEach(fn => fn());
};
(window as any).__registerTrayMute = (fn: () => void) => {
  trayMuteListeners.add(fn);
  return () => { trayMuteListeners.delete(fn); };
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

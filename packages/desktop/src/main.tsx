import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PlatformProvider } from '@shared/platform';
import { createDesktopPlatform } from './platform';
import App from './App';
import '@shared/index.css';
import '@fontsource-variable/geist';

async function init() {
  const platform = await createDesktopPlatform();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <PlatformProvider value={platform}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PlatformProvider>
    </React.StrictMode>,
  );
}

init();

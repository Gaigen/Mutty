import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PlatformProvider } from '@shared/platform';
import { ThemeProvider } from '@shared/context';
import { webPlatform } from './platform';
import App from './App';
import '@shared/index.css';
import '@fontsource-variable/geist';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlatformProvider value={webPlatform}>
      <ThemeProvider storage={webPlatform.storage}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </PlatformProvider>
  </React.StrictMode>,
);

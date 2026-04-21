import * as React from 'react';
import { usePlatform } from '../platform';

interface LinkBrowserState {
  url: string | null;
  isOpen: boolean;
}

interface LinkBrowserContextValue {
  state: LinkBrowserState;
  open: (url: string) => void;
  close: () => void;
  openInBrowser: (url: string) => void;
  copyLink: (url: string) => Promise<boolean>;
}

const LinkBrowserContext = React.createContext<LinkBrowserContextValue | null>(null);

export function LinkBrowserProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<LinkBrowserState>({ url: null, isOpen: false });
  const platform = usePlatform();

  const open = React.useCallback((url: string) => {
    setState({ url, isOpen: true });
  }, []);

  const close = React.useCallback(() => {
    setState({ url: null, isOpen: false });
  }, []);

  const openInBrowser = React.useCallback((url: string) => {
    if (platform.type === 'desktop') {
      // Tauri: try shell plugin dynamically
      import(/* @vite-ignore */ '@tauri-apps/plugin-shell')
        .then(({ open: shellOpen }: any) => shellOpen(url))
        .catch(() => {
          // Fallback if shell plugin not installed
          window.open(url, '_blank');
        });
    } else {
      // Web: open in new tab
      window.open(url, '_blank');
    }
  }, [platform.type]);

  const copyLink = React.useCallback(async (url: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = React.useMemo(
    () => ({ state, open, close, openInBrowser, copyLink }),
    [state, open, close, openInBrowser, copyLink],
  );

  return (
    <LinkBrowserContext.Provider value={value}>
      {children}
    </LinkBrowserContext.Provider>
  );
}

export function useLinkBrowser(): LinkBrowserContextValue {
  const ctx = React.useContext(LinkBrowserContext);
  if (!ctx) throw new Error('useLinkBrowser must be used within LinkBrowserProvider');
  return ctx;
}

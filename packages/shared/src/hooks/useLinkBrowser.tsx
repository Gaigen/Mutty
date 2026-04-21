import * as React from 'react';

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

  const open = React.useCallback((url: string) => {
    setState({ url, isOpen: true });
  }, []);

  const close = React.useCallback(() => {
    setState({ url: null, isOpen: false });
  }, []);

  const openInBrowser = React.useCallback((url: string) => {
    // Use <a target="_blank"> instead of window.open — Tauri webview handles
    // this natively by opening in system browser
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

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

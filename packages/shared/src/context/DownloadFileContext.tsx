import * as React from 'react';

export type DownloadFileHandler = (blob: Blob, name: string) => Promise<void> | void;

const DownloadFileContext = React.createContext<DownloadFileHandler | null>(null);

export function DownloadFileProvider({
  handler,
  children,
}: {
  handler: DownloadFileHandler;
  children: React.ReactNode;
}) {
  return <DownloadFileContext.Provider value={handler}>{children}</DownloadFileContext.Provider>;
}

export function useDownloadFile(): DownloadFileHandler | null {
  return React.useContext(DownloadFileContext);
}

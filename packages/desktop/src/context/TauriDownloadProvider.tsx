import * as React from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { DownloadFileProvider } from '@mutty/shared';

export function TauriDownloadProvider({ children }: { children: React.ReactNode }) {
  const handleDownload = React.useCallback(async (blob: Blob, name: string) => {
    const path = await save({ defaultPath: name });
    if (!path) return;
    const arrayBuffer = await blob.arrayBuffer();
    const contents = Array.from(new Uint8Array(arrayBuffer));
    await invoke('save_file', { path, contents });
  }, []);

  return <DownloadFileProvider handler={handleDownload}>{children}</DownloadFileProvider>;
}

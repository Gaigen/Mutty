import type { Platform } from '@shared/platform';
import { TauriStorage } from './tauri-storage';
import { TauriConfig } from './tauri-config';
import { TauriNotifications } from './tauri-notifications';

export async function createDesktopPlatform(): Promise<Platform> {
  const storage = new TauriStorage();
  await storage.init();
  return {
    storage,
    config: new TauriConfig(storage),
    notifications: new TauriNotifications(),
    type: 'desktop',
  };
}

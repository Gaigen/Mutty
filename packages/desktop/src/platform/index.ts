import type { Platform } from '@shared/platform';
import { LS_KEYS } from '@shared/config';
import { TauriStorage } from './tauri-storage';
import { TauriConfig } from './tauri-config';
import { TauriNotifications } from './tauri-notifications';

export async function createDesktopPlatform(): Promise<Platform> {
  const storage = new TauriStorage();
  await storage.init();

  // Migrate from localStorage to Tauri Store (one-time, for upgrades)
  await storage.migrateFromLocalStorage(Object.values(LS_KEYS));

  return {
    storage,
    config: new TauriConfig(storage),
    notifications: new TauriNotifications(),
    type: 'desktop',
  };
}

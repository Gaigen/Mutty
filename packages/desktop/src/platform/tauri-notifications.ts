import type { NotificationAdapter } from '@shared/platform/notifications';
import { invoke } from '@tauri-apps/api/core';

export class TauriNotifications implements NotificationAdapter {
  isAvailable(): boolean {
    return true; // Tauri native notifications always available
  }

  async requestPermission(): Promise<boolean> {
    return true; // No permission needed on desktop
  }

  send(title: string, body: string): void {
    invoke('plugin:notification|notify', { title, body }).catch(() => {});
  }
}

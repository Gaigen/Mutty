import type { NotificationAdapter } from '@shared/platform/notifications';
import { sendNotification, requestPermission, isPermissionGranted } from '@tauri-apps/plugin-notification';

export class TauriNotifications implements NotificationAdapter {
  isAvailable(): boolean {
    return true; // Tauri native notifications always available
  }

  async requestPermission(): Promise<boolean> {
    const granted = await isPermissionGranted();
    if (granted) return true;
    const result = await requestPermission();
    return result === 'granted';
  }

  send(title: string, body: string): void {
    sendNotification({ title, body });
  }
}

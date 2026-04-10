import type { NotificationAdapter } from '@shared/platform/notifications';

export class WebNotifications implements NotificationAdapter {
  isAvailable(): boolean {
    return 'Notification' in window;
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  send(title: string, body: string, options?: { icon?: string }): void {
    if (!this.isAvailable() || Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: options?.icon });
  }
}

import { usePlatform } from '@/platform';

let _notifications: ReturnType<typeof usePlatform>['notifications'] | null = null;

/**
 * Initialize notify-chat with the platform notifications adapter.
 * Call once at app startup (e.g., inside a top-level component).
 */
export function initNotifyChat(notifications: { isAvailable(): boolean; requestPermission(): Promise<boolean>; send(title: string, body: string, options?: { icon?: string }): void }) {
  _notifications = notifications;
}

export function requestNotificationPermission() {
  if (_notifications) {
    _notifications.requestPermission();
    return;
  }
  // Fallback: web Notification API directly
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function sendChatNotification(sender: string, message: string, icon?: string) {
  if (_notifications) {
    const preview = message.length > 100 ? message.slice(0, 100) + '...' : message;
    _notifications.send(sender, preview, { icon });
    return;
  }
  // Fallback: web Notification API directly
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;

  const preview = message.length > 100 ? message.slice(0, 100) + '...' : message;

  new Notification(sender, {
    body: preview,
    icon: icon || '/favicon.png',
  });
}

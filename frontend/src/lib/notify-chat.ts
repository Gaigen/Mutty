export function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function sendChatNotification(sender: string, message: string, icon?: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;

  const preview = message.length > 100 ? message.slice(0, 100) + '...' : message;

  new Notification(sender, {
    body: preview,
    icon: icon || '/favicon.png',
  });
}

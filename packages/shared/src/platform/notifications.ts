export interface NotificationAdapter {
  isAvailable(): boolean;
  requestPermission(): Promise<boolean>;
  send(title: string, body: string, options?: { icon?: string }): void;
}

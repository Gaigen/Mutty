import type { Platform } from '@shared/platform';
import { WebStorage } from './web-storage';
import { WebConfig } from './web-config';
import { WebNotifications } from './web-notifications';

export const webPlatform: Platform = {
  storage: new WebStorage(),
  config: new WebConfig(),
  notifications: new WebNotifications(),
  type: 'web',
};

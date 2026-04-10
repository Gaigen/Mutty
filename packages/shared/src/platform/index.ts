import { createContext, useContext } from 'react';
import type { StorageAdapter } from './storage';
import type { ConfigAdapter } from './config';
import type { NotificationAdapter } from './notifications';

export type { StorageAdapter } from './storage';
export type { ConfigAdapter } from './config';
export type { NotificationAdapter } from './notifications';

export interface Platform {
  storage: StorageAdapter;
  config: ConfigAdapter;
  notifications: NotificationAdapter;
  type: 'web' | 'desktop';
}

const PlatformContext = createContext<Platform | null>(null);

export const PlatformProvider = PlatformContext.Provider;

export function usePlatform(): Platform {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}

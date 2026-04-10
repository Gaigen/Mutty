import type { ConfigAdapter } from '@shared/platform/config';
import type { StorageAdapter } from '@shared/platform/storage';

const LS_KEYS = {
  serverUrl: 'mutty-server-url',
  webAppUrl: 'mutty-webapp-url',
};

export class TauriConfig implements ConfigAdapter {
  constructor(private storage: StorageAdapter) {}

  getTokenEndpoint(): string | null {
    const url = this.storage.get<string>(LS_KEYS.serverUrl);
    return url ? `${url}/api/token` : null;
  }

  getDispatchEndpoint(): string | null {
    const url = this.storage.get<string>(LS_KEYS.serverUrl);
    return url ? `${url}/api/agent/dispatch` : null;
  }

  getWebAppUrl(): string {
    return this.storage.get<string>(LS_KEYS.webAppUrl) || window.location.origin;
  }

  async setServerUrl(url: string): Promise<void> {
    this.storage.set(LS_KEYS.serverUrl, url);
  }

  async clearServerUrl(): Promise<void> {
    this.storage.delete(LS_KEYS.serverUrl);
  }

  isValidServerUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

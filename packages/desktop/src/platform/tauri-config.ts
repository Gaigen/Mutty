import type { ConfigAdapter } from '@shared/platform/config';
import type { StorageAdapter } from '@shared/platform/storage';
import { LS_KEYS } from '@shared/config';

export class TauriConfig implements ConfigAdapter {
  constructor(private storage: StorageAdapter) {}

  getTokenEndpoint(): string | null {
    const url = this.storage.get<string>(LS_KEYS.serverUrl);
    if (!url) return null;
    const base = this.normalizeBaseUrl(url);
    return `${base}/api/token`;
  }

  getDispatchEndpoint(): string | null {
    const url = this.storage.get<string>(LS_KEYS.serverUrl);
    if (!url) return null;
    const base = this.normalizeBaseUrl(url);
    return `${base}/api/agent/dispatch`;
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
    if (!url.trim()) return false;
    const normalized = this.normalizeBaseUrl(url);
    try {
      const parsed = new URL(normalized);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private normalizeBaseUrl(url: string): string {
    let base = url.replace(/\/+$/, '');
    if (base.startsWith('http://') || base.startsWith('https://')) {
      return base;
    }
    return `https://${base}`;
  }
}

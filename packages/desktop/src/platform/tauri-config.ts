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

  /** Defaults to secure, which is the behaviour this adapter had before the toggle. */
  isSecure(): boolean {
    const stored = this.storage.get<boolean>(LS_KEYS.serverSecure);
    return stored === null || stored === undefined ? true : stored;
  }

  async setSecure(secure: boolean): Promise<void> {
    this.storage.set(LS_KEYS.serverSecure, secure);
  }

  /**
   * The token server returns its own LIVEKIT_PUBLIC_WS_URL, so the scheme there is
   * whatever the operator configured. Force it to match the user's choice, otherwise
   * there is no way to try ws:// against a server that advertises wss:// (or back).
   */
  normalizeWsUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    const scheme = this.isSecure() ? 'wss://' : 'ws://';
    const withoutScheme = trimmed.replace(/^wss?:\/\//i, '');
    return `${scheme}${withoutScheme}`;
  }

  private normalizeBaseUrl(url: string): string {
    const base = url.replace(/\/+$/, '');
    const scheme = this.isSecure() ? 'https://' : 'http://';
    // An explicit scheme in the input wins over the toggle.
    if (/^https?:\/\//i.test(base)) {
      return base;
    }
    return `${scheme}${base}`;
  }
}

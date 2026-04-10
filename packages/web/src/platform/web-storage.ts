import type { StorageAdapter } from '@shared/platform/storage';

export class WebStorage implements StorageAdapter {
  get<T = unknown>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async getAsync<T = unknown>(key: string): Promise<T | null> {
    return this.get<T>(key);
  }

  set<T = unknown>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage full or unavailable
    }
  }

  delete(key: string): void {
    localStorage.removeItem(key);
  }
}

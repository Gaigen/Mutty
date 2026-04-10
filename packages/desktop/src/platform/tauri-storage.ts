import type { StorageAdapter } from '@shared/platform/storage';
import { Store } from '@tauri-apps/plugin-store';

export class TauriStorage implements StorageAdapter {
  private store: Store | null = null;
  private cache = new Map<string, unknown>();

  async init(): Promise<void> {
    this.store = await Store.load('settings.json');
  }

  get<T = unknown>(key: string): T | null {
    return (this.cache.get(key) as T) ?? null;
  }

  async getAsync<T = unknown>(key: string): Promise<T | null> {
    if (!this.store) await this.init();
    const val = await this.store!.get<T>(key);
    if (val !== null && val !== undefined) {
      this.cache.set(key, val);
    }
    return val ?? null;
  }

  set<T = unknown>(key: string, value: T): void {
    this.cache.set(key, value);
    if (this.store) {
      this.store.set(key, value);
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
    if (this.store) {
      this.store.delete(key);
    }
  }
}

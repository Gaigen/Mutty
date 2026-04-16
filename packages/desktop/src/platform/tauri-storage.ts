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
      this.store.set(key, value).then(() => this.store!.save());
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
    if (this.store) {
      this.store.delete(key).then(() => this.store!.save());
    }
  }

  /**
   * Migrate keys from localStorage to Tauri Store (one-time).
   * After migration, all keys are pre-loaded into cache for sync access.
   */
  async migrateFromLocalStorage(keys: string[]): Promise<void> {
    if (!this.store) await this.init();
    const store = this.store!;
    const migrated = await store.get<boolean>('migrated_from_localstorage');

    if (!migrated) {
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          try {
            const parsed = JSON.parse(raw);
            await store.set(key, parsed);
            this.cache.set(key, parsed);
          } catch {
            await store.set(key, raw);
            this.cache.set(key, raw);
          }
          localStorage.removeItem(key);
        }
      }

      await store.set('migrated_from_localstorage', true);
      await store.save();
    }

    // Pre-load all keys into cache for synchronous access
    for (const key of keys) {
      if (!this.cache.has(key)) {
        const value = await store.get(key);
        if (value !== null && value !== undefined) {
          this.cache.set(key, value);
        }
      }
    }
  }
}

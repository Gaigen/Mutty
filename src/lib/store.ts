import { Store } from '@tauri-apps/plugin-store';

const STORE_PATH = 'settings.json';

let storeInstance: Store | null = null;
const syncCache: Record<string, unknown> = {};

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await Store.load(STORE_PATH);
  }
  return storeInstance;
}

export async function storeGet<T>(key: string): Promise<T | null> {
  if (syncCache[key] !== undefined) {
    return syncCache[key] as T;
  }
  const store = await getStore();
  const value = await store.get<T>(key);
  if (value !== null && value !== undefined) {
    syncCache[key] = value;
  }
  return value ?? null;
}

export async function storeSet(key: string, value: unknown): Promise<void> {
  syncCache[key] = value;
  const store = await getStore();
  await store.set(key, value);
  await store.save();
}

export async function storeDelete(key: string): Promise<void> {
  delete syncCache[key];
  const store = await getStore();
  await store.delete(key);
  await store.save();
}

export function storeGetSync<T>(key: string): T | null {
  if (syncCache[key] !== undefined) {
    return syncCache[key] as T;
  }
  return null;
}

export function storeSetSync(key: string, value: unknown): void {
  syncCache[key] = value;
  getStore().then((store) => {
    store.set(key, value);
    store.save();
  });
}

export async function storeClear(): Promise<void> {
  const store = await getStore();
  await store.clear();
  await store.save();
  Object.keys(syncCache).forEach((k) => delete syncCache[k]);
}

export async function migrateFromLocalStorage(keys: string[]): Promise<void> {
  const store = await getStore();
  const migrated = await store.get<boolean>('migrated_from_localstorage');
  if (migrated) return;

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        await store.set(key, parsed);
        syncCache[key] = parsed;
      } catch {
        await store.set(key, raw);
        syncCache[key] = raw;
      }
      localStorage.removeItem(key);
    }
  }

  await store.set('migrated_from_localstorage', true);
  await store.save();
}

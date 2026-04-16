export interface StorageAdapter {
  /** Synchronous read from cache. Returns null if not cached. */
  get<T = unknown>(key: string): T | null;
  /** Async read (for initial load from Tauri Store). Web version just wraps get(). */
  getAsync<T = unknown>(key: string): Promise<T | null>;
  /** Write value. Desktop: fire-and-forget async persist + sync cache update. */
  set<T = unknown>(key: string, value: T): void;
  /** Delete key. */
  delete(key: string): void;
}

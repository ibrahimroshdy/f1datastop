// Lightweight client-side cache with TTL and stale-while-revalidate support

export const DEFAULT_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

type CacheEntry<T> = {
  timestamp: number;
  data: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function buildKey(key: string, namespace?: string): string {
  const ns = namespace ? `${namespace}:` : "";
  return `f1datastop:${ns}${key}`;
}

export function getCache<T>(key: string, ttlMs: number, namespace?: string): T | null {
  const compositeKey = buildKey(key, namespace);

  // Check in-memory first
  const memoryEntry = memoryCache.get(compositeKey) as CacheEntry<T> | undefined;
  if (memoryEntry && Date.now() - memoryEntry.timestamp < ttlMs) {
    return memoryEntry.data;
  }

  // Fallback to localStorage
  if (isBrowser()) {
    try {
      const raw = localStorage.getItem(compositeKey);
      if (!raw) return null;
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (entry && Date.now() - entry.timestamp < ttlMs) {
        // Refresh memory cache
        memoryCache.set(compositeKey, entry);
        return entry.data;
      }
    } catch {
      // Ignore parsing/storage errors
      return null;
    }
  }

  return null;
}

export function getStale<T>(key: string, namespace?: string): T | null {
  const compositeKey = buildKey(key, namespace);
  const memoryEntry = memoryCache.get(compositeKey) as CacheEntry<T> | undefined;
  if (memoryEntry) return memoryEntry.data;
  if (isBrowser()) {
    try {
      const raw = localStorage.getItem(compositeKey);
      if (!raw) return null;
      const entry = JSON.parse(raw) as CacheEntry<T>;
      return entry?.data ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export function setCache<T>(key: string, data: T, namespace?: string): void {
  const compositeKey = buildKey(key, namespace);
  const entry: CacheEntry<T> = { timestamp: Date.now(), data };
  memoryCache.set(compositeKey, entry);
  if (isBrowser()) {
    try {
      localStorage.setItem(compositeKey, JSON.stringify(entry));
    } catch {
      // Storage might be full or unavailable; ignore
    }
  }
}

export function deleteCache(key: string, namespace?: string): void {
  const compositeKey = buildKey(key, namespace);
  memoryCache.delete(compositeKey);
  if (isBrowser()) {
    try {
      localStorage.removeItem(compositeKey);
    } catch {
      // ignore
    }
  }
}

export function clearNamespace(namespace?: string): void {
  if (!isBrowser()) {
    if (!namespace) {
      memoryCache.clear();
      return;
    }
    // Clear only namespace keys from memory
    for (const key of memoryCache.keys()) {
      if (key.startsWith(`f1datastop:${namespace}:`)) memoryCache.delete(key);
    }
    return;
  }

  if (!namespace) {
    // Clear just our app's keys in localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("f1datastop:")) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    memoryCache.clear();
    return;
  }

  const prefix = `f1datastop:${namespace}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keysToRemove.push(k);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  // Memory as well
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

export async function withCache<T>(
  key: string,
  ttlMs: number = DEFAULT_TTL_MS,
  fetcher: () => Promise<T>,
  options?: { namespace?: string; staleWhileRevalidate?: boolean }
): Promise<T> {
  const namespace = options?.namespace;
  const swr = options?.staleWhileRevalidate ?? true;

  const fresh = getCache<T>(key, ttlMs, namespace);
  if (fresh !== null) {
    console.log(`🎯 Cache HIT for ${key}`);
    return fresh;
  }

  if (swr) {
    const stale = getStale<T>(key, namespace);
    if (stale !== null) {
      console.log(`♻️  Cache STALE for ${key} - serving stale, revalidating in background`);
      // Revalidate in background
      setTimeout(async () => {
        try {
          const data = await fetcher();
          setCache(key, data, namespace);
          console.log(`✅ Background revalidation complete for ${key}`);
        } catch (error) {
          console.log(`❌ Background revalidation failed for ${key}:`, error);
        }
      }, 0);
      return stale;
    }
  }

  console.log(`🌐 Cache MISS for ${key} - fetching fresh data`);
  const data = await fetcher();
  setCache(key, data, namespace);
  console.log(`💾 Cached fresh data for ${key}`);
  return data;
}

// Development helpers (expose globally for console testing)
if (typeof window !== "undefined") {
  (window as any).f1Cache = {
    inspect: () => {
      console.log("=== F1 Cache Inspection ===");
      console.log("Memory cache entries:", memoryCache.size);
      
      if (isBrowser()) {
        const lsKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("f1datastop:")) {
            lsKeys.push(key);
          }
        }
        console.log("LocalStorage cache entries:", lsKeys.length);
        console.log("Cache keys:", lsKeys);
      }
      
      return { memoryCache, localStorageKeys: isBrowser() ? Object.keys(localStorage).filter(k => k.startsWith("f1datastop:")) : [] };
    },
    
    clear: () => {
      clearNamespace();
      console.log("🧹 All F1 cache cleared");
    },
    
    clearErgast: () => {
      clearNamespace('ergast');
      console.log("🧹 Ergast cache cleared");
    },
    
    get: (key: string, namespace?: string) => {
      return getStale(key, namespace);
    },
    
    test: async () => {
      console.log("🧪 Testing cache with driver standings...");
      const { getDriverStandings } = await import("@/services/f1Service");
      
      console.time("First call (should be cache MISS)");
      await getDriverStandings(2024);
      console.timeEnd("First call (should be cache MISS)");
      
      console.time("Second call (should be cache HIT)");
      await getDriverStandings(2024);
      console.timeEnd("Second call (should be cache HIT)");
    }
  };
}


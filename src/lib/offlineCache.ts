/**
 * offlineCache — tiny read-through cache used to make a small set of employee
 * screens usable when the PWA is launched without internet connectivity.
 *
 * Design goals (see docs/pwa-offline-plan.md):
 *  - Only cache what an employee is most likely to check offline: today's
 *    shift, recent attendance records, their own profile and leave balance.
 *  - Keep entries for at most 24h; anything older is treated as unavailable.
 *  - Version bust with the build hash so a breaking schema change invalidates
 *    old persisted data cleanly.
 *  - Stay dependency-free. localStorage is plenty for the <100 KB of JSON we
 *    expect to store and it survives page reloads and PWA restarts.
 *  - Never block writes: a mutation must still fail loudly when offline, per
 *    the policy that all writes require a live connection.
 */

const STORAGE_PREFIX = 'alssaa.offlineCache.v1:';
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Pull a stable-ish version string from Vite's define-injected env. The
// fallback keeps tests and development happy. When you ship a new release
// with a different VITE_APP_VERSION (or a different build hash), any entry
// stored under a different buster is ignored and will be overwritten on the
// next successful fetch.
function resolveCacheBuster(): string {
  try {
    // Vite exposes import.meta.env as a plain object at build time.
    const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
    return env.VITE_APP_VERSION || env.VITE_BUILD_ID || 'dev';
  } catch {
    return 'dev';
  }
}

const CACHE_BUSTER = resolveCacheBuster();

interface StoredEntry<T> {
  /** ms since epoch when the value was saved. */
  t: number;
  /** build/version string; mismatches are treated as misses. */
  v: string;
  /** the cached payload. */
  d: T;
}

export interface CachedValue<T> {
  data: T;
  /** Date the value was written. */
  fetchedAt: Date;
  /** Whether the cached value has exceeded the configured maxAge. */
  isStale: boolean;
}

function storageKey(key: string): string {
  return STORAGE_PREFIX + key;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Read an entry out of the persistent cache. Returns null on miss, on parse
 * errors, on version mismatch, or when the entry is older than `maxAgeMs`.
 */
export function readCache<T>(
  key: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS
): CachedValue<T> | null {
  const storage = safeStorage();
  if (!storage) return null;
  const raw = storage.getItem(storageKey(key));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredEntry<T>;
    if (!parsed || typeof parsed.t !== 'number') return null;
    if (parsed.v !== CACHE_BUSTER) {
      storage.removeItem(storageKey(key));
      return null;
    }
    const age = Date.now() - parsed.t;
    const isStale = age > maxAgeMs;
    if (isStale) {
      // Drop anything older than maxAge so we don't accidentally surface
      // multi-day-old data to the user.
      storage.removeItem(storageKey(key));
      return null;
    }
    return {
      data: parsed.d,
      fetchedAt: new Date(parsed.t),
      isStale: false,
    };
  } catch {
    return null;
  }
}

/**
 * Write a value to the persistent cache. Silently becomes a no-op if the
 * JSON payload cannot be serialised or the storage quota is exceeded.
 */
export function writeCache<T>(key: string, data: T): void {
  const storage = safeStorage();
  if (!storage) return;
  const entry: StoredEntry<T> = { t: Date.now(), v: CACHE_BUSTER, d: data };
  try {
    storage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Quota exceeded or circular value — we don't want caching failures to
    // break the user's session.
  }
}

/** Remove a single cache entry. */
export function invalidateCache(key: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(key));
  } catch {
    /* ignore */
  }
}

/** Drop every entry this module has written. Useful on logout. */
export function clearOfflineCache(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) storage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export interface CachedFetchOptions {
  /** Max age in milliseconds; defaults to 24h. */
  maxAgeMs?: number;
  /**
   * When true and the browser reports offline, skip the network entirely and
   * return the cached value if present. Otherwise falls through to the
   * default stale-while-revalidate behaviour (return cached immediately, let
   * the fetch run, write on success).
   */
  offlineFirst?: boolean;
}

export interface CachedFetchResult<T> {
  data: T;
  fetchedAt: Date;
  fromCache: boolean;
}

/**
 * Stale-while-revalidate helper:
 *  - If a fresh cache entry exists and the browser is offline, return it.
 *  - Otherwise attempt a live fetch; on success, write the result to cache
 *    and return it with a fresh timestamp.
 *  - If the fetch fails and a cache entry exists, return the cached value
 *    (marked `fromCache: true`) and swallow the error so the UI can still
 *    render last-known data.
 *  - If the fetch fails and there is no cache, rethrow the original error so
 *    the caller can display its usual offline/error state.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CachedFetchOptions = {}
): Promise<CachedFetchResult<T>> {
  const { maxAgeMs = DEFAULT_MAX_AGE_MS } = options;
  const cached = readCache<T>(key, maxAgeMs);
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (cached && isOffline) {
    return { data: cached.data, fetchedAt: cached.fetchedAt, fromCache: true };
  }

  try {
    const data = await fetcher();
    writeCache(key, data);
    return { data, fetchedAt: new Date(), fromCache: false };
  } catch (error) {
    if (cached) {
      return { data: cached.data, fetchedAt: cached.fetchedAt, fromCache: true };
    }
    throw error;
  }
}

import { useEffect, useRef } from 'react';

/**
 * useVisibilityRefetch — call `onRefetch` whenever the tab/PWA window becomes
 * visible again after being hidden. This is the plain-React replacement for
 * TanStack Query's `refetchOnWindowFocus` and is meant to keep the user's data
 * fresh when they come back to the PWA after backgrounding it.
 *
 * The callback is also fired when the user comes back online from an offline
 * state while the page is visible, because in that case the currently shown
 * data was most likely served from the service worker cache and is stale.
 *
 * The callback is debounced to a single invocation per visibility cycle and is
 * skipped while the page is still hidden / offline.
 */
export function useVisibilityRefetch(
  onRefetch: () => void,
  options?: { enabled?: boolean; minIntervalMs?: number }
) {
  const enabled = options?.enabled ?? true;
  const minIntervalMs = options?.minIntervalMs ?? 5_000;
  const callbackRef = useRef(onRefetch);
  const lastRunRef = useRef<number>(0);

  // Keep the latest callback without re-subscribing every render.
  useEffect(() => {
    callbackRef.current = onRefetch;
  }, [onRefetch]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    const maybeRun = () => {
      if (document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const nowMs = Date.now();
      if (nowMs - lastRunRef.current < minIntervalMs) return;
      lastRunRef.current = nowMs;
      try {
        callbackRef.current();
      } catch (error) {
        console.warn('[useVisibilityRefetch] refetch callback failed', error);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') maybeRun();
    };
    const onOnline = () => maybeRun();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, minIntervalMs]);
}

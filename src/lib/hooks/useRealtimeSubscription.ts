import { useEffect, useRef, useCallback } from 'react';

/**
 * Manages a Supabase Realtime subscription tied to a React component lifecycle.
 *
 * @param subscribe - Factory that sets up the channel and returns an unsubscribe teardown.
 *                    Return `undefined` to skip subscribing (e.g. when deps aren't ready).
 * @param deps     - Re-subscribe whenever these values change (same semantics as useEffect deps).
 */
export function useRealtimeSubscription(
  subscribe: () => (() => void) | undefined,
  deps: React.DependencyList
) {
  const unsubRef = useRef<(() => void) | undefined>();

  const teardown = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = undefined;
  }, []);

  useEffect(() => {
    teardown();
    try {
      unsubRef.current = subscribe();
    } catch (err) {
      console.warn('[useRealtimeSubscription] subscribe failed (e.g. network/realtime unavailable):', err);
      unsubRef.current = undefined;
    }
    return () => {
      try {
        teardown();
      } catch (err) {
        console.warn('[useRealtimeSubscription] teardown error:', err);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

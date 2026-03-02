import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import * as time from '@/lib/time';

const DEV_TIME_STORAGE_KEY = 'devTimeOverride';

export type SpeedMultiplier = 1 | 10 | 60;

export interface DevTimeOverride {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  speed: SpeedMultiplier;
  startedAt: number; // real timestamp
}

interface DevTimeContextType {
  now: () => Date;
  isOverrideActive: boolean;
  override: DevTimeOverride | null;
  setOverride: (date: string, time: string, speed: SpeedMultiplier) => void;
  reset: () => void;
}

const DevTimeContext = createContext<DevTimeContextType | undefined>(undefined);

function parseStored(data: string | null): DevTimeOverride | null {
  if (!data) return null;
  try {
    const o = JSON.parse(data) as DevTimeOverride;
    if (o?.date && o?.time && o?.speed && typeof o.startedAt === 'number') return o;
  } catch {
    /* ignore */
  }
  return null;
}

function computeSimulatedNow(o: DevTimeOverride): Date {
  const base = new Date(`${o.date}T${o.time}`);
  const elapsed = (Date.now() - o.startedAt) * o.speed;
  return new Date(base.getTime() + elapsed);
}

export function DevTimeProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<DevTimeOverride | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseStored(localStorage.getItem(DEV_TIME_STORAGE_KEY));
  });

  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setOverride = useCallback((date: string, timeStr: string, speed: SpeedMultiplier) => {
    const next: DevTimeOverride = { date, time: timeStr, speed, startedAt: Date.now() };
    setOverrideState(next);
    localStorage.setItem(DEV_TIME_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const reset = useCallback(() => {
    setOverrideState(null);
    localStorage.removeItem(DEV_TIME_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!override) {
      time.setNowFn(() => new Date());
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    time.setNowFn(() => computeSimulatedNow(override));

    intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [override]);

  const now = useCallback(() => {
    if (override) return computeSimulatedNow(override);
    return new Date();
  }, [override, tick]);

  const value: DevTimeContextType = {
    now,
    isOverrideActive: override != null,
    override,
    setOverride,
    reset,
  };

  return <DevTimeContext.Provider value={value}>{children}</DevTimeContext.Provider>;
}

export function useDevTime(): DevTimeContextType | undefined {
  return useContext(DevTimeContext);
}

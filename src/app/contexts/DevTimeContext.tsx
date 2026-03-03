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

export const DEV_TIME_STORAGE_KEY = 'devTimeOverride';
export const DEV_LOGS_STORAGE_KEY = 'devAttendanceLogs';

export type SpeedMultiplier = 1 | 60;

export interface DevTimeOverride {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  speed: SpeedMultiplier;
  startedAt: number; // real timestamp
}

export type DevAttendanceStatus = 'present' | 'late' | 'absent' | 'on_leave';

export interface DevAttendanceLog {
  id: string;
  org_id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: DevAttendanceStatus;
  is_dev: true;
}

interface DevTimeContextType {
  now: () => Date;
  isOverrideActive: boolean;
  override: DevTimeOverride | null;
  setOverride: (date: string, time: string, speed: SpeedMultiplier) => void;
  reset: () => void;
  getDevLog: (userId: string, date: string) => DevAttendanceLog | null;
  setDevLog: (userId: string, date: string, log: DevAttendanceLog) => void;
  clearDevLogs: () => void;
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

function devLogKey(userId: string, date: string): string {
  return `${userId}:${date}`;
}

export function getDevLogFromStorage(userId: string, date: string): DevAttendanceLog | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEV_LOGS_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, DevAttendanceLog>;
    return map[devLogKey(userId, date)] ?? null;
  } catch {
    return null;
  }
}

export function setDevLogInStorage(userId: string, date: string, log: DevAttendanceLog): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(DEV_LOGS_STORAGE_KEY);
    const map: Record<string, DevAttendanceLog> = raw ? JSON.parse(raw) : {};
    map[devLogKey(userId, date)] = log;
    localStorage.setItem(DEV_LOGS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function clearDevLogsFromStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEV_LOGS_STORAGE_KEY);
}

/** Check if dev time override is active (for use outside React, e.g. in services) */
export function isDevModeActive(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(DEV_TIME_STORAGE_KEY);
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

  const getDevLog = useCallback((userId: string, date: string) => getDevLogFromStorage(userId, date), []);
  const setDevLog = useCallback((userId: string, date: string, log: DevAttendanceLog) => {
    setDevLogInStorage(userId, date, log);
  }, []);
  const clearDevLogs = useCallback(() => clearDevLogsFromStorage(), []);

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

    intervalRef.current = setInterval(() => {
      // Advance tick so consumers re-render
      setTick((t) => t + 1);
    }, 1000);

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
    getDevLog,
    setDevLog,
    clearDevLogs,
  };

  return <DevTimeContext.Provider value={value}>{children}</DevTimeContext.Provider>;
}

export function useDevTime(): DevTimeContextType | undefined {
  return useContext(DevTimeContext);
}

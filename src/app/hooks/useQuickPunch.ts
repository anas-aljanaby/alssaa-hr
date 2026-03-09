import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import * as attendanceService from '@/lib/services/attendance.service';
import type { AttendanceLog, TodayRecord } from '@/lib/services/attendance.service';

const COOLDOWN_SECONDS = 60;

const EMPTY_TODAY: TodayRecord = { log: null, punches: [], shift: null };

interface UseQuickPunchOptions {
  userId?: string;
  onLogUpdated?: (log: AttendanceLog | null) => void;
}

export function useQuickPunch({ userId, onLogUpdated }: UseQuickPunchOptions) {
  const { checkIn, checkOut } = useApp();

  const [today, setToday] = useState<TodayRecord>(EMPTY_TODAY);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshToday = useCallback(async () => {
    if (!userId) return;
    try {
      const record = await attendanceService.getAttendanceToday(userId);
      setToday(record);
      onLogUpdated?.(record.log);
    } finally {
      setLoading(false);
    }
  }, [userId, onLogUpdated]);

  useEffect(() => {
    if (!userId) {
      setToday(EMPTY_TODAY);
      setLoading(false);
      return;
    }
    setLoading(true);
    refreshToday();
  }, [userId, refreshToday]);

  const startCooldown = () => {
    setCooldownSecondsLeft(COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleCheckIn = useCallback(async () => {
    if (!userId || actionLoading || cooldownSecondsLeft > 0) return;
    setActionLoading(true);
    try {
      const result = await checkIn(userId);
      if (navigator.vibrate) navigator.vibrate(100);
      startCooldown();
      onLogUpdated?.(result.log);
      await refreshToday();
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, checkIn, cooldownSecondsLeft, onLogUpdated, refreshToday, userId]);

  const handleCheckOut = useCallback(async () => {
    if (!userId || actionLoading) return;
    setActionLoading(true);
    try {
      const result = await checkOut(userId);
      if (navigator.vibrate) navigator.vibrate(100);
      setToday((prev) => ({ ...prev, log: result }));
      onLogUpdated?.(result);
      try {
        await refreshToday();
      } catch {
        // Keep optimistic log if refresh fails.
      }
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, checkOut, onLogUpdated, refreshToday, userId]);

  return {
    today,
    loading,
    actionLoading,
    cooldownSecondsLeft,
    handleCheckIn,
    handleCheckOut,
    refreshToday,
  };
}

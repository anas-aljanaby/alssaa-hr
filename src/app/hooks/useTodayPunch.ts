import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import * as attendanceService from '@/lib/services/attendance.service';
import type { AttendanceLog, TodayRecord } from '@/lib/services/attendance.service';
import { isOfflineError } from '@/lib/network';

const EMPTY_TODAY: TodayRecord = { log: null, punches: [], shift: null };

interface UseTodayPunchOptions {
  userId?: string;
  onLogUpdated?: (log: AttendanceLog | null) => void;
}

export function useTodayPunch({ userId, onLogUpdated }: UseTodayPunchOptions) {
  const { checkIn, checkOut } = useApp();

  const [today, setToday] = useState<TodayRecord>(EMPTY_TODAY);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const actionInFlightRef = useRef(false);

  const refreshToday = useCallback(async () => {
    if (!userId) return;
    try {
      const record = await attendanceService.getAttendanceToday(userId);
      setLoadError(null);
      setToday(record);
      onLogUpdated?.(record.log);
    } catch (error) {
      setToday(EMPTY_TODAY);
      setLoadError(
        isOfflineError(error)
          ? 'تعذر تحميل حالة اليوم بدون اتصال بالإنترنت.'
          : 'فشل تحميل حالة الحضور الحالية.'
      );
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

  const handleCheckIn = useCallback(async () => {
    if (!userId || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActionLoading(true);
    try {
      const result = await checkIn(userId);
      if (navigator.vibrate) navigator.vibrate(100);
      onLogUpdated?.(result.log);
      await refreshToday();
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(false);
    }
  }, [checkIn, onLogUpdated, refreshToday, userId]);

  const handleCheckOut = useCallback(async () => {
    if (!userId || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActionLoading(true);
    try {
      const result = await checkOut(userId);
      if (navigator.vibrate) navigator.vibrate(100);
      setToday((prev) => ({ ...prev, log: result.log }));
      onLogUpdated?.(result.log);
      try {
        await refreshToday();
      } catch {
        // Keep optimistic log if refresh fails.
      }
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(false);
    }
  }, [checkOut, onLogUpdated, refreshToday, userId]);

  return {
    today,
    loading,
    loadError,
    actionLoading,
    handleCheckIn,
    handleCheckOut,
    refreshToday,
  };
}

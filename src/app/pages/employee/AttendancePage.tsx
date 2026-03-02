import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';
import * as attendanceService from '@/lib/services/attendance.service';
import type { TodayRecord, MonthDaySummary } from '@/lib/services/attendance.service';
import { now } from '@/lib/time';
import { TodayStatusCard } from '../../components/attendance/TodayStatusCard';
import { TodayPunchLog } from '../../components/attendance/TodayPunchLog';
import { MonthCalendarHeatmap } from '../../components/attendance/MonthCalendarHeatmap';
import { DayDetailsSheet } from '../../components/attendance/DayDetailsSheet';

const COOLDOWN_SECONDS = 60;

export function AttendancePage() {
  const { currentUser } = useAuth();
  const { checkIn, checkOut } = useApp();

  const [today, setToday] = useState<TodayRecord>({ log: null, punches: [], shift: null });
  const [todayLoading, setTodayLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(now().getMonth());
  const [selectedYear, setSelectedYear] = useState(now().getFullYear());
  const [monthlySummaries, setMonthlySummaries] = useState<MonthDaySummary[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    if (!currentUser) return;
    try {
      const record = await attendanceService.getAttendanceToday(currentUser.uid);
      setToday(record);
    } catch {
      toast.error('فشل تحميل بيانات الحضور');
    } finally {
      setTodayLoading(false);
    }
  }, [currentUser?.uid]);

  const loadMonthly = useCallback(async () => {
    if (!currentUser) return;
    setMonthlyLoading(true);
    try {
      const summaries = await attendanceService.getAttendanceMonthly(currentUser.uid, selectedYear, selectedMonth);
      setMonthlySummaries(summaries);
    } catch {
      // Non-critical, silently fail
    } finally {
      setMonthlyLoading(false);
    }
  }, [currentUser?.uid, selectedYear, selectedMonth]);

  // Initial load — today and monthly in parallel
  useEffect(() => {
    if (!currentUser) return;
    setTodayLoading(true);
    Promise.all([loadToday(), loadMonthly()]);
  }, [loadToday, loadMonthly]);

  // Visibility refresh
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentUser) {
        loadToday();
        loadMonthly();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadToday, loadMonthly, currentUser]);

  const startCooldown = () => {
    setCooldownLeft(COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownLeft((prev) => {
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

  const getCoords = (): Promise<{ lat: number; lng: number } | undefined> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(undefined),
        { timeout: 5000 }
      );
    });

  const handleCheckIn = async () => {
    if (!currentUser || actionLoading || cooldownLeft > 0) return;
    setActionLoading(true);
    try {
      const coords = await getCoords();
      const result = await checkIn(currentUser.uid, coords);
      if (navigator.vibrate) navigator.vibrate(100);
      startCooldown();
      const updated = await attendanceService.getAttendanceToday(currentUser.uid);
      setToday({ ...updated, log: result });
      loadMonthly();
    } catch {
      // toast handled by context
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!currentUser || actionLoading || cooldownLeft > 0) return;
    setActionLoading(true);
    try {
      const coords = await getCoords();
      const result = await checkOut(currentUser.uid, coords);
      if (navigator.vibrate) navigator.vibrate(100);
      startCooldown();
      const updated = await attendanceService.getAttendanceToday(currentUser.uid);
      setToday({ ...updated, log: result });
      loadMonthly();
    } catch {
      // toast handled by context
    } finally {
      setActionLoading(false);
    }
  };

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    const currentNow = now();
    const isAtCurrentMonth =
      selectedYear === currentNow.getFullYear() && selectedMonth === currentNow.getMonth();
    if (isAtCurrentMonth) return;

    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  if (!currentUser) return null;

  const isCheckedIn = !!(today.log?.check_in_time && !today.log?.check_out_time);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">
      <h1 className="text-gray-800 font-semibold text-lg">الحضور والانصراف</h1>

      {/* Section 1: Today's Status Card */}
      {todayLoading ? (
        <div className="bg-gray-100 rounded-2xl h-64 animate-pulse" />
      ) : (
        <TodayStatusCard
          today={today}
          actionLoading={actionLoading}
          cooldownSecondsLeft={cooldownLeft}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
        />
      )}

      {/* Section 2: Today's Punch Log */}
      {todayLoading ? (
        <div className="bg-gray-100 rounded-2xl h-28 animate-pulse" />
      ) : (
        <TodayPunchLog punches={today.punches} isCheckedIn={isCheckedIn} />
      )}

      {/* Section 3: Monthly Calendar Heatmap */}
      <MonthCalendarHeatmap
        year={selectedYear}
        month={selectedMonth}
        summaries={monthlySummaries}
        loading={monthlyLoading}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onDayTap={setSelectedDay}
      />

      {/* Day Details Bottom Sheet */}
      <DayDetailsSheet
        userId={currentUser.uid}
        date={selectedDay}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}

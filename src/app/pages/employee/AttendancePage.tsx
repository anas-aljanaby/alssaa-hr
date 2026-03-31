import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDevTime } from '../../contexts/DevTimeContext';
import { toast } from 'sonner';
import * as attendanceService from '@/lib/services/attendance.service';
import type { TodayRecord, MonthDaySummary } from '@/lib/services/attendance.service';
import { now } from '@/lib/time';
import { TodayPunchLog } from '../../components/attendance/TodayPunchLog';
import { MonthCalendarHeatmap } from '../../components/attendance/MonthCalendarHeatmap';
import { DayDetailsSheet } from '../../components/attendance/DayDetailsSheet';

export function AttendancePage() {
  const { currentUser } = useAuth();
  const devTime = useDevTime();

  const [today, setToday] = useState<TodayRecord>({ log: null, punches: [], shift: null });
  const [todayLoading, setTodayLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(now().getMonth());
  const [selectedYear, setSelectedYear] = useState(now().getFullYear());
  const [monthlySummaries, setMonthlySummaries] = useState<MonthDaySummary[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(true);

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

  // Refresh today when dev toolbar date changes
  useEffect(() => {
    if (devTime?.override?.date && currentUser) {
      loadToday();
    }
  }, [devTime?.override?.date, loadToday, currentUser]);

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

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">
      <h1 className="text-gray-800 font-semibold text-lg">الحضور والانصراف</h1>

      {/* Section 1: Monthly Calendar Heatmap */}
      <MonthCalendarHeatmap
        year={selectedYear}
        month={selectedMonth}
        summaries={monthlySummaries}
        loading={monthlyLoading}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onDayTap={setSelectedDay}
      />

      {/* Section 2: Daily Punch Log */}
      {todayLoading ? (
        <div className="bg-gray-100 rounded-2xl h-28 animate-pulse" />
      ) : (
        <TodayPunchLog punches={today.punches} isCheckedIn={attendanceService.isCheckedInToday(today)} />
      )}

      {/* Day Details Bottom Sheet */}
      <DayDetailsSheet
        userId={currentUser.uid}
        date={selectedDay}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}

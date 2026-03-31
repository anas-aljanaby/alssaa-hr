import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDevTime } from '../../contexts/DevTimeContext';
import { toast } from 'sonner';
import * as attendanceService from '@/lib/services/attendance.service';
import type { MonthDaySummary, AttendanceSession } from '@/lib/services/attendance.service';
import { now } from '@/lib/time';
import { TodayPunchLog } from '../../components/attendance/TodayPunchLog';
import { MonthCalendarHeatmap } from '../../components/attendance/MonthCalendarHeatmap';

export function AttendancePage() {
  const { currentUser } = useAuth();
  const devTime = useDevTime();

  const [selectedMonth, setSelectedMonth] = useState(now().getMonth());
  const [selectedYear, setSelectedYear] = useState(now().getFullYear());
  const [monthlySummaries, setMonthlySummaries] = useState<MonthDaySummary[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(true);

  const [selectedLogDate, setSelectedLogDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

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

  const loadSessions = useCallback(async (date?: string | null) => {
    if (!currentUser) return;
    setSessionsLoading(true);
    try {
      const data = await attendanceService.getAttendanceSessions(currentUser.uid, date ?? undefined);
      setSessions(data);
    } catch {
      setSessions([]);
      toast.error(date ? 'فشل تحميل جلسات اليوم المحدد' : 'فشل تحميل جلسات الحضور');
    } finally {
      setSessionsLoading(false);
    }
  }, [currentUser?.uid]);

  // Initial load — monthly summaries and sessions in parallel
  useEffect(() => {
    if (!currentUser) return;
    Promise.all([loadMonthly(), loadSessions()]);
  }, [loadMonthly, loadSessions, currentUser]);

  // Visibility refresh
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentUser) {
        loadMonthly();
        loadSessions(selectedLogDate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadMonthly, loadSessions, selectedLogDate, currentUser]);

  // Refresh today when dev toolbar date changes
  useEffect(() => {
    if (devTime?.override?.date && currentUser) {
      loadSessions(selectedLogDate);
    }
  }, [devTime?.override?.date, loadSessions, selectedLogDate, currentUser]);

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

  const isShowingFilteredDate = !!selectedLogDate;
  const selectedDateLabel = selectedLogDate
    ? new Date(`${selectedLogDate}T00:00:00`).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      numberingSystem: 'latn',
    })
    : null;
  const logTitle = isShowingFilteredDate ? `جلسات ${selectedDateLabel}` : 'سجل الجلسات';
  const logLoading = sessionsLoading;

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
        onDayTap={(date) => {
          const nextDate = selectedLogDate === date ? null : date;
          setSelectedLogDate(nextDate);
          loadSessions(nextDate);
        }}
      />

      {/* Section 2: Sessions list */}
      {logLoading ? (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
          <div className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
          <div className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
        </div>
      ) : (
        <TodayPunchLog
          sessions={sessions}
          selectedDate={selectedLogDate}
          onClearFilter={() => {
            setSelectedLogDate(null);
            loadSessions(null);
          }}
          title={logTitle}
        />
      )}
    </div>
  );
}

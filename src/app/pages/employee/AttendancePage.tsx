import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useDevTime } from '../../contexts/DevTimeContext';
import { toast } from 'sonner';
import * as attendanceService from '@/lib/services/attendance.service';
import type {
  MonthDaySummary,
  AttendanceSession,
  CalendarStatus,
} from '@/lib/services/attendance.service';
import { now } from '@/lib/time';
import {
  TodayPunchLog,
  type AttendanceListItem,
} from '../../components/attendance/TodayPunchLog';
import { MonthCalendarHeatmap } from '../../components/attendance/MonthCalendarHeatmap';
import { getStatusTheme } from '../../components/attendance/attendanceStatusTheme';

type StatusFilter = 'present' | 'late' | 'absent' | 'on_leave' | 'overtime' | null;

const FILTER_OPTIONS: Array<{ key: Exclude<StatusFilter, null>; label: string }> = [
  { key: 'present', label: getStatusTheme('present').label },
  { key: 'late', label: getStatusTheme('late').label },
  { key: 'absent', label: getStatusTheme('absent').label },
  { key: 'on_leave', label: getStatusTheme('on_leave').label },
  { key: 'overtime', label: 'عمل إضافي' },
];

function formatMonthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function parseMonthParam(raw: string | null): { year: number; month: number } | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) return null;
  return { year, month };
}

function mapUrlStatusToFilter(raw: string | null): StatusFilter {
  if (!raw) return null;
  if (raw === 'overtime_only' || raw === 'overtime_offday') return 'overtime';
  if (raw === 'present' || raw === 'late' || raw === 'absent' || raw === 'on_leave') return raw;
  return null;
}

function isOvertimeStatus(status: CalendarStatus): boolean {
  return status === 'overtime_only' || status === 'overtime_offday';
}

export function AttendancePage() {
  const { currentUser } = useAuth();
  const devTime = useDevTime();
  const [searchParams, setSearchParams] = useSearchParams();

  const parsedMonth = parseMonthParam(searchParams.get('month'));
  const initialMonth = parsedMonth ?? { year: now().getFullYear(), month: now().getMonth() };
  const initialStatus = mapUrlStatusToFilter(searchParams.get('status'));

  const [selectedMonth, setSelectedMonth] = useState(initialMonth.month);
  const [selectedYear, setSelectedYear] = useState(initialMonth.year);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthDaySummary[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(true);

  const [selectedLogDate, setSelectedLogDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [allSessions, setAllSessions] = useState<AttendanceSession[]>([]);
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

  const loadSessions = useCallback(async () => {
    if (!currentUser) return;
    setSessionsLoading(true);
    try {
      const data = await attendanceService.getAttendanceSessions(currentUser.uid);
      setAllSessions(data);
    } catch {
      setAllSessions([]);
      toast.error('فشل تحميل جلسات الحضور');
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
        loadSessions();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadMonthly, loadSessions, currentUser]);

  // Refresh today when dev toolbar date changes
  useEffect(() => {
    if (devTime?.override?.date && currentUser) {
      loadSessions();
    }
  }, [devTime?.override?.date, loadSessions, currentUser]);

  useEffect(() => {
    const monthFromUrl = parseMonthParam(searchParams.get('month'));
    const statusFromUrl = mapUrlStatusToFilter(searchParams.get('status'));
    if (monthFromUrl) {
      setSelectedYear(monthFromUrl.year);
      setSelectedMonth(monthFromUrl.month);
    }
    setStatusFilter(statusFromUrl);
    if (statusFromUrl) setSelectedLogDate(null);
  }, [searchParams]);

  const updateUrlParams = useCallback((nextYear: number, nextMonth: number, nextStatus: StatusFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('month', formatMonthParam(nextYear, nextMonth));
    if (nextStatus) {
      nextParams.set('status', nextStatus);
    } else {
      nextParams.delete('status');
    }
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const prevMonth = () => {
    let nextMonth = selectedMonth;
    let nextYear = selectedYear;
    if (selectedMonth === 0) {
      nextMonth = 11;
      nextYear = selectedYear - 1;
    } else {
      nextMonth = selectedMonth - 1;
    }
    setSelectedMonth(nextMonth);
    setSelectedYear(nextYear);
    setSelectedLogDate(null);
    updateUrlParams(nextYear, nextMonth, statusFilter);
  };

  const nextMonth = () => {
    const currentNow = now();
    const isAtCurrentMonth =
      selectedYear === currentNow.getFullYear() && selectedMonth === currentNow.getMonth();
    if (isAtCurrentMonth) return;

    let nextMonthValue = selectedMonth;
    let nextYearValue = selectedYear;
    if (selectedMonth === 11) {
      nextMonthValue = 0;
      nextYearValue = selectedYear + 1;
    } else {
      nextMonthValue = selectedMonth + 1;
    }
    setSelectedMonth(nextMonthValue);
    setSelectedYear(nextYearValue);
    setSelectedLogDate(null);
    updateUrlParams(nextYearValue, nextMonthValue, statusFilter);
  };

  if (!currentUser) return null;

  const summaryMap = useMemo(
    () => new Map(monthlySummaries.map((s) => [s.date, s.status])),
    [monthlySummaries]
  );
  const monthParam = formatMonthParam(selectedYear, selectedMonth);
  const monthPrefix = `${monthParam}-`;

  const monthSessions = useMemo(
    () => allSessions.filter((s) => s.date.startsWith(monthPrefix)),
    [allSessions, monthPrefix]
  );

  const dateScopedSessions = useMemo(
    () => (selectedLogDate ? monthSessions.filter((s) => s.date === selectedLogDate) : monthSessions),
    [monthSessions, selectedLogDate]
  );

  const sessionMatchesFilter = useCallback((session: AttendanceSession) => {
    if (!statusFilter) return true;
    const dayStatus = summaryMap.get(session.date) ?? null;
    if (statusFilter === 'overtime') {
      return session.is_overtime || isOvertimeStatus(dayStatus);
    }
    return dayStatus === statusFilter;
  }, [statusFilter, summaryMap]);

  const visibleSessions = useMemo(
    () => dateScopedSessions.filter(sessionMatchesFilter),
    [dateScopedSessions, sessionMatchesFilter]
  );

  const absentItems = useMemo<AttendanceListItem[]>(() => {
    const includeAbsent = !statusFilter || statusFilter === 'absent';
    if (!includeAbsent) return [];
    return monthlySummaries
      .filter((summary) => summary.status === 'absent')
      .filter((summary) => !selectedLogDate || summary.date === selectedLogDate)
      .map((summary) => ({
        kind: 'absent_day',
        date: summary.date,
      }));
  }, [monthlySummaries, selectedLogDate, statusFilter]);

  const listItems = useMemo<AttendanceListItem[]>(() => {
    const sessionItems: AttendanceListItem[] = visibleSessions.map((session) => ({
      kind: 'session',
      session,
    }));
    return [...sessionItems, ...absentItems].sort((a, b) => {
      const aDate = a.kind === 'session' ? a.session.date : a.date;
      const bDate = b.kind === 'session' ? b.session.date : b.date;
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      const aTime = a.kind === 'session' ? a.session.check_in_time : '00:00';
      const bTime = b.kind === 'session' ? b.session.check_in_time : '00:00';
      return bTime.localeCompare(aTime);
    });
  }, [visibleSessions, absentItems]);

  const isShowingFilteredDate = !!selectedLogDate;
  const selectedDateLabel = selectedLogDate
    ? new Date(`${selectedLogDate}T00:00:00`).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      numberingSystem: 'latn',
    })
    : null;
  const filterTitle = FILTER_OPTIONS.find((f) => f.key === statusFilter)?.label;
  const logTitle = isShowingFilteredDate
    ? `جلسات ${selectedDateLabel}`
    : statusFilter
      ? `${filterTitle} - ${monthParam}`
      : `سجل الشهر - ${monthParam}`;
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
          if (statusFilter) return;
          const nextDate = selectedLogDate === date ? null : date;
          setSelectedLogDate(nextDate);
        }}
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => {
            const active = statusFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  const nextStatus = active ? null : opt.key;
                  setStatusFilter(nextStatus);
                  setSelectedLogDate(null);
                  updateUrlParams(selectedYear, selectedMonth, nextStatus);
                }}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          {(statusFilter || selectedLogDate) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter(null);
                setSelectedLogDate(null);
                updateUrlParams(selectedYear, selectedMonth, null);
              }}
              className="px-3 py-1.5 rounded-full text-xs border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Section 2: Sessions list */}
      {logLoading ? (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
          <div className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
          <div className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
        </div>
      ) : (
        <TodayPunchLog
          items={listItems}
          selectedDate={selectedLogDate}
          onClearFilter={() => {
            setSelectedLogDate(null);
            setStatusFilter(null);
            updateUrlParams(selectedYear, selectedMonth, null);
          }}
          title={logTitle}
        />
      )}
    </div>
  );
}

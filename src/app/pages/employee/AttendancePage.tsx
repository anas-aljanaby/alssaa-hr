import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTopBar } from '../../contexts/AppTopBarContext';
import * as attendanceService from '@/lib/services/attendance.service';
import type {
  AttendanceHistoryDay,
  MonthDaySummary,
} from '@/lib/services/attendance.service';
import { AttendanceHistoryList } from '../../components/attendance/AttendanceHistoryList';
import { MonthCalendarHeatmap } from '../../components/attendance/MonthCalendarHeatmap';
import { getStatusConfig } from '@/shared/attendance';

type StatusFilter =
  | 'fulfilled_shift'
  | 'incomplete_shift'
  | 'late'
  | 'absent'
  | 'on_leave'
  | 'overtime'
  | null;

const FILTER_OPTIONS: Array<{ key: Exclude<StatusFilter, null>; label: string }> = [
  { key: 'fulfilled_shift', label: getStatusConfig('fulfilled_shift').label },
  { key: 'incomplete_shift', label: getStatusConfig('incomplete_shift').label },
  { key: 'late', label: getStatusConfig('late').label },
  { key: 'absent', label: getStatusConfig('absent').label },
  { key: 'on_leave', label: getStatusConfig('on_leave').label },
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
  if (raw === 'present') return 'fulfilled_shift';
  if (raw === 'overtime' || raw === 'overtime_only' || raw === 'overtime_offday') return 'overtime';
  if (
    raw === 'fulfilled_shift' ||
    raw === 'incomplete_shift' ||
    raw === 'late' ||
    raw === 'absent' ||
    raw === 'on_leave'
  ) {
    return raw;
  }
  return null;
}

function matchesFilter(day: AttendanceHistoryDay, filter: StatusFilter): boolean {
  if (!filter) return true;
  if (filter === 'overtime') return day.hasOvertime;
  return day.primaryState === filter;
}

function formatSelectedDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ar-IQ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AttendancePage() {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const parsedMonth = parseMonthParam(searchParams.get('month'));
  const initialMonth = parsedMonth ?? { year: new Date().getFullYear(), month: new Date().getMonth() };
  const initialStatus = mapUrlStatusToFilter(searchParams.get('status'));

  const [selectedMonth, setSelectedMonth] = useState(initialMonth.month);
  const [selectedYear, setSelectedYear] = useState(initialMonth.year);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthDaySummary[]>([]);
  const [historyDays, setHistoryDays] = useState<AttendanceHistoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);

  const loadMonthData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [summaries, monthHistory] = await Promise.all([
        attendanceService.getAttendanceMonthly(currentUser.uid, selectedYear, selectedMonth),
        attendanceService.getAttendanceHistoryMonth(currentUser.uid, selectedYear, selectedMonth),
      ]);
      setMonthlySummaries(summaries);
      setHistoryDays(monthHistory);
    } catch {
      setMonthlySummaries([]);
      setHistoryDays([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, selectedMonth, selectedYear]);

  useEffect(() => {
    if (!currentUser) return;
    void loadMonthData();
  }, [currentUser, loadMonthData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentUser) {
        void loadMonthData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentUser, loadMonthData]);

  useEffect(() => {
    const monthFromUrl = parseMonthParam(searchParams.get('month'));
    const statusFromUrl = mapUrlStatusToFilter(searchParams.get('status'));
    if (monthFromUrl) {
      setSelectedYear(monthFromUrl.year);
      setSelectedMonth(monthFromUrl.month);
    }
    setStatusFilter(statusFromUrl);
    if (statusFromUrl) setSelectedDate(null);
  }, [searchParams]);

  const updateUrlParams = useCallback(
    (nextYear: number, nextMonth: number, nextStatus: StatusFilter) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('month', formatMonthParam(nextYear, nextMonth));
      if (nextStatus) nextParams.set('status', nextStatus);
      else nextParams.delete('status');
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

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
    setSelectedDate(null);
    updateUrlParams(nextYear, nextMonth, statusFilter);
  };

  const nextMonth = () => {
    const currentNow = new Date();
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
    setSelectedDate(null);
    updateUrlParams(nextYearValue, nextMonthValue, statusFilter);
  };

  const visibleDays = useMemo(
    () =>
      historyDays.filter((day) => (!selectedDate || day.date === selectedDate) && matchesFilter(day, statusFilter)),
    [historyDays, selectedDate, statusFilter]
  );

  const monthParam = formatMonthParam(selectedYear, selectedMonth);
  const selectedDateLabel = selectedDate ? formatSelectedDateLabel(selectedDate) : null;
  const filterTitle = FILTER_OPTIONS.find((option) => option.key === statusFilter)?.label;
  const listTitle = selectedDateLabel
    ? `سجل ${selectedDateLabel}`
    : filterTitle
      ? `${filterTitle} - ${monthParam}`
      : `سجل الشهر - ${monthParam}`;

  useAppTopBar({
    title: currentUser ? 'الحضور والانصراف' : undefined,
    meta: monthParam,
  });

  if (!currentUser) return null;

  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 pb-24 pt-3">
      <MonthCalendarHeatmap
        year={selectedYear}
        month={selectedMonth}
        summaries={monthlySummaries}
        loading={loading}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onDayTap={(date) => {
          if (statusFilter) return;
          setSelectedDate((current) => (current === date ? null : date));
        }}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const active = statusFilter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  const nextStatus = active ? null : option.key;
                  setStatusFilter(nextStatus);
                  setSelectedDate(null);
                  updateUrlParams(selectedYear, selectedMonth, nextStatus);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            );
          })}
          {(statusFilter || selectedDate) ? (
            <button
              type="button"
              onClick={() => {
                setStatusFilter(null);
                setSelectedDate(null);
                updateUrlParams(selectedYear, selectedMonth, null);
              }}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 transition-colors hover:bg-blue-100"
            >
              مسح الفلاتر
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-40 animate-pulse rounded-3xl bg-gray-100" />
          <div className="h-40 animate-pulse rounded-3xl bg-gray-100" />
        </div>
      ) : (
        <AttendanceHistoryList
          days={visibleDays}
          title={listTitle}
          focusedDate={selectedDate}
          onClearFocus={
            selectedDate
              ? () => {
                  setSelectedDate(null);
                  if (statusFilter) {
                    setStatusFilter(null);
                    updateUrlParams(selectedYear, selectedMonth, null);
                  }
                }
              : undefined
          }
          emptyMessage={
            selectedDate
              ? 'لا توجد سجلات لهذا اليوم'
              : statusFilter
                ? `لا توجد سجلات بحالة ${filterTitle}`
                : 'لا توجد سجلات لهذا الشهر'
          }
        />
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Clock3, LogIn, LogOut } from 'lucide-react';
import type {
  AttendanceHistoryDay,
  AttendanceHistorySession,
} from '@/lib/services/attendance.service';
import { doesCheckOutCrossDay } from '@/lib/services/attendance.service';
import { getSessionTheme } from './attendanceStatusTheme';
import { cn } from '@/app/components/ui/utils';
import { StatusBadge } from '@/shared/components';

interface Props {
  days: AttendanceHistoryDay[];
  title?: string;
  emptyMessage: string;
  focusedDate?: string | null;
  onClearFocus?: () => void;
}

function formatDayDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(time: string | null): string {
  if (!time) return '—';
  return time.slice(0, 5);
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours <= 0) return `${remainder} د`;
  if (remainder <= 0) return `${hours} س`;
  return `${hours} س ${remainder} د`;
}

function sessionClassificationMeta(session: AttendanceHistorySession) {
  if (session.classification === 'overtime') {
    return {
      label: 'إضافي',
      theme: getSessionTheme('overtime'),
    };
  }

  if (session.classification === 'late') {
    return {
      label: 'متأخر',
      theme: getSessionTheme('late'),
    };
  }

  return {
    label: 'عادي',
    theme: getSessionTheme('present'),
  };
}

function SessionFlag({
  label,
  tone,
}: {
  label: string;
  tone: 'gray' | 'amber' | 'rose';
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : tone === 'rose'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${toneClass}`}>
      {label}
    </span>
  );
}

function SessionCard({ session }: { session: AttendanceHistorySession }) {
  const classification = sessionClassificationMeta(session);
  const checkOutIsNextDay = doesCheckOutCrossDay(session.checkInTime, session.checkOutTime);

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-slate-50 p-3"
      data-testid={`session-card-${session.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium"
            style={classification.theme.badgeSoftStyle}
          >
            {classification.label}
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {session.isEarlyDeparture ? <SessionFlag label="خروج مبكر" tone="amber" /> : null}
            {session.isAutoPunchOut ? <SessionFlag label="انصراف تلقائي" tone="gray" /> : null}
            {session.needsReview ? <SessionFlag label="تحتاج مراجعة" tone="rose" /> : null}
          </div>
        </div>

        <div className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-right">
          <p className="text-[11px] text-gray-500">مدة الجلسة</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{formatMinutes(session.durationMinutes)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <LogIn className="h-3.5 w-3.5 text-emerald-600" />
            <span>دخول</span>
          </div>
          <p className="mt-1 font-mono text-sm text-gray-900">{formatTime(session.checkInTime)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <LogOut className="h-3.5 w-3.5 text-rose-500" />
            <span>خروج</span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            <p className="font-mono text-sm text-gray-900">{formatTime(session.checkOutTime)}</p>
            {checkOutIsNextDay
              ? <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1">+1 يوم</span>
              : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DaySummaryMetric({ label, value, suffix }: { label: string; value: string; suffix?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <p className="text-sm font-medium text-gray-900">{value}</p>
        {suffix}
      </div>
    </div>
  );
}

function DayTag({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${className}`}>{label}</span>;
}

function AttendanceHistoryDayCard({
  day,
  expanded,
  onToggle,
}: {
  day: AttendanceHistoryDay;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isExpandable = day.sessions.length > 0;
  const lastCheckOutIsNextDay = doesCheckOutCrossDay(day.firstCheckIn, day.lastCheckOut);

  return (
    <div
      className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      data-testid={`day-card-${day.date}`}
    >
      <button
        type="button"
        onClick={isExpandable ? onToggle : undefined}
        disabled={!isExpandable}
        className={cn(
          'w-full px-4 py-4 text-right',
          isExpandable ? 'transition-colors hover:bg-slate-50' : 'cursor-default'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={day.primaryState} size="sm" />
              <p className="text-sm font-medium text-gray-900">{formatDayDate(day.date)}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {day.hasOvertime ? (
                <DayTag label="عمل إضافي" className="border-slate-300 bg-slate-50 text-slate-700" />
              ) : null}
              {day.hasAutoPunchOut ? (
                <DayTag label="انصراف تلقائي" className="border-slate-300 bg-slate-50 text-slate-700" />
              ) : null}
              {day.needsReview ? (
                <DayTag label="تحتاج مراجعة" className="border-rose-200 bg-rose-50 text-rose-700" />
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-xl border border-gray-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">الجلسات</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{day.sessionCount}</p>
            </div>
            {isExpandable ? (
              <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', expanded ? 'rotate-180' : '')} />
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <DaySummaryMetric label="أول دخول" value={formatTime(day.firstCheckIn)} />
          <DaySummaryMetric
            label="آخر خروج"
            value={formatTime(day.lastCheckOut)}
            suffix={
              lastCheckOutIsNextDay
                ? <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1">+1 يوم</span>
                : undefined
            }
          />
          <DaySummaryMetric label="عادي" value={formatMinutes(day.totalRegularMinutes)} />
          <DaySummaryMetric label="إضافي" value={formatMinutes(day.totalOvertimeMinutes)} />
          <DaySummaryMetric label="الإجمالي" value={formatMinutes(day.totalWorkedMinutes)} />
        </div>
      </button>

      {expanded && isExpandable ? (
        <div className="border-t border-gray-100 bg-slate-50/70 px-4 py-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
            <Clock3 className="h-3.5 w-3.5" />
            <span>سجل الجلسات</span>
          </div>
          <div className="space-y-2">
            {day.sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AttendanceHistoryList({
  days,
  title = 'سجل الحضور',
  emptyMessage,
  focusedDate = null,
  onClearFocus,
}: Props) {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!focusedDate) return;
    setExpandedDates((current) => ({ ...current, [focusedDate]: true }));
  }, [focusedDate]);

  useEffect(() => {
    setExpandedDates((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([date]) => days.some((day) => day.date === date))
      );
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [days]);

  const sortedDays = useMemo(
    () => [...days].sort((a, b) => b.date.localeCompare(a.date)),
    [days]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {focusedDate && onClearFocus ? (
          <button
            type="button"
            onClick={onClearFocus}
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-100"
          >
            عرض كل الأيام
          </button>
        ) : null}
      </div>

      {sortedDays.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center text-gray-400">
          <Clock3 className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDays.map((day) => (
            <AttendanceHistoryDayCard
              key={day.date}
              day={day}
              expanded={!!expandedDates[day.date]}
              onToggle={() =>
                setExpandedDates((current) => ({
                  ...current,
                  [day.date]: !current[day.date],
                }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  DayDetailsSheet,
  type DayDetailsSheetSummary,
} from '@/app/components/attendance/DayDetailsSheet';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { cn } from '@/app/components/ui/utils';
import * as attendanceService from '@/lib/services/attendance.service';
import * as departmentsService from '@/lib/services/departments.service';
import type { Department } from '@/lib/services/departments.service';
import type {
  SafeAttendanceDayRow,
  SafeAvailabilityRow,
  TeamAttendanceDayRow,
} from '@/lib/services/attendance.service';
import { now } from '@/lib/time';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  RefreshCcw,
  ShieldAlert,
} from 'lucide-react';

const ALL_DEPARTMENTS = '__all_departments__';
const NO_DEPARTMENT_KEY = '__no_department__';
const LIVE_REFRESH_INTERVAL_MS = 45_000;

type TeamAttendanceMode = 'live' | 'date';
type BoardTone = 'green' | 'amber' | 'red' | 'blue' | 'gray';
type BoardScope = 'full' | 'generic';
type BoardGroup = 'present' | 'not_present';
type AttendanceStatusFilter =
  | 'all'
  | 'present_now'
  | 'not_present_now'
  | 'late'
  | 'absent'
  | 'on_leave'
  | 'finished'
  | 'present_day'
  | 'not_present_day';

type BoardRowStatus =
  | 'present_now'
  | 'not_present_now'
  | 'late'
  | 'absent'
  | 'on_leave'
  | 'finished'
  | 'not_yet_punched'
  | 'present_day'
  | 'not_present_day';

interface AttendanceBoardRow {
  userId: string;
  nameAr: string;
  employeeId: string;
  role: 'employee' | 'manager' | 'admin';
  departmentId: string | null;
  departmentNameAr: string;
  scope: BoardScope;
  group: BoardGroup;
  statusKey: BoardRowStatus;
  statusLabel: string;
  statusTone: BoardTone;
  filterKeys: AttendanceStatusFilter[];
  metaText: string | null;
  factText: string | null;
  canViewDetailedStatus: boolean;
  canViewTimes: boolean;
  canOpenDetailsSheet: boolean;
  detailSummary: DayDetailsSheetSummary | null;
  sortRank: number;
}

interface BoardSection {
  id: string;
  name: string;
  summaryText: string;
  presentRows: AttendanceBoardRow[];
  notPresentRows: AttendanceBoardRow[];
  defaultExpanded: boolean;
}

interface StatusChipOption {
  key: AttendanceStatusFilter;
  label: string;
  tone: BoardTone;
  count: number;
}

interface BoardDataState {
  detailedRows: TeamAttendanceDayRow[];
  liveAvailabilityRows: SafeAvailabilityRow[];
  dayAvailabilityRows: SafeAttendanceDayRow[];
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDays(base: Date, amount: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + amount);
  return toDateInputValue(next);
}

function formatWallTime(time: string | null): string {
  if (!time) return '--:--';
  return time.slice(0, 5);
}

function formatLastUpdated(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('ar-IQ', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatSelectedDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

function roleMeta(role: AttendanceBoardRow['role']): string | null {
  if (role === 'manager') return 'مدير';
  return null;
}

function rowMetaText(employeeId: string, role: AttendanceBoardRow['role']): string {
  const meta = roleMeta(role);
  return meta ? `${employeeId} • ${meta}` : employeeId;
}

function toneClasses(tone: BoardTone): string {
  const classMap: Record<BoardTone, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return classMap[tone];
}

function resolveDetailedLiveStatus(row: TeamAttendanceDayRow): Exclude<
  BoardRowStatus,
  'not_present_now' | 'present_day' | 'not_present_day'
> {
  if (row.isCheckedInNow && row.displayStatus === 'late') return 'late';
  if (row.isCheckedInNow) return 'present_now';
  if (row.displayStatus === 'on_leave') return 'on_leave';
  if (row.displayStatus === 'absent') return 'absent';
  if (row.firstCheckIn || row.lastCheckOut || row.sessionCount > 0) return 'finished';
  return 'not_yet_punched';
}

function liveStatusLabel(status: BoardRowStatus): string {
  switch (status) {
    case 'present_now':
      return 'موجود الآن';
    case 'late':
      return 'متأخر';
    case 'absent':
      return 'غائب';
    case 'on_leave':
      return 'إجازة';
    case 'finished':
      return 'أنهى الدوام';
    case 'not_yet_punched':
      return 'لم يسجل بعد';
    case 'not_present_now':
      return 'غير موجود الآن';
    default:
      return 'موجود الآن';
  }
}

function liveStatusTone(status: BoardRowStatus): BoardTone {
  switch (status) {
    case 'present_now':
      return 'green';
    case 'late':
      return 'amber';
    case 'absent':
      return 'red';
    case 'on_leave':
      return 'blue';
    case 'finished':
    case 'not_yet_punched':
    case 'not_present_now':
      return 'gray';
    default:
      return 'gray';
  }
}

function dayStatusLabel(status: BoardRowStatus, isToday: boolean): string {
  if (status === 'present_day') return isToday ? 'حضر اليوم' : 'حضر';
  if (status === 'late') return isToday ? 'تأخر اليوم' : 'تأخر';
  if (status === 'absent') return isToday ? 'غائب اليوم' : 'غائب';
  if (status === 'on_leave') return isToday ? 'إجازة اليوم' : 'إجازة';
  return isToday ? 'غير حاضر اليوم' : 'غير حاضر';
}

function dayStatusTone(status: BoardRowStatus): BoardTone {
  switch (status) {
    case 'present_day':
      return 'green';
    case 'late':
      return 'amber';
    case 'absent':
      return 'red';
    case 'on_leave':
      return 'blue';
    case 'not_present_day':
      return 'gray';
    default:
      return 'gray';
  }
}

function buildDetailSummary(
  row: TeamAttendanceDayRow,
  statusLabel: string,
  statusTone: BoardTone
): DayDetailsSheetSummary {
  return {
    employeeName: row.nameAr,
    departmentName: row.departmentNameAr ?? 'بدون قسم',
    statusLabel,
    statusTone,
  };
}

function buildDetailedLiveRow(row: TeamAttendanceDayRow): AttendanceBoardRow {
  const statusKey = resolveDetailedLiveStatus(row);
  const group: BoardGroup =
    statusKey === 'present_now' || statusKey === 'late' ? 'present' : 'not_present';
  const statusLabel = liveStatusLabel(statusKey);
  const statusTone = liveStatusTone(statusKey);
  const filterKeys: AttendanceStatusFilter[] = [
    group === 'present' ? 'present_now' : 'not_present_now',
  ];

  if (statusKey === 'late') filterKeys.push('late');
  if (statusKey === 'absent') filterKeys.push('absent');
  if (statusKey === 'on_leave') filterKeys.push('on_leave');
  if (statusKey === 'finished') filterKeys.push('finished');

  let factText: string | null = null;
  if ((statusKey === 'present_now' || statusKey === 'late') && row.firstCheckIn) {
    factText = `دخل ${formatWallTime(row.firstCheckIn)}`;
  } else if (statusKey === 'finished' && row.lastCheckOut) {
    factText = `غادر ${formatWallTime(row.lastCheckOut)}`;
  }

  let sortRank = 5;
  if (statusKey === 'late') sortRank = 0;
  else if (statusKey === 'present_now') sortRank = 1;
  else if (statusKey === 'absent' || statusKey === 'not_yet_punched') sortRank = 2;
  else if (statusKey === 'on_leave') sortRank = 3;
  else if (statusKey === 'finished') sortRank = 4;

  return {
    userId: row.userId,
    nameAr: row.nameAr,
    employeeId: row.employeeId,
    role: row.role,
    departmentId: row.departmentId,
    departmentNameAr: row.departmentNameAr ?? 'بدون قسم',
    scope: 'full',
    group,
    statusKey,
    statusLabel,
    statusTone,
    filterKeys,
    metaText: rowMetaText(row.employeeId, row.role),
    factText,
    canViewDetailedStatus: true,
    canViewTimes: true,
    canOpenDetailsSheet: true,
    detailSummary: buildDetailSummary(row, statusLabel, statusTone),
    sortRank,
  };
}

function buildDetailedDayRow(row: TeamAttendanceDayRow, isToday: boolean): AttendanceBoardRow {
  const isPresent =
    row.displayStatus === 'present' ||
    row.displayStatus === 'late' ||
    row.displayStatus === 'overtime_only' ||
    row.displayStatus === 'overtime_offday' ||
    row.sessionCount > 0;

  let statusKey: BoardRowStatus = isPresent ? 'present_day' : 'not_present_day';
  if (row.displayStatus === 'late') statusKey = 'late';
  else if (row.displayStatus === 'absent') statusKey = 'absent';
  else if (row.displayStatus === 'on_leave') statusKey = 'on_leave';

  const group: BoardGroup =
    statusKey === 'present_day' || statusKey === 'late' ? 'present' : 'not_present';
  const filterKeys: AttendanceStatusFilter[] = [
    group === 'present' ? 'present_day' : 'not_present_day',
  ];

  if (statusKey === 'late') filterKeys.push('late');
  if (statusKey === 'absent') filterKeys.push('absent');
  if (statusKey === 'on_leave') filterKeys.push('on_leave');

  let sortRank = 3;
  if (statusKey === 'late') sortRank = 0;
  else if (statusKey === 'present_day') sortRank = 1;
  else if (statusKey === 'absent') sortRank = 2;

  let factText: string | null = null;
  if (row.firstCheckIn) {
    factText = `دخل ${formatWallTime(row.firstCheckIn)}`;
  } else if (row.lastCheckOut) {
    factText = `غادر ${formatWallTime(row.lastCheckOut)}`;
  }

  return {
    userId: row.userId,
    nameAr: row.nameAr,
    employeeId: row.employeeId,
    role: row.role,
    departmentId: row.departmentId,
    departmentNameAr: row.departmentNameAr ?? 'بدون قسم',
    scope: 'full',
    group,
    statusKey,
    statusLabel: dayStatusLabel(statusKey, isToday),
    statusTone: dayStatusTone(statusKey),
    filterKeys,
    metaText: rowMetaText(row.employeeId, row.role),
    factText,
    canViewDetailedStatus: true,
    canViewTimes: true,
    canOpenDetailsSheet: true,
    detailSummary: buildDetailSummary(
      row,
      dayStatusLabel(statusKey, isToday),
      dayStatusTone(statusKey)
    ),
    sortRank,
  };
}

function buildGenericLiveRow(row: SafeAvailabilityRow): AttendanceBoardRow {
  const isPresent = row.availabilityState === 'available_now';

  return {
    userId: row.userId,
    nameAr: row.nameAr,
    employeeId: row.employeeId,
    role: row.role,
    departmentId: row.departmentId,
    departmentNameAr: row.departmentNameAr ?? 'بدون قسم',
    scope: 'generic',
    group: isPresent ? 'present' : 'not_present',
    statusKey: isPresent ? 'present_now' : 'not_present_now',
    statusLabel: isPresent ? 'موجود الآن' : 'غير موجود الآن',
    statusTone: isPresent ? 'green' : 'gray',
    filterKeys: [isPresent ? 'present_now' : 'not_present_now'],
    metaText: rowMetaText(row.employeeId, row.role),
    factText: null,
    canViewDetailedStatus: false,
    canViewTimes: false,
    canOpenDetailsSheet: false,
    detailSummary: null,
    sortRank: isPresent ? 0 : 1,
  };
}

function buildGenericDayRow(row: SafeAttendanceDayRow, isToday: boolean): AttendanceBoardRow {
  const isPresent = row.attendanceState === 'present_on_date';
  const statusKey: BoardRowStatus = isPresent ? 'present_day' : 'not_present_day';

  return {
    userId: row.userId,
    nameAr: row.nameAr,
    employeeId: row.employeeId,
    role: row.role,
    departmentId: row.departmentId,
    departmentNameAr: row.departmentNameAr ?? 'بدون قسم',
    scope: 'generic',
    group: isPresent ? 'present' : 'not_present',
    statusKey,
    statusLabel: dayStatusLabel(statusKey, isToday),
    statusTone: dayStatusTone(statusKey),
    filterKeys: [isPresent ? 'present_day' : 'not_present_day'],
    metaText: rowMetaText(row.employeeId, row.role),
    factText: null,
    canViewDetailedStatus: false,
    canViewTimes: false,
    canOpenDetailsSheet: false,
    detailSummary: null,
    sortRank: isPresent ? 0 : 1,
  };
}

function buildBoardRows(params: {
  mode: TeamAttendanceMode;
  isTodayInDateMode: boolean;
  detailedRows: TeamAttendanceDayRow[];
  liveAvailabilityRows: SafeAvailabilityRow[];
  dayAvailabilityRows: SafeAttendanceDayRow[];
}): AttendanceBoardRow[] {
  const rowsByUser = new Map<string, AttendanceBoardRow>();

  if (params.mode === 'live') {
    params.liveAvailabilityRows.forEach((row) => {
      rowsByUser.set(row.userId, buildGenericLiveRow(row));
    });

    params.detailedRows.forEach((row) => {
      rowsByUser.set(row.userId, buildDetailedLiveRow(row));
    });
  } else {
    params.dayAvailabilityRows.forEach((row) => {
      rowsByUser.set(row.userId, buildGenericDayRow(row, params.isTodayInDateMode));
    });

    params.detailedRows.forEach((row) => {
      rowsByUser.set(row.userId, buildDetailedDayRow(row, params.isTodayInDateMode));
    });
  }

  return Array.from(rowsByUser.values());
}

function filterCount(rows: AttendanceBoardRow[], key: AttendanceStatusFilter): number {
  if (key === 'all') return rows.length;
  return rows.filter((row) => row.filterKeys.includes(key)).length;
}

function buildChipOptions(params: {
  rows: AttendanceBoardRow[];
  mode: TeamAttendanceMode;
  useDetailedFilters: boolean;
}): StatusChipOption[] {
  const blueprint: Array<Omit<StatusChipOption, 'count'>> = params.useDetailedFilters
    ? params.mode === 'live'
      ? [
          { key: 'all', label: 'الكل', tone: 'gray' },
          { key: 'present_now', label: 'موجودون الآن', tone: 'green' },
          { key: 'late', label: 'متأخر', tone: 'amber' },
          { key: 'absent', label: 'غائب', tone: 'red' },
          { key: 'on_leave', label: 'إجازة', tone: 'blue' },
          { key: 'finished', label: 'أنهى الدوام', tone: 'gray' },
        ]
      : [
          { key: 'all', label: 'الكل', tone: 'gray' },
          { key: 'present_day', label: 'حضر', tone: 'green' },
          { key: 'late', label: 'تأخر', tone: 'amber' },
          { key: 'absent', label: 'غائب', tone: 'red' },
          { key: 'on_leave', label: 'إجازة', tone: 'blue' },
        ]
    : params.mode === 'live'
      ? [
          { key: 'all', label: 'الكل', tone: 'gray' },
          { key: 'present_now', label: 'موجودون الآن', tone: 'green' },
          { key: 'not_present_now', label: 'غير موجودين الآن', tone: 'gray' },
        ]
      : [
          { key: 'all', label: 'الكل', tone: 'gray' },
          { key: 'present_day', label: 'حضر', tone: 'green' },
          { key: 'not_present_day', label: 'غير حاضر', tone: 'gray' },
        ];

  return blueprint.map((option) => ({
    ...option,
    count: filterCount(params.rows, option.key),
  }));
}

function compareRows(a: AttendanceBoardRow, b: AttendanceBoardRow): number {
  if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
  return a.nameAr.localeCompare(b.nameAr, 'ar');
}

function buildSectionSummary(
  rows: AttendanceBoardRow[],
  mode: TeamAttendanceMode
): string {
  const isDetailed = rows.every((row) => row.scope === 'full');
  const presentCount =
    mode === 'live' ? filterCount(rows, 'present_now') : filterCount(rows, 'present_day');
  const notPresentCount =
    mode === 'live'
      ? rows.filter((row) => row.group === 'not_present').length
      : filterCount(rows, 'not_present_day');

  if (!isDetailed) {
    return mode === 'live'
      ? `${presentCount} موجودون الآن • ${notPresentCount} غير موجودين الآن`
      : `${presentCount} حضروا • ${notPresentCount} غير حاضرين`;
  }

  const lateCount = filterCount(rows, 'late');
  const absentCount = filterCount(rows, 'absent');
  const leaveCount = filterCount(rows, 'on_leave');
  const finishedCount = filterCount(rows, 'finished');

  const segments: string[] = [];
  if (mode === 'live') {
    segments.push(`${presentCount} الآن`);
    if (lateCount > 0) segments.push(`${lateCount} متأخر`);
    if (absentCount > 0) segments.push(`${absentCount} غائب`);
    else if (leaveCount > 0) segments.push(`${leaveCount} إجازة`);
    else if (finishedCount > 0) segments.push(`${finishedCount} أنهوا الدوام`);
  } else {
    segments.push(`${presentCount} حضروا`);
    if (lateCount > 0) segments.push(`${lateCount} متأخر`);
    if (absentCount > 0) segments.push(`${absentCount} غائب`);
    else if (leaveCount > 0) segments.push(`${leaveCount} إجازة`);
  }

  return segments.join(' • ');
}

function buildSections(params: {
  allRows: AttendanceBoardRow[];
  visibleRows: AttendanceBoardRow[];
  departments: Department[];
  selectedDepartmentId: string | null;
  mode: TeamAttendanceMode;
}): BoardSection[] {
  const departmentOrder = new Map(params.departments.map((department, index) => [department.id, index]));
  const allRowsByDepartment = new Map<string, AttendanceBoardRow[]>();
  const visibleRowsByDepartment = new Map<string, AttendanceBoardRow[]>();

  params.allRows.forEach((row) => {
    const key = row.departmentId ?? NO_DEPARTMENT_KEY;
    const departmentRows = allRowsByDepartment.get(key) ?? [];
    departmentRows.push(row);
    allRowsByDepartment.set(key, departmentRows);
  });

  params.visibleRows.forEach((row) => {
    const key = row.departmentId ?? NO_DEPARTMENT_KEY;
    const departmentRows = visibleRowsByDepartment.get(key) ?? [];
    departmentRows.push(row);
    visibleRowsByDepartment.set(key, departmentRows);
  });

  const orderedKeys = Array.from(visibleRowsByDepartment.keys()).sort((a, b) => {
    const aRows = allRowsByDepartment.get(a) ?? [];
    const bRows = allRowsByDepartment.get(b) ?? [];
    const aHasPresent = aRows.some((row) => row.group === 'present');
    const bHasPresent = bRows.some((row) => row.group === 'present');

    if (params.selectedDepartmentId == null && params.mode === 'live' && aHasPresent !== bHasPresent) {
      return aHasPresent ? -1 : 1;
    }

    const aIndex = a === NO_DEPARTMENT_KEY ? Number.MAX_SAFE_INTEGER : (departmentOrder.get(a) ?? Number.MAX_SAFE_INTEGER - 1);
    const bIndex = b === NO_DEPARTMENT_KEY ? Number.MAX_SAFE_INTEGER : (departmentOrder.get(b) ?? Number.MAX_SAFE_INTEGER - 1);
    if (aIndex !== bIndex) return aIndex - bIndex;

    const aName = (aRows[0]?.departmentNameAr ?? 'بدون قسم');
    const bName = (bRows[0]?.departmentNameAr ?? 'بدون قسم');
    return aName.localeCompare(bName, 'ar');
  });

  return orderedKeys
    .map((key) => {
      const allRows = (allRowsByDepartment.get(key) ?? []).sort(compareRows);
      const visibleRows = (visibleRowsByDepartment.get(key) ?? []).sort(compareRows);
      if (visibleRows.length === 0) return null;

      const presentRows = visibleRows.filter((row) => row.group === 'present');
      const notPresentRows = visibleRows.filter((row) => row.group === 'not_present');

      return {
        id: key,
        name: allRows[0]?.departmentNameAr ?? 'بدون قسم',
        summaryText: buildSectionSummary(allRows, params.mode),
        presentRows,
        notPresentRows,
        defaultExpanded:
          params.selectedDepartmentId != null ||
          params.mode === 'date' ||
          allRows.some((row) => row.group === 'present'),
      } satisfies BoardSection;
    })
    .filter((section): section is BoardSection => section != null);
}

function ContentSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="rounded-3xl border border-gray-200 bg-white px-3 py-3">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-2 pt-3">
            {Array.from({ length: 3 }).map((__, rowIndex) => (
              <div key={rowIndex} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center">
      <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-800">{title}</p>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" size="sm" className="mt-4 rounded-full" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function StatusCountChips({
  options,
  activeFilter,
  onChange,
}: {
  options: StatusChipOption[];
  activeFilter: AttendanceStatusFilter;
  onChange: (value: AttendanceStatusFilter) => void;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2">
        {options.map((option) => {
          const active = option.key === activeFilter;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors',
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : cn('bg-white text-gray-700', toneClasses(option.tone))
              )}
            >
              <span>{option.label}</span>
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[10px]',
                  active ? 'bg-white/20 text-white' : 'bg-white/80 text-gray-700'
                )}
              >
                {option.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmployeeAttendanceRow({
  row,
  onOpenDetails,
}: {
  row: AttendanceBoardRow;
  onOpenDetails: (row: AttendanceBoardRow) => void;
}) {
  const content = (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{row.nameAr}</p>
        {(row.metaText || row.factText) ? (
          <p className="mt-0.5 truncate text-[11px] text-gray-500">
            {row.metaText}
            {row.metaText && row.factText ? ' • ' : ''}
            {row.factText}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className={cn('rounded-full border px-2.5 py-1 text-[11px]', toneClasses(row.statusTone))}>
          {row.statusLabel}
        </span>
        {row.canOpenDetailsSheet ? (
          <ChevronLeft className="h-4 w-4 text-gray-400" />
        ) : null}
      </div>
    </div>
  );

  if (!row.canOpenDetailsSheet) {
    return <div>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpenDetails(row)}
      className="w-full text-right transition-colors hover:bg-gray-50"
    >
      {content}
    </button>
  );
}

function DepartmentAttendanceSection({
  section,
  boardMode,
  isTodayInDateMode,
  expanded,
  onToggle,
  onOpenDetails,
}: {
  section: BoardSection;
  boardMode: TeamAttendanceMode;
  isTodayInDateMode: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetails: (row: AttendanceBoardRow) => void;
}) {
  const presentHeading =
    boardMode === 'live'
      ? 'موجودون الآن'
      : isTodayInDateMode
        ? 'حضروا اليوم'
        : 'حضروا في هذا اليوم';
  const notPresentHeading =
    boardMode === 'live'
      ? 'غير موجودون الآن'
      : isTodayInDateMode
        ? 'غير حاضرين اليوم'
        : 'غير حاضرين في هذا اليوم';

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={onToggle}
        className="sticky top-[7.2rem] z-10 flex w-full items-center justify-between gap-3 border-b border-gray-100 bg-white/95 px-4 py-3 text-right backdrop-blur supports-[backdrop-filter]:bg-white/80"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{section.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">{section.summaryText}</p>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', expanded ? 'rotate-180' : '')}
        />
      </button>

      {expanded ? (
        <div className="px-4 py-2">
          {section.presentRows.length > 0 ? (
            <div className="pb-1">
              <p className="pb-2 pt-1 text-[11px] font-medium text-gray-500">{presentHeading}</p>
              <div className="divide-y divide-gray-100">
                {section.presentRows.map((row) => (
                  <EmployeeAttendanceRow key={row.userId} row={row} onOpenDetails={onOpenDetails} />
                ))}
              </div>
            </div>
          ) : null}

          {section.notPresentRows.length > 0 ? (
            <div className={cn(section.presentRows.length > 0 ? 'border-t border-gray-100 pt-3' : '')}>
              <p className="pb-2 text-[11px] font-medium text-gray-500">{notPresentHeading}</p>
              <div className="divide-y divide-gray-100">
                {section.notPresentRows.map((row) => (
                  <EmployeeAttendanceRow key={row.userId} row={row} onOpenDetails={onOpenDetails} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function TeamAttendancePage() {
  const { currentUser } = useAuth();
  const today = useMemo(() => now(), []);
  const todayDate = toDateInputValue(today);
  const yesterdayDate = shiftDays(today, -1);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [managerDepartmentId, setManagerDepartmentId] = useState<string | null>(null);
  const [metaReady, setMetaReady] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(ALL_DEPARTMENTS);
  const [mode, setMode] = useState<TeamAttendanceMode>('live');
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilter>('all');
  const [boardData, setBoardData] = useState<BoardDataState>({
    detailedRows: [],
    liveAvailabilityRows: [],
    dayAvailabilityRows: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [selectedDetailRow, setSelectedDetailRow] = useState<AttendanceBoardRow | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function loadMeta() {
      setMetaReady(false);
      try {
        const [allDepartments, managedDepartment] = await Promise.all([
          departmentsService.listDepartments(),
          currentUser.role === 'manager' && !currentUser.departmentId
            ? departmentsService.getDepartmentByManagerUid(currentUser.uid)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setDepartments(allDepartments);
        setManagerDepartmentId(
          currentUser.role === 'manager'
            ? currentUser.departmentId || managedDepartment?.id || null
            : null
        );
      } catch {
        if (cancelled) return;
        toast.error('فشل تحميل الأقسام');
        setDepartments([]);
        setManagerDepartmentId(null);
      } finally {
        if (!cancelled) {
          setSelectedDepartmentId(ALL_DEPARTMENTS);
          setMetaReady(true);
        }
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const selectedDepartmentDbId =
    selectedDepartmentId === ALL_DEPARTMENTS ? null : selectedDepartmentId;
  const isTodayInDateMode = selectedDate === todayDate;

  const useDetailedFilters =
    !!currentUser &&
    (currentUser.role === 'admin' ||
      (currentUser.role === 'manager' &&
        managerDepartmentId != null &&
        selectedDepartmentDbId === managerDepartmentId));

  const loadBoard = useCallback(
    async (silent = false) => {
      if (!currentUser || !metaReady) return;

      const activeDate = mode === 'live' ? todayDate : selectedDate;
      const nextState: BoardDataState = {
        detailedRows: [],
        liveAvailabilityRows: [],
        dayAvailabilityRows: [],
      };

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      try {
        if (currentUser.role === 'admin') {
          nextState.detailedRows = await attendanceService.getTeamAttendanceDay({
            date: activeDate,
            departmentId: selectedDepartmentDbId,
          });
        } else if (currentUser.role === 'employee') {
          if (mode === 'live') {
            nextState.liveAvailabilityRows =
              await attendanceService.getRedactedDepartmentAvailability({
                departmentId: selectedDepartmentDbId,
              });
          } else {
            nextState.dayAvailabilityRows = await attendanceService.getRedactedTeamAttendanceDay({
              date: activeDate,
              departmentId: selectedDepartmentDbId,
            });
          }
        } else {
          const ownDepartmentSelected =
            managerDepartmentId != null && selectedDepartmentDbId === managerDepartmentId;

          if (ownDepartmentSelected) {
            nextState.detailedRows = await attendanceService.getTeamAttendanceDay({
              date: activeDate,
              departmentId: managerDepartmentId,
            });
          } else if (mode === 'live') {
            const [liveRows, ownRows] = await Promise.all([
              attendanceService.getRedactedDepartmentAvailability({
                departmentId: selectedDepartmentDbId,
              }),
              selectedDepartmentDbId == null && managerDepartmentId
                ? attendanceService.getTeamAttendanceDay({
                    date: activeDate,
                    departmentId: managerDepartmentId,
                  })
                : Promise.resolve([]),
            ]);

            nextState.liveAvailabilityRows = liveRows;
            nextState.detailedRows = ownRows;
          } else {
            const [dayRows, ownRows] = await Promise.all([
              attendanceService.getRedactedTeamAttendanceDay({
                date: activeDate,
                departmentId: selectedDepartmentDbId,
              }),
              selectedDepartmentDbId == null && managerDepartmentId
                ? attendanceService.getTeamAttendanceDay({
                    date: activeDate,
                    departmentId: managerDepartmentId,
                  })
                : Promise.resolve([]),
            ]);

            nextState.dayAvailabilityRows = dayRows;
            nextState.detailedRows = ownRows;
          }
        }

        setBoardData(nextState);
        if (mode === 'live') {
          setLastUpdatedAt(new Date());
        }
      } catch {
        toast.error('فشل تحميل لوحة حضور الفريق');
        setBoardData({
          detailedRows: [],
          liveAvailabilityRows: [],
          dayAvailabilityRows: [],
        });
        setErrorMessage('تعذر تحميل البيانات الحالية');
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [currentUser, managerDepartmentId, metaReady, mode, selectedDate, selectedDepartmentDbId, todayDate]
  );

  useEffect(() => {
    if (!metaReady) return;
    void loadBoard();
  }, [loadBoard, metaReady]);

  useEffect(() => {
    if (!metaReady || mode !== 'live') return;
    const intervalId = window.setInterval(() => {
      void loadBoard(true);
    }, LIVE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadBoard, metaReady, mode]);

  useEffect(() => {
    setSelectedDetailRow(null);
  }, [mode, selectedDate, selectedDepartmentId]);

  const boardRows = useMemo(
    () =>
      buildBoardRows({
        mode,
        isTodayInDateMode,
        detailedRows: boardData.detailedRows,
        liveAvailabilityRows: boardData.liveAvailabilityRows,
        dayAvailabilityRows: boardData.dayAvailabilityRows,
      }),
    [boardData.dayAvailabilityRows, boardData.detailedRows, boardData.liveAvailabilityRows, isTodayInDateMode, mode]
  );

  const chipOptions = useMemo(
    () =>
      buildChipOptions({
        rows: boardRows,
        mode,
        useDetailedFilters,
      }),
    [boardRows, mode, useDetailedFilters]
  );

  useEffect(() => {
    if (!chipOptions.some((option) => option.key === statusFilter)) {
      setStatusFilter('all');
    }
  }, [chipOptions, statusFilter]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return boardRows;
    return boardRows.filter((row) => row.filterKeys.includes(statusFilter));
  }, [boardRows, statusFilter]);

  const sections = useMemo(
    () =>
      buildSections({
        allRows: boardRows,
        visibleRows: filteredRows,
        departments,
        selectedDepartmentId: selectedDepartmentDbId,
        mode,
      }),
    [boardRows, departments, filteredRows, mode, selectedDepartmentDbId]
  );

  useEffect(() => {
    setExpandedSections({});
  }, [mode, selectedDepartmentId, statusFilter]);

  const selectedDepartmentName = useMemo(() => {
    if (selectedDepartmentDbId == null) return 'كل الأقسام';
    return departments.find((department) => department.id === selectedDepartmentDbId)?.name_ar ?? 'القسم';
  }, [departments, selectedDepartmentDbId]);

  const handleRefresh = useCallback(() => {
    void loadBoard(true);
  }, [loadBoard]);

  const resetFilters = useCallback(() => {
    setSelectedDepartmentId(ALL_DEPARTMENTS);
    setStatusFilter('all');
    if (mode === 'date') {
      setSelectedDate(todayDate);
    }
  }, [mode, todayDate]);

  if (!currentUser) return null;

  const hasNoDepartmentData = !loading && !errorMessage && departments.length === 0 && boardRows.length === 0;
  const showFilterEmptyState = !loading && !errorMessage && boardRows.length > 0 && filteredRows.length === 0;
  const showBoardEmptyState = !loading && !errorMessage && boardRows.length === 0 && !hasNoDepartmentData;

  return (
    <div className="mx-auto max-w-xl bg-gray-50 px-4 pb-24 pt-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">حضور الفريق</h1>
          <p className="mt-1 text-xs text-gray-500">
            {mode === 'live'
              ? 'لوحة تشغيلية سريعة توضّح من هو موجود الآن وفي أي قسم.'
              : `عرض الحضور ليوم ${formatSelectedDateLabel(selectedDate)}`}
          </p>
        </div>

        {mode === 'live' ? (
          <div className="shrink-0 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left">
            <p className="text-[10px] text-gray-500">آخر تحديث</p>
            <p className="mt-0.5 text-xs font-medium text-gray-700">{formatLastUpdated(lastUpdatedAt)}</p>
          </div>
        ) : null}
      </div>

      <div className="sticky top-0 z-20 -mx-4 mb-3 border-b border-gray-200 bg-gray-50/95 px-4 pb-3 backdrop-blur supports-[backdrop-filter]:bg-gray-50/85">
        <div className="space-y-2">
          <div className="grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-gray-200">
            <button
              type="button"
              onClick={() => setMode('live')}
              className={cn(
                'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                mode === 'live' ? 'bg-slate-900 text-white' : 'text-gray-600'
              )}
            >
              الآن
            </button>
            <button
              type="button"
              onClick={() => setMode('date')}
              className={cn(
                'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                mode === 'date' ? 'bg-slate-900 text-white' : 'text-gray-600'
              )}
            >
              اليوم/التاريخ
            </button>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[11rem] flex-1">
                <Building2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={selectedDepartmentId}
                  onChange={(event) => setSelectedDepartmentId(event.target.value)}
                  className="h-10 w-full rounded-2xl border border-gray-200 bg-white pr-9 pl-3 text-sm text-gray-700 outline-none transition-colors focus:border-slate-400"
                >
                  <option value={ALL_DEPARTMENTS}>كل الأقسام</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              {mode === 'date' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayDate)}
                    className={cn(
                      'rounded-full border px-3 py-2 text-xs transition-colors',
                      selectedDate === todayDate
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-700'
                    )}
                  >
                    اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(yesterdayDate)}
                    className={cn(
                      'rounded-full border px-3 py-2 text-xs transition-colors',
                      selectedDate === yesterdayDate
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-700'
                    )}
                  >
                    أمس
                  </button>
                  <div className="relative min-w-[9.5rem] flex-1">
                    <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      max={todayDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      dir="ltr"
                      className="h-10 w-full rounded-2xl border border-gray-200 bg-white pr-9 pl-3 text-sm text-gray-700 outline-none transition-colors focus:border-slate-400"
                    />
                  </div>
                </>
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-2xl border-gray-200"
                onClick={handleRefresh}
                aria-label="تحديث"
              >
                <RefreshCcw className={cn('h-4 w-4', refreshing ? 'animate-spin' : '')} />
              </Button>
            </div>

            <div className="mt-3">
              <StatusCountChips
                options={chipOptions}
                activeFilter={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? <ContentSkeleton /> : null}

        {!loading && errorMessage ? (
          <EmptyState
            title="تعذر تحميل لوحة الحضور"
            subtitle="أعد المحاولة لاسترجاع أحدث بيانات الفريق."
            actionLabel="إعادة المحاولة"
            onAction={handleRefresh}
          />
        ) : null}

        {hasNoDepartmentData ? (
          <EmptyState
            title="لا توجد أقسام أو موظفون"
            subtitle="أضف بيانات الفريق أولًا ليظهر توزيع الحضور حسب القسم."
          />
        ) : null}

        {showBoardEmptyState ? (
          <EmptyState
            title={mode === 'live' ? 'لا توجد بيانات مباشرة الآن' : 'لا توجد بيانات لهذا التاريخ'}
            subtitle={`لا توجد سجلات ظاهرة ضمن ${selectedDepartmentName}.`}
            actionLabel="تحديث"
            onAction={handleRefresh}
          />
        ) : null}

        {showFilterEmptyState ? (
          <EmptyState
            title="لا توجد نتائج مطابقة"
            subtitle={`الفلاتر الحالية لا تعرض أي موظف ضمن ${selectedDepartmentName}.`}
            actionLabel="إعادة تعيين الفلاتر"
            onAction={resetFilters}
          />
        ) : null}

        {!loading &&
          !errorMessage &&
          !hasNoDepartmentData &&
          !showBoardEmptyState &&
          !showFilterEmptyState &&
          sections.map((section) => {
            const forceExpanded = selectedDepartmentDbId != null;
            const isExpanded = forceExpanded || (expandedSections[section.id] ?? section.defaultExpanded);

            return (
              <DepartmentAttendanceSection
                key={section.id}
                section={section}
                boardMode={mode}
                isTodayInDateMode={isTodayInDateMode}
                expanded={isExpanded}
                onToggle={() =>
                  forceExpanded
                    ? undefined
                    : setExpandedSections((current) => ({
                        ...current,
                        [section.id]: !isExpanded,
                      }))
                }
                onOpenDetails={setSelectedDetailRow}
              />
            );
          })}
      </div>

      <DayDetailsSheet
        userId={selectedDetailRow?.userId ?? ''}
        date={selectedDetailRow ? (mode === 'live' ? todayDate : selectedDate) : null}
        summary={selectedDetailRow?.detailSummary ?? null}
        onClose={() => setSelectedDetailRow(null)}
      />
    </div>
  );
}

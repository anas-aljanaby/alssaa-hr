import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext';
import { useAppTopBar } from '@/app/contexts/AppTopBarContext';
import {
  DayDetailsSheet,
  type DayDetailsSheetSummary,
} from '@/app/components/attendance/DayDetailsSheet';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { cn } from '@/app/components/ui/utils';
import { getDepartmentColorTokens } from '@/lib/departmentColors';
import * as attendanceService from '@/lib/services/attendance.service';
import * as departmentsService from '@/lib/services/departments.service';
import type { Department } from '@/lib/services/departments.service';
import type {
  SafeAttendanceDayRow,
  SafeAvailabilityRow,
  TeamAttendanceDayRow,
} from '@/lib/services/attendance.service';
import {
  TEAM_ATTENDANCE_DATE_CHIPS,
  TEAM_ATTENDANCE_LIVE_CHIPS,
  countByChip,
  getChipsForRole,
  getStatusConfig,
  isTeamAttendancePrimaryState,
  rowMatchesChip,
  type TeamAttendancePrimaryState,
  type TeamAttendanceChipKey,
  type UserRole,
  type VisualStatus,
} from '@/shared/attendance';
import { StatusCountChips } from '@/shared/components';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Clock3,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

const ALL_DEPARTMENTS = '__all_departments__';
const NO_DEPARTMENT_KEY = '__no_department__';
const LIVE_REFRESH_INTERVAL_MS = 45_000;
const MOBILE_TOP_BAR_OFFSET = 'var(--mobile-top-bar-offset, 3.5rem)';

type TeamAttendanceMode = 'live' | 'date';
type BoardScope = 'full' | 'generic';
type BoardGroup = 'present' | 'not_present';
type AttendanceStatusFilter = TeamAttendanceChipKey;
type SectionMetricKey = 'present' | 'late' | 'absent' | 'on_leave' | 'on_break';

interface AttendanceBoardRow {
  userId: string;
  nameAr: string;
  role: 'employee' | 'manager' | 'admin';
  departmentId: string | null;
  departmentNameAr: string;
  scope: BoardScope;
  group: BoardGroup;
  primaryState: TeamAttendancePrimaryState | null; // null = baseline (on time, checked in, no chip)
  hasOvertime: boolean;
  isCheckedInNow: boolean; // true = employee has an open session right now
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
  departmentColor: string | null;
  subtitle: string;
  healthStatus: VisualStatus;
  metrics: Array<{
    key: SectionMetricKey;
    count: number;
    label: string;
    status: VisualStatus;
  }>;
  presentRows: AttendanceBoardRow[];
  notPresentRows: AttendanceBoardRow[];
  defaultExpanded: boolean;
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

function parseTeamAttendanceMode(raw: string | null): TeamAttendanceMode {
  return raw === 'date' ? 'date' : 'live';
}

function isValidDateParam(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw);
}

function normalizeTeamAttendanceDate(raw: string | null, todayDate: string): string {
  if (!raw || !isValidDateParam(raw) || raw > todayDate) {
    return todayDate;
  }

  return raw;
}

/** Past dates only: used in «سجل» (history) mode; «اليوم» tab is for the current day. */
function normalizeHistoryDate(
  raw: string | null,
  todayDate: string,
  yesterdayDate: string
): string {
  if (!raw || !isValidDateParam(raw) || raw >= todayDate) {
    return yesterdayDate;
  }

  return raw;
}

function parseStatusFilterParam(raw: string | null): AttendanceStatusFilter {
  if (!raw) return 'all';
  const trimmed = raw.trim();
  if (
    [
      'all',
      'checked_in',
      'on_break',
      'fulfilled_shift',
      'incomplete_shift',
      'late',
      'not_entered_yet',
      'absent',
      'on_leave',
      'overtime',
    ].includes(trimmed)
  ) {
    return trimmed as AttendanceStatusFilter;
  }

  return 'all';
}

function roleMeta(role: AttendanceBoardRow['role']): string | null {
  if (role === 'manager') return 'مدير';
  return null;
}

function rowMetaText(role: AttendanceBoardRow['role']): string | null {
  const meta = roleMeta(role);
  return meta;
}

function isPresentGroup(primaryState: TeamAttendancePrimaryState | null, mode: TeamAttendanceMode): boolean {
  if (mode === 'live') {
    // Live section split is driven by is_checked_in_now on the row, not primaryState.
    // This branch is here for completeness but build functions use isCheckedInNow directly.
    return primaryState === null; // null = baseline (on time, checked in)
  }

  return (
    primaryState === 'fulfilled_shift' ||
    primaryState === 'incomplete_shift' ||
    primaryState === 'late'
  );
}

function sortRankForState(primaryState: TeamAttendancePrimaryState | null, mode: TeamAttendanceMode): number {
  if (mode === 'live') {
    switch (primaryState) {
      case 'late':
        return 0;
      case null: // baseline: on time, checked in
        return 1;
      case 'on_break':
        return 2;
      case 'not_entered_yet':
        return 3;
      case 'incomplete_shift':
        return 4;
      case 'fulfilled_shift':
        return 5;
      case 'absent':
        return 6;
      case 'on_leave':
        return 7;
      case 'neutral':
      default:
        return 8;
    }
  }

  switch (primaryState) {
    case 'fulfilled_shift':
      return 0;
    case 'incomplete_shift':
      return 1;
    case 'late':
      return 2;
    case 'absent':
      return 3;
    case 'on_leave':
      return 4;
    case 'neutral':
    default:
      return 5;
  }
}

function buildDetailSummary(
  row: TeamAttendanceDayRow,
  primaryState: TeamAttendancePrimaryState | null
): DayDetailsSheetSummary {
  const config = primaryState ? getStatusConfig(primaryState) : getStatusConfig('checked_in');
  return {
    employeeName: row.nameAr,
    departmentName: row.departmentNameAr ?? 'بدون قسم',
    statusLabel: config.label,
    statusTone:
      primaryState === null || primaryState === 'fulfilled_shift'
        ? 'green' // null = baseline (on time, checked in) = green
        : primaryState === 'incomplete_shift'
          ? 'blue'
          : primaryState === 'late'
            ? 'amber'
            : primaryState === 'absent'
              ? 'red'
              : primaryState === 'on_leave' || primaryState === 'on_break'
                ? 'blue'
                : 'gray',
  };
}

function buildDetailedLiveRow(row: TeamAttendanceDayRow): AttendanceBoardRow {
  const primaryState = row.teamLiveState;
  const group: BoardGroup = row.isCheckedInNow ? 'present' : 'not_present';

  let factText: string | null = null;
  if (row.isCheckedInNow && (primaryState === null || primaryState === 'late') && row.firstCheckIn) {
    factText = `دخل ${formatWallTime(row.firstCheckIn)}`;
  } else if ((primaryState === 'on_break' || primaryState === 'late') && row.lastCheckOut) {
    factText = `غادر ${formatWallTime(row.lastCheckOut)}`;
  } else if ((primaryState === 'fulfilled_shift' || primaryState === 'incomplete_shift') && row.lastCheckOut) {
    factText = `غادر ${formatWallTime(row.lastCheckOut)}`;
  } else if (primaryState === 'neutral' && row.lastCheckOut) {
    factText = `غادر ${formatWallTime(row.lastCheckOut)}`;
  }

  return {
    userId: row.userId,
    nameAr: row.nameAr,
    role: row.role,
    departmentId: row.departmentId,
    departmentNameAr: row.departmentNameAr ?? 'بدون قسم',
    scope: 'full',
    group,
    primaryState,
    hasOvertime: row.hasOvertime,
    isCheckedInNow: row.isCheckedInNow,
    metaText: rowMetaText(row.role),
    factText,
    canViewDetailedStatus: true,
    canViewTimes: true,
    canOpenDetailsSheet: true,
    detailSummary: buildDetailSummary(row, primaryState),
    sortRank: sortRankForState(primaryState, 'live'),
  };
}

function buildDetailedDayRow(row: TeamAttendanceDayRow): AttendanceBoardRow {
  const primaryState = row.teamDateState;
  const group: BoardGroup = isPresentGroup(primaryState, 'date') ? 'present' : 'not_present';

  let factText: string | null = null;
  if (row.firstCheckIn) {
    factText = `دخل ${formatWallTime(row.firstCheckIn)}`;
  } else if (row.lastCheckOut) {
    factText = `غادر ${formatWallTime(row.lastCheckOut)}`;
  }

  return {
    userId: row.userId,
    nameAr: row.nameAr,
    role: row.role,
    departmentId: row.departmentId,
    departmentNameAr: row.departmentNameAr ?? 'بدون قسم',
    scope: 'full',
    group,
    primaryState,
    hasOvertime: row.hasOvertime,
    isCheckedInNow: false, // date mode: presence state not applicable
    metaText: rowMetaText(row.role),
    factText,
    canViewDetailedStatus: true,
    canViewTimes: true,
    canOpenDetailsSheet: true,
    detailSummary: buildDetailSummary(row, primaryState),
    sortRank: sortRankForState(primaryState, 'date'),
  };
}

function buildGenericLiveRow(row: SafeAvailabilityRow): AttendanceBoardRow {
  const primaryState = row.teamLiveState;

  return {
    userId: row.userId,
    nameAr: row.nameAr,
    role: row.role,
    departmentId: row.departmentId,
    departmentNameAr: row.departmentNameAr ?? 'بدون قسم',
    scope: 'generic',
    group: row.availabilityState === 'available_now' ? 'present' : 'not_present',
    primaryState,
    hasOvertime: row.hasOvertime,
    isCheckedInNow: row.availabilityState === 'available_now',
    metaText: rowMetaText(row.role),
    factText: null,
    canViewDetailedStatus: false,
    canViewTimes: false,
    canOpenDetailsSheet: false,
    detailSummary: null,
    sortRank: sortRankForState(primaryState, 'live'),
  };
}

function buildGenericDayRow(row: SafeAttendanceDayRow): AttendanceBoardRow {
  const primaryState = row.teamDateState;

  return {
    userId: row.userId,
    nameAr: row.nameAr,
    role: row.role,
    departmentId: row.departmentId,
    departmentNameAr: row.departmentNameAr ?? 'بدون قسم',
    scope: 'generic',
    group: isPresentGroup(primaryState, 'date') ? 'present' : 'not_present',
    primaryState,
    hasOvertime: row.hasOvertime,
    isCheckedInNow: false, // date mode: presence state not applicable
    metaText: rowMetaText(row.role),
    factText: null,
    canViewDetailedStatus: false,
    canViewTimes: false,
    canOpenDetailsSheet: false,
    detailSummary: null,
    sortRank: sortRankForState(primaryState, 'date'),
  };
}

function buildBoardRows(params: {
  mode: TeamAttendanceMode;
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
      rowsByUser.set(row.userId, buildGenericDayRow(row));
    });

    params.detailedRows.forEach((row) => {
      rowsByUser.set(row.userId, buildDetailedDayRow(row));
    });
  }

  return Array.from(rowsByUser.values());
}

function compareRowsWithinGroup(
  a: AttendanceBoardRow,
  b: AttendanceBoardRow,
  mode: TeamAttendanceMode
): number {
  function getGroupSortRank(row: AttendanceBoardRow): number {
    if (mode === 'live') {
      if (row.group === 'present') {
        switch (row.primaryState) {
          case 'late':
            return 0;
          case null: // baseline: on time, checked in
            return 1;
          default:
            return 2;
        }
      }

      switch (row.primaryState) {
        case 'not_entered_yet':
          return 0;
        case 'on_leave':
          return 1;
        case 'on_break':
          return 2;
        case 'absent':
          return 3;
        case 'incomplete_shift':
          return 4;
        case 'fulfilled_shift':
          return 5;
        case 'neutral':
        default:
          return 6;
      }
    }

    if (row.group === 'present') {
      switch (row.primaryState) {
        case 'late':
          return 0;
        case 'incomplete_shift':
          return 1;
        case 'fulfilled_shift':
          return 2;
        default:
          return 3;
      }
    }

    switch (row.primaryState) {
      case 'absent':
        return 0;
      case 'on_leave':
        return 1;
      case 'neutral':
      default:
        return 2;
    }
  }

  const aRank = getGroupSortRank(a);
  const bRank = getGroupSortRank(b);
  if (aRank !== bRank) return aRank - bRank;
  return a.nameAr.localeCompare(b.nameAr, 'ar');
}

function buildSectionSummary(
  rows: AttendanceBoardRow[],
  mode: TeamAttendanceMode
): Pick<BoardSection, 'subtitle' | 'healthStatus' | 'metrics'> {
  const presentCount = rows.filter((row) => row.group === 'present').length;
  const lateCount = rows.filter((row) => row.primaryState === 'late').length;
  const absentCount = rows.filter(
    (row) => row.primaryState === 'absent' || row.primaryState === 'not_entered_yet'
  ).length;
  const onLeaveCount = rows.filter((row) => row.primaryState === 'on_leave').length;
  const onBreakCount = rows.filter((row) => row.primaryState === 'on_break').length;
  const totalCount = rows.length;
  const presentStatus: VisualStatus = mode === 'live' ? 'checked_in' : 'fulfilled_shift';
  const everyoneUnavailableByDesign =
    totalCount === 0 ||
    rows.every((row) => row.primaryState === 'on_leave' || row.primaryState === 'neutral');

  let healthStatus: VisualStatus = 'neutral';
  if (everyoneUnavailableByDesign) {
    healthStatus = 'neutral';
  } else if (absentCount > 0) {
    healthStatus = 'absent';
  } else if (lateCount > 0) {
    healthStatus = 'late';
  } else if (
    presentCount > 0 ||
    onBreakCount > 0 ||
    rows.some(
      (row) =>
        row.primaryState === 'fulfilled_shift' || row.primaryState === 'incomplete_shift'
    )
  ) {
    healthStatus = presentStatus;
  }

  return {
    subtitle: `${presentCount} من ${totalCount} موجودون`,
    healthStatus,
    metrics: [
      {
        key: 'present',
        count: presentCount,
        label: 'موجودون',
        status: presentStatus,
      },
      {
        key: 'late',
        count: lateCount,
        label: 'متأخر',
        status: 'late',
      },
      {
        key: 'absent',
        count: absentCount,
        label: 'غائب أو لم يسجل',
        status: 'absent',
      },
      {
        key: 'on_leave',
        count: onLeaveCount,
        label: 'إجازة',
        status: 'on_leave',
      },
      {
        key: 'on_break',
        count: onBreakCount,
        label: 'استراحة',
        status: 'on_break',
      },
    ].filter((metric) => metric.count > 0),
  };
}

function buildSections(params: {
  allRows: AttendanceBoardRow[];
  visibleRows: AttendanceBoardRow[];
  departments: Department[];
  selectedDepartmentId: string | null;
  mode: TeamAttendanceMode;
}): BoardSection[] {
  const departmentOrder = new Map(params.departments.map((department, index) => [department.id, index]));
  const departmentById = new Map(params.departments.map((department) => [department.id, department]));
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
      const allRows = allRowsByDepartment.get(key) ?? [];
      const visibleRows = visibleRowsByDepartment.get(key) ?? [];
      if (visibleRows.length === 0) return null;

      const presentRows = visibleRows
        .filter((row) => row.group === 'present')
        .sort((a, b) => compareRowsWithinGroup(a, b, params.mode));
      const notPresentRows = visibleRows
        .filter((row) => row.group === 'not_present')
        .sort((a, b) => compareRowsWithinGroup(a, b, params.mode));
      const summary = buildSectionSummary(allRows, params.mode);

      return {
        id: key,
        name: allRows[0]?.departmentNameAr ?? 'بدون قسم',
        departmentColor: key === NO_DEPARTMENT_KEY ? null : (departmentById.get(key)?.color ?? null),
        subtitle: summary.subtitle,
        healthStatus: summary.healthStatus,
        metrics: summary.metrics,
        presentRows,
        notPresentRows,
        defaultExpanded: false,
      } satisfies BoardSection;
    })
    .filter((section): section is BoardSection => section != null);
}

function EmployeeStatusTag({
  status,
  label,
  icon: Icon,
}: {
  status: VisualStatus;
  label?: string;
  icon?: typeof Clock3;
}) {
  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium text-white',
        config.dotColor
      )}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {label ?? config.label}
    </span>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <div
          key={sectionIndex}
          className="rounded-3xl border border-slate-200 bg-white px-3 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.07)]"
        >
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

function EmployeeAttendanceRow({
  row,
  onOpenDetails,
}: {
  row: AttendanceBoardRow;
  onOpenDetails: (row: AttendanceBoardRow) => void;
}) {
  const showOvertimeIndicator = row.hasOvertime;
  const showPrimaryBadge =
    row.primaryState !== null &&
    row.primaryState !== 'neutral' &&
    isTeamAttendancePrimaryState(row.primaryState); // guard against stale/unknown DB values

  const content = (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{row.nameAr}</p>
        {(row.metaText || row.factText) ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-right">
            {row.metaText ? (
              <span className="truncate text-[11px] font-medium text-slate-500">{row.metaText}</span>
            ) : null}
            {row.factText ? (
              <span className="truncate text-[10px] text-slate-400">{row.factText}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {showOvertimeIndicator ? (
          <Badge className="border-violet-200 bg-violet-50 text-violet-700">
            <Clock3 className="h-3 w-3" />
            عمل إضافي
          </Badge>
        ) : null}
        {showPrimaryBadge && row.primaryState ? <EmployeeStatusTag status={row.primaryState} /> : null}
        {row.canOpenDetailsSheet ? (
          <ChevronLeft className="h-4 w-4 text-slate-400" />
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
      className="w-full text-right transition-colors hover:bg-white/70"
    >
      {content}
    </button>
  );
}

function DepartmentAttendanceSection({
  section,
  boardMode,
  expanded,
  onToggle,
  onOpenDetails,
}: {
  section: BoardSection;
  boardMode: TeamAttendanceMode;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetails: (row: AttendanceBoardRow) => void;
}) {
  const presentHeading = boardMode === 'live' ? 'موجودون الآن' : 'حضروا في هذا اليوم';
  const notPresentHeading = boardMode === 'live' ? 'غير موجودون' : 'غير حاضرين في هذا اليوم';
  const departmentIconStyle = section.departmentColor
    ? getDepartmentColorTokens(section.departmentColor).iconStyle
    : undefined;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3.5 text-right transition-colors hover:bg-slate-50',
          expanded ? 'border-b border-slate-200/80 bg-slate-50/80' : ''
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              section.departmentColor ? '' : 'bg-slate-100 text-slate-500'
            )}
            style={departmentIconStyle}
            aria-hidden="true"
          >
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-950">{section.name}</p>
            <p className="mt-1 truncate text-[11px] font-medium text-slate-600">{section.subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 self-center">
          {section.metrics.length > 0 ? (
            <div className="flex max-w-[11rem] flex-wrap items-center justify-end gap-1.5">
              {section.metrics.map((metric) => {
                const metricConfig = getStatusConfig(metric.status);
                return (
                  <span
                    key={metric.key}
                    className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-[11px] font-semibold tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.08)]',
                      metricConfig.bgColor,
                      metricConfig.color,
                      metricConfig.borderColor
                    )}
                    aria-label={`${metric.label} (${metric.count})`}
                    title={`${metric.label} (${metric.count})`}
                  >
                    {metric.count}
                  </span>
                );
              })}
            </div>
          ) : null}
          <ChevronDown
            className={cn('h-4 w-4 text-slate-400 transition-transform', expanded ? 'rotate-180' : '')}
          />
        </div>
      </button>

      {expanded ? (
        <div className="px-4 py-3">
          {section.presentRows.length > 0 ? (
            <div className="pb-1">
              <p className="pb-2 pt-1 text-[11px] font-semibold text-emerald-700">
                {`${presentHeading} (${section.presentRows.length})`}
              </p>
              <div className="divide-y divide-slate-200/80">
                {section.presentRows.map((row) => (
                  <EmployeeAttendanceRow key={row.userId} row={row} onOpenDetails={onOpenDetails} />
                ))}
              </div>
            </div>
          ) : null}

          {section.notPresentRows.length > 0 ? (
            <div className={cn(section.presentRows.length > 0 ? 'border-t border-slate-200/80 pt-3' : '')}>
              <p className="pb-2 text-[11px] font-semibold text-slate-600">
                {`${notPresentHeading} (${section.notPresentRows.length})`}
              </p>
              <div className="divide-y divide-slate-200/80">
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
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => new Date(), []);
  const todayDate = toDateInputValue(today);
  const yesterdayDate = shiftDays(today, -1);
  const initialMode = parseTeamAttendanceMode(searchParams.get('mode'));
  const initialSelectedDate =
    initialMode === 'date'
      ? normalizeHistoryDate(searchParams.get('date'), todayDate, yesterdayDate)
      : normalizeTeamAttendanceDate(searchParams.get('date'), todayDate);
  const initialStatusFilter = parseStatusFilterParam(searchParams.get('filter'));
  const preservedHistoryDateRef = useRef(
    initialMode === 'date'
      ? initialSelectedDate
      : initialSelectedDate !== todayDate
        ? initialSelectedDate
        : yesterdayDate
  );

  const [departments, setDepartments] = useState<Department[]>([]);
  const [managerDepartmentId, setManagerDepartmentId] = useState<string | null>(null);
  const [metaReady, setMetaReady] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(ALL_DEPARTMENTS);
  const [mode, setMode] = useState<TeamAttendanceMode>(initialMode);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilter>(initialStatusFilter);
  const [boardData, setBoardData] = useState<BoardDataState>({
    detailedRows: [],
    liveAvailabilityRows: [],
    dayAvailabilityRows: [],
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [selectedDetailRow, setSelectedDetailRow] = useState<AttendanceBoardRow | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const nextMode = parseTeamAttendanceMode(searchParams.get('mode'));
    const nextSelectedDate =
      nextMode === 'date'
        ? normalizeHistoryDate(searchParams.get('date'), todayDate, yesterdayDate)
        : normalizeTeamAttendanceDate(searchParams.get('date'), todayDate);
    const nextStatusFilter = parseStatusFilterParam(searchParams.get('filter'));

    setMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));
    setSelectedDate((currentDate) =>
      currentDate === nextSelectedDate ? currentDate : nextSelectedDate
    );
    setStatusFilter((currentFilter) =>
      currentFilter === nextStatusFilter ? currentFilter : nextStatusFilter
    );
  }, [searchParams, todayDate, yesterdayDate]);

  useEffect(() => {
    if (mode === 'date') {
      preservedHistoryDateRef.current = selectedDate;
    }
  }, [mode, selectedDate]);

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
  const activeRole = (currentUser?.role ?? 'employee') as UserRole;

  const loadBoard = useCallback(
    async (silent = false) => {
      if (!currentUser || !metaReady) return;

      const activeDate = mode === 'live' ? todayDate : selectedDate;
      const nextState: BoardDataState = {
        detailedRows: [],
        liveAvailabilityRows: [],
        dayAvailabilityRows: [],
      };

      if (!silent) {
        setLoading(true);
      }
      setErrorMessage(null);

      try {
        if (currentUser.role === 'admin') {
          nextState.detailedRows = await attendanceService.getTeamAttendanceDay({
            date: activeDate,
            departmentId: selectedDepartmentDbId,
            includeAllProfiles: true,
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
              includeAllProfiles: true,
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
                    includeAllProfiles: true,
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
                    includeAllProfiles: true,
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
        if (!silent) {
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
        detailedRows: boardData.detailedRows,
        liveAvailabilityRows: boardData.liveAvailabilityRows,
        dayAvailabilityRows: boardData.dayAvailabilityRows,
      }),
    [boardData.dayAvailabilityRows, boardData.detailedRows, boardData.liveAvailabilityRows, mode]
  );

  const activeChips = useMemo(
    () =>
      getChipsForRole(
        mode === 'live' ? TEAM_ATTENDANCE_LIVE_CHIPS : TEAM_ATTENDANCE_DATE_CHIPS,
        activeRole
      ),
    [activeRole, mode]
  );

  const chipCounts = useMemo(
    () => countByChip(activeChips, boardRows),
    [activeChips, boardRows]
  );

  useEffect(() => {
    if (!activeChips.some((chip) => chip.key === statusFilter)) {
      setStatusFilter('all');
    }
  }, [activeChips, statusFilter]);

  useEffect(() => {
    const currentMode = searchParams.get('mode');
    const currentDate = searchParams.get('date');
    const currentFilter = searchParams.get('filter');

    const effectiveDate = mode === 'live' ? todayDate : selectedDate;
    if (
      currentMode === mode &&
      currentDate === effectiveDate &&
      currentFilter === statusFilter
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('mode', mode);
    nextParams.set('date', effectiveDate);
    nextParams.set('filter', statusFilter);
    setSearchParams(nextParams, { replace: true });
  }, [mode, searchParams, selectedDate, setSearchParams, statusFilter, todayDate]);

  const filteredRows = useMemo(() => {
    const activeChip = activeChips.find((chip) => chip.key === statusFilter);
    if (!activeChip) return boardRows;
    return boardRows.filter((row) => rowMatchesChip(activeChip, row));
  }, [activeChips, boardRows, statusFilter]);

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
    void loadBoard(false);
  }, [loadBoard]);

  const resetFilters = useCallback(() => {
    setSelectedDepartmentId(ALL_DEPARTMENTS);
    setStatusFilter('all');
    if (mode === 'date') {
      setSelectedDate(yesterdayDate);
      preservedHistoryDateRef.current = yesterdayDate;
    }
  }, [mode, yesterdayDate]);

  const hasNoDepartmentData = !loading && !errorMessage && departments.length === 0 && boardRows.length === 0;
  const showFilterEmptyState = !loading && !errorMessage && boardRows.length > 0 && filteredRows.length === 0;
  const showBoardEmptyState = !loading && !errorMessage && boardRows.length === 0 && !hasNoDepartmentData;
  const topBarMeta = useMemo(() => {
    if (mode === 'live') {
      return `آخر تحديث ${formatLastUpdated(lastUpdatedAt)}`;
    }
    return formatSelectedDateLabel(selectedDate);
  }, [lastUpdatedAt, mode, selectedDate]);

  const topBarAction = useMemo(() => (
    <button
      type="button"
      onClick={handleRefresh}
      aria-label="تحديث البيانات"
      title="تحديث"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
    >
      <RefreshCw className="h-4 w-4" />
    </button>
  ), [handleRefresh]);

  useAppTopBar({
    title: 'حضور الفريق',
    meta: topBarMeta,
    action: topBarAction,
  });

  if (!currentUser) return null;

  return (
    <div className="mx-auto max-w-xl bg-gray-50 px-4 pb-24">
      <div
        data-testid="team-attendance-sticky-filters"
        className="sticky z-20 -mx-4 border-b border-gray-200 bg-gray-50 px-4 pb-2 pt-2"
        style={{ top: MOBILE_TOP_BAR_OFFSET }}
      >
        <div className="rounded-3xl border border-gray-200 bg-white p-2 shadow-sm">
          <StatusCountChips
            chips={activeChips}
            counts={chipCounts}
            activeKey={statusFilter}
            onSelect={setStatusFilter}
          />
        </div>
      </div>

      <div className="space-y-3 overflow-x-hidden pt-3">
        <div className="rounded-3xl border border-gray-200 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <div className="relative min-w-0">
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
            </div>

            <div className="grid min-w-0 grid-cols-2 rounded-2xl bg-slate-50 p-1 ring-1 ring-gray-200">
              <button
                type="button"
                onClick={() => {
                  if (mode === 'date') {
                    preservedHistoryDateRef.current = selectedDate;
                  }
                  setMode('live');
                  setSelectedDate(todayDate);
                }}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  mode === 'live' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-blue-50'
                )}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('date');
                  setSelectedDate(preservedHistoryDateRef.current);
                }}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  mode === 'date' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-blue-50'
                )}
              >
                سجل
              </button>
            </div>

          </div>
          {mode === 'date' ? (
            <div
              data-testid="team-attendance-date-picker"
              className="mt-2 max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-2"
            >
              <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedDate(yesterdayDate)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-2 text-xs transition-colors',
                    selectedDate === yesterdayDate
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-blue-100 bg-blue-50 text-blue-700'
                  )}
                >
                  أمس
                </button>
                <div className="relative min-w-[11.5rem] flex-1">
                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    max={yesterdayDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    dir="ltr"
                    title="لا يتضمن يوم اليوم — استخدم «اليوم» أعلاه"
                    className="block h-10 w-full rounded-2xl border border-gray-200 bg-white pr-9 pl-3 text-sm text-gray-700 outline-none transition-colors focus:border-slate-400"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

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
            const isExpanded = expandedSections[section.id] ?? section.defaultExpanded;

            return (
              <DepartmentAttendanceSection
                key={section.id}
                section={section}
                boardMode={mode}
                expanded={isExpanded}
                onToggle={() =>
                  setExpandedSections((current) => ({
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

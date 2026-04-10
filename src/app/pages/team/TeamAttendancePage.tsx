import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext';
import { useAppTopBar } from '@/app/contexts/AppTopBarContext';
import {
  DayDetailsSheet,
  type DayDetailsSheetSummary,
} from '@/app/components/attendance/DayDetailsSheet';
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
import { now } from '@/lib/time';
import {
  TEAM_ATTENDANCE_DATE_CHIPS,
  TEAM_ATTENDANCE_LIVE_CHIPS,
  countByChip,
  getChipsForRole,
  getStatusConfig,
  rowMatchesChip,
  type TeamAttendancePrimaryState,
  type TeamAttendanceChipKey,
  type UserRole,
} from '@/shared/attendance';
import { Badge } from '@/app/components/ui/badge';
import {
  StatusBadge,
  StatusCountChips,
} from '@/shared/components';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Clock3,
  RefreshCcw,
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

interface AttendanceBoardRow {
  userId: string;
  nameAr: string;
  role: 'employee' | 'manager' | 'admin';
  departmentId: string | null;
  departmentNameAr: string;
  scope: BoardScope;
  group: BoardGroup;
  primaryState: TeamAttendancePrimaryState;
  hasOvertime: boolean;
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
  color: string | null;
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

function parseStatusFilterParam(raw: string | null): AttendanceStatusFilter {
  if (!raw) return 'all';
  const trimmed = raw.trim();
  if (
    [
      'all',
      'available_now',
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

function isPresentGroup(primaryState: TeamAttendancePrimaryState, mode: TeamAttendanceMode): boolean {
  if (mode === 'live') {
    return primaryState === 'available_now' || primaryState === 'late';
  }

  return (
    primaryState === 'fulfilled_shift' ||
    primaryState === 'incomplete_shift' ||
    primaryState === 'late'
  );
}

function sortRankForState(primaryState: TeamAttendancePrimaryState, mode: TeamAttendanceMode): number {
  if (mode === 'live') {
    switch (primaryState) {
      case 'late':
        return 0;
      case 'available_now':
        return 1;
      case 'fulfilled_shift':
        return 2;
      case 'not_entered_yet':
        return 3;
      case 'absent':
        return 4;
      case 'on_leave':
        return 5;
      case 'neutral':
      default:
        return 6;
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
  primaryState: TeamAttendancePrimaryState
): DayDetailsSheetSummary {
  const config = getStatusConfig(primaryState);
  return {
    employeeName: row.nameAr,
    departmentName: row.departmentNameAr ?? 'بدون قسم',
    statusLabel: config.label,
    statusTone:
      primaryState === 'available_now' || primaryState === 'fulfilled_shift'
        ? 'green'
        : primaryState === 'incomplete_shift'
          ? 'blue'
          : primaryState === 'late'
          ? 'amber'
          : primaryState === 'absent'
            ? 'red'
            : primaryState === 'on_leave'
              ? 'blue'
              : 'gray',
  };
}

function buildDetailedLiveRow(row: TeamAttendanceDayRow): AttendanceBoardRow {
  const primaryState = row.teamLiveState;
  const group: BoardGroup = isPresentGroup(primaryState, 'live') ? 'present' : 'not_present';

  let factText: string | null = null;
  if ((primaryState === 'available_now' || primaryState === 'late') && row.firstCheckIn) {
    factText = `دخل ${formatWallTime(row.firstCheckIn)}`;
  } else if (primaryState === 'fulfilled_shift' && row.lastCheckOut) {
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
    group: isPresentGroup(primaryState, 'live') ? 'present' : 'not_present',
    primaryState,
    hasOvertime: row.hasOvertime,
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

function compareRows(a: AttendanceBoardRow, b: AttendanceBoardRow): number {
  if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
  return a.nameAr.localeCompare(b.nameAr, 'ar');
}

function buildSectionSummary(
  rows: AttendanceBoardRow[],
  mode: TeamAttendanceMode
): string {
  const liveChips = countByChip(TEAM_ATTENDANCE_LIVE_CHIPS, rows);
  const dateChips = countByChip(TEAM_ATTENDANCE_DATE_CHIPS, rows);

  const segments: string[] = [];
  if (mode === 'live') {
    const availableCount = liveChips.available_now ?? 0;
    const lateCount = liveChips.late ?? 0;
    const pendingCount = liveChips.not_entered_yet ?? 0;
    const absentCount = liveChips.absent ?? 0;
    const overtimeCount = liveChips.overtime ?? 0;
    const leaveCount = liveChips.on_leave ?? 0;

    segments.push(`${availableCount} موجودون الآن`);
    if (lateCount > 0) segments.push(`${lateCount} متأخر`);
    if (pendingCount > 0) segments.push(`${pendingCount} لم يسجلوا بعد`);
    if (absentCount > 0) segments.push(`${absentCount} غائب`);
    if (overtimeCount > 0) segments.push(`${overtimeCount} إضافي`);
    if (leaveCount > 0) segments.push(`${leaveCount} إجازة`);
  } else {
    const fulfilledCount = dateChips.fulfilled_shift ?? 0;
    const incompleteCount = dateChips.incomplete_shift ?? 0;
    const lateCount = dateChips.late ?? 0;
    const absentCount = dateChips.absent ?? 0;
    const overtimeCount = dateChips.overtime ?? 0;
    const leaveCount = dateChips.on_leave ?? 0;

    segments.push(`${fulfilledCount} أكملوا الدوام`);
    if (incompleteCount > 0) segments.push(`${incompleteCount} غير مكتمل`);
    if (lateCount > 0) segments.push(`${lateCount} متأخر`);
    if (absentCount > 0) segments.push(`${absentCount} غائب`);
    if (overtimeCount > 0) segments.push(`${overtimeCount} إضافي`);
    if (leaveCount > 0) segments.push(`${leaveCount} إجازة`);
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
        color:
          key === NO_DEPARTMENT_KEY
            ? null
            : params.departments.find((department) => department.id === key)?.color ?? null,
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

function EmployeeAttendanceRow({
  row,
  onOpenDetails,
}: {
  row: AttendanceBoardRow;
  onOpenDetails: (row: AttendanceBoardRow) => void;
}) {
  const showOvertimeIndicator = row.hasOvertime;
  const showPrimaryBadge = row.primaryState !== 'neutral';

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
        {showOvertimeIndicator ? (
          <Badge className="border-violet-200 bg-violet-50 text-violet-700">
            <Clock3 className="h-3 w-3" />
            عمل إضافي
          </Badge>
        ) : null}
        {showPrimaryBadge ? <StatusBadge status={row.primaryState} size="sm" /> : null}
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
  const colorTokens = getDepartmentColorTokens(section.color);
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
        className="flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-right"
        style={colorTokens.headerStyle}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{section.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">{section.summaryText}</p>
        </div>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: colorTokens.value }}
          aria-hidden="true"
        />
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', expanded ? 'rotate-180' : '')}
        />
      </button>

      {expanded ? (
        <div className="px-4 py-2" style={colorTokens.sectionAccentStyle}>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => now(), []);
  const todayDate = toDateInputValue(today);
  const yesterdayDate = shiftDays(today, -1);
  const initialMode = parseTeamAttendanceMode(searchParams.get('mode'));
  const initialSelectedDate = normalizeTeamAttendanceDate(searchParams.get('date'), todayDate);
  const initialStatusFilter = parseStatusFilterParam(searchParams.get('filter'));

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
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [selectedDetailRow, setSelectedDetailRow] = useState<AttendanceBoardRow | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const nextMode = parseTeamAttendanceMode(searchParams.get('mode'));
    const nextSelectedDate = normalizeTeamAttendanceDate(searchParams.get('date'), todayDate);
    const nextStatusFilter = parseStatusFilterParam(searchParams.get('filter'));

    setMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));
    setSelectedDate((currentDate) =>
      currentDate === nextSelectedDate ? currentDate : nextSelectedDate
    );
    setStatusFilter((currentFilter) =>
      currentFilter === nextStatusFilter ? currentFilter : nextStatusFilter
    );
  }, [searchParams, todayDate]);

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

    if (
      currentMode === mode &&
      currentDate === selectedDate &&
      currentFilter === statusFilter
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('mode', mode);
    nextParams.set('date', selectedDate);
    nextParams.set('filter', statusFilter);
    setSearchParams(nextParams, { replace: true });
  }, [mode, searchParams, selectedDate, setSearchParams, statusFilter]);

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
    void loadBoard(true);
  }, [loadBoard]);

  const resetFilters = useCallback(() => {
    setSelectedDepartmentId(ALL_DEPARTMENTS);
    setStatusFilter('all');
    if (mode === 'date') {
      setSelectedDate(todayDate);
    }
  }, [mode, todayDate]);

  const hasNoDepartmentData = !loading && !errorMessage && departments.length === 0 && boardRows.length === 0;
  const showFilterEmptyState = !loading && !errorMessage && boardRows.length > 0 && filteredRows.length === 0;
  const showBoardEmptyState = !loading && !errorMessage && boardRows.length === 0 && !hasNoDepartmentData;
  const topBarMeta = useMemo(() => {
    if (mode === 'live') {
      return `آخر تحديث ${formatLastUpdated(lastUpdatedAt)}`;
    }
    return formatSelectedDateLabel(selectedDate);
  }, [lastUpdatedAt, mode, selectedDate]);

  useAppTopBar({
    title: 'حضور الفريق',
    meta: topBarMeta,
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
                onClick={() => setMode('live')}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  mode === 'live' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-blue-50'
                )}
              >
                الآن
              </button>
              <button
                type="button"
                onClick={() => setMode('date')}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  mode === 'date' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-blue-50'
                )}
              >
                اليوم/التاريخ
              </button>
            </div>

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
          {mode === 'date' ? (
            <div
              data-testid="team-attendance-date-picker"
              className="mt-2 max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-2"
            >
              <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayDate)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-2 text-xs transition-colors',
                    selectedDate === todayDate
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-blue-100 bg-blue-50 text-blue-700'
                  )}
                >
                  اليوم
                </button>
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
                    max={todayDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    dir="ltr"
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
            const forceExpanded = selectedDepartmentDbId != null;
            const isExpanded = forceExpanded || (expandedSections[section.id] ?? section.defaultExpanded);

            return (
              <DepartmentAttendanceSection
                key={section.id}
                section={section}
                boardMode={mode}
                isTodayInDateMode={isTodayInDateMode}
                expanded={isExpanded}
                onToggle={
                  forceExpanded
                    ? () => {}
                    : () =>
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

/**
 * Module purpose:
 * Defines reusable attendance chip groups and generic counting/filter helpers.
 * Team-attendance chips use row predicates so overlapping states like overtime
 * can coexist with primary-state filters.
 */

import type { DisplayStatus, UserRole } from './types';
import type { TeamAttendancePrimaryState, TeamAttendanceChipKey } from './teamState';

export interface ChipConfig<Row = { displayStatus: DisplayStatus }> {
  key: string;
  label: string;
  visibleToRoles: UserRole[];
  requiresHrVisibility?: boolean;
  themeStatus?: DisplayStatus | TeamAttendancePrimaryState | 'checked_in';
  matchStatuses?: DisplayStatus[];
  matchesRow?: (row: Row) => boolean;
}

export interface TeamAttendanceChipRow {
  primaryState: TeamAttendancePrimaryState | null; // null = baseline (on time, checked in, no chip)
  hasOvertime: boolean;
  isCheckedInNow: boolean;
  canViewHrStatus?: boolean;
}

const ALL_ROLES: UserRole[] = ['admin', 'manager', 'employee'];
const MANAGEMENT_ROLES: UserRole[] = ['admin', 'manager'];

export const TEAM_ATTENDANCE_LIVE_CHIPS: ChipConfig<TeamAttendanceChipRow>[] = [
  {
    key: 'all',
    label: 'الكل',
    visibleToRoles: ALL_ROLES,
  },
  {
    key: 'checked_in',
    label: 'موجودون الآن',
    themeStatus: 'checked_in',
    visibleToRoles: ALL_ROLES,
    matchesRow: (row) => row.isCheckedInNow,
  },
  {
    key: 'late',
    label: 'متأخر',
    themeStatus: 'late',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.primaryState === 'late',
  },
  {
    key: 'on_break',
    label: 'في استراحة',
    themeStatus: 'on_break',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.primaryState === 'on_break',
  },
  {
    key: 'not_entered_yet',
    label: 'لم يسجلوا بعد',
    themeStatus: 'not_entered_yet',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.primaryState === 'not_entered_yet',
  },
  {
    key: 'absent',
    label: 'غائب',
    themeStatus: 'absent',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.primaryState === 'absent',
  },
  {
    key: 'overtime',
    label: 'عمل إضافي',
    themeStatus: 'fulfilled_shift',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.hasOvertime,
  },
  {
    key: 'on_leave',
    label: 'إجازة',
    themeStatus: 'on_leave',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.primaryState === 'on_leave',
  },
];

export const TEAM_ATTENDANCE_DATE_CHIPS: ChipConfig<TeamAttendanceChipRow>[] = [
  {
    key: 'all',
    label: 'الكل',
    visibleToRoles: ALL_ROLES,
  },
  {
    key: 'fulfilled_shift',
    label: 'أكملوا الدوام',
    themeStatus: 'fulfilled_shift',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.primaryState === 'fulfilled_shift',
  },
  {
    key: 'incomplete_shift',
    label: 'دوام غير مكتمل',
    themeStatus: 'incomplete_shift',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.primaryState === 'incomplete_shift',
  },
  {
    key: 'late',
    label: 'متأخر',
    themeStatus: 'late',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.primaryState === 'late',
  },
  {
    key: 'absent',
    label: 'غائب',
    themeStatus: 'absent',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.primaryState === 'absent',
  },
  {
    key: 'overtime',
    label: 'عمل إضافي',
    themeStatus: 'fulfilled_shift',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.hasOvertime,
  },
  {
    key: 'on_leave',
    label: 'إجازة',
    themeStatus: 'on_leave',
    visibleToRoles: MANAGEMENT_ROLES,
    requiresHrVisibility: true,
    matchesRow: (row) => row.primaryState === 'on_leave',
  },
];

const DASHBOARD_LIVE_CHIP_KEYS = [
  'checked_in',
  'late',
  'not_entered_yet',
  'absent',
] as const;

const DASHBOARD_DATE_CHIP_KEYS = [
  'fulfilled_shift',
  'incomplete_shift',
  'late',
  'absent',
] as const;

function pickChipSubset<Row>(
  chips: ChipConfig<Row>[],
  keys: readonly string[]
): ChipConfig<Row>[] {
  return keys
    .map((key) => chips.find((chip) => chip.key === key))
    .filter((chip): chip is ChipConfig<Row> => !!chip);
}

export const DASHBOARD_LIVE_SUMMARY_CHIPS = pickChipSubset(
  TEAM_ATTENDANCE_LIVE_CHIPS,
  DASHBOARD_LIVE_CHIP_KEYS
);

export const DASHBOARD_DATE_SUMMARY_CHIPS = pickChipSubset(
  TEAM_ATTENDANCE_DATE_CHIPS,
  DASHBOARD_DATE_CHIP_KEYS
);

export function getChipsForRole<Row>(
  chips: ChipConfig<Row>[],
  role: UserRole,
  options?: {
    includeHrChips?: boolean;
  }
): ChipConfig<Row>[] {
  return chips.filter((chip) => {
    if (!chip.visibleToRoles.includes(role)) return false;
    if (chip.requiresHrVisibility && options?.includeHrChips === false) return false;
    return true;
  });
}

function rowSupportsHrChip<Row>(chip: ChipConfig<Row>, row: Row): boolean {
  if (!chip.requiresHrVisibility) return true;
  const candidate = row as { canViewHrStatus?: boolean };
  return candidate.canViewHrStatus !== false;
}

export function countByChip<Row>(
  chips: ChipConfig<Row>[],
  rows: Row[]
): Record<string, number> {
  return chips.reduce<Record<string, number>>((counts, chip) => {
    if (!chip.matchesRow && (!chip.matchStatuses || chip.matchStatuses.length === 0)) {
      counts[chip.key] = rows.length;
      return counts;
    }

    if (chip.matchesRow) {
      counts[chip.key] = rows.filter((row) => rowSupportsHrChip(chip, row) && chip.matchesRow?.(row)).length;
      return counts;
    }

    counts[chip.key] = rows.filter((row) => {
      if (!rowSupportsHrChip(chip, row)) return false;
      const candidate = row as { displayStatus?: DisplayStatus };
      return !!candidate.displayStatus && chip.matchStatuses?.includes(candidate.displayStatus);
    }).length;
    return counts;
  }, {});
}

export function rowMatchesChip<Row>(chip: ChipConfig<Row>, row: Row): boolean {
  if (!rowSupportsHrChip(chip, row)) return false;
  if (chip.matchesRow) return chip.matchesRow(row);
  if (!chip.matchStatuses || chip.matchStatuses.length === 0) return true;
  const candidate = row as { displayStatus?: DisplayStatus };
  return !!candidate.displayStatus && chip.matchStatuses.includes(candidate.displayStatus);
}

export function isTeamAttendanceChipKey(value: string): value is TeamAttendanceChipKey {
  return [
    'all',
    'checked_in',
    'fulfilled_shift',
    'incomplete_shift',
    'late',
    'on_break',
    'not_entered_yet',
    'absent',
    'on_leave',
    'overtime',
  ].includes(value);
}

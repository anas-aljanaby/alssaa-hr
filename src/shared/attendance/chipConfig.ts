/**
 * Module purpose:
 * Defines reusable chip filter groups for attendance surfaces and utilities for
 * role-aware chip visibility plus chip-based counting over resolved statuses.
 */

import { USER_ROLES, type DisplayStatus, type UserRole } from './types';

export interface ChipConfig {
  key: string;
  label: string;
  matchStatuses: DisplayStatus[];
  visibleToRoles: UserRole[];
}

const ALL_ROLES: UserRole[] = [...USER_ROLES];
const MANAGEMENT_ROLES: UserRole[] = ['admin', 'manager'];

export const TEAM_ATTENDANCE_LIVE_CHIPS: ChipConfig[] = [
  {
    key: 'all',
    label: 'الكل',
    matchStatuses: [],
    visibleToRoles: ALL_ROLES,
  },
  {
    key: 'present_now',
    label: 'موجودون الآن',
    matchStatuses: ['present_now', 'late_now'],
    visibleToRoles: ALL_ROLES,
  },
  {
    key: 'late',
    label: 'متأخر',
    matchStatuses: ['late_now'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
  {
    key: 'absent',
    label: 'غائب',
    matchStatuses: ['absent', 'not_registered'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
  {
    key: 'on_leave',
    label: 'إجازة',
    matchStatuses: ['on_leave'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
  {
    key: 'finished',
    label: 'أنهى الدوام',
    matchStatuses: ['finished'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
];

export const TEAM_ATTENDANCE_DATE_CHIPS: ChipConfig[] = [
  {
    key: 'all',
    label: 'الكل',
    matchStatuses: [],
    visibleToRoles: ALL_ROLES,
  },
  {
    key: 'present',
    label: 'حضر',
    matchStatuses: ['present', 'late'],
    visibleToRoles: ALL_ROLES,
  },
  {
    key: 'late',
    label: 'تأخر',
    matchStatuses: ['late'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
  {
    key: 'absent',
    label: 'غائب',
    matchStatuses: ['absent_day'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
  {
    key: 'on_leave',
    label: 'إجازة',
    matchStatuses: ['on_leave_day'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
];

export const DASHBOARD_SUMMARY_CHIPS: ChipConfig[] = [
  {
    key: 'present',
    label: 'حاضرون',
    matchStatuses: ['present_now', 'late_now', 'finished'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
  {
    key: 'late',
    label: 'متأخرون',
    matchStatuses: ['late_now'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
  {
    key: 'absent',
    label: 'غائبون',
    matchStatuses: ['absent', 'not_registered'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
  {
    key: 'on_leave',
    label: 'في إجازة',
    matchStatuses: ['on_leave'],
    visibleToRoles: MANAGEMENT_ROLES,
  },
];

export function getChipsForRole(chips: ChipConfig[], role: UserRole): ChipConfig[] {
  return chips.filter((chip) => chip.visibleToRoles.includes(role));
}

export function countByChip(
  chips: ChipConfig[],
  rows: Array<{ displayStatus: DisplayStatus }>
): Record<string, number> {
  return chips.reduce<Record<string, number>>((counts, chip) => {
    counts[chip.key] =
      chip.matchStatuses.length === 0
        ? rows.length
        : rows.filter((row) => chip.matchStatuses.includes(row.displayStatus)).length;
    return counts;
  }, {});
}

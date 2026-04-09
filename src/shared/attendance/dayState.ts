/**
 * Module purpose:
 * Normalizes backend attendance statuses into canonical day-state data that
 * preserves whether overtime occurred, even when the primary day outcome is
 * still considered absent or weekend.
 */

import { resolveDisplayStatus } from './resolveDisplayStatus';
import type { DayStatus, DisplayStatus, LivePresence, ResolveContext } from './types';

export type OvertimeAwareAttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'on_leave'
  | 'overtime_only'
  | 'overtime_offday'
  | null
  | undefined;

export interface AttendanceDayState {
  dayStatus: DayStatus;
  hasOvertime: boolean;
}

export function resolveAttendanceDayState(
  status: OvertimeAwareAttendanceStatus
): AttendanceDayState {
  switch (status) {
    case 'late':
      return { dayStatus: 'late', hasOvertime: false };
    case 'absent':
      return { dayStatus: 'absent', hasOvertime: false };
    case 'on_leave':
      return { dayStatus: 'on_leave', hasOvertime: false };
    case 'overtime_only':
      return { dayStatus: 'absent', hasOvertime: true };
    case 'overtime_offday':
      return { dayStatus: 'weekend', hasOvertime: true };
    case 'present':
    case null:
    case undefined:
    default:
      return { dayStatus: 'present', hasOvertime: false };
  }
}

export function resolveAttendanceDisplayStatus(
  dayState: AttendanceDayState,
  livePresence: LivePresence | null,
  context: ResolveContext
): DisplayStatus {
  if (dayState.hasOvertime && dayState.dayStatus === 'absent') {
    return livePresence === null ? 'absent_day' : 'absent';
  }

  return resolveDisplayStatus(dayState.dayStatus, livePresence, context);
}

/**
 * Module purpose:
 * Resolves a "today" attendance record into the shared display status using
 * the same day-state and live-presence rules across dashboards and details.
 */

import {
  resolveAttendanceDayState,
  resolveAttendanceDisplayStatus,
  type OvertimeAwareAttendanceStatus,
} from './dayState';
import type { DisplayStatus, LivePresence } from './types';

interface TodayShiftLike {
  weeklyOffDays?: number[] | null;
  workEndTime: string;
  bufferMinutesAfterShift: number;
}

interface TodaySummaryLike {
  effective_status?: OvertimeAwareAttendanceStatus;
  has_overtime?: boolean | null;
  total_overtime_minutes?: number | null;
}

interface TodaySessionLike {
  check_out_time?: string | null;
  is_overtime?: boolean | null;
}

export interface TodayRecordStatusLike {
  shift: TodayShiftLike | null;
  summary?: TodaySummaryLike | null;
  sessions?: TodaySessionLike[] | null;
}

export function getTodayRecordLivePresence(record: TodayRecordStatusLike): LivePresence {
  if (record.sessions?.some((session) => !session.check_out_time)) return 'checked_in';
  if ((record.sessions?.length ?? 0) > 0) return 'checked_out';
  return 'no_session';
}

export function isWithinTodayShiftWindow(record: TodayRecordStatusLike, at: Date): boolean {
  if (!record.shift) return false;
  const offDays = record.shift.weeklyOffDays ?? [5, 6];
  if (offDays.includes(at.getDay())) return false;

  const currentMinutes = at.getHours() * 60 + at.getMinutes();
  const [endHour, endMinute] = record.shift.workEndTime.split(':').map(Number);
  const shiftEndMinutes =
    (endHour ?? 0) * 60 +
    (endMinute ?? 0) +
    record.shift.bufferMinutesAfterShift;

  return currentMinutes <= shiftEndMinutes;
}

export function resolveTodayRecordDisplayStatus(
  record: TodayRecordStatusLike,
  at: Date
): DisplayStatus {
  const offDays = record.shift?.weeklyOffDays ?? [5, 6];
  const isOffDay = !!record.shift && offDays.includes(at.getDay());
  const hasOvertime =
    record.summary?.has_overtime === true ||
    (record.summary?.total_overtime_minutes ?? 0) > 0 ||
    record.sessions?.some((session) => session.is_overtime) === true;

  const dayState = isOffDay
    ? { dayStatus: 'weekend' as const, hasOvertime }
    : {
        ...resolveAttendanceDayState(record.summary?.effective_status, hasOvertime),
      };

  return resolveAttendanceDisplayStatus(
    dayState,
    getTodayRecordLivePresence(record),
    { isWithinShiftWindow: isWithinTodayShiftWindow(record, at) }
  );
}

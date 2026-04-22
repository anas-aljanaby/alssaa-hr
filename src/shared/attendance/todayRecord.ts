/**
 * Module purpose:
 * Resolves a "today" attendance record into the shared display status using
 * the same day-state and live-presence rules across dashboards and details.
 */

import { getNormalizedDayScheduleWindow } from './workSchedule';
import {
  resolveAttendanceDayState,
  resolveAttendanceDisplayStatus,
  type OvertimeAwareAttendanceStatus,
} from './dayState';
import type { DisplayStatus, LivePresence } from './types';

interface TodayShiftLike {
  workStartTime: string;
  workEndTime: string;
  bufferMinutesAfterShift: number;
}

interface TodaySummaryLike {
  date?: string;
  effective_status?: OvertimeAwareAttendanceStatus;
  has_overtime?: boolean | null;
  total_overtime_minutes?: number | null;
}

interface TodaySessionLike {
  date?: string;
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

function dateOnlyString(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dayDifference(fromIso: string, toIso: string): number | null {
  const from = parseDateOnly(fromIso);
  const to = parseDateOnly(toIso);
  if (!from || !to) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function getRecordDate(record: TodayRecordStatusLike, at: Date): string {
  return record.summary?.date ?? record.sessions?.[0]?.date ?? dateOnlyString(at);
}

export function isWithinTodayShiftWindow(record: TodayRecordStatusLike, at: Date): boolean {
  // A null shift means today is an off day — no shift window to be within.
  if (!record.shift) return false;

  const schedule = getNormalizedDayScheduleWindow({
    start: record.shift.workStartTime,
    end: record.shift.workEndTime,
  });
  if (!schedule) return false;

  const currentMinutes = at.getHours() * 60 + at.getMinutes();
  const currentDate = dateOnlyString(at);
  const dateOffset = dayDifference(getRecordDate(record, at), currentDate);
  if (dateOffset === null) return false;

  if (!schedule.overnight) {
    return dateOffset === 0 && currentMinutes <= schedule.endClockMinutes + record.shift.bufferMinutesAfterShift;
  }

  if (dateOffset === 0) return true;
  if (dateOffset === 1) {
    return currentMinutes <= schedule.endClockMinutes + record.shift.bufferMinutesAfterShift;
  }
  return false;
}

export function resolveTodayRecordDisplayStatus(
  record: TodayRecordStatusLike,
  at: Date
): DisplayStatus {
  // In the new schedule model, the caller passes shift=null on off days.
  const isOffDay = record.shift === null;
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

// Per-day work schedule helpers.
//
// A WorkSchedule is a map keyed by day-of-week (0=Sun..6=Sat, matching
// JS Date.getDay() and Postgres EXTRACT(DOW FROM date)). Each value is
// { start, end } in "HH:MM" 24h format. Missing keys mean the user does
// not work that day.
//
// Effective resolution order for a given user + date:
//   1. user.work_schedule[dow] if present
//   2. org.work_schedule[dow] if present
//   3. null => off day

export type DaySchedule = {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
};

export type WorkSchedule = Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', DaySchedule>>;

export const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const WORK_TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type WorkScheduleValidationIssue = {
  dayKey: DayKey;
  field: 'start' | 'end';
  message: string;
};

export type NormalizedDayScheduleWindow = {
  startClockMinutes: number;
  endClockMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  overnight: boolean;
  normalizeTimeMinutes: (
    timeMinutes: number,
    options?: { assumeNextDay?: boolean }
  ) => number;
};

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDaySchedule(value: unknown): value is DaySchedule {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as { start?: unknown; end?: unknown };
  return typeof candidate.start === 'string' && typeof candidate.end === 'string';
}

export function isValidWorkTime(value: string): boolean {
  return WORK_TIME_REGEX.test(value);
}

export function workTimeToMinutes(value: string): number | null {
  if (!isValidWorkTime(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function getNormalizedDayScheduleWindow(
  schedule: DaySchedule
): NormalizedDayScheduleWindow | null {
  const startClockMinutes = workTimeToMinutes(schedule.start);
  const endClockMinutes = workTimeToMinutes(schedule.end);
  if (startClockMinutes === null || endClockMinutes === null) return null;

  const overnight = endClockMinutes < startClockMinutes;
  const endMinutes = overnight ? endClockMinutes + 1440 : endClockMinutes;
  const durationMinutes = endMinutes - startClockMinutes;

  return {
    startClockMinutes,
    endClockMinutes,
    endMinutes,
    durationMinutes,
    overnight,
    normalizeTimeMinutes: (timeMinutes: number, options) =>
      overnight && options?.assumeNextDay ? timeMinutes + 1440 : timeMinutes,
  };
}

export function getDayScheduleDurationMinutes(schedule: DaySchedule): number | null {
  return getNormalizedDayScheduleWindow(schedule)?.durationMinutes ?? null;
}

export function isOvernightDaySchedule(schedule: DaySchedule): boolean {
  return getNormalizedDayScheduleWindow(schedule)?.overnight ?? false;
}

export function getDayScheduleValidationIssue(
  schedule: DaySchedule | undefined
): { field: 'start' | 'end'; message: string } | null {
  if (!schedule) return null;
  if (!schedule.start || !schedule.end) {
    return { field: 'end', message: 'وقت البداية والنهاية مطلوبان' };
  }
  if (!isValidWorkTime(schedule.start)) {
    return { field: 'start', message: 'وقت البداية غير صالح' };
  }
  if (!isValidWorkTime(schedule.end)) {
    return { field: 'end', message: 'وقت النهاية غير صالح' };
  }

  const durationMinutes = getDayScheduleDurationMinutes(schedule);
  if (durationMinutes === null) {
    return { field: 'end', message: 'الوقت المدخل غير صالح' };
  }
  if (durationMinutes === 0) {
    return { field: 'end', message: 'وقت النهاية يجب أن يختلف عن وقت البداية' };
  }

  return null;
}

export function getWorkScheduleValidationIssues(
  schedule: WorkSchedule | null | undefined
): WorkScheduleValidationIssue[] {
  if (!schedule) return [];

  const issues: WorkScheduleValidationIssue[] = [];
  for (const dayKey of DAY_KEYS) {
    const issue = getDayScheduleValidationIssue(schedule[dayKey]);
    if (!issue) continue;
    issues.push({ dayKey, field: issue.field, message: issue.message });
  }
  return issues;
}

export function assertValidWorkSchedule(schedule: WorkSchedule | null | undefined): void {
  const [firstIssue] = getWorkScheduleValidationIssues(schedule);
  if (firstIssue) {
    throw new Error(firstIssue.message);
  }
}

export function isOvertimeForScheduleTime(
  timeMinutes: number,
  schedule: DaySchedule,
  earlyLoginMinutes = 60
): boolean {
  const window = getNormalizedDayScheduleWindow(schedule);
  if (!window) return true;
  const normalizedTime = window.normalizeTimeMinutes(timeMinutes);
  const earlyLoginStart = window.startClockMinutes - earlyLoginMinutes;
  return normalizedTime < earlyLoginStart || normalizedTime > window.endMinutes;
}

/**
 * Normalizes any JSON-compatible value (including null/undefined) into a
 * WorkSchedule shape. Silently drops malformed entries.
 */
export function toWorkSchedule(raw: unknown): WorkSchedule {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result: WorkSchedule = {};
  for (const key of DAY_KEYS) {
    const day = (raw as Record<string, unknown>)[key];
    if (isDaySchedule(day) && isValidWorkTime(day.start) && isValidWorkTime(day.end)) {
      result[key] = { start: day.start, end: day.end };
    }
  }
  return result;
}

/**
 * Picks the effective DaySchedule for a given day-of-week using the
 * user -> org -> null fallback chain.
 */
export function resolveDaySchedule(
  dow: number,
  user: WorkSchedule | null | undefined,
  org: WorkSchedule | null | undefined,
): DaySchedule | null {
  const key = String(dow) as DayKey;
  if (user) return user[key] ?? null;
  if (org) return org[key] ?? null;
  return null;
}

/**
 * Returns the effective shift for a specific calendar date, or null if
 * the day is an off-day for this user.
 */
export function getShiftForDate(
  date: Date,
  user: WorkSchedule | null | undefined,
  org: WorkSchedule | null | undefined,
): DaySchedule | null {
  return resolveDaySchedule(date.getDay(), user, org);
}

/**
 * Returns the set of working day-of-week indices after applying the
 * user -> org fallback chain.
 */
export function getWorkDays(
  user: WorkSchedule | null | undefined,
  org: WorkSchedule | null | undefined,
): number[] {
  const result: number[] = [];
  for (let dow = 0; dow < 7; dow += 1) {
    if (resolveDaySchedule(dow, user, org)) {
      result.push(dow);
    }
  }
  return result;
}

/**
 * Whether a given date is a working day for the user/org combination.
 */
export function isWorkingDay(
  date: Date,
  user: WorkSchedule | null | undefined,
  org: WorkSchedule | null | undefined,
): boolean {
  return getShiftForDate(date, user, org) !== null;
}

/**
 * Counts the number of working days (inclusive) in a date range.
 */
export function countWorkingDaysInRange(
  startIso: string | null,
  endIso: string | null,
  user: WorkSchedule | null | undefined,
  org: WorkSchedule | null | undefined,
): number {
  if (!startIso) return 0;
  const workDays = getWorkDays(user, org);
  if (workDays.length === 0) return 0;

  const start = normalizeDate(parseIsoDate(startIso));
  const end = normalizeDate(parseIsoDate(endIso ?? startIso));
  if (end < start) return 0;

  let count = 0;
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    if (workDays.includes(current.getDay())) {
      count += 1;
    }
  }
  return count;
}

/**
 * Bundle resolving both sides at once for callers that already have the
 * profile + policy JSON values in hand.
 */
export type EffectiveSchedule = {
  user: WorkSchedule;
  org: WorkSchedule;
};

export function resolveEffectiveSchedule(
  userRaw: unknown,
  orgRaw: unknown,
): EffectiveSchedule {
  return {
    user: toWorkSchedule(userRaw),
    org: toWorkSchedule(orgRaw),
  };
}

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

const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;
type DayKey = (typeof DAY_KEYS)[number];

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
    if (isDaySchedule(day)) {
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
  if (user && user[key]) return user[key]!;
  if (org && org[key]) return org[key]!;
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

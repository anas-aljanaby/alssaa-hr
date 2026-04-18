const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function resolveWorkDays({
  profileWorkDays,
  orgWeeklyOffDays,
}: {
  profileWorkDays?: number[] | null;
  orgWeeklyOffDays?: number[] | null;
}): number[] {
  if (profileWorkDays && profileWorkDays.length > 0) {
    return [...profileWorkDays].sort((a, b) => a - b);
  }

  const weeklyOffDays = orgWeeklyOffDays ?? [5, 6];
  return ALL_WEEK_DAYS.filter((day) => !weeklyOffDays.includes(day));
}

export function isWorkingDayForDate(date: Date, workDays: number[]): boolean {
  return workDays.includes(date.getDay());
}

export function countWorkingDaysInRange(
  startIso: string | null,
  endIso: string | null,
  workDays: number[]
): number {
  if (!startIso || workDays.length === 0) return 0;

  const start = normalizeDate(parseIsoDate(startIso));
  const end = normalizeDate(parseIsoDate(endIso ?? startIso));

  if (end < start) return 0;

  let count = 0;
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    if (isWorkingDayForDate(current, workDays)) {
      count += 1;
    }
  }

  return count;
}

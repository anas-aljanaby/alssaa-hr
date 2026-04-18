const DAY_IN_MS = 86_400_000;

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function countInclusiveDateRangeDays(
  startIso: string | null,
  endIso: string | null
): number {
  if (!startIso) return 0;

  const startTime = normalizeDate(parseIsoDate(startIso)).getTime();
  const endTime = normalizeDate(parseIsoDate(endIso ?? startIso)).getTime();

  if (endTime < startTime) return 0;

  return Math.floor((endTime - startTime) / DAY_IN_MS) + 1;
}

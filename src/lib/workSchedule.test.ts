import { describe, expect, it } from 'vitest';
import { countWorkingDaysInRange, resolveWorkDays } from './workSchedule';

describe('resolveWorkDays', () => {
  it('prefers the user custom schedule when present', () => {
    expect(resolveWorkDays({ profileWorkDays: [1, 2, 4], orgWeeklyOffDays: [5, 6] })).toEqual([1, 2, 4]);
  });

  it('falls back to org weekly off-days', () => {
    expect(resolveWorkDays({ orgWeeklyOffDays: [5, 6] })).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('countWorkingDaysInRange', () => {
  it('counts only scheduled work days in a selected range', () => {
    expect(countWorkingDaysInRange('2026-04-18', '2026-04-22', [0, 1, 2, 3, 4])).toBe(4);
  });

  it('returns zero when the selected range is entirely off-days', () => {
    expect(countWorkingDaysInRange('2026-04-24', '2026-04-25', [0, 1, 2, 3, 4])).toBe(0);
  });
});

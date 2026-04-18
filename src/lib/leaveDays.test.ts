import { describe, expect, it } from 'vitest';
import { countInclusiveDateRangeDays } from './leaveDays';

describe('countInclusiveDateRangeDays', () => {
  it('counts a same-day leave request as one day', () => {
    expect(countInclusiveDateRangeDays('2026-04-18', '2026-04-18')).toBe(1);
  });

  it('counts both ends of a multi-day leave range', () => {
    expect(countInclusiveDateRangeDays('2026-04-18', '2026-04-22')).toBe(5);
  });

  it('returns zero when the range is reversed', () => {
    expect(countInclusiveDateRangeDays('2026-04-22', '2026-04-18')).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { TEAM_ATTENDANCE_LIVE_CHIPS, countByChip } from './chipConfig';

describe('TEAM_ATTENDANCE_LIVE_CHIPS', () => {
  it('does not count late employees inside the available now chip', () => {
    const counts = countByChip(TEAM_ATTENDANCE_LIVE_CHIPS, [
      { primaryState: 'available_now' as const, hasOvertime: false },
      { primaryState: 'late' as const, hasOvertime: false },
      { primaryState: 'on_break' as const, hasOvertime: false },
    ]);

    expect(counts.available_now).toBe(1);
    expect(counts.late).toBe(1);
    expect(counts.all).toBe(3);
  });
});

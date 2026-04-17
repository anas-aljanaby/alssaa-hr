import { describe, expect, it } from 'vitest';
import { TEAM_ATTENDANCE_LIVE_CHIPS, countByChip } from './chipConfig';

describe('TEAM_ATTENDANCE_LIVE_CHIPS', () => {
  it('checked_in chip counts employees with an open session regardless of primaryState', () => {
    const counts = countByChip(TEAM_ATTENDANCE_LIVE_CHIPS, [
      { primaryState: null,       hasOvertime: false, isCheckedInNow: true  }, // baseline: on time, checked in
      { primaryState: 'late',     hasOvertime: false, isCheckedInNow: true  }, // late, still checked in
      { primaryState: 'late',     hasOvertime: false, isCheckedInNow: false }, // late, signed off
      { primaryState: 'on_break', hasOvertime: false, isCheckedInNow: false }, // on break
    ]);

    expect(counts.checked_in).toBe(2); // first two rows have an open session
    expect(counts.late).toBe(2);       // both late rows regardless of presence
    expect(counts.all).toBe(4);
  });

  it('checked_in chip does not count employees who are not currently checked in', () => {
    const counts = countByChip(TEAM_ATTENDANCE_LIVE_CHIPS, [
      { primaryState: 'not_entered_yet', hasOvertime: false, isCheckedInNow: false },
      { primaryState: 'absent',          hasOvertime: false, isCheckedInNow: false },
      { primaryState: 'on_break',        hasOvertime: false, isCheckedInNow: false },
    ]);

    expect(counts.checked_in).toBe(0);
  });
});

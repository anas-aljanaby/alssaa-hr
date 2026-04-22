import { describe, expect, it } from 'vitest';
import { isWithinTodayShiftWindow } from './todayRecord';

describe('todayRecord shift window helpers', () => {
  it('treats an overnight shift as within the window on its scheduled day', () => {
    const result = isWithinTodayShiftWindow(
      {
        shift: {
          workStartTime: '15:00',
          workEndTime: '01:00',
          bufferMinutesAfterShift: 5,
        },
        summary: {
          date: '2025-06-10',
        },
      },
      new Date('2025-06-10T16:00:00')
    );

    expect(result).toBe(true);
  });

  it('keeps an overnight shift window open briefly after midnight, then closes it', () => {
    const record = {
      shift: {
        workStartTime: '15:00',
        workEndTime: '01:00',
        bufferMinutesAfterShift: 5,
      },
      sessions: [
        {
          date: '2025-06-10',
          check_out_time: null,
        },
      ],
    };

    expect(isWithinTodayShiftWindow(record, new Date('2025-06-11T01:04:00'))).toBe(true);
    expect(isWithinTodayShiftWindow(record, new Date('2025-06-11T01:06:00'))).toBe(false);
  });
});

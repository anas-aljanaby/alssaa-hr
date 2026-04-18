import { describe, expect, it } from 'vitest';
import { formatRequestCalendarDate, isFullDayLeaveRequestType } from './requestDateDisplay';

describe('requestDateDisplay', () => {
  it('treats annual leave as a full-day request type', () => {
    expect(isFullDayLeaveRequestType('annual_leave')).toBe(true);
  });

  it('formats full-day leave by its stored calendar date', () => {
    expect(formatRequestCalendarDate('2026-04-23T23:59:59.000Z', 'annual_leave')).toBe(
      new Date(2026, 3, 23).toLocaleDateString('ar-IQ')
    );
  });

  it('keeps regular local date formatting for non-full-day requests', () => {
    const iso = '2026-04-23T13:30:00.000Z';
    expect(formatRequestCalendarDate(iso, 'hourly_permission')).toBe(
      new Date(iso).toLocaleDateString('ar-IQ')
    );
  });
});

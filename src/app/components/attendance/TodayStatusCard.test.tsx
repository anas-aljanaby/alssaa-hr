import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TodayStatusCard } from './TodayStatusCard';
import { setNowFn } from '@/lib/time';
import type { TodayRecord } from '@/lib/services/attendance.service';

function makeToday(weeklyOffDays: number[]): TodayRecord {
  return {
    log: null,
    punches: [],
    shift: {
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      bufferMinutesAfterShift: 30,
      weeklyOffDays,
    },
  };
}

describe('TodayStatusCard overtime confirmation', () => {
  beforeEach(() => {
    // Use fixed dates so off-day calculations are deterministic.
    setNowFn(() => new Date('2025-06-06T10:00:00')); // Friday
  });

  afterEach(() => {
    setNowFn(() => new Date());
  });

  it('shows confirmation on weekly off-day before submitting check-in', () => {
    const onCheckIn = vi.fn();
    const onCheckOut = vi.fn();

    render(
      <TodayStatusCard
        today={makeToday([5, 6])}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الحضور' }));
    expect(screen.getByText('تأكيد عمل إضافي')).toBeInTheDocument();
    expect(onCheckIn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'متابعة' }));
    expect(onCheckIn).toHaveBeenCalledTimes(1);
  });

  it('shows confirmation on custom per-user off-day before submitting check-in', () => {
    const onCheckIn = vi.fn();
    const onCheckOut = vi.fn();

    setNowFn(() => new Date('2025-06-09T10:00:00')); // Monday

    render(
      <TodayStatusCard
        today={makeToday([1])}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الحضور' }));
    expect(screen.getByText('تأكيد عمل إضافي')).toBeInTheDocument();
    expect(onCheckIn).not.toHaveBeenCalled();
  });

  it('submits directly on working day without showing confirmation', () => {
    const onCheckIn = vi.fn();
    const onCheckOut = vi.fn();

    setNowFn(() => new Date('2025-06-10T10:00:00')); // Tuesday

    render(
      <TodayStatusCard
        today={makeToday([5, 6])}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الحضور' }));
    expect(onCheckIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('تأكيد عمل إضافي')).not.toBeInTheDocument();
  });
});

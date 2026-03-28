import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuickPunchCard } from './QuickPunchCard';
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

describe('QuickPunchCard overtime confirmation', () => {
  beforeEach(() => {
    setNowFn(() => new Date('2025-06-06T10:00:00')); // Friday
  });

  afterEach(() => {
    setNowFn(() => new Date());
  });

  it('shows confirmation on weekly off-day before submitting check-in', () => {
    const onCheckIn = vi.fn();
    const onCheckOut = vi.fn();

    render(
      <QuickPunchCard
        today={makeToday([5, 6])}
        loading={false}
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
      <QuickPunchCard
        today={makeToday([1])}
        loading={false}
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
      <QuickPunchCard
        today={makeToday([5, 6])}
        loading={false}
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

  it('does not show overtime-only CTA for mid-shift completed segment', () => {
    const onCheckIn = vi.fn();
    const onCheckOut = vi.fn();
    setNowFn(() => new Date('2025-06-10T13:20:00')); // Tuesday, before shift end

    const today: TodayRecord = {
      log: {
        id: 'seg-1',
        org_id: 'o1',
        user_id: 'u1',
        date: '2025-06-10',
        check_in_time: '13:15',
        check_out_time: '13:16',
        check_in_lat: null,
        check_in_lng: null,
        check_out_lat: null,
        check_out_lng: null,
        status: 'late',
        is_dev: false,
        auto_punch_out: false,
      },
      punches: [],
      shift: {
        workStartTime: '09:00',
        workEndTime: '18:00',
        gracePeriodMinutes: 15,
        bufferMinutesAfterShift: 30,
        weeklyOffDays: [5, 6],
      },
    };

    render(
      <QuickPunchCard
        today={today}
        loading={false}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    expect(screen.queryByRole('button', { name: 'حضور إضافي' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^تسجيل الحضور$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^تسجيل الحضور$/ }));
    expect(screen.queryByText('تأكيد عمل إضافي')).not.toBeInTheDocument();
  });

  it('shows overtime confirmation for completed day after shift end', () => {
    const onCheckIn = vi.fn();
    const onCheckOut = vi.fn();
    setNowFn(() => new Date('2025-06-10T18:20:00'));

    const today: TodayRecord = {
      log: {
        id: 'seg-2',
        org_id: 'o1',
        user_id: 'u1',
        date: '2025-06-10',
        check_in_time: '13:15',
        check_out_time: '13:16',
        check_in_lat: null,
        check_in_lng: null,
        check_out_lat: null,
        check_out_lng: null,
        status: 'late',
        is_dev: false,
        auto_punch_out: false,
      },
      punches: [],
      shift: {
        workStartTime: '09:00',
        workEndTime: '18:00',
        gracePeriodMinutes: 15,
        bufferMinutesAfterShift: 30,
        weeklyOffDays: [5, 6],
      },
    };

    render(
      <QuickPunchCard
        today={today}
        loading={false}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'حضور إضافي' }));
    expect(screen.getByText('تأكيد عمل إضافي')).toBeInTheDocument();
  });

  it('renders checkout action when latest session is open', () => {
    const onCheckIn = vi.fn();
    const onCheckOut = vi.fn();
    setNowFn(() => new Date('2025-06-10T13:20:00'));

    const today: TodayRecord = {
      log: {
        id: 'seg-open',
        org_id: 'o1',
        user_id: 'u1',
        date: '2025-06-10',
        check_in_time: '13:17',
        check_out_time: null,
        check_in_lat: null,
        check_in_lng: null,
        check_out_lat: null,
        check_out_lng: null,
        status: 'late',
        is_dev: false,
        auto_punch_out: false,
      },
      punches: [],
      shift: {
        workStartTime: '09:00',
        workEndTime: '18:00',
        gracePeriodMinutes: 15,
        bufferMinutesAfterShift: 30,
        weeklyOffDays: [5, 6],
      },
      sessions: [
        {
          id: 's1',
          org_id: 'o1',
          user_id: 'u1',
          date: '2025-06-10',
          check_in_time: '13:15',
          check_out_time: '13:16',
          status: 'late',
          is_overtime: false,
          is_auto_punch_out: false,
          is_early_departure: true,
          needs_review: false,
          duration_minutes: 1,
          last_action_at: '2025-06-10T13:16:00Z',
          is_dev: false,
          created_at: '2025-06-10T13:15:00Z',
          updated_at: '2025-06-10T13:16:00Z',
        },
        {
          id: 's2',
          org_id: 'o1',
          user_id: 'u1',
          date: '2025-06-10',
          check_in_time: '13:17',
          check_out_time: null,
          status: 'late',
          is_overtime: false,
          is_auto_punch_out: false,
          is_early_departure: false,
          needs_review: false,
          duration_minutes: 0,
          last_action_at: '2025-06-10T13:17:00Z',
          is_dev: false,
          created_at: '2025-06-10T13:17:00Z',
          updated_at: '2025-06-10T13:17:00Z',
        },
      ],
    };

    render(
      <QuickPunchCard
        today={today}
        loading={false}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    expect(screen.getByRole('button', { name: 'تسجيل الانصراف' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'حضور إضافي' })).not.toBeInTheDocument();
  });
});

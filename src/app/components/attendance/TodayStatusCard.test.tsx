import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('increments worked hours after check-in when check_in_time is ISO datetime', () => {
    vi.useFakeTimers();
    let mockedNow = new Date('2025-06-10T10:05:00');
    setNowFn(() => mockedNow);

    const onCheckIn = vi.fn();
    const onCheckOut = vi.fn();

    const today: TodayRecord = {
      log: {
        id: 'log-iso-in',
        org_id: 'o1',
        user_id: 'u1',
        date: '2025-06-10',
        check_in_time: '2025-06-10T10:00:00Z',
        check_out_time: null,
        check_in_lat: null,
        check_in_lng: null,
        check_out_lat: null,
        check_out_lng: null,
        status: 'present',
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
      <TodayStatusCard
        today={today}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    expect(screen.getByText('05:00')).toBeInTheDocument();

    mockedNow = new Date('2025-06-10T10:06:00');
    vi.advanceTimersByTime(1000);

    expect(screen.getByText('06:00')).toBeInTheDocument();
    vi.useRealTimers();
  });

  /**
   * Doc §20.2: with ISO `check_in_time`, elapsed should tick (e.g. 05:00 → 05:01) not stay at 00:00 / NaN.
   * Fails fast until `check_in_time` parsing matches wall-clock vs punch time (currently shows NaN:NaN).
   */
  it('20.2 worked-hours line advances each second when check_in_time is ISO datetime', async () => {
    vi.useFakeTimers();
    const punchIso = '2025-06-10T10:00:00.000Z';
    let mockedNow = new Date('2025-06-10T10:05:00.000Z');
    setNowFn(() => mockedNow);

    const onCheckIn = vi.fn();
    const onCheckOut = vi.fn();

    const today: TodayRecord = {
      log: {
        id: 'log-iso-20-2',
        org_id: 'o1',
        user_id: 'u1',
        date: '2025-06-10',
        check_in_time: punchIso,
        check_out_time: null,
        check_in_lat: null,
        check_in_lng: null,
        check_out_lat: null,
        check_out_lng: null,
        status: 'present',
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
      <TodayStatusCard
        today={today}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const hoursLabel = screen.getByText(/ساعات العمل/);
    expect(hoursLabel.textContent).toMatch(/05:00/);

    mockedNow = new Date('2025-06-10T10:05:01.000Z');
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(hoursLabel.textContent).toMatch(/05:01/);

    vi.useRealTimers();
  });

  it('does not show overtime-only CTA for a mid-shift completed segment', () => {
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
      <TodayStatusCard
        today={today}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    expect(screen.queryByRole('button', { name: /عمل إضافي/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^تسجيل الحضور$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^تسجيل الحضور$/ }));
    expect(screen.queryByText('تأكيد عمل إضافي')).not.toBeInTheDocument();
  });

  it('allows overtime confirmation for completed day after shift end', () => {
    const onCheckIn = vi.fn();
    const onCheckOut = vi.fn();
    setNowFn(() => new Date('2025-06-10T18:20:00')); // Tuesday, after shift end

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
      <TodayStatusCard
        today={today}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /عمل إضافي/ }));
    expect(screen.getByText('تأكيد عمل إضافي')).toBeInTheDocument();
  });

  it('renders checked-in state when latest session is open', () => {
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
      <TodayStatusCard
        today={today}
        actionLoading={false}
        cooldownSecondsLeft={0}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    );

    expect(screen.getByRole('button', { name: 'تسجيل الانصراف' })).toBeInTheDocument();
    expect(screen.queryByText('اكتمل اليوم')).not.toBeInTheDocument();
  });
});

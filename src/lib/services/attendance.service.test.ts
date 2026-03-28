import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';
import { setNowFn } from '../time';

vi.mock('../supabase');
vi.mock('./requests.service', () => ({
  submitRequest: vi.fn().mockResolvedValue({
    id: 'lr1',
    org_id: 'o1',
    user_id: 'u1',
    type: 'overtime',
    from_date_time: '2025-06-11T10:00:00',
    to_date_time: '2025-06-11T16:00:00',
    note: '',
    status: 'pending',
    approver_id: null,
    decision_note: null,
    attachment_url: null,
    created_at: '2025-06-11T10:00:00Z',
    decided_at: null,
  }),
}));

const logRow = {
  id: 'log1',
  org_id: 'o1',
  user_id: 'u1',
  date: '2025-06-11',
  check_in_time: '08:00' as string | null,
  check_out_time: null as string | null,
  check_in_lat: null as number | null,
  check_in_lng: null as number | null,
  check_out_lat: null as number | null,
  check_out_lng: null as number | null,
  status: 'present' as const,
  is_dev: false,
  auto_punch_out: false,
};

const profileShift = {
  id: 'u1',
  org_id: 'o1',
  employee_id: 'E1',
  name: 'N',
  name_ar: 'ن',
  email: 'e@e.com',
  phone: '',
  role: 'employee' as const,
  department_id: 'd1',
  avatar_url: null as string | null,
  join_date: '2020-01-01',
  work_days: null as number[] | null,
  work_start_time: null as string | null,
  work_end_time: null as string | null,
};

const policyRow = {
  id: 'p1',
  org_id: 'o1',
  work_start_time: '08:00',
  work_end_time: '16:00',
  grace_period_minutes: 15,
  weekly_off_days: [5, 6],
  max_late_days_before_warning: 3,
  absent_cutoff_time: '12:00',
  annual_leave_per_year: 21,
  sick_leave_per_year: 10,
  auto_punch_out_buffer_minutes: 30,
  minimum_required_minutes: null as number | null,
};

describe('attendance.service', () => {
  beforeEach(() => {
    sb.clearQueue();
    sb.clearChannelInstances();
    setNowFn(() => new Date(2025, 5, 11, 10, 0, 0));
  });

  afterEach(() => {
    setNowFn(() => new Date());
  });

  it('isOvertimeTime detects weekend as overtime', async () => {
    const { isOvertimeTime } = await import('./attendance.service');
    const shift = {
      workStartTime: '08:00',
      workEndTime: '16:00',
      gracePeriodMinutes: 10,
      bufferMinutesAfterShift: 30,
      weeklyOffDays: [5, 6],
      minimumRequiredMinutes: null,
    };
    expect(isOvertimeTime(9 * 60, shift, 5)).toBe(true);
  });

  it('wallTimeToMinutes parses ISO and HH:MM', async () => {
    const { wallTimeToMinutes } = await import('./attendance.service');
    expect(wallTimeToMinutes('2025-06-10T10:05:00')).toBe(10 * 60 + 5);
    expect(wallTimeToMinutes('10:05')).toBe(10 * 60 + 5);
  });

  it('totalWorkedMinutesToday prefers summary then sessions then log span', async () => {
    const { totalWorkedMinutesToday } = await import('./attendance.service');
    const shift = {
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      bufferMinutesAfterShift: 30,
      weeklyOffDays: [5, 6],
      minimumRequiredMinutes: null,
    };
    type TodayRecord = import('./attendance.service').TodayRecord;
    type ADS = import('./attendance.service').AttendanceDailySummary;
    const base = { log: null, punches: [], shift } as TodayRecord;
    expect(
      totalWorkedMinutesToday({
        ...base,
        summary: { total_work_minutes: 99 } as ADS,
      })
    ).toBe(99);
  });

  it('isShiftRequirementMet uses full duration or minimum when set', async () => {
    const { isShiftRequirementMet } = await import('./attendance.service');
    const shift = {
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      bufferMinutesAfterShift: 30,
      weeklyOffDays: [5, 6],
      minimumRequiredMinutes: 420,
    };
    expect(isShiftRequirementMet(shift, 419)).toBe(false);
    expect(isShiftRequirementMet(shift, 420)).toBe(true);
    expect(isShiftRequirementMet(shift, 539)).toBe(true);
    const noMin = { ...shift, minimumRequiredMinutes: null };
    expect(isShiftRequirementMet(noMin, 539)).toBe(false);
    expect(isShiftRequirementMet(noMin, 540)).toBe(true);
  });

  it('shouldShowShiftCongrats only on fulfilled work days when checked out', async () => {
    const { shouldShowShiftCongrats } = await import('./attendance.service');
    const shift = {
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      bufferMinutesAfterShift: 30,
      weeklyOffDays: [5, 6],
      minimumRequiredMinutes: null,
    };
    const tuesday = new Date('2025-06-10T19:00:00');
    const fulfilled = {
      log: {
        id: '1',
        org_id: 'o1',
        user_id: 'u1',
        date: '2025-06-10',
        check_in_time: '09:00',
        check_out_time: '18:00',
        check_in_lat: null,
        check_in_lng: null,
        check_out_lat: null,
        check_out_lng: null,
        status: 'present' as const,
        is_dev: false,
        auto_punch_out: false,
      },
      punches: [],
      shift,
      summary: {
        total_work_minutes: 540,
      } as import('./attendance.service').AttendanceDailySummary,
    };
    expect(shouldShowShiftCongrats(fulfilled, tuesday)).toBe(true);

    const short = { ...fulfilled, summary: { total_work_minutes: 60 } as import('./attendance.service').AttendanceDailySummary };
    expect(shouldShowShiftCongrats(short, tuesday)).toBe(false);

    const open = {
      ...fulfilled,
      log: { ...fulfilled.log, check_out_time: null },
      summary: { total_work_minutes: 540 } as import('./attendance.service').AttendanceDailySummary,
    };
    expect(shouldShowShiftCongrats(open, tuesday)).toBe(false);
  });

  it('todayStr formats current day', async () => {
    const { todayStr } = await import('./attendance.service');
    expect(todayStr()).toBe('2025-06-11');
  });

  it('getTodayLog returns null when no row', async () => {
    sb.queueResult({ data: null, error: null });
    const { getTodayLog } = await import('./attendance.service');
    expect(await getTodayLog('u1')).toBeNull();
  });

  it('getTodayLog throws on error', async () => {
    sb.queueResult({ data: null, error: { message: 'db' } });
    const { getTodayLog } = await import('./attendance.service');
    await expect(getTodayLog('u1')).rejects.toEqual({ message: 'db' });
  });

  it('getAttendanceToday combines log and shift', async () => {
    sb.queueResult({ data: logRow, error: null });
    sb.queueResult({ data: profileShift, error: null });
    sb.queueResult({ data: policyRow, error: null });
    sb.queueResult({ data: null, error: null });
    const { getAttendanceToday } = await import('./attendance.service');
    const rec = await getAttendanceToday('u1');
    expect(rec.log?.id).toBe('log1');
    expect(rec.shift?.workStartTime).toBe('08:00');
    expect(rec.shift?.minimumRequiredMinutes).toBeNull();
    expect(rec.punches.length).toBeGreaterThan(0);
  });

  it('getEffectiveShiftForUser returns null when profile missing', async () => {
    sb.queueResult({ data: null, error: { message: 'x' } });
    const { getEffectiveShiftForUser } = await import('./attendance.service');
    expect(await getEffectiveShiftForUser('u1')).toBeNull();
  });

  it('getAttendanceDay loads log for date', async () => {
    // Promise.all evaluates getEffectiveShiftForUser() second arg before the first thenable is consumed,
    // so the profiles query runs first, then attendance_logs, then policy.
    sb.queueResult({ data: profileShift, error: null });
    sb.queueResult({ data: logRow, error: null });
    sb.queueResult({ data: policyRow, error: null });
    const { getAttendanceDay } = await import('./attendance.service');
    const day = await getAttendanceDay('u1', '2025-06-11');
    expect(day.log?.date).toBe('2025-06-11');
  });

  it('getLogsInRange returns rows', async () => {
    sb.queueResult({ data: [logRow], error: null });
    const { getLogsInRange } = await import('./attendance.service');
    const logs = await getLogsInRange('u1', '2025-06-01', '2025-06-30');
    expect(logs).toHaveLength(1);
  });

  it('getMonthlyStats aggregates statuses', async () => {
    sb.queueResult({ data: profileShift, error: null });
    sb.queueResult({
      data: [
        {
          id: 's1',
          org_id: 'o1',
          user_id: 'u1',
          date: '2025-06-10',
          first_check_in: '09:00',
          last_check_out: '17:00',
          total_work_minutes: 480,
          total_overtime_minutes: 0,
          effective_status: 'late',
          is_short_day: false,
          session_count: 1,
          updated_at: '2025-06-10T17:00:00Z',
        },
        {
          id: 's2',
          org_id: 'o1',
          user_id: 'u1',
          date: '2025-06-11',
          first_check_in: '08:00',
          last_check_out: '16:00',
          total_work_minutes: 480,
          total_overtime_minutes: 0,
          effective_status: 'present',
          is_short_day: false,
          session_count: 1,
          updated_at: '2025-06-11T16:00:00Z',
        },
      ],
      error: null,
    });
    sb.queueResult({ data: policyRow, error: null });
    const { getMonthlyStats } = await import('./attendance.service');
    const stats = await getMonthlyStats('u1', 2025, 5);
    expect(stats.presentDays).toBe(1);
    expect(stats.lateDays).toBe(1);
  });

  it('calendar maps overtime_only summary to overtime_only status', async () => {
    sb.queueResult({ data: profileShift, error: null });
    sb.queueResult({
      data: [{
        id: 'sum-ot-only',
        org_id: 'o1',
        user_id: 'u1',
        date: '2025-06-10',
        first_check_in: '20:00',
        last_check_out: '22:00',
        total_work_minutes: 120,
        total_overtime_minutes: 120,
        effective_status: 'overtime_only',
        is_short_day: true,
        session_count: 1,
        updated_at: '2025-06-10T22:00:00Z',
      }],
      error: null,
    });
    sb.queueResult({ data: policyRow, error: null });

    const { getAttendanceMonthly } = await import('./attendance.service');
    const month = await getAttendanceMonthly('u1', 2025, 5); // June
    const day = month.find((d) => d.date === '2025-06-10');
    expect(day?.status).toBe('overtime_only');
  });

  it('calendar maps off-day sessions to overtime_offday indicator', async () => {
    sb.queueResult({ data: profileShift, error: null });
    sb.queueResult({
      data: [{
        id: 'sum-offday-ot',
        org_id: 'o1',
        user_id: 'u1',
        date: '2025-06-06', // Friday
        first_check_in: '10:00',
        last_check_out: '19:00',
        total_work_minutes: 420,
        total_overtime_minutes: 420,
        effective_status: null,
        is_short_day: false,
        session_count: 2,
        updated_at: '2025-06-06T19:00:00Z',
      }],
      error: null,
    });
    sb.queueResult({ data: policyRow, error: null });

    const { getAttendanceMonthly } = await import('./attendance.service');
    const month = await getAttendanceMonthly('u1', 2025, 5); // June
    const day = month.find((d) => d.date === '2025-06-06');
    expect(day?.status).toBe('overtime_offday');
  });

  it('checkIn inserts when no existing log', async () => {
    sb.queueResult({ data: null, error: null });
    sb.queueResult({ data: profileShift, error: null });
    sb.queueResult({ data: policyRow, error: null });
    sb.queueResult({ data: { ...logRow, check_in_time: '10:00' }, error: null });
    const { checkIn } = await import('./attendance.service');
    const { submitRequest } = await import('./requests.service');
    vi.mocked(submitRequest).mockClear();
    const r = await checkIn('u1');
    expect(r.log.check_in_time).toBe('10:00');
    expect(submitRequest).not.toHaveBeenCalled();
  });

  it('checkIn throws when already checked in without checkout', async () => {
    sb.queueResult({
      data: { ...logRow, check_in_time: '08:00', check_out_time: null },
      error: null,
    });
    const { checkIn } = await import('./attendance.service');
    await expect(checkIn('u1')).rejects.toThrow('Already checked in');
  });

  it('checkOut updates existing log', async () => {
    sb.queueResult({
      data: { ...logRow, check_in_time: '08:00', check_out_time: null },
      error: null,
    });
    sb.queueResult({
      data: { ...logRow, check_in_time: '08:00', check_out_time: '17:00' },
      error: null,
    });
    const { checkOut } = await import('./attendance.service');
    const log = await checkOut('u1');
    expect(log.check_out_time).toBe('17:00');
  });

  it('checkOut throws without check-in', async () => {
    sb.queueResult({ data: { ...logRow, check_in_time: null }, error: null });
    const { checkOut } = await import('./attendance.service');
    await expect(checkOut('u1')).rejects.toThrow('Must check in');
  });

  it('subscribeToAttendanceLogs unsubscribes', async () => {
    const { subscribeToAttendanceLogs } = await import('./attendance.service');
    const unsub = subscribeToAttendanceLogs(vi.fn());
    expect(sb.channelInstances.at(-1)?.name).toBe('attendance_logs:all');
    unsub();
    expect(sb.removeChannel).toHaveBeenCalledWith('SUBSCRIBED');
  });

  it('subscribeToUserAttendance uses user filter channel', async () => {
    const { subscribeToUserAttendance } = await import('./attendance.service');
    subscribeToUserAttendance('u1', vi.fn());
    expect(sb.channelInstances.at(-1)?.name).toBe('attendance_logs:user:u1');
  });
});


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
    };
    expect(isOvertimeTime(9 * 60, shift, 5)).toBe(true);
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
    const { getAttendanceToday } = await import('./attendance.service');
    const rec = await getAttendanceToday('u1');
    expect(rec.log?.id).toBe('log1');
    expect(rec.shift?.workStartTime).toBe('08:00');
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
    sb.queueResult({
      data: [
        { ...logRow, status: 'present' as const },
        { ...logRow, id: 'l2', date: '2025-06-10', status: 'late' as const },
      ],
      error: null,
    });
    const { getMonthlyStats } = await import('./attendance.service');
    const stats = await getMonthlyStats('u1', 2025, 5);
    expect(stats.presentDays).toBe(1);
    expect(stats.lateDays).toBe(1);
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


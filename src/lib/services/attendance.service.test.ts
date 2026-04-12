import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';
import { todayRecord24_1, todayRecord24_1a } from './__fixtures__/todayMultiSession';

vi.mock('../supabase');

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
  auto_punch_out_buffer_minutes: 5,
  minimum_overtime_minutes: 30,
  minimum_required_minutes: null as number | null,
};

describe('attendance.service', () => {
  beforeEach(() => {
    sb.clearQueue();
    sb.clearChannelInstances();
    vi.mocked(sb.rpc).mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 11, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('isOvertimeTime detects weekend as overtime', async () => {
    const { isOvertimeTime } = await import('./attendance.service');
    const shift = {
      workStartTime: '08:00',
      workEndTime: '16:00',
      gracePeriodMinutes: 10,
      bufferMinutesAfterShift: 5,
      minimumOvertimeMinutes: 30,
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
      bufferMinutesAfterShift: 5,
      minimumOvertimeMinutes: 30,
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
      bufferMinutesAfterShift: 5,
      minimumOvertimeMinutes: 30,
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
      bufferMinutesAfterShift: 5,
      minimumOvertimeMinutes: 30,
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

  it('getRedactedDepartmentAvailability maps RPC rows', async () => {
    vi.mocked(sb.rpc).mockResolvedValue({
      data: [
        {
          user_id: 'u1',
          name_ar: 'علي',
          employee_id: 'EMP-1',
          role: 'employee',
          avatar_url: null,
          department_id: 'd1',
          department_name_ar: 'التحرير',
          availability_state: 'available_now',
          team_live_state: 'available_now',
          has_overtime: false,
        },
      ],
      error: null,
    } as never);

    const { getRedactedDepartmentAvailability } = await import('./attendance.service');
    const rows = await getRedactedDepartmentAvailability({ departmentId: 'd1' });

    expect(sb.rpc).toHaveBeenCalledWith('get_redacted_department_availability', {
      p_department_id: 'd1',
    });
    expect(rows).toEqual([
      expect.objectContaining({
        userId: 'u1',
        nameAr: 'علي',
        departmentNameAr: 'التحرير',
        teamLiveState: 'available_now',
        hasOvertime: false,
      }),
    ]);
  });

  it('getRedactedTeamAttendanceDay maps RPC rows', async () => {
    vi.mocked(sb.rpc).mockResolvedValue({
      data: [
        {
          user_id: 'u2',
          name_ar: 'ليلى',
          employee_id: 'EMP-4',
          role: 'employee',
          avatar_url: null,
          department_id: 'd2',
          department_name_ar: 'التقنية',
          date: '2025-06-11',
          attendance_state: 'present_on_date',
          team_date_state: 'fulfilled_shift',
          has_overtime: false,
        },
      ],
      error: null,
    } as never);

    const { getRedactedTeamAttendanceDay } = await import('./attendance.service');
    const rows = await getRedactedTeamAttendanceDay({ date: '2025-06-11', departmentId: 'd2' });

    expect(sb.rpc).toHaveBeenCalledWith('get_redacted_team_attendance_day', {
      p_date: '2025-06-11',
      p_department_id: 'd2',
    });
    expect(rows).toEqual([
      expect.objectContaining({
        userId: 'u2',
        nameAr: 'ليلى',
        departmentNameAr: 'التقنية',
        teamDateState: 'fulfilled_shift',
        hasOvertime: false,
      }),
    ]);
  });

  it('getTeamAttendanceDay maps RPC rows', async () => {
    vi.mocked(sb.rpc).mockResolvedValue({
      data: [
        {
          user_id: 'u1',
          name_ar: 'منى',
          employee_id: 'EMP-2',
          role: 'employee',
          avatar_url: null,
          department_id: 'd1',
          department_name_ar: 'الأخبار',
          date: '2025-06-11',
          effective_status: 'late',
          display_status: 'late',
          team_live_state: 'late',
          team_date_state: 'late',
          first_check_in: '08:20',
          last_check_out: null,
          total_work_minutes: 120,
          total_overtime_minutes: 0,
          has_overtime: false,
          session_count: 1,
          is_checked_in_now: true,
          has_auto_punch_out: false,
          needs_review: false,
          is_short_day: false,
        },
      ],
      error: null,
    } as never);

    const { getTeamAttendanceDay } = await import('./attendance.service');
    const rows = await getTeamAttendanceDay({ date: '2025-06-11', departmentId: 'd1' });

    expect(sb.rpc).toHaveBeenCalledWith('get_team_attendance_day', {
      p_date: '2025-06-11',
      p_department_id: 'd1',
      p_include_all_profiles: false,
    });
    expect(rows).toEqual([
      expect.objectContaining({
        userId: 'u1',
        nameAr: 'منى',
        effectiveStatus: 'late',
        displayStatus: 'late',
        teamLiveState: 'late',
        teamDateState: 'late',
        hasOvertime: false,
        isCheckedInNow: true,
      }),
    ]);
  });

  it('getTeamAttendanceDay flags overtime rows', async () => {
    vi.mocked(sb.rpc).mockResolvedValue({
      data: [
        {
          user_id: 'u2',
          name_ar: 'سالم',
          employee_id: 'EMP-9',
          role: 'employee',
          avatar_url: null,
          department_id: 'd1',
          department_name_ar: 'الأخبار',
          date: '2025-06-11',
          effective_status: 'overtime_only',
          display_status: 'overtime_only',
          team_live_state: 'neutral',
          team_date_state: 'absent',
          first_check_in: '18:00',
          last_check_out: '20:00',
          total_work_minutes: 120,
          total_overtime_minutes: 120,
          has_overtime: true,
          session_count: 1,
          is_checked_in_now: false,
          has_auto_punch_out: false,
          needs_review: false,
          is_short_day: false,
        },
      ],
      error: null,
    } as never);

    const { getTeamAttendanceDay } = await import('./attendance.service');
    const rows = await getTeamAttendanceDay({ date: '2025-06-11' });

    expect(rows).toEqual([
      expect.objectContaining({
        userId: 'u2',
        displayStatus: 'overtime_only',
        teamLiveState: 'neutral',
        teamDateState: 'absent',
        totalOvertimeMinutes: 120,
        hasOvertime: true,
      }),
    ]);
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

  it('getMonthlyLogs returns rows', async () => {
    sb.queueResult({ data: { join_date: '2020-01-01' }, error: null });
    sb.queueResult({ data: [logRow], error: null });
    const { getMonthlyLogs } = await import('./attendance.service');
    const logs = await getMonthlyLogs('u1', 2025, 5);
    expect(logs).toHaveLength(1);
  });

  it('getMonthlyLogs excludes logs before join date', async () => {
    sb.queueResult({ data: { join_date: '2025-06-10' }, error: null });
    sb.queueResult({
      data: [
        { ...logRow, id: 'old', date: '2025-06-08', status: 'absent' as const },
        { ...logRow, id: 'new', date: '2025-06-11', status: 'present' as const },
      ],
      error: null,
    });
    const { getMonthlyLogs } = await import('./attendance.service');
    const logs = await getMonthlyLogs('u1', 2025, 5);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.id).toBe('new');
  });

  it('getMonthlyStats aggregates statuses', async () => {
    sb.queueResult({ data: profileShift, error: null });
    sb.queueResult({ data: { join_date: '2020-01-01' }, error: null });
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
    sb.queueResult({ data: { join_date: '2020-01-01' }, error: null });
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
    sb.queueResult({ data: { join_date: '2020-01-01' }, error: null });
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

  it('calendar does not mark pre-join working days as absent', async () => {
    sb.queueResult({ data: profileShift, error: null });
    sb.queueResult({ data: { join_date: '2025-06-05' }, error: null });
    sb.queueResult({ data: [], error: null });
    sb.queueResult({ data: policyRow, error: null });

    const { getAttendanceMonthly } = await import('./attendance.service');
    const month = await getAttendanceMonthly('u1', 2025, 5); // June
    const preJoinDay = month.find((d) => d.date === '2025-06-03');
    const postJoinWorkday = month.find((d) => d.date === '2025-06-10');
    expect(preJoinDay?.status).toBeNull();
    expect(postJoinWorkday?.status).toBe('absent');
  });

  it('calendar uses profile created_at when join_date is missing', async () => {
    sb.queueResult({ data: profileShift, error: null });
    sb.queueResult({ data: { join_date: null, created_at: '2025-06-05T09:45:00Z' }, error: null });
    sb.queueResult({ data: [], error: null });
    sb.queueResult({ data: policyRow, error: null });

    const { getAttendanceMonthly } = await import('./attendance.service');
    const month = await getAttendanceMonthly('u1', 2025, 5); // June
    const preAccountDay = month.find((d) => d.date === '2025-06-03');
    const postAccountWorkday = month.find((d) => d.date === '2025-06-10');
    expect(preAccountDay?.status).toBeNull();
    expect(postAccountWorkday?.status).toBe('absent');
  });

  it('checkIn inserts when no existing log', async () => {
    sb.queueResult({ data: null, error: null });
    sb.queueResult({ data: profileShift, error: null });
    sb.queueResult({ data: policyRow, error: null });
    sb.queueResult({ data: { ...logRow, check_in_time: '10:00' }, error: null });
    const { checkIn } = await import('./attendance.service');
    const r = await checkIn('u1');
    expect(r.log.check_in_time).toBe('10:00');
  });

  describe('checkIn (Edge Function punch path)', () => {
    const otSession = {
      id: 'sess-ot-1',
      org_id: 'o1',
      user_id: 'u1',
      date: '2025-06-11',
      check_in_time: '18:30',
      check_out_time: null as string | null,
      status: 'present' as const,
      is_overtime: true,
      is_auto_punch_out: false,
      is_early_departure: false,
      needs_review: false,
      duration_minutes: 0,
      last_action_at: '2025-06-11T18:30:00Z',
      is_dev: false,
      created_at: '2025-06-11T18:30:00Z',
      updated_at: '2025-06-11T18:30:00Z',
    };

    function queueGetAttendanceTodayForPunch(sessions: unknown[]) {
      sb.queueResult({ data: sessions, error: null });
      sb.queueResult({ data: profileShift, error: null });
      sb.queueResult({ data: policyRow, error: null });
      sb.queueResult({ data: null, error: null });
    }

    beforeEach(() => {
      vi.mocked(sb.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'test-access-token' } },
        error: null,
      } as never);
    });

    afterEach(() => {
      vi.mocked(sb.auth.getSession).mockReset();
      vi.mocked(sb.functions.invoke).mockReset();
    });

    it('returns overtimeRequest after punch when session is overtime', async () => {
      vi.mocked(sb.functions.invoke).mockResolvedValue({
        data: otSession,
        error: null,
      } as never);
      queueGetAttendanceTodayForPunch([otSession]);
      sb.queueResult({
        data: {
          id: 'or1',
          org_id: 'o1',
          user_id: 'u1',
          session_id: 'sess-ot-1',
          status: 'pending',
        },
        error: null,
      });

      const { checkIn } = await import('./attendance.service');
      const r = await checkIn('u1');

      expect(sb.functions.invoke).toHaveBeenCalledWith(
        'punch',
        expect.objectContaining({
          body: expect.objectContaining({ action: 'check_in' }),
          headers: { Authorization: 'Bearer test-access-token' },
        })
      );
      expect(r.overtimeRequest).not.toBeNull();
      expect((r.overtimeRequest as { session_id?: string })?.session_id).toBe('sess-ot-1');
      expect(r.log.check_in_time).toBe('18:30');
    });

    it('does not query overtime_requests when session is not overtime', async () => {
      const regularSession = { ...otSession, id: 'sess-reg-1', is_overtime: false };
      vi.mocked(sb.functions.invoke).mockResolvedValue({
        data: regularSession,
        error: null,
      } as never);
      queueGetAttendanceTodayForPunch([regularSession]);
      sb.from.mockClear();

      const { checkIn } = await import('./attendance.service');
      const r = await checkIn('u1');

      expect(r.overtimeRequest).toBeNull();
      expect(sb.from.mock.calls.some((c) => c[0] === 'overtime_requests')).toBe(false);
    });

    it('throws when punch invoke returns an error payload', async () => {
      vi.mocked(sb.functions.invoke).mockResolvedValue({
        data: { error: 'Already checked in', code: 'conflict' },
        error: null,
      } as never);

      const { checkIn } = await import('./attendance.service');
      await expect(checkIn('u1')).rejects.toThrow(/Already checked in/);
    });
  });

  describe('checkOut (Edge Function punch path)', () => {
    const closedRegular = {
      id: 'sess-reg',
      org_id: 'o1',
      user_id: 'u1',
      date: '2025-06-11',
      check_in_time: '09:00',
      check_out_time: '18:00',
      status: 'present' as const,
      is_overtime: false,
      is_auto_punch_out: false,
      is_early_departure: false,
      needs_review: false,
      duration_minutes: 540,
      last_action_at: '2025-06-11T19:00:00Z',
      is_dev: false,
      created_at: '2025-06-11T09:00:00Z',
      updated_at: '2025-06-11T19:00:00Z',
    };

    beforeEach(() => {
      vi.mocked(sb.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'test-access-token' } },
        error: null,
      } as never);
    });

    afterEach(() => {
      vi.mocked(sb.auth.getSession).mockReset();
      vi.mocked(sb.functions.invoke).mockReset();
    });

    it('returns overtimeRequest after late-stay split checkout', async () => {
      vi.mocked(sb.functions.invoke).mockResolvedValue({
        data: {
          session: closedRegular,
          late_stay_overtime_session_id: 'sess-ot-split',
        },
        error: null,
      } as never);
      sb.queueResult({
        data: {
          id: 'or-split',
          org_id: 'o1',
          user_id: 'u1',
          session_id: 'sess-ot-split',
          status: 'pending',
          reviewed_by: null,
          note: null,
          created_at: '2025-06-11T19:00:00Z',
          updated_at: '2025-06-11T19:00:00Z',
        },
        error: null,
      });
      const otSplit = {
        ...closedRegular,
        id: 'sess-ot-split',
        check_in_time: '18:00',
        check_out_time: '19:00',
        is_overtime: true,
        duration_minutes: 60,
      };
      sb.queueResult({ data: [closedRegular, otSplit], error: null });
      sb.queueResult({ data: profileShift, error: null });
      sb.queueResult({ data: policyRow, error: null });
      sb.queueResult({ data: null, error: null });

      const { checkOut } = await import('./attendance.service');
      const r = await checkOut('u1');

      expect(r.overtimeRequest).not.toBeNull();
      expect(r.overtimeRequest?.session_id).toBe('sess-ot-split');
      expect(r.log.check_out_time).toBeDefined();
    });

    it('allows discarded short overtime checkout to return a null log without error', async () => {
      vi.mocked(sb.functions.invoke).mockResolvedValue({
        data: {
          session: null,
          discarded_overtime_session_id: 'sess-ot-short',
        },
        error: null,
      } as never);
      sb.queueResult({ data: [], error: null });
      sb.queueResult({ data: profileShift, error: null });
      sb.queueResult({ data: policyRow, error: null });
      sb.queueResult({ data: null, error: null });

      const { checkOut } = await import('./attendance.service');
      const r = await checkOut('u1');

      expect(r.overtimeRequest).toBeNull();
      expect(r.log).toBeNull();
    });
  });

  describe('runAutoPunchOut', () => {
    beforeEach(() => {
      vi.mocked(sb.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'admin-access-token' } },
        error: null,
      } as never);
    });

    afterEach(() => {
      vi.mocked(sb.auth.getSession).mockReset();
      vi.mocked(sb.functions.invoke).mockReset();
    });

    it('invokes the auto-punch-out edge function with the current auth token', async () => {
      vi.mocked(sb.functions.invoke).mockResolvedValue({
        data: { processed: 3, total: 5 },
        error: null,
      } as never);

      const { runAutoPunchOut } = await import('./attendance.service');
      const result = await runAutoPunchOut();

      expect(sb.functions.invoke).toHaveBeenCalledWith(
        'auto-punch-out',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer admin-access-token' },
        })
      );
      expect(result).toEqual({ processed: 3, total: 5, message: undefined });
    });

    it('throws when the edge function returns an error payload', async () => {
      vi.mocked(sb.functions.invoke).mockResolvedValue({
        data: { error: 'Forbidden', code: 'FORBIDDEN' },
        error: null,
      } as never);

      const { runAutoPunchOut } = await import('./attendance.service');
      await expect(runAutoPunchOut()).rejects.toThrow(/Forbidden/);
    });
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
    const { log } = await checkOut('u1');
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

  describe('getTodayPunchUiState / isCheckedInToday (pseudo log + sessions)', () => {
    it('24.1a treats open second session as checked in despite aggregate log check_out_time', async () => {
      vi.setSystemTime(new Date('2025-06-10T13:20:00'));
      const { getTodayPunchUiState, isCheckedInToday } = await import('./attendance.service');
      const today = todayRecord24_1a();
      expect(isCheckedInToday(today)).toBe(true);
      const ui = getTodayPunchUiState(today);
      expect(ui.isCheckedIn).toBe(true);
      expect(ui.activeCheckInWallTime).toBe('13:00');
      expect(ui.isOvertimeNow).toBe(false);
      expect(ui.canPunchIn).toBe(true);
    });

    it('24.1 treats open third session as checked in despite stale aggregate check_out_time', async () => {
      vi.setSystemTime(new Date('2025-06-10T15:00:00'));
      const { getTodayPunchUiState, isCheckedInToday } = await import('./attendance.service');
      const today = todayRecord24_1();
      expect(isCheckedInToday(today)).toBe(true);
      const ui = getTodayPunchUiState(today);
      expect(ui.isCheckedIn).toBe(true);
      expect(ui.activeCheckInWallTime).toBe('14:30');
      expect(ui.isOvertimeNow).toBe(false);
      expect(ui.canPunchIn).toBe(true);
    });
  });
});

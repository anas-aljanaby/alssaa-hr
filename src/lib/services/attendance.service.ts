import { supabase } from '../supabase';
import type { Tables, InsertTables } from '../database.types';
import { now } from '../time';
import type { LeaveRequest } from './requests.service';

export type AttendanceLog = Tables<'attendance_logs'>;
export type AttendanceLogInsert = InsertTables<'attendance_logs'>;
export type AttendanceStatus = AttendanceLog['status'];
export type AttendanceSession = Tables<'attendance_sessions'>;
export type AttendanceDailySummary = Tables<'attendance_daily_summary'>;
export type AttendanceEffectiveStatus = AttendanceDailySummary['effective_status'];
export type CalendarStatus = AttendanceStatus | 'overtime_only' | 'overtime_offday' | 'weekend' | 'future' | null;

export type PunchType = 'clock_in' | 'clock_out';

export interface PunchEntry {
  id: string;
  timestamp: string;
  type: PunchType;
  isOvertime: boolean;
}

export interface ShiftInfo {
  workStartTime: string;
  workEndTime: string;
  gracePeriodMinutes: number;
  /** Minutes after shift end during which manual punch-out is allowed; after this the auto punch-out job runs. */
  bufferMinutesAfterShift: number;
  /** JavaScript getDay() values that are off (e.g. [5, 6] = Fri, Sat). Default [5, 6]. */
  weeklyOffDays: number[];
}

export interface TodayRecord {
  log: AttendanceLog | null;
  punches: PunchEntry[];
  shift: ShiftInfo | null;
  sessions?: AttendanceSession[];
  summary?: AttendanceDailySummary | null;
}

export interface DayRecord {
  log: AttendanceLog | null;
  punches: PunchEntry[];
  shift: ShiftInfo | null;
  totalMinutesWorked: number;
  sessions?: AttendanceSession[];
  summary?: AttendanceDailySummary | null;
}

export interface MonthDaySummary {
  date: string;
  status: CalendarStatus;
  totalMinutesWorked: number;
}

function resolveCalendarStatus(
  dateStr: string,
  isOffDay: boolean,
  summary: AttendanceDailySummary | undefined,
  todayStr_: string
): CalendarStatus {
  const isFuture = dateStr > todayStr_;
  const isToday = dateStr === todayStr_;

  if (isFuture) return 'future';
  if (summary?.effective_status === 'present') return 'present';
  if (summary?.effective_status === 'late') return 'late';
  if (summary?.effective_status === 'absent') return 'absent';
  if (summary?.effective_status === 'on_leave') return 'on_leave';
  if (summary?.effective_status === 'overtime_only') return 'overtime_only';

  // Off-day with attendance is rendered as overtime day (no effective_status by policy).
  if (isOffDay && (summary?.session_count ?? 0) > 0) return 'overtime_offday';

  // Working day with sessions but unresolved summary should still appear as overtime-only.
  if (!isOffDay && (summary?.session_count ?? 0) > 0) return 'overtime_only';

  if (isOffDay) return 'weekend';

  // Policy defines absent for past working day only; today's empty state remains neutral.
  if (isToday) return null;
  return 'absent';
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Unified overtime check. A time is "overtime" when:
 * - It's a non-working day, OR
 * - On a working day: before (shiftStart - 60) or after shiftEnd
 *
 * The 1-hour window before shift start is "early login" (not overtime).
 * Anything after shift end is overtime. The buffer only controls auto-punch-out timing.
 */
export function isOvertimeTime(timeMinutes: number, shift: ShiftInfo, dayOfWeek: number): boolean {
  const isWorkingDay = !(shift.weeklyOffDays ?? [5, 6]).includes(dayOfWeek);
  if (!isWorkingDay) return true;
  const startMin = toMinutes(shift.workStartTime);
  const endMin = toMinutes(shift.workEndTime);
  return timeMinutes < startMin - 60 || timeMinutes > endMin;
}

function buildPunchesFromSessions(sessions: AttendanceSession[]): PunchEntry[] {
  const punches: PunchEntry[] = [];
  const sorted = [...sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));

  for (const session of sorted) {
    punches.push({
      id: `${session.id}-in`,
      timestamp: session.check_in_time,
      type: 'clock_in',
      isOvertime: session.is_overtime,
    });
    if (session.check_out_time) {
      punches.push({
        id: `${session.id}-out`,
        timestamp: session.check_out_time,
        type: 'clock_out',
        isOvertime: session.is_overtime,
      });
    }
  }

  return punches;
}

function computeTotalMinutesFromSessions(sessions: AttendanceSession[]): number {
  return sessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
}

function normalizeSessions(data: unknown, dateHint: string): AttendanceSession[] {
  if (Array.isArray(data)) return data as AttendanceSession[];
  if (!data || typeof data !== 'object') return [];
  const row = data as Partial<AttendanceLog>;
  if (!row.check_in_time) return [];
  return [{
    id: String(row.id ?? `legacy-${dateHint}`),
    org_id: String(row.org_id ?? ''),
    user_id: String(row.user_id ?? ''),
    date: String(row.date ?? dateHint),
    check_in_time: row.check_in_time,
    check_out_time: row.check_out_time ?? null,
    status: row.status === 'late' ? 'late' : 'present',
    is_overtime: false,
    is_auto_punch_out: Boolean(row.auto_punch_out),
    is_early_departure: false,
    needs_review: false,
    duration_minutes: row.check_out_time ? Math.max(0, toMinutes(row.check_out_time) - toMinutes(row.check_in_time)) : 0,
    last_action_at: new Date().toISOString(),
    is_dev: Boolean(row.is_dev),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }];
}

function normalizeSummary(data: unknown): AttendanceDailySummary | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Partial<AttendanceDailySummary>;
  if (typeof row.date !== 'string' || typeof row.user_id !== 'string') return null;
  return row as AttendanceDailySummary;
}

function buildPseudoLog(
  date: string,
  sessions: AttendanceSession[],
  summary: AttendanceDailySummary | null
): AttendanceLog | null {
  if (!sessions.length && !summary) return null;
  const sorted = [...sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  const first = sorted[0];
  const last = [...sorted].reverse().find((s) => !!s.check_out_time) ?? sorted[sorted.length - 1];
  const rawStatus = summary?.effective_status ?? first?.status ?? null;
  const status: AttendanceLog['status'] =
    rawStatus === 'overtime_only'
      ? 'present'
      : (rawStatus as AttendanceLog['status']) ?? 'present';

  return {
    id: summary?.id ?? first?.id ?? `pseudo-${date}`,
    org_id: summary?.org_id ?? first?.org_id ?? '',
    user_id: summary?.user_id ?? first?.user_id ?? '',
    date,
    check_in_time: summary?.first_check_in ?? first?.check_in_time ?? null,
    check_out_time: summary?.last_check_out ?? last?.check_out_time ?? null,
    check_in_lat: null,
    check_in_lng: null,
    check_out_lat: null,
    check_out_lng: null,
    status,
    is_dev: false,
    auto_punch_out: sessions.some((s) => !!s.is_auto_punch_out),
  };
}

/** Returns effective shift for a user: per-user schedule if set, else org policy. */
export async function getEffectiveShiftForUser(userId: string): Promise<ShiftInfo | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('work_days, work_start_time, work_end_time, org_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile) return null;

  const hasCustomSchedule =
    profile.work_days &&
    profile.work_days.length > 0 &&
    profile.work_start_time &&
    profile.work_end_time;

  if (hasCustomSchedule) {
    const { data: policy } = await supabase
      .from('attendance_policy')
      .select('grace_period_minutes, auto_punch_out_buffer_minutes')
      .eq('org_id', profile.org_id)
      .limit(1)
      .maybeSingle();

    const weeklyOffDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !profile.work_days!.includes(d));
    return {
      workStartTime: profile.work_start_time!,
      workEndTime: profile.work_end_time!,
      gracePeriodMinutes: policy?.grace_period_minutes ?? 15,
      bufferMinutesAfterShift: policy?.auto_punch_out_buffer_minutes ?? 30,
      weeklyOffDays,
    };
  }

  const { data: policy } = await supabase
    .from('attendance_policy')
    .select('work_start_time, work_end_time, grace_period_minutes, auto_punch_out_buffer_minutes, weekly_off_days')
    .eq('org_id', profile.org_id)
    .limit(1)
    .maybeSingle();

  if (!policy) return null;
  return {
    workStartTime: policy.work_start_time,
    workEndTime: policy.work_end_time,
    gracePeriodMinutes: policy.grace_period_minutes,
    bufferMinutesAfterShift: policy.auto_punch_out_buffer_minutes ?? 30,
    weeklyOffDays: policy.weekly_off_days ?? [5, 6],
  };
}

export async function getAttendanceToday(userId: string): Promise<TodayRecord> {
  const today = todayStr();
  const sessionsRes = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .order('check_in_time', { ascending: true });
  const shift = await getEffectiveShiftForUser(userId);
  const summaryRes = await supabase
    .from('attendance_daily_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (sessionsRes.error) throw sessionsRes.error;
  if (summaryRes.error) throw summaryRes.error;

  const sessions = normalizeSessions(sessionsRes.data, today);
  const summary = normalizeSummary(summaryRes.data);
  const punches = buildPunchesFromSessions(sessions);
  const log = buildPseudoLog(today, sessions, summary);

  return { log, punches, shift, sessions, summary };
}

export async function getAttendanceDay(userId: string, date: string): Promise<DayRecord> {
  const [sessionsRes, summaryRes, shift] = await Promise.all([
    supabase
      .from('attendance_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('check_in_time', { ascending: true }),
    supabase
      .from('attendance_daily_summary')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle(),
    getEffectiveShiftForUser(userId),
  ]);

  if (sessionsRes.error) throw sessionsRes.error;
  if (summaryRes.error) throw summaryRes.error;

  const sessions = normalizeSessions(sessionsRes.data, date);
  const summary = normalizeSummary(summaryRes.data);
  const punches = buildPunchesFromSessions(sessions);
  const totalMinutesWorked = summary?.total_work_minutes ?? computeTotalMinutesFromSessions(sessions);
  const log = buildPseudoLog(date, sessions, summary);

  return { log, punches, shift, totalMinutesWorked, sessions, summary };
}

export async function getAttendanceMonthly(
  userId: string,
  year: number,
  month: number
): Promise<MonthDaySummary[]> {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [summariesRes, shift] = await Promise.all([
    supabase
      .from('attendance_daily_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to),
    getEffectiveShiftForUser(userId),
  ]);

  if (summariesRes.error) throw summariesRes.error;
  const summaryMap = new Map((summariesRes.data ?? []).map((s) => [s.date, s]));
  const offDays = shift?.weeklyOffDays ?? [5, 6];

  const today = now();
  const todayStr_ = todayStr(today);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const summaries: MonthDaySummary[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(dateStr).getDay();
    const isOffDay = offDays.includes(dayOfWeek);
    const summary = summaryMap.get(dateStr);
    const status = resolveCalendarStatus(dateStr, isOffDay, summary, todayStr_);

    summaries.push({
      date: dateStr,
      status,
      totalMinutesWorked: summary?.total_work_minutes ?? 0,
    });
  }

  return summaries;
}

export function todayStr(d?: Date): string {
  const date = d ?? now();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function nowTimeStr(d?: Date): string {
  const date = d ?? now();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export async function getTodayLog(userId: string): Promise<AttendanceLog | null> {
  const today = todayStr();
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface CheckInResult {
  log: AttendanceLog;
  overtimeRequest: LeaveRequest | null;
}

type EdgeInvokeResult = {
  data?: unknown;
  error?: { message?: string } | null;
};

async function invokePunchAuthenticated(payload: { action: 'check_in' | 'check_out'; devOverrideTime?: string }): Promise<EdgeInvokeResult | null> {
  const edgeInvoke = (supabase as unknown as { functions?: { invoke?: Function } }).functions?.invoke;
  if (typeof edgeInvoke !== 'function') return null;

  const getSession = (supabase as unknown as { auth?: { getSession?: Function } }).auth?.getSession;
  if (typeof getSession !== 'function') {
    return await supabase.functions.invoke('punch', { body: payload }) as EdgeInvokeResult;
  }

  const sessionResult = await supabase.auth.getSession();
  // Test mocks may not provide an auth session shape; fall back to legacy flow.
  if (!sessionResult || typeof sessionResult !== 'object' || !('data' in sessionResult)) {
    return null;
  }
  const session = sessionResult?.data?.session;
  const sessionError = sessionResult?.error;
  if (sessionError || !session?.access_token) {
    throw new Error('انتهت الجلسة أو أنك غير مسجل الدخول. يرجى تسجيل الدخول مرة أخرى.');
  }

  return await supabase.functions.invoke('punch', {
    body: payload,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  }) as EdgeInvokeResult;
}

export async function checkIn(userId: string): Promise<CheckInResult> {
  const invoked = await invokePunchAuthenticated({ action: 'check_in' });
  if (invoked) {
    const data = invoked.data;
    const error = invoked.error;
    if (error) throw new Error(error.message || 'Failed to check in');

    const session = data as AttendanceSession;
    const today = await getAttendanceToday(userId);
    const log = today.log ?? buildPseudoLog(todayStr(), [session], null);
    if (!log) {
      throw new Error('Unable to build check-in result');
    }

    let overtimeRequest: LeaveRequest | null = null;
    if (session?.is_overtime) {
      try {
        const { data: req } = await supabase
          .from('overtime_requests')
          .select('*')
          .eq('session_id', session.id)
          .maybeSingle();
        overtimeRequest = req as unknown as LeaveRequest | null;
      } catch {
        overtimeRequest = null;
      }
    }

    return { log, overtimeRequest };
  }

  return checkInLegacy(userId);
}

async function checkInLegacy(userId: string): Promise<CheckInResult> {
  const today = todayStr();
  const time = nowTimeStr();
  const { data: existing, error: existingError } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.check_in_time && !existing?.check_out_time) {
    throw new Error('Already checked in today');
  }

  const shift = await getEffectiveShiftForUser(userId);
  const nowDate = now();
  const dayOfWeek = nowDate.getDay();
  const nowMin = toMinutes(time);
  const isWorkingDay = shift ? !(shift.weeklyOffDays ?? [5, 6]).includes(dayOfWeek) : true;
  const isOvertimePunch = shift ? isOvertimeTime(nowMin, shift, dayOfWeek) : false;

  let status: AttendanceStatus = 'present';
  if (shift && !isOvertimePunch && isWorkingDay) {
    const startMinutes = toMinutes(shift.workStartTime) + shift.gracePeriodMinutes;
    if (nowMin > startMinutes) status = 'late';
  }

  let log: AttendanceLog;
  if (existing) {
    const { data: updated, error } = await supabase
      .from('attendance_logs')
      .update({ check_in_time: time, check_out_time: null, status })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    log = updated;
  } else {
    const { data: inserted, error } = await supabase
      .from('attendance_logs')
      .insert({ user_id: userId, date: today, check_in_time: time, status })
      .select()
      .single();
    if (error) throw error;
    log = inserted;
  }

  let overtimeRequest: LeaveRequest | null = null;
  if (isOvertimePunch || !isWorkingDay) {
    // Legacy mode cannot create session-linked overtime_requests safely.
    overtimeRequest = null;
  }

  return { log, overtimeRequest };
}

export async function checkOut(userId: string, checkoutTime?: string): Promise<AttendanceLog> {
  const payload = checkoutTime
    ? { action: 'check_out' as const, devOverrideTime: `${todayStr()}T${checkoutTime}:00` }
    : { action: 'check_out' as const };
  const invoked = await invokePunchAuthenticated(payload);
  if (invoked) {
    const error = invoked.error;
    if (error) throw new Error(error.message || 'Failed to check out');

    const today = await getAttendanceToday(userId);
    if (!today.log) {
      throw new Error('Unable to load updated attendance log');
    }
    return today.log;
  }

  return checkOutLegacy(userId, checkoutTime);
}

async function checkOutLegacy(userId: string, checkoutTime?: string): Promise<AttendanceLog> {
  const today = todayStr();
  const time = checkoutTime ?? nowTimeStr();
  const { data: existing, error: existingError } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing?.check_in_time) throw new Error('Must check in before checking out');
  if (existing.check_out_time) throw new Error('Already checked out today');

  const { data, error } = await supabase
    .from('attendance_logs')
    .update({ check_out_time: time, auto_punch_out: false })
    .eq('id', existing.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLogsInRange(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<AttendanceLog[]> {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getMonthlyLogs(
  userId: string,
  year: number,
  month: number
): Promise<AttendanceLog[]> {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return getLogsInRange(userId, from, to);
}

export interface MonthlyStats {
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  totalWorkingDays: number;
}

export async function getMonthlyStats(
  userId: string,
  year: number,
  month: number
): Promise<MonthlyStats> {
  const summaries = await getAttendanceMonthly(userId, year, month);

  return {
    presentDays: summaries.filter((d) => d.status === 'present').length,
    lateDays: summaries.filter((d) => d.status === 'late').length,
    absentDays: summaries.filter((d) => d.status === 'absent').length,
    leaveDays: summaries.filter((d) => d.status === 'on_leave').length,
    totalWorkingDays: summaries.filter((d) => d.status !== 'future' && d.status !== 'weekend').length,
  };
}

export async function getDepartmentLogsForDate(
  departmentId: string,
  date: string
): Promise<AttendanceLog[]> {
  const { data: employees, error: empErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('department_id', departmentId);

  if (empErr) throw empErr;
  if (!employees?.length) return [];

  const userIds = employees.map((e) => e.id);

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .in('user_id', userIds)
    .eq('date', date)
    .order('check_in_time');

  if (error) throw error;
  return data ?? [];
}

export async function getAllLogsForDate(date: string): Promise<AttendanceLog[]> {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('date', date)
    .order('check_in_time');

  if (error) throw error;
  return data ?? [];
}

export type AttendanceChangeEvent = {
  eventType: 'INSERT' | 'UPDATE';
  new: AttendanceLog;
  old: Partial<AttendanceLog>;
};

export function subscribeToAttendanceLogs(
  onEvent: (event: AttendanceChangeEvent) => void
): () => void {
  const channel = supabase
    .channel('attendance_logs:all')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
      (payload) => onEvent({ eventType: 'INSERT', new: payload.new as AttendanceLog, old: {} })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'attendance_logs' },
      (payload) =>
        onEvent({
          eventType: 'UPDATE',
          new: payload.new as AttendanceLog,
          old: payload.old as Partial<AttendanceLog>,
        })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToUserAttendance(
  userId: string,
  onEvent: (event: AttendanceChangeEvent) => void
): () => void {
  const channel = supabase
    .channel(`attendance_logs:user:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_logs',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onEvent({ eventType: 'INSERT', new: payload.new as AttendanceLog, old: {} })
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'attendance_logs',
        filter: `user_id=eq.${userId}`,
      },
      (payload) =>
        onEvent({
          eventType: 'UPDATE',
          new: payload.new as AttendanceLog,
          old: payload.old as Partial<AttendanceLog>,
        })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

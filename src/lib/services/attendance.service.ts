import { supabase } from '../supabase';
import type { Tables, InsertTables } from '../database.types';
import { now } from '../time';

export type AttendanceLog = Tables<'attendance_logs'>;
export type AttendanceLogInsert = InsertTables<'attendance_logs'>;
export type AttendanceStatus = AttendanceLog['status'];

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
  /** JavaScript getDay() values that are off (e.g. [5, 6] = Fri, Sat). Default [5, 6]. */
  weeklyOffDays: number[];
}

export interface TodayRecord {
  log: AttendanceLog | null;
  punches: PunchEntry[];
  shift: ShiftInfo | null;
}

export interface DayRecord {
  log: AttendanceLog | null;
  punches: PunchEntry[];
  shift: ShiftInfo | null;
  totalMinutesWorked: number;
}

export interface MonthDaySummary {
  date: string;
  status: AttendanceStatus | 'weekend' | 'future' | null;
  totalMinutesWorked: number;
}

function buildPunches(log: Pick<AttendanceLog, 'id' | 'check_in_time' | 'check_out_time'>, shift: ShiftInfo | null): PunchEntry[] {
  if (!log.check_in_time) return [];

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const shiftStartMinutes = shift ? toMinutes(shift.workStartTime) : null;
  const shiftEndMinutes = shift ? toMinutes(shift.workEndTime) : null;
  const outsideWorkingHours = (minutes: number) =>
    shiftStartMinutes !== null &&
    shiftEndMinutes !== null &&
    (minutes < shiftStartMinutes || minutes > shiftEndMinutes);

  const punches: PunchEntry[] = [];

  const inTime = log.check_in_time;
  const inMinutes = toMinutes(inTime);
  const inOvertime = outsideWorkingHours(inMinutes);

  punches.push({
    id: `${log.id}-in`,
    timestamp: inTime,
    type: 'clock_in',
    isOvertime: inOvertime,
  });

  if (log.check_out_time) {
    const outTime = log.check_out_time;
    const outMinutes = toMinutes(outTime);
    const outOvertime = outsideWorkingHours(outMinutes);

    punches.push({
      id: `${log.id}-out`,
      timestamp: outTime,
      type: 'clock_out',
      isOvertime: outOvertime,
    });
  }

  return punches;
}

function computeTotalMinutes(log: AttendanceLog): number {
  if (!log.check_in_time || !log.check_out_time) return 0;
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return Math.max(0, toMinutes(log.check_out_time) - toMinutes(log.check_in_time));
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
      .select('grace_period_minutes')
      .eq('org_id', profile.org_id)
      .limit(1)
      .maybeSingle();

    const weeklyOffDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !profile.work_days!.includes(d));
    return {
      workStartTime: profile.work_start_time!,
      workEndTime: profile.work_end_time!,
      gracePeriodMinutes: policy?.grace_period_minutes ?? 15,
      weeklyOffDays,
    };
  }

  const { data: policy } = await supabase
    .from('attendance_policy')
    .select('work_start_time, work_end_time, grace_period_minutes, weekly_off_days')
    .eq('org_id', profile.org_id)
    .limit(1)
    .maybeSingle();

  if (!policy) return null;
  return {
    workStartTime: policy.work_start_time,
    workEndTime: policy.work_end_time,
    gracePeriodMinutes: policy.grace_period_minutes,
    weeklyOffDays: policy.weekly_off_days ?? [5, 6],
  };
}

export async function getAttendanceToday(userId: string): Promise<TodayRecord> {
  const [log, shift] = await Promise.all([getTodayLog(userId), getEffectiveShiftForUser(userId)]);

  const punches = log ? buildPunches(log, shift) : [];

  return { log, punches, shift };
}

export async function getAttendanceDay(userId: string, date: string): Promise<DayRecord> {
  const [logRes, shift] = await Promise.all([
    supabase.from('attendance_logs').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    getEffectiveShiftForUser(userId),
  ]);

  if (logRes.error) throw logRes.error;

  const log = logRes.data ?? null;
  const punches = log ? buildPunches(log, shift) : [];
  const totalMinutesWorked = log ? computeTotalMinutes(log) : 0;

  return { log, punches, shift, totalMinutesWorked };
}

export async function getAttendanceMonthly(
  userId: string,
  year: number,
  month: number
): Promise<MonthDaySummary[]> {
  const logs = await getMonthlyLogs(userId, year, month);
  const logMap = new Map(logs.map((l) => [l.date, l]));

  const today = now();
  const todayStr_ = todayStr(today);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const summaries: MonthDaySummary[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(dateStr).getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isFuture = dateStr > todayStr_;

    const log = logMap.get(dateStr);

    let status: MonthDaySummary['status'] = null;
    if (isFuture) status = 'future';
    else if (isWeekend && !log) status = 'weekend';
    else if (log) status = log.status;

    summaries.push({
      date: dateStr,
      status,
      totalMinutesWorked: log ? computeTotalMinutes(log) : 0,
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

export async function checkIn(userId: string): Promise<AttendanceLog> {
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

  let status: AttendanceStatus = 'present';
  if (shift) {
    const [startH, startM] = shift.workStartTime.split(':').map(Number);
    const grace = shift.gracePeriodMinutes;
    const [nowH, nowM] = time.split(':').map(Number);
    const startMinutes = startH * 60 + startM + grace;
    const nowMinutes = nowH * 60 + nowM;
    if (nowMinutes > startMinutes) status = 'late';
  }

  if (existing) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .update({
        check_in_time: time,
        check_out_time: null,
        status,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('attendance_logs')
    .insert({
      user_id: userId,
      date: today,
      check_in_time: time,
      status,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function checkOut(userId: string, checkoutTime?: string): Promise<AttendanceLog> {
  const today = todayStr();
  const time = checkoutTime ?? nowTimeStr();

  const { data: existing, error: existingError } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing?.check_in_time) {
    throw new Error('Must check in before checking out');
  }
  if (existing.check_out_time) {
    throw new Error('Already checked out today');
  }

  const { data, error } = await supabase
    .from('attendance_logs')
    .update({
      check_out_time: time,
    })
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
  const logs = await getMonthlyLogs(userId, year, month);

  return {
    presentDays: logs.filter((l) => l.status === 'present').length,
    lateDays: logs.filter((l) => l.status === 'late').length,
    absentDays: logs.filter((l) => l.status === 'absent').length,
    leaveDays: logs.filter((l) => l.status === 'on_leave').length,
    totalWorkingDays: logs.length,
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

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
  location?: { lat: number; lng: number } | null;
}

export interface ShiftInfo {
  workStartTime: string;
  workEndTime: string;
  gracePeriodMinutes: number;
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

function buildPunches(log: AttendanceLog, shift: ShiftInfo | null): PunchEntry[] {
  if (!log.check_in_time) return [];

  const shiftEndMinutes = shift
    ? shift.workEndTime.split(':').reduce((h, m, i) => i === 0 ? Number(h) * 60 : Number(h) + Number(m), 0 as unknown as number)
    : null;

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const punches: PunchEntry[] = [];

  const inTime = log.check_in_time;
  const inMinutes = toMinutes(inTime);
  const inOvertime = shiftEndMinutes !== null && inMinutes > (shiftEndMinutes as number);

  punches.push({
    id: `${log.id}-in`,
    timestamp: inTime,
    type: 'clock_in',
    isOvertime: inOvertime,
    location: log.check_in_lat != null && log.check_in_lng != null
      ? { lat: log.check_in_lat, lng: log.check_in_lng }
      : null,
  });

  if (log.check_out_time) {
    const outTime = log.check_out_time;
    const outMinutes = toMinutes(outTime);
    const outOvertime = shiftEndMinutes !== null && outMinutes > (shiftEndMinutes as number);

    punches.push({
      id: `${log.id}-out`,
      timestamp: outTime,
      type: 'clock_out',
      isOvertime: outOvertime,
      location: log.check_out_lat != null && log.check_out_lng != null
        ? { lat: log.check_out_lat, lng: log.check_out_lng }
        : null,
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

export async function getAttendanceToday(userId: string): Promise<TodayRecord> {
  const [log, policy] = await Promise.all([
    getTodayLog(userId),
    supabase.from('attendance_policy').select('work_start_time, work_end_time, grace_period_minutes').limit(1).maybeSingle(),
  ]);

  const shift: ShiftInfo | null = policy.data
    ? {
        workStartTime: policy.data.work_start_time,
        workEndTime: policy.data.work_end_time,
        gracePeriodMinutes: policy.data.grace_period_minutes,
      }
    : null;

  const punches = log ? buildPunches(log, shift) : [];

  return { log, punches, shift };
}

export async function getAttendanceDay(userId: string, date: string): Promise<DayRecord> {
  const [logRes, policy] = await Promise.all([
    supabase.from('attendance_logs').select('*').eq('user_id', userId).eq('date', date).eq('is_dev', false).maybeSingle(),
    supabase.from('attendance_policy').select('work_start_time, work_end_time, grace_period_minutes').limit(1).maybeSingle(),
  ]);

  if (logRes.error) throw logRes.error;

  const shift: ShiftInfo | null = policy.data
    ? {
        workStartTime: policy.data.work_start_time,
        workEndTime: policy.data.work_end_time,
        gracePeriodMinutes: policy.data.grace_period_minutes,
      }
    : null;

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
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayStr())
    .eq('is_dev', false)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function checkIn(
  userId: string,
  coords?: { lat: number; lng: number }
): Promise<AttendanceLog> {
  const today = todayStr();
  const time = nowTimeStr();

  const existing = await getTodayLog(userId);
  if (existing?.check_in_time && !existing?.check_out_time) {
    throw new Error('Already checked in today');
  }

  const policyRes = await supabase
    .from('attendance_policy')
    .select('work_start_time, grace_period_minutes')
    .limit(1)
    .single();

  let status: AttendanceStatus = 'present';
  if (policyRes.data) {
    const [startH, startM] = policyRes.data.work_start_time.split(':').map(Number);
    const grace = policyRes.data.grace_period_minutes;
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
        check_in_lat: coords?.lat ?? null,
        check_in_lng: coords?.lng ?? null,
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
      check_in_lat: coords?.lat ?? null,
      check_in_lng: coords?.lng ?? null,
      status,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function checkOut(
  userId: string,
  coords?: { lat: number; lng: number }
): Promise<AttendanceLog> {
  const time = nowTimeStr();

  const existing = await getTodayLog(userId);
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
      check_out_lat: coords?.lat ?? null,
      check_out_lng: coords?.lng ?? null,
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
    .eq('is_dev', false)
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
    .eq('is_dev', false)
    .order('check_in_time');

  if (error) throw error;
  return data ?? [];
}

export async function getAllLogsForDate(date: string): Promise<AttendanceLog[]> {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('date', date)
    .eq('is_dev', false)
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

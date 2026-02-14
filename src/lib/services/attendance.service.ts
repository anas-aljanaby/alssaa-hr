import { supabase } from '../supabase';
import type { Tables, InsertTables } from '../database.types';

export type AttendanceLog = Tables<'attendance_logs'>;
export type AttendanceLogInsert = InsertTables<'attendance_logs'>;
export type AttendanceStatus = AttendanceLog['status'];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function getTodayLog(userId: string): Promise<AttendanceLog | null> {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayStr())
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
  if (existing?.check_in_time) {
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
  const today = todayStr();
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

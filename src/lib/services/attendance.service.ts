import { supabase } from '../supabase';
import type { Tables, InsertTables } from '../database.types';
import { now } from '../time';

export type AttendanceLog = Tables<'attendance_logs'>;
export type AttendanceLogInsert = InsertTables<'attendance_logs'>;
export type AttendanceStatus = AttendanceLog['status'];
export type AttendancePolicy = Tables<'attendance_policy'>;

// Punch entry from a session
export interface PunchEntry {
  id: string; // Derived ID (log_id + '_in' or '_out')
  timestamp: string; // HH:mm time string
  type: 'clock_in' | 'clock_out';
  isOvertime: boolean;
  location?: { lat: number; lng: number };
}

// Today's record with all necessary info
export interface TodayRecord {
  log: AttendanceLog | null;
  policy: AttendancePolicy | null;
  punches: PunchEntry[];
  totalHoursWorked?: number; // For completed shifts
  shiftStart: string; // HH:mm
  shiftEnd: string; // HH:mm
  gracePeriodMinutes: number;
  isCheckedIn: boolean;
  isCompleted: boolean;
}

// Single day record with detailed info
export interface DayRecord {
  log: AttendanceLog;
  policy: AttendancePolicy;
  punches: PunchEntry[];
  totalHoursWorked: number;
  shiftStart: string;
  shiftEnd: string;
}

// Monthly summary for calendar
export interface MonthlySummary {
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  totalHoursWorked?: number;
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

// ============================================================
// NEW SPEC FUNCTIONS
// ============================================================

/** Get attendance policy for an organization */
async function getOrgPolicy(orgId: string): Promise<AttendancePolicy | null> {
  const { data, error } = await supabase
    .from('attendance_policy')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Get org_id for a user */
async function getUserOrgId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', userId)
    .single();

  if (error) throw error;
  if (!data?.org_id) throw new Error('User organization not found');
  return data.org_id;
}

/** Calculate total hours worked from check_in_time and check_out_time */
function calculateHoursWorked(checkInTime: string | null, checkOutTime: string | null): number {
  if (!checkInTime || !checkOutTime) return 0;

  const [inH, inM] = checkInTime.split(':').map(Number);
  const [outH, outM] = checkOutTime.split(':').map(Number);

  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;

  return (outMinutes - inMinutes) / 60;
}

/** Check if a punch is overtime based on shift times */
function isOvertimePunch(
  punchTime: string,
  shiftEnd: string,
  isClockOut: boolean
): boolean {
  const [punchH, punchM] = punchTime.split(':').map(Number);
  const [endH, endM] = shiftEnd.split(':').map(Number);

  const punchMinutes = punchH * 60 + punchM;
  const endMinutes = endH * 60 + endM;

  return isClockOut ? punchMinutes > endMinutes : punchMinutes < endMinutes;
}

/** Build punch entries from attendance log */
function buildPunchEntries(
  log: AttendanceLog,
  shiftEnd: string
): PunchEntry[] {
  const punches: PunchEntry[] = [];

  if (log.check_in_time) {
    punches.push({
      id: `${log.id}_in`,
      timestamp: log.check_in_time,
      type: 'clock_in',
      isOvertime: false, // Clock-in is not overtime
      location: log.check_in_lat && log.check_in_lng
        ? { lat: log.check_in_lat, lng: log.check_in_lng }
        : undefined,
    });
  }

  if (log.check_out_time) {
    punches.push({
      id: `${log.id}_out`,
      timestamp: log.check_out_time,
      type: 'clock_out',
      isOvertime: isOvertimePunch(log.check_out_time, shiftEnd, true),
      location: log.check_out_lat && log.check_out_lng
        ? { lat: log.check_out_lat, lng: log.check_out_lng }
        : undefined,
    });
  }

  return punches;
}

/**
 * Get today's attendance record with all punch data and shift info
 */
export async function getAttendanceToday(userId: string): Promise<TodayRecord> {
  const orgId = await getUserOrgId(userId);
  const [log, policy] = await Promise.all([
    getTodayLog(userId),
    getOrgPolicy(orgId),
  ]);

  const shiftStart = policy?.work_start_time ?? '08:00';
  const shiftEnd = policy?.work_end_time ?? '16:00';
  const gracePeriodMinutes = policy?.grace_period_minutes ?? 15;

  const punches = log ? buildPunchEntries(log, shiftEnd) : [];
  const totalHoursWorked = log ? calculateHoursWorked(log.check_in_time, log.check_out_time) : undefined;

  return {
    log,
    policy,
    punches,
    totalHoursWorked,
    shiftStart,
    shiftEnd,
    gracePeriodMinutes,
    isCheckedIn: !!(log?.check_in_time && !log?.check_out_time),
    isCompleted: !!(log?.check_in_time && log?.check_out_time),
  };
}

/**
 * Get a specific day's attendance record with full punch details
 */
export async function getAttendanceDay(userId: string, date: string): Promise<DayRecord> {
  const orgId = await getUserOrgId(userId);
  const policy = await getOrgPolicy(orgId);

  const { data: log, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  if (!log) throw new Error('No attendance record for this date');

  const shiftStart = policy?.work_start_time ?? '08:00';
  const shiftEnd = policy?.work_end_time ?? '16:00';
  const punches = buildPunchEntries(log, shiftEnd);
  const totalHoursWorked = calculateHoursWorked(log.check_in_time, log.check_out_time);

  return {
    log,
    policy: policy!,
    punches,
    totalHoursWorked,
    shiftStart,
    shiftEnd,
  };
}

/**
 * Get monthly attendance with summary for calendar display
 */
export async function getAttendanceMonthlyWithSummary(
  userId: string,
  year: number,
  month: number
): Promise<MonthlySummary[]> {
  const logs = await getMonthlyLogs(userId, year, month);

  return logs.map((log) => ({
    date: log.date,
    status: log.status,
    totalHoursWorked: calculateHoursWorked(log.check_in_time, log.check_out_time),
  }));
}

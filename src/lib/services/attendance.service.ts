import { supabase } from '../supabase';
import type { Database, Tables, InsertTables } from '../database.types';
import { now } from '../time';
import type { OvertimeRequest } from './overtime-requests.service';
import { resolveDisplayStatus, type DayStatus } from '@/shared/attendance';

export type AttendanceLog = Tables<'attendance_logs'>;
export type AttendanceLogInsert = InsertTables<'attendance_logs'>;
export type AttendanceStatus = AttendanceLog['status'];
export type AttendanceSession = Tables<'attendance_sessions'>;
export type AttendanceDailySummary = Tables<'attendance_daily_summary'>;
export type AttendanceEffectiveStatus = AttendanceDailySummary['effective_status'];
export type ProfileRole = Tables<'profiles'>['role'];
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
  /** Org policy: minimum minutes worked to count shift fulfilled; null = use full scheduled duration only in UI logic. */
  minimumRequiredMinutes: number | null;
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

export type TeamAttendanceDisplayStatus = AttendanceEffectiveStatus | 'overtime_offday' | null;
export type AvailabilityState = 'available_now' | 'unavailable_now';
export type AttendanceDayAvailabilityState = 'present_on_date' | 'not_present_on_date';

export interface TeamAttendanceDayRow {
  userId: string;
  nameAr: string;
  employeeId: string;
  role: ProfileRole;
  avatarUrl: string | null;
  departmentId: string | null;
  departmentNameAr: string | null;
  date: string;
  effectiveStatus: AttendanceEffectiveStatus | null;
  displayStatus: TeamAttendanceDisplayStatus;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  totalWorkMinutes: number;
  totalOvertimeMinutes: number;
  hasOvertime: boolean;
  sessionCount: number;
  isCheckedInNow: boolean;
  hasAutoPunchOut: boolean;
  needsReview: boolean;
  isShortDay: boolean;
}

export interface SafeAvailabilityRow {
  userId: string;
  nameAr: string;
  employeeId: string;
  role: ProfileRole;
  avatarUrl: string | null;
  departmentId: string | null;
  departmentNameAr: string | null;
  availabilityState: AvailabilityState;
}

export interface SafeAttendanceDayRow {
  userId: string;
  nameAr: string;
  employeeId: string;
  role: ProfileRole;
  avatarUrl: string | null;
  departmentId: string | null;
  departmentNameAr: string | null;
  date: string;
  attendanceState: AttendanceDayAvailabilityState;
}

type TeamAttendanceDayRpcRow = Database['public']['Functions']['get_team_attendance_day']['Returns'][number];
type RedactedAvailabilityRpcRow =
  Database['public']['Functions']['get_redacted_department_availability']['Returns'][number];
type RedactedAttendanceDayRpcRow =
  Database['public']['Functions']['get_redacted_team_attendance_day']['Returns'][number];

type CalendarResolutionInput = DayStatus | 'overtime_only' | 'overtime_offday';

function resolveCalendarInput(
  dateStr: string,
  isOffDay: boolean,
  summary: AttendanceDailySummary | undefined,
  todayStr_: string,
  joinDate?: string | null
): CalendarResolutionInput {
  const isFuture = dateStr > todayStr_;
  const isToday = dateStr === todayStr_;
  const isBeforeJoinDate = !!joinDate && dateStr < joinDate;

  if (isFuture) return 'future';
  if (isBeforeJoinDate) return 'not_joined';
  if (summary?.effective_status === 'present') return 'present';
  if (summary?.effective_status === 'late') return 'late';
  if (summary?.effective_status === 'absent') return 'absent';
  if (summary?.effective_status === 'on_leave') return 'on_leave';
  if (summary?.effective_status === 'overtime_only') return 'overtime_only';
  if (isOffDay && (summary?.session_count ?? 0) > 0) return 'overtime_offday';
  if (!isOffDay && (summary?.session_count ?? 0) > 0) return 'overtime_only';
  if (isOffDay) return 'weekend';
  if (isToday) return 'not_joined';
  return 'absent';
}

function resolveCalendarStatus(
  dateStr: string,
  isOffDay: boolean,
  summary: AttendanceDailySummary | undefined,
  todayStr_: string,
  joinDate?: string | null
): CalendarStatus {
  const resolved = resolveCalendarInput(dateStr, isOffDay, summary, todayStr_, joinDate);

  if (resolved === 'future') return 'future';
  if (resolved === 'not_joined') return null;
  if (resolved === 'overtime_only' || resolved === 'overtime_offday') return resolved;

  const displayStatus = resolveDisplayStatus(resolved, null, {
    isWithinShiftWindow: false,
  });

  switch (displayStatus) {
    case 'present':
      return 'present';
    case 'late':
      return 'late';
    case 'on_leave_day':
      return 'on_leave';
    case 'weekend':
      return 'weekend';
    case 'absent_day':
    default:
      return 'absent';
  }
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Wall clock minutes from DB time strings (HH:MM or ISO datetime). */
export function wallTimeToMinutes(time: string | null | undefined): number {
  if (!time) return NaN;
  const hm = time.includes('T') ? time.slice(11, 16) : time.slice(0, 5);
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/** HH:MM for display and parsing from DB (may be ISO or HH:MM). */
export function wallTimeHHMM(time: string | null | undefined): string | null {
  if (!time) return null;
  if (time.includes('T')) return time.slice(11, 16);
  return time.slice(0, 5);
}

export function shiftDurationMinutes(shift: ShiftInfo): number {
  const d = toMinutes(shift.workEndTime) - toMinutes(shift.workStartTime);
  return d > 0 ? d : 0;
}

export function totalWorkedMinutesToday(today: TodayRecord): number {
  if (today.summary?.total_work_minutes != null) return today.summary.total_work_minutes;
  if (today.sessions?.length) return computeTotalMinutesFromSessions(today.sessions);
  const log = today.log;
  if (log?.check_in_time && log?.check_out_time) {
    return Math.max(0, wallTimeToMinutes(log.check_out_time) - wallTimeToMinutes(log.check_in_time));
  }
  return 0;
}

/** Latest open session's check-in (wall time), or null if none. */
export function getOpenSessionCheckInTime(today: TodayRecord): string | null {
  const sessions = today.sessions;
  if (!sessions?.length) return null;
  const open = sessions.filter((s) => s.check_out_time == null);
  if (!open.length) return null;
  const sorted = [...open].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  return sorted[sorted.length - 1]!.check_in_time;
}

/** True if the user has an open session, or (legacy) a single open log row with no sessions list. */
export function isCheckedInToday(today: TodayRecord): boolean {
  const openIn = getOpenSessionCheckInTime(today);
  if (openIn) return true;
  const sessions = today.sessions;
  if (sessions && sessions.length > 0) return false;
  const log = today.log;
  return !!(log?.check_in_time && !log?.check_out_time);
}

/** Wall time for the current punch-in (open session or legacy open log). */
export function getActiveCheckInWallTime(today: TodayRecord): string | null {
  const fromSession = getOpenSessionCheckInTime(today);
  if (fromSession) return fromSession;
  const log = today.log;
  if (log?.check_in_time && !log?.check_out_time) return log.check_in_time;
  return null;
}

/** Shared punch CTAs / badges for today status UIs (same inputs → same behavior). */
export interface TodayPunchUiState {
  isCheckedIn: boolean;
  activeCheckInWallTime: string | null;
  isOvertimeNow: boolean;
  canPunchIn: boolean;
  showShiftCongrats: boolean;
}

export function getTodayPunchUiState(today: TodayRecord, at: Date = now()): TodayPunchUiState {
  const { shift } = today;
  const currentMinutes = at.getHours() * 60 + at.getMinutes();
  const dayOfWeek = at.getDay();
  const isOvertimeNow = shift ? isOvertimeTime(currentMinutes, shift, dayOfWeek) : false;
  const shiftStartMinutes = shift ? toMinutes(shift.workStartTime) : null;
  const canPunchIn =
    !shift || isOvertimeNow || (shiftStartMinutes !== null && currentMinutes >= shiftStartMinutes - 60);
  return {
    isCheckedIn: isCheckedInToday(today),
    activeCheckInWallTime: getActiveCheckInWallTime(today),
    isOvertimeNow,
    canPunchIn,
    showShiftCongrats: shouldShowShiftCongrats(today, at),
  };
}

export function isShiftRequirementMet(shift: ShiftInfo, totalWorkedMinutes: number): boolean {
  const full = shiftDurationMinutes(shift);
  const min = shift.minimumRequiredMinutes;
  return totalWorkedMinutes >= full || (min != null && totalWorkedMinutes >= min);
}

export function shouldShowShiftCongrats(today: TodayRecord, at: Date = now()): boolean {
  const { log, shift } = today;
  if (!shift) return false;
  const dayOfWeek = at.getDay();
  const isWorkingDay = !(shift.weeklyOffDays ?? [5, 6]).includes(dayOfWeek);
  if (!isWorkingDay) return false;
  if (isCheckedInToday(today)) return false;
  const worked = totalWorkedMinutesToday(today);
  if (worked <= 0) return false;
  const hasClosedSession =
    !!log?.check_out_time || (today.sessions?.some((s) => !!s.check_out_time) ?? false);
  if (!hasClosedSession) return false;
  return isShiftRequirementMet(shift, worked);
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
    duration_minutes: row.check_out_time
      ? Math.max(0, wallTimeToMinutes(row.check_out_time) - wallTimeToMinutes(row.check_in_time!))
      : 0,
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
      .select('grace_period_minutes, auto_punch_out_buffer_minutes, minimum_required_minutes')
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
      minimumRequiredMinutes: policy?.minimum_required_minutes ?? null,
    };
  }

  const { data: policy } = await supabase
    .from('attendance_policy')
    .select(
      'work_start_time, work_end_time, grace_period_minutes, auto_punch_out_buffer_minutes, weekly_off_days, minimum_required_minutes'
    )
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
    minimumRequiredMinutes: policy.minimum_required_minutes ?? null,
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

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

async function getUserJoinDate(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('join_date, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  const joinDate = toDateOnly(data?.join_date);
  if (joinDate) return joinDate;
  return toDateOnly(data?.created_at);
}

export async function getAttendanceSessions(
  userId: string,
  date?: string
): Promise<AttendanceSession[]> {
  let query = supabase
    .from('attendance_sessions')
    .select('*')
    .eq('user_id', userId);

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query
    .order('date', { ascending: false })
    .order('check_in_time', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getAttendanceMonthly(
  userId: string,
  year: number,
  month: number
): Promise<MonthDaySummary[]> {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [summariesRes, shift, joinDate] = await Promise.all([
    supabase
      .from('attendance_daily_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to),
    getEffectiveShiftForUser(userId),
    getUserJoinDate(userId),
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
    const status = resolveCalendarStatus(dateStr, isOffDay, summary, todayStr_, joinDate);

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
  overtimeRequest: OvertimeRequest | null;
}

export interface CheckOutResult {
  log: AttendanceLog;
  overtimeRequest: OvertimeRequest | null;
}

export interface AutoPunchOutRunResult {
  processed: number;
  total?: number;
  message?: string;
}

type EdgeInvokeResult = {
  data?: unknown;
  error?: { message?: string } | null;
};

function parsePunchCheckoutPayload(data: unknown): {
  session: AttendanceSession;
  lateStayOvertimeSessionId: string | null;
} {
  if (data && typeof data === 'object' && data !== null && 'session' in data) {
    const o = data as {
      session: AttendanceSession;
      late_stay_overtime_session_id?: string | null;
    };
    return {
      session: o.session,
      lateStayOvertimeSessionId: o.late_stay_overtime_session_id ?? null,
    };
  }
  return {
    session: data as AttendanceSession,
    lateStayOvertimeSessionId: null,
  };
}

/** UTC instant for devOverrideTime; matches punch handler org wall via toOrgLocalDate (+3). */
function orgWallToPunchUtcIso(dateStr: string, wallTime: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const parts = wallTime.split(':').map(Number);
  const h = parts[0] ?? 0;
  const mi = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s, 0) - 3 * 60 * 60 * 1000).toISOString();
}

function normalizeEdgeInvokeError(invokeResult: EdgeInvokeResult): Error | null {
  const edgeError = invokeResult.error;
  const edgeData = invokeResult.data as { error?: string; code?: string } | null | undefined;
  if (!edgeError && !edgeData?.error) return null;

  const code = edgeData?.code;
  const message =
    edgeData?.error ||
    edgeError?.message ||
    'Failed to process attendance action';

  return new Error(code ? `${message} (${code})` : message);
}

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

export async function checkIn(userId: string, devSimulatedNowIso?: string): Promise<CheckInResult> {
  const invoked = await invokePunchAuthenticated(
    import.meta.env.DEV && devSimulatedNowIso
      ? { action: 'check_in', devOverrideTime: devSimulatedNowIso }
      : { action: 'check_in' }
  );
  if (invoked) {
    const normalizedError = normalizeEdgeInvokeError(invoked);
    if (normalizedError) throw normalizedError;
    const data = invoked.data;

    const session = data as AttendanceSession;
    const today = await getAttendanceToday(userId);
    const log = today.log ?? buildPseudoLog(todayStr(), [session], null);
    if (!log) {
      throw new Error('Unable to build check-in result');
    }

    let overtimeRequest: OvertimeRequest | null = null;
    if (session?.is_overtime) {
      try {
        const { data: req } = await supabase
          .from('overtime_requests')
          .select('*')
          .eq('session_id', session.id)
          .maybeSingle();
        overtimeRequest = (req ?? null) as OvertimeRequest | null;
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

  let overtimeRequest: OvertimeRequest | null = null;
  if (isOvertimePunch || !isWorkingDay) {
    // Legacy mode cannot create session-linked overtime_requests safely.
    overtimeRequest = null;
  }

  return { log, overtimeRequest };
}

export async function checkOut(
  userId: string,
  checkoutTime?: string,
  devSimulatedNowIso?: string
): Promise<CheckOutResult> {
  let devOverrideTime: string | undefined;
  if (checkoutTime) {
    devOverrideTime = orgWallToPunchUtcIso(todayStr(), checkoutTime);
  } else if (import.meta.env.DEV && devSimulatedNowIso) {
    devOverrideTime = devSimulatedNowIso;
  }
  const payload = devOverrideTime
    ? { action: 'check_out' as const, devOverrideTime }
    : { action: 'check_out' as const };
  const invoked = await invokePunchAuthenticated(payload);
  if (invoked) {
    const normalizedError = normalizeEdgeInvokeError(invoked);
    if (normalizedError) throw normalizedError;

    const checkoutPayload = parsePunchCheckoutPayload(invoked.data);
    let overtimeRequest: OvertimeRequest | null = null;
    const otSessionId =
      checkoutPayload.lateStayOvertimeSessionId ||
      (checkoutPayload.session?.is_overtime ? checkoutPayload.session.id : null);
    if (otSessionId) {
      try {
        const { data: req } = await supabase
          .from('overtime_requests')
          .select('*')
          .eq('session_id', otSessionId)
          .maybeSingle();
        overtimeRequest = (req ?? null) as OvertimeRequest | null;
      } catch {
        overtimeRequest = null;
      }
    }

    const today = await getAttendanceToday(userId);
    if (!today.log) {
      throw new Error('Unable to load updated attendance log');
    }
    return { log: today.log, overtimeRequest };
  }

  const log = await checkOutLegacy(userId, checkoutTime);
  return { log, overtimeRequest: null };
}

export async function runAutoPunchOut(): Promise<AutoPunchOutRunResult> {
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult?.data?.session;
  const sessionError = sessionResult?.error;
  if (sessionError || !session?.access_token) {
    throw new Error('انتهت الجلسة أو أنك غير مسجل الدخول. يرجى تسجيل الدخول مرة أخرى.');
  }

  const invoked = await supabase.functions.invoke('auto-punch-out', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  }) as EdgeInvokeResult;

  const normalizedError = normalizeEdgeInvokeError(invoked);
  if (normalizedError) throw normalizedError;

  const data = invoked.data as AutoPunchOutRunResult | null | undefined;
  return {
    processed: Number(data?.processed ?? 0),
    total: data?.total,
    message: data?.message,
  };
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

async function getLogsInRange(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<AttendanceLog[]> {
  const [{ data, error }, joinDate] = await Promise.all([
    supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false }),
    getUserJoinDate(userId),
  ]);

  if (error) throw error;
  const logs = data ?? [];
  if (!joinDate) return logs;
  return logs.filter((log) => log.date >= joinDate);
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
    totalWorkingDays: summaries.filter((d) => d.status != null && d.status !== 'future' && d.status !== 'weekend').length,
  };
}

export async function getAllTimeStats(userId: string): Promise<MonthlyStats> {
  const joinDate = await getUserJoinDate(userId);
  const today = now();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  let startYear: number;
  let startMonth: number;
  if (joinDate) {
    const [y, m] = joinDate.split('-').map(Number);
    startYear = y;
    startMonth = m - 1;
  } else {
    startYear = todayYear;
    startMonth = todayMonth;
  }

  const totals: MonthlyStats = {
    presentDays: 0,
    lateDays: 0,
    absentDays: 0,
    leaveDays: 0,
    totalWorkingDays: 0,
  };

  let y = startYear;
  let m = startMonth;
  while (y < todayYear || (y === todayYear && m <= todayMonth)) {
    const summaries = await getAttendanceMonthly(userId, y, m);
    for (const d of summaries) {
      if (d.status === 'present') totals.presentDays++;
      else if (d.status === 'late') totals.lateDays++;
      else if (d.status === 'absent') totals.absentDays++;
      else if (d.status === 'on_leave') totals.leaveDays++;
      if (d.status != null && d.status !== 'future' && d.status !== 'weekend') {
        totals.totalWorkingDays++;
      }
    }
    m++;
    if (m > 11) { m = 0; y++; }
  }

  return totals;
}

export async function getAllTimeSummaries(userId: string): Promise<MonthDaySummary[]> {
  const joinDate = await getUserJoinDate(userId);
  const today = now();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  let startYear: number;
  let startMonth: number;
  if (joinDate) {
    const [y, m] = joinDate.split('-').map(Number);
    startYear = y;
    startMonth = m - 1;
  } else {
    startYear = todayYear;
    startMonth = todayMonth;
  }

  const all: MonthDaySummary[] = [];
  let y = startYear;
  let m = startMonth;
  while (y < todayYear || (y === todayYear && m <= todayMonth)) {
    const summaries = await getAttendanceMonthly(userId, y, m);
    all.push(...summaries);
    m++;
    if (m > 11) { m = 0; y++; }
  }

  return all;
}

export async function getSummariesInRange(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<MonthDaySummary[]> {
  const [fromY, fromM] = fromDate.split('-').map(Number);
  const [toY, toM] = toDate.split('-').map(Number);

  const all: MonthDaySummary[] = [];
  let y = fromY;
  let m = fromM - 1;
  const endY = toY;
  const endM = toM - 1;
  while (y < endY || (y === endY && m <= endM)) {
    const summaries = await getAttendanceMonthly(userId, y, m);
    all.push(...summaries);
    m++;
    if (m > 11) { m = 0; y++; }
  }

  return all.filter((d) => d.date >= fromDate && d.date <= toDate);
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

function mapTeamAttendanceDayRow(row: TeamAttendanceDayRpcRow): TeamAttendanceDayRow {
  return {
    userId: row.user_id,
    nameAr: row.name_ar,
    employeeId: row.employee_id,
    role: row.role as ProfileRole,
    avatarUrl: row.avatar_url,
    departmentId: row.department_id,
    departmentNameAr: row.department_name_ar,
    date: row.date,
    effectiveStatus: row.effective_status as AttendanceEffectiveStatus | null,
    displayStatus: row.display_status as TeamAttendanceDisplayStatus,
    firstCheckIn: row.first_check_in,
    lastCheckOut: row.last_check_out,
    totalWorkMinutes: row.total_work_minutes,
    totalOvertimeMinutes: row.total_overtime_minutes,
    hasOvertime:
      row.display_status === 'overtime_only' ||
      row.display_status === 'overtime_offday' ||
      Number(row.total_overtime_minutes ?? 0) > 0,
    sessionCount: row.session_count,
    isCheckedInNow: row.is_checked_in_now,
    hasAutoPunchOut: row.has_auto_punch_out,
    needsReview: row.needs_review,
    isShortDay: row.is_short_day,
  };
}

function mapSafeAvailabilityRow(row: RedactedAvailabilityRpcRow): SafeAvailabilityRow {
  return {
    userId: row.user_id,
    nameAr: row.name_ar,
    employeeId: row.employee_id,
    role: row.role as ProfileRole,
    avatarUrl: row.avatar_url,
    departmentId: row.department_id,
    departmentNameAr: row.department_name_ar,
    availabilityState: row.availability_state as AvailabilityState,
  };
}

function mapSafeAttendanceDayRow(row: RedactedAttendanceDayRpcRow): SafeAttendanceDayRow {
  return {
    userId: row.user_id,
    nameAr: row.name_ar,
    employeeId: row.employee_id,
    role: row.role as ProfileRole,
    avatarUrl: row.avatar_url,
    departmentId: row.department_id,
    departmentNameAr: row.department_name_ar,
    date: row.date,
    attendanceState: row.attendance_state as AttendanceDayAvailabilityState,
  };
}

export async function getTeamAttendanceDay(params: {
  date: string;
  departmentId?: string | null;
}): Promise<TeamAttendanceDayRow[]> {
  const { data, error } = await supabase.rpc('get_team_attendance_day', {
    p_date: params.date,
    p_department_id: params.departmentId ?? null,
  });

  if (error) throw error;
  return (data ?? []).map(mapTeamAttendanceDayRow);
}

export async function getRedactedDepartmentAvailability(params: {
  departmentId?: string | null;
}): Promise<SafeAvailabilityRow[]> {
  const { data, error } = await supabase.rpc('get_redacted_department_availability', {
    p_department_id: params.departmentId ?? null,
  });

  if (error) throw error;
  return (data ?? []).map(mapSafeAvailabilityRow);
}

export async function getRedactedTeamAttendanceDay(params: {
  date: string;
  departmentId?: string | null;
}): Promise<SafeAttendanceDayRow[]> {
  const { data, error } = await supabase.rpc('get_redacted_team_attendance_day', {
    p_date: params.date,
    p_department_id: params.departmentId ?? null,
  });

  if (error) throw error;
  return (data ?? []).map(mapSafeAttendanceDayRow);
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

import { supabase } from '../supabase';
import type { Database, Tables } from '../database.types';
import type { OvertimeRequest } from './overtime-requests.service';
import { emitOvertimeRequestSubmitted } from '@/lib/notifications/emit';
import {
  DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES,
  DEFAULT_MINIMUM_OVERTIME_MINUTES,
  resolveDisplayStatus,
  type DayStatus,
  type TeamAttendanceDateState,
  type TeamAttendanceLiveState,
} from '@/shared/attendance';
import {
  getNormalizedDayScheduleWindow,
  getShiftForDate,
  isOvertimeForScheduleTime,
  isWorkingDay as isWorkingDayFromSchedule,
  resolveEffectiveSchedule,
  type EffectiveSchedule,
} from '@/shared/attendance/workSchedule';

export type AttendanceStatus = 'present' | 'late';
export type AttendanceLogStatus = AttendanceStatus | 'absent' | 'on_leave';

export interface AttendanceLog {
  id: string;
  org_id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  status: AttendanceLogStatus;
  is_dev: boolean;
  auto_punch_out: boolean;
}

export type AttendanceSession = Tables<'attendance_sessions'>;
export type AttendanceDailySummary = Tables<'attendance_daily_summary'>;
export type AttendanceEffectiveStatus = AttendanceDailySummary['effective_status'];
export type ProfileRole = Tables<'profiles'>['role'];
export type CalendarStatus = Exclude<DayStatus, 'not_joined'> | null;

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
  /** Minimum overtime segment length that must be reached before overtime is counted. */
  minimumOvertimeMinutes: number;
  /** Org policy: minimum minutes worked to count shift fulfilled; null = use full scheduled duration only in UI logic. */
  minimumRequiredMinutes: number | null;
}

export interface TodayRecord {
  punches: PunchEntry[];
  shift: ShiftInfo | null;
  sessions?: AttendanceSession[];
  summary?: AttendanceDailySummary | null;
}

export interface DayRecord {
  punches: PunchEntry[];
  shift: ShiftInfo | null;
  totalMinutesWorked: number;
  sessions?: AttendanceSession[];
  summary?: AttendanceDailySummary | null;
}

export interface MonthDaySummary {
  date: string;
  status: CalendarStatus;
  hasOvertime: boolean;
  totalMinutesWorked: number;
}

export type AttendanceHistoryPrimaryState =
  | TeamAttendanceDateState
  | Extract<DayStatus, 'weekend' | 'holiday'>;

export type AttendanceHistorySessionClassification = 'regular' | 'late' | 'overtime';

export interface AttendanceHistorySession {
  id: string;
  checkInTime: string;
  checkOutTime: string | null;
  durationMinutes: number;
  classification: AttendanceHistorySessionClassification;
  isEarlyDeparture: boolean;
  isAutoPunchOut: boolean;
  needsReview: boolean;
}

export interface AttendanceHistoryDay {
  date: string;
  primaryState: AttendanceHistoryPrimaryState;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  totalRegularMinutes: number;
  totalOvertimeMinutes: number;
  totalWorkedMinutes: number;
  sessionCount: number;
  hasOvertime: boolean;
  hasAutoPunchOut: boolean;
  needsReview: boolean;
  sessions: AttendanceHistorySession[];
}

export interface AttendanceHistoryStats {
  fulfilledShiftDays: number;
  incompleteShiftDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  overtimeDays: number;
  totalWorkingDays: number;
}

export type TeamAttendanceDisplayStatus = AttendanceEffectiveStatus | null;

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
  teamLiveState: TeamAttendanceLiveState | null; // null = baseline (on time, checked in, no chip)
  teamDateState: TeamAttendanceDateState;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  totalWorkMinutes: number;
  totalOvertimeMinutes: number;
  hasOvertime: boolean;
  sessionCount: number;
  isCheckedInNow: boolean;
  hasAutoPunchOut: boolean;
  needsReview: boolean;
  isIncompleteShift: boolean;
}

export interface SafeAvailabilityRow {
  userId: string;
  nameAr: string;
  employeeId: string;
  role: ProfileRole;
  avatarUrl: string | null;
  departmentId: string | null;
  departmentNameAr: string | null;
  availabilityState: 'available_now' | 'unavailable_now';
  teamLiveState: TeamAttendanceLiveState | null; // null = baseline (on time, checked in, no chip)
  hasOvertime: boolean;
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
  teamDateState: TeamAttendanceDateState;
  hasOvertime: boolean;
}

type TeamAttendanceDayRpcRow = Database['public']['Functions']['get_team_attendance_day']['Returns'][number];
type RedactedAvailabilityRpcRow =
  Database['public']['Functions']['get_redacted_department_availability']['Returns'][number];
type RedactedAttendanceDayRpcRow =
  Database['public']['Functions']['get_redacted_team_attendance_day']['Returns'][number];

type CalendarResolutionInput = DayStatus;

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

export function doesCheckOutCrossDay(
  checkInTime: string | null | undefined,
  checkOutTime: string | null | undefined
): boolean {
  const checkInMinutes = wallTimeToMinutes(checkInTime);
  const checkOutMinutes = wallTimeToMinutes(checkOutTime);
  return Number.isFinite(checkInMinutes) && Number.isFinite(checkOutMinutes) && checkOutMinutes < checkInMinutes;
}

export function getLatestCheckOutTime(
  sessions: Array<Pick<AttendanceSession, 'check_in_time' | 'check_out_time'>>
): string | null {
  return sessions
    .filter(
      (session): session is Pick<AttendanceSession, 'check_in_time'> & { check_out_time: string } =>
        !!session.check_out_time
    )
    .map((session) => ({
      time: session.check_out_time,
      sortKey: doesCheckOutCrossDay(session.check_in_time, session.check_out_time)
        ? wallTimeToMinutes(session.check_out_time) + 1440
        : wallTimeToMinutes(session.check_out_time),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .at(-1)?.time ?? null;
}

export function shiftDurationMinutes(shift: ShiftInfo): number {
  return (
    getNormalizedDayScheduleWindow({
      start: shift.workStartTime,
      end: shift.workEndTime,
    })?.durationMinutes ?? 0
  );
}

export function totalWorkedMinutesToday(today: TodayRecord): number {
  if (today.summary?.total_work_minutes != null) return today.summary.total_work_minutes;
  if (today.sessions?.length) return computeTotalMinutesFromSessions(today.sessions);
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

/** True if the user has an open attendance session. */
export function isCheckedInToday(today: TodayRecord): boolean {
  return getOpenSessionCheckInTime(today) !== null;
}

/** Wall time for the current open session punch-in. */
export function getActiveCheckInWallTime(today: TodayRecord): string | null {
  return getOpenSessionCheckInTime(today);
}

/** Shared punch CTAs / badges for today status UIs (same inputs → same behavior). */
export interface TodayPunchUiState {
  isCheckedIn: boolean;
  activeCheckInWallTime: string | null;
  isOvertimeNow: boolean;
  canPunchIn: boolean;
  showShiftCongrats: boolean;
}

export function getTodayPunchUiState(today: TodayRecord, at: Date = new Date()): TodayPunchUiState {
  const { shift } = today;
  const currentMinutes = at.getHours() * 60 + at.getMinutes();
  const activeSession = today.sessions?.find((session) => !session.check_out_time) ?? null;
  // `shift === null` means today is an off day (or no policy found): any
  // punch is overtime.
  const normalizedShift = shift
    ? getNormalizedDayScheduleWindow({ start: shift.workStartTime, end: shift.workEndTime })
    : null;
  const assumeNextDay =
    normalizedShift?.overnight === true &&
    !!activeSession?.date &&
    activeSession.date < todayStr(at);
  const normalizedCurrentMinutes = normalizedShift
    ? normalizedShift.normalizeTimeMinutes(currentMinutes, { assumeNextDay })
    : null;
  const isOvertimeNow =
    shift && normalizedShift && normalizedCurrentMinutes !== null
      ? normalizedCurrentMinutes < normalizedShift.startClockMinutes - 60 ||
        normalizedCurrentMinutes > normalizedShift.endMinutes
      : true;
  const canPunchIn =
    !shift ||
    isOvertimeNow ||
    (normalizedShift !== null &&
      normalizedCurrentMinutes !== null &&
      normalizedCurrentMinutes >= normalizedShift.startClockMinutes - 60);
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

export function shouldShowShiftCongrats(today: TodayRecord, _at: Date = new Date()): boolean {
  const { shift } = today;
  // A null shift means today is an off day — nothing to celebrate.
  if (!shift) return false;
  if (isCheckedInToday(today)) return false;
  const worked = totalWorkedMinutesToday(today);
  if (worked <= 0) return false;
  const hasClosedSession =
    !!today.summary?.last_check_out || (today.sessions?.some((s) => !!s.check_out_time) ?? false);
  if (!hasClosedSession) return false;
  return isShiftRequirementMet(shift, worked);
}

/**
 * Unified overtime check. Callers pass the shift for the relevant date
 * (null = off day). A time is "overtime" when:
 * - The day is an off day (caller should pass null shift, which short-circuits), OR
 * - On a working day: before (shiftStart - 60) or after shiftEnd
 *
 * The 1-hour window before shift start is "early login" (not overtime).
 * Anything after shift end is overtime. The buffer only controls
 * auto-punch-out timing.
 */
export function isOvertimeTime(timeMinutes: number, shift: ShiftInfo): boolean {
  return isOvertimeForScheduleTime(
    timeMinutes,
    { start: shift.workStartTime, end: shift.workEndTime },
    60
  );
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

function computeOvertimeMinutesFromSessions(sessions: AttendanceSession[]): number {
  return sessions.reduce(
    (sum, session) => sum + (session.is_overtime ? session.duration_minutes ?? 0 : 0),
    0
  );
}

function computeRegularMinutesFromSessions(sessions: AttendanceSession[]): number {
  return sessions.reduce(
    (sum, session) => sum + (!session.is_overtime ? session.duration_minutes ?? 0 : 0),
    0
  );
}

function buildSummaryFallback(
  sessions: AttendanceSession[],
  summary: AttendanceDailySummary | undefined
): AttendanceDailySummary | undefined {
  if (summary) return summary;
  if (sessions.length === 0) return undefined;

  const sorted = [...sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  const firstCheckIn = sorted[0]?.check_in_time ?? null;
  const regularSessions = sorted.filter((session) => !session.is_overtime);
  const hasRegularPresent = regularSessions.some((session) => session.status === 'present');
  const hasRegularLate = regularSessions.some((session) => session.status === 'late');
  const allOvertime = sorted.every((session) => session.is_overtime);

  let effectiveStatus: AttendanceEffectiveStatus | null = null;
  if (hasRegularPresent) effectiveStatus = 'present';
  else if (hasRegularLate) effectiveStatus = 'late';
  else if (allOvertime) effectiveStatus = 'absent';

  return {
    id: `fallback-${sorted[0]?.date ?? 'unknown'}`,
    org_id: sorted[0]?.org_id ?? '',
    user_id: sorted[0]?.user_id ?? '',
    date: sorted[0]?.date ?? '',
    first_check_in: firstCheckIn,
    last_check_out: getLatestCheckOutTime(sorted),
    total_work_minutes: computeTotalMinutesFromSessions(sorted),
    total_overtime_minutes: computeOvertimeMinutesFromSessions(sorted),
    effective_status: effectiveStatus,
    has_overtime: sorted.some((session) => session.is_overtime),
    is_incomplete_shift: false,
    session_count: sorted.length,
    updated_at: new Date().toISOString(),
  } as AttendanceDailySummary;
}

function mapSessionClassification(
  session: AttendanceSession
): AttendanceHistorySessionClassification {
  if (session.is_overtime) return 'overtime';
  if (session.status === 'late') return 'late';
  return 'regular';
}

function mapHistoryPrimaryState(
  status: CalendarStatus,
  isIncompleteShift: boolean
): AttendanceHistoryPrimaryState | null {
  switch (status) {
    case 'present':
      return isIncompleteShift ? 'incomplete_shift' : 'fulfilled_shift';
    case 'late':
      return 'late';
    case 'absent':
      return 'absent';
    case 'on_leave':
      return 'on_leave';
    case 'weekend':
      return 'weekend';
    case 'holiday':
      return 'holiday';
    case 'future':
    case null:
    default:
      return null;
  }
}

function shouldIncludeHistoryDay(
  primaryState: AttendanceHistoryPrimaryState | null,
  sessions: AttendanceSession[]
): primaryState is AttendanceHistoryPrimaryState {
  if (!primaryState) return false;
  if (primaryState === 'weekend' || primaryState === 'holiday') {
    return sessions.length > 0;
  }
  return true;
}

function buildHistoryDay(params: {
  date: string;
  summary: AttendanceDailySummary | undefined;
  sessions: AttendanceSession[];
  isOffDay: boolean;
  todayStr_: string;
  joinDate?: string | null;
}): AttendanceHistoryDay | null {
  const { date, sessions, isOffDay, todayStr_, joinDate } = params;
  const summary = buildSummaryFallback(sessions, params.summary);
  const calendarStatus = resolveCalendarStatus(date, isOffDay, summary, todayStr_, joinDate);
  const primaryState = mapHistoryPrimaryState(calendarStatus, summary?.is_incomplete_shift ?? false);

  if (!shouldIncludeHistoryDay(primaryState, sessions)) {
    return null;
  }

  const sortedSessions = [...sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  const totalWorkedMinutes = summary?.total_work_minutes ?? computeTotalMinutesFromSessions(sortedSessions);
  const totalOvertimeMinutes =
    summary?.total_overtime_minutes ?? computeOvertimeMinutesFromSessions(sortedSessions);
  const totalRegularMinutes =
    sortedSessions.length > 0
      ? computeRegularMinutesFromSessions(sortedSessions)
      : Math.max(0, totalWorkedMinutes - totalOvertimeMinutes);

  return {
    date,
    primaryState,
    firstCheckIn: summary?.first_check_in ?? sortedSessions[0]?.check_in_time ?? null,
    lastCheckOut: summary?.last_check_out ?? getLatestCheckOutTime(sortedSessions),
    totalRegularMinutes,
    totalOvertimeMinutes,
    totalWorkedMinutes,
    sessionCount: summary?.session_count ?? sortedSessions.length,
    hasOvertime:
      (summary?.has_overtime ?? totalOvertimeMinutes > 0) &&
      sortedSessions.length > 0,
    hasAutoPunchOut: sortedSessions.some((session) => !!session.is_auto_punch_out),
    needsReview: sortedSessions.some((session) => !!session.needs_review),
    sessions: sortedSessions.map((session) => ({
      id: session.id,
      checkInTime: session.check_in_time,
      checkOutTime: session.check_out_time,
      durationMinutes: session.duration_minutes ?? 0,
      classification: mapSessionClassification(session),
      isEarlyDeparture: !!session.is_early_departure,
      isAutoPunchOut: !!session.is_auto_punch_out,
      needsReview: !!session.needs_review,
    })),
  };
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
  const rawStatus = summary?.effective_status ?? first?.status ?? null;
  const status: AttendanceLog['status'] =
    rawStatus === 'late' || rawStatus === 'absent' || rawStatus === 'on_leave'
      ? rawStatus
      : 'present';

  return {
    id: summary?.id ?? first?.id ?? `pseudo-${date}`,
    org_id: summary?.org_id ?? first?.org_id ?? '',
    user_id: summary?.user_id ?? first?.user_id ?? '',
    date,
    check_in_time: summary?.first_check_in ?? first?.check_in_time ?? null,
    check_out_time: summary?.last_check_out ?? getLatestCheckOutTime(sorted),
    check_in_lat: null,
    check_in_lng: null,
    check_out_lat: null,
    check_out_lng: null,
    status,
    is_dev: false,
    auto_punch_out: sessions.some((s) => !!s.is_auto_punch_out),
  };
}

export function toAttendanceLog(record: {
  summary?: AttendanceDailySummary | null;
  sessions?: AttendanceSession[] | null;
  date?: string | null;
}): AttendanceLog | null {
  const sessions = record.sessions ?? [];
  const summary = record.summary ?? null;
  const date = summary?.date ?? sessions[0]?.date ?? record.date ?? '';
  if (!date) return null;
  return buildPseudoLog(date, sessions, summary);
}

function parseDateOnlyStr(value: string): Date {
  // Interpret "YYYY-MM-DD" as local date so getDay() matches the calendar.
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * Fetches the raw work_schedule json for user and org, plus the policy
 * fields needed to build a ShiftInfo. Returned objects are the
 * normalized WorkSchedule maps.
 */
export async function getEffectiveScheduleForUser(userId: string): Promise<{
  schedule: EffectiveSchedule;
  policy: {
    gracePeriodMinutes: number;
    bufferMinutesAfterShift: number;
    minimumOvertimeMinutes: number;
    minimumRequiredMinutes: number | null;
  } | null;
} | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('work_schedule, org_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile) return null;

  const { data: policy } = await supabase
    .from('attendance_policy')
    .select(
      'work_schedule, grace_period_minutes, auto_punch_out_buffer_minutes, minimum_overtime_minutes, minimum_required_minutes'
    )
    .eq('org_id', profile.org_id)
    .limit(1)
    .maybeSingle();

  const schedule = resolveEffectiveSchedule(profile.work_schedule, policy?.work_schedule);

  return {
    schedule,
    policy: policy
      ? {
          gracePeriodMinutes: policy.grace_period_minutes ?? 15,
          bufferMinutesAfterShift:
            policy.auto_punch_out_buffer_minutes ?? DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES,
          minimumOvertimeMinutes:
            policy.minimum_overtime_minutes ?? DEFAULT_MINIMUM_OVERTIME_MINUTES,
          minimumRequiredMinutes: policy.minimum_required_minutes ?? null,
        }
      : null,
  };
}

/**
 * Returns the effective shift for a user on a specific date, or null if
 * the user does not work that day. Per-user schedule (work_schedule) wins
 * over per-org policy schedule (attendance_policy.work_schedule).
 */
export async function getEffectiveShiftForUser(
  userId: string,
  dateStr?: string,
): Promise<ShiftInfo | null> {
  const resolved = await getEffectiveScheduleForUser(userId);
  if (!resolved || !resolved.policy) return null;

  const date = dateStr ? parseDateOnlyStr(dateStr) : new Date();
  const day = getShiftForDate(date, resolved.schedule.user, resolved.schedule.org);
  if (!day) return null;

  return {
    workStartTime: day.start,
    workEndTime: day.end,
    gracePeriodMinutes: resolved.policy.gracePeriodMinutes,
    bufferMinutesAfterShift: resolved.policy.bufferMinutesAfterShift,
    minimumOvertimeMinutes: resolved.policy.minimumOvertimeMinutes,
    minimumRequiredMinutes: resolved.policy.minimumRequiredMinutes,
  };
}

export async function getAttendanceToday(userId: string): Promise<TodayRecord> {
  const today = todayStr();
  const [sessionsRes, shiftRes, summaryRes] = await Promise.all([
    supabase
      .from('attendance_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .order('check_in_time', { ascending: true }),
    getEffectiveShiftForUser(userId, today),
    supabase
      .from('attendance_daily_summary')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),
  ]);

  if (sessionsRes.error) throw sessionsRes.error;
  if (summaryRes.error) throw summaryRes.error;

  let sessions = Array.isArray(sessionsRes.data) ? (sessionsRes.data as AttendanceSession[]) : [];
  let shift = shiftRes;
  let summary = normalizeSummary(summaryRes.data);

  if (sessions.length === 0) {
    const current = parseDateOnlyStr(today);
    current.setDate(current.getDate() - 1);
    const yesterday = todayStr(current);
    const [carrySessionsRes, carryShiftRes, carrySummaryRes] = await Promise.all([
      supabase
        .from('attendance_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('date', yesterday)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: true }),
      getEffectiveShiftForUser(userId, yesterday),
      supabase
        .from('attendance_daily_summary')
        .select('*')
        .eq('user_id', userId)
        .eq('date', yesterday)
        .maybeSingle(),
    ]);

    if (carrySessionsRes.error) throw carrySessionsRes.error;
    if (carrySummaryRes.error) throw carrySummaryRes.error;

    const carrySessions = Array.isArray(carrySessionsRes.data)
      ? (carrySessionsRes.data as AttendanceSession[])
      : [];
    if (carrySessions.length > 0) {
      sessions = carrySessions;
      shift = carryShiftRes;
      summary = normalizeSummary(carrySummaryRes.data);
    }
  }

  const punches = buildPunchesFromSessions(sessions);
  return { punches, shift, sessions, summary };
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
    getEffectiveShiftForUser(userId, date),
  ]);

  if (sessionsRes.error) throw sessionsRes.error;
  if (summaryRes.error) throw summaryRes.error;

  const sessions = Array.isArray(sessionsRes.data) ? (sessionsRes.data as AttendanceSession[]) : [];
  const summary = normalizeSummary(summaryRes.data);
  const punches = buildPunchesFromSessions(sessions);
  const totalMinutesWorked = summary?.total_work_minutes ?? computeTotalMinutesFromSessions(sessions);

  return { punches, shift, totalMinutesWorked, sessions, summary };
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

  const [summariesRes, scheduleBundle, joinDate] = await Promise.all([
    supabase
      .from('attendance_daily_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to),
    getEffectiveScheduleForUser(userId),
    getUserJoinDate(userId),
  ]);

  if (summariesRes.error) throw summariesRes.error;
  const summaryMap = new Map((summariesRes.data ?? []).map((s) => [s.date, s]));
  const userSchedule = scheduleBundle?.schedule.user ?? {};
  const orgSchedule = scheduleBundle?.schedule.org ?? {};

  const today = new Date();
  const todayStr_ = todayStr(today);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const summaries: MonthDaySummary[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = parseDateOnlyStr(dateStr);
    const isOffDay = !isWorkingDayFromSchedule(dateObj, userSchedule, orgSchedule);
    const summary = summaryMap.get(dateStr);
    const status = resolveCalendarStatus(dateStr, isOffDay, summary, todayStr_, joinDate);

    summaries.push({
      date: dateStr,
      status,
      hasOvertime:
        Boolean(summary?.has_overtime) || Number(summary?.total_overtime_minutes ?? 0) > 0,
      totalMinutesWorked: summary?.total_work_minutes ?? 0,
    });
  }

  return summaries;
}

export async function getAttendanceHistoryMonth(
  userId: string,
  year: number,
  month: number
): Promise<AttendanceHistoryDay[]> {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [summariesRes, sessionsRes, scheduleBundle, joinDate] = await Promise.all([
    supabase
      .from('attendance_daily_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to),
    supabase
      .from('attendance_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('check_in_time', { ascending: true }),
    getEffectiveScheduleForUser(userId),
    getUserJoinDate(userId),
  ]);

  if (summariesRes.error) throw summariesRes.error;
  if (sessionsRes.error) throw sessionsRes.error;

  const summaryMap = new Map((summariesRes.data ?? []).map((summary) => [summary.date, summary]));
  const sessionsByDate = new Map<string, AttendanceSession[]>();
  for (const session of sessionsRes.data ?? []) {
    const existing = sessionsByDate.get(session.date) ?? [];
    existing.push(session);
    sessionsByDate.set(session.date, existing);
  }

  const userSchedule = scheduleBundle?.schedule.user ?? {};
  const orgSchedule = scheduleBundle?.schedule.org ?? {};
  const todayStr_ = todayStr(new Date());
  const items: AttendanceHistoryDay[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = parseDateOnlyStr(date);
    const isOffDay = !isWorkingDayFromSchedule(dateObj, userSchedule, orgSchedule);
    const historyDay = buildHistoryDay({
      date,
      summary: summaryMap.get(date),
      sessions: sessionsByDate.get(date) ?? [],
      isOffDay,
      todayStr_,
      joinDate,
    });
    if (historyDay) items.push(historyDay);
  }

  return items;
}

export function todayStr(d?: Date): string {
  const date = d ?? new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function nowTimeStr(d?: Date): string {
  const date = d ?? new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export async function getTodayLog(userId: string): Promise<AttendanceLog | null> {
  const today = todayStr();
  const [sessionsRes, summaryRes] = await Promise.all([
    supabase
      .from('attendance_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .order('check_in_time', { ascending: true }),
    supabase
      .from('attendance_daily_summary')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle(),
  ]);

  if (sessionsRes.error) throw sessionsRes.error;
  if (summaryRes.error) throw summaryRes.error;

  return buildPseudoLog(
    today,
    Array.isArray(sessionsRes.data) ? (sessionsRes.data as AttendanceSession[]) : [],
    normalizeSummary(summaryRes.data)
  );
}

export interface CheckInResult {
  log: AttendanceLog;
  overtimeRequest: OvertimeRequest | null;
}

export interface CheckOutResult {
  log: AttendanceLog | null;
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
  session: AttendanceSession | null;
  lateStayOvertimeSessionId: string | null;
  discardedOvertimeSessionId: string | null;
} {
  if (data && typeof data === 'object' && data !== null && 'session' in data) {
    const o = data as {
      session: AttendanceSession | null;
      late_stay_overtime_session_id?: string | null;
      discarded_overtime_session_id?: string | null;
    };
    return {
      session: o.session,
      lateStayOvertimeSessionId: o.late_stay_overtime_session_id ?? null,
      discardedOvertimeSessionId: o.discarded_overtime_session_id ?? null,
    };
  }
  return {
    session: data as AttendanceSession,
    lateStayOvertimeSessionId: null,
    discardedOvertimeSessionId: null,
  };
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

async function invokePunchAuthenticated(payload: { action: 'check_in' | 'check_out' }): Promise<EdgeInvokeResult | null> {
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
    const normalizedError = normalizeEdgeInvokeError(invoked);
    if (normalizedError) throw normalizedError;
    const data = invoked.data;

    const session = data as AttendanceSession;
    const today = await getAttendanceToday(userId);
    const log = toAttendanceLog(today) ?? buildPseudoLog(todayStr(), [session], null);
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
        if (overtimeRequest) {
          void emitOvertimeRequestSubmitted({
            request_id: overtimeRequest.id,
            requester_id: overtimeRequest.user_id,
            org_id: overtimeRequest.org_id,
          });
        }
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
    .from('attendance_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .is('check_out_time', null)
    .order('check_in_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.check_in_time && !existing?.check_out_time) {
    throw new Error('Already checked in today');
  }

  const [{ data: profile, error: profileError }, shift] = await Promise.all([
    supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single(),
    getEffectiveShiftForUser(userId, today),
  ]);

  if (profileError || !profile?.org_id) throw profileError ?? new Error('Missing profile org');
  const nowMin = toMinutes(time);
  // null shift = off day in the new schedule model: any punch is overtime.
  const isWorkingDay = shift !== null;
  const isOvertimePunch = shift ? isOvertimeTime(nowMin, shift) : true;

  let status: AttendanceStatus = 'present';
  if (shift && !isOvertimePunch && isWorkingDay) {
    const startMinutes = toMinutes(shift.workStartTime) + shift.gracePeriodMinutes;
    if (nowMin > startMinutes) status = 'late';
  }

  const { data: inserted, error } = await supabase
    .from('attendance_sessions')
    .insert({
      org_id: profile.org_id,
      user_id: userId,
      date: today,
      check_in_time: time,
      check_out_time: null,
      status,
      is_overtime: isOvertimePunch,
      duration_minutes: 0,
      is_auto_punch_out: false,
      is_early_departure: false,
      needs_review: false,
    })
    .select()
    .single();
  if (error) throw error;

  const log = buildPseudoLog(today, [inserted as AttendanceSession], null);
  if (!log) {
    throw new Error('Unable to build check-in result');
  }

  let overtimeRequest: OvertimeRequest | null = null;
  if (isOvertimePunch || !isWorkingDay) {
    // Legacy mode cannot create session-linked overtime_requests safely.
    overtimeRequest = null;
  }

  return { log, overtimeRequest };
}

export async function checkOut(userId: string): Promise<CheckOutResult> {
  const invoked = await invokePunchAuthenticated({ action: 'check_out' });
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
        if (checkoutPayload.lateStayOvertimeSessionId && overtimeRequest) {
          void emitOvertimeRequestSubmitted({
            request_id: overtimeRequest.id,
            requester_id: overtimeRequest.user_id,
            org_id: overtimeRequest.org_id,
          });
        }
      } catch {
        overtimeRequest = null;
      }
    }

    const today = await getAttendanceToday(userId);
    const log = toAttendanceLog(today);
    if (!log && !checkoutPayload.discardedOvertimeSessionId) {
      throw new Error('Unable to load updated attendance log');
    }
    return { log, overtimeRequest };
  }

  const log = await checkOutLegacy(userId);
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
    .from('attendance_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .is('check_out_time', null)
    .order('check_in_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing?.check_in_time) throw new Error('Must check in before checking out');
  if (existing.check_out_time) throw new Error('Already checked out today');

  const durationMinutes = Math.max(
    0,
    wallTimeToMinutes(time) - wallTimeToMinutes(existing.check_in_time)
  );
  const { data, error } = await supabase
    .from('attendance_sessions')
    .update({
      check_out_time: time,
      duration_minutes: durationMinutes,
      is_auto_punch_out: false,
    })
    .eq('id', existing.id)
    .select()
    .single();
  if (error) throw error;
  const log = buildPseudoLog(today, [data as AttendanceSession], null);
  if (!log) {
    throw new Error('Unable to build check-out result');
  }
  return log;
}

async function getLogsInRange(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<AttendanceLog[]> {
  const [{ data, error }, joinDate] = await Promise.all([
    supabase
      .from('attendance_daily_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false }),
    getUserJoinDate(userId),
  ]);

  if (error) throw error;
  const logs = (data ?? [])
    .map((summary) =>
      buildPseudoLog(
        (summary as AttendanceDailySummary).date,
        [],
        summary as AttendanceDailySummary
      )
    )
    .filter((log): log is AttendanceLog => !!log);
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
    totalWorkingDays: summaries.filter(
      (d) =>
        d.status != null &&
        d.status !== 'future' &&
        d.status !== 'weekend' &&
        d.status !== 'holiday'
    ).length,
  };
}

export async function getAllTimeStats(userId: string): Promise<MonthlyStats> {
  const joinDate = await getUserJoinDate(userId);
  const today = new Date();
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
      if (
        d.status != null &&
        d.status !== 'future' &&
        d.status !== 'weekend' &&
        d.status !== 'holiday'
      ) {
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
  const today = new Date();
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

export async function getAttendanceHistoryAllTime(userId: string): Promise<AttendanceHistoryDay[]> {
  const joinDate = await getUserJoinDate(userId);
  const today = new Date();
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

  const all: AttendanceHistoryDay[] = [];
  let y = startYear;
  let m = startMonth;
  while (y < todayYear || (y === todayYear && m <= todayMonth)) {
    const monthDays = await getAttendanceHistoryMonth(userId, y, m);
    all.push(...monthDays);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
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

export async function getAttendanceHistoryRange(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<AttendanceHistoryDay[]> {
  const [fromY, fromM] = fromDate.split('-').map(Number);
  const [toY, toM] = toDate.split('-').map(Number);

  const all: AttendanceHistoryDay[] = [];
  let y = fromY;
  let m = fromM - 1;
  const endY = toY;
  const endM = toM - 1;
  while (y < endY || (y === endY && m <= endM)) {
    const monthDays = await getAttendanceHistoryMonth(userId, y, m);
    all.push(...monthDays);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }

  return all.filter((day) => day.date >= fromDate && day.date <= toDate);
}

export function calculateAttendanceHistoryStats(
  days: AttendanceHistoryDay[]
): AttendanceHistoryStats {
  return days.reduce<AttendanceHistoryStats>(
    (totals, day) => {
      if (day.primaryState === 'fulfilled_shift') totals.fulfilledShiftDays++;
      else if (day.primaryState === 'incomplete_shift') totals.incompleteShiftDays++;
      else if (day.primaryState === 'late') totals.lateDays++;
      else if (day.primaryState === 'absent') totals.absentDays++;
      else if (day.primaryState === 'on_leave') totals.leaveDays++;

      if (day.hasOvertime) totals.overtimeDays++;

      if (
        day.primaryState === 'fulfilled_shift' ||
        day.primaryState === 'incomplete_shift' ||
        day.primaryState === 'late' ||
        day.primaryState === 'absent' ||
        day.primaryState === 'on_leave'
      ) {
        totals.totalWorkingDays++;
      }

      return totals;
    },
    {
      fulfilledShiftDays: 0,
      incompleteShiftDays: 0,
      lateDays: 0,
      absentDays: 0,
      leaveDays: 0,
      overtimeDays: 0,
      totalWorkingDays: 0,
    }
  );
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
    .from('attendance_daily_summary')
    .select('*')
    .in('user_id', userIds)
    .eq('date', date)
    .order('first_check_in', { ascending: true });

  if (error) throw error;
  return (data ?? [])
    .map((summary) =>
      buildPseudoLog(
        date,
        [],
        summary as AttendanceDailySummary
      )
    )
    .filter((log): log is AttendanceLog => !!log);
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
    teamLiveState: row.team_live_state as TeamAttendanceLiveState | null,
    teamDateState: row.team_date_state as TeamAttendanceDateState,
    firstCheckIn: row.first_check_in,
    lastCheckOut: row.last_check_out,
    totalWorkMinutes: row.total_work_minutes,
    totalOvertimeMinutes: row.total_overtime_minutes,
    hasOvertime: Boolean(row.has_overtime) || Number(row.total_overtime_minutes ?? 0) > 0,
    sessionCount: row.session_count,
    isCheckedInNow: row.is_checked_in_now,
    hasAutoPunchOut: row.has_auto_punch_out,
    needsReview: row.needs_review,
    isIncompleteShift: row.is_incomplete_shift,
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
    availabilityState: row.availability_state as 'available_now' | 'unavailable_now',
    teamLiveState: row.team_live_state as TeamAttendanceLiveState | null,
    hasOvertime: Boolean(row.has_overtime),
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
    teamDateState: row.team_date_state as TeamAttendanceDateState,
    hasOvertime: Boolean(row.has_overtime),
  };
}

export async function getTeamAttendanceDay(params: {
  date: string;
  departmentId?: string | null;
  includeAllProfiles?: boolean;
}): Promise<TeamAttendanceDayRow[]> {
  const { data, error } = await supabase.rpc('get_team_attendance_day', {
    p_date: params.date,
    p_department_id: params.departmentId ?? null,
    p_include_all_profiles: params.includeAllProfiles ?? false,
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
    .channel('attendance_daily_summary:all')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'attendance_daily_summary' },
      (payload) => {
        const log = buildPseudoLog(
          String((payload.new as { date?: string }).date ?? ''),
          [],
          payload.new as AttendanceDailySummary
        );
        if (!log) return;
        onEvent({ eventType: 'INSERT', new: log, old: {} });
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'attendance_daily_summary' },
      (payload) => {
        const nextLog = buildPseudoLog(
          String((payload.new as { date?: string }).date ?? ''),
          [],
          payload.new as AttendanceDailySummary
        );
        const prevLog = buildPseudoLog(
          String((payload.old as { date?: string }).date ?? ''),
          [],
          payload.old as AttendanceDailySummary
        );
        if (!nextLog) return;
        onEvent({
          eventType: 'UPDATE',
          new: nextLog,
          old: prevLog ?? {},
        });
      }
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
    .channel(`attendance_daily_summary:user:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_daily_summary',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const log = buildPseudoLog(
          String((payload.new as { date?: string }).date ?? ''),
          [],
          payload.new as AttendanceDailySummary
        );
        if (!log) return;
        onEvent({ eventType: 'INSERT', new: log, old: {} });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'attendance_daily_summary',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const nextLog = buildPseudoLog(
          String((payload.new as { date?: string }).date ?? ''),
          [],
          payload.new as AttendanceDailySummary
        );
        const prevLog = buildPseudoLog(
          String((payload.old as { date?: string }).date ?? ''),
          [],
          payload.old as AttendanceDailySummary
        );
        if (!nextLog) return;
        onEvent({
          eventType: 'UPDATE',
          new: nextLog,
          old: prevLog ?? {},
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

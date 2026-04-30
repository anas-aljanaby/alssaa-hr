/**
 * Testable punch handler: check-in / check-out.
 * Geofence / coords are not implemented (N/A for tests).
 */

import { corsHeaders } from '../_shared/cors.ts';

/** Keep in sync with `src/shared/attendance/constants.ts`. */
const DEFAULT_MINIMUM_OVERTIME_MINUTES = 60;

export interface PunchBody {
  action: 'check_in' | 'check_out';
}

/** Shifts a UTC Date to org local time (UTC+3) so date/time components are correct. */
export function toOrgLocalDate(d: Date, offsetHours = 3): Date {
  return new Date(d.getTime() + offsetHours * 3600 * 1000);
}

export function toDateStr(d: Date): string {
  const local = toOrgLocalDate(d);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toTimeStr(d: Date): string {
  const local = toOrgLocalDate(d);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

export type PunchEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
};

/** Minimal client shapes for DI; production uses createClient from supabase-js. */
export type PunchUserClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown | null }>;
  };
};

/** PostgREST builder await result (supabase-js compatible). */
export type PgResult = { data: unknown; error: unknown | null };

export type PgChain = PromiseLike<PgResult> & {
  select: (...args: unknown[]) => PgChain;
  insert: (...args: unknown[]) => PgChain;
  update: (...args: unknown[]) => PgChain;
  upsert: (...args: unknown[]) => PgChain;
  delete: (...args: unknown[]) => PgChain;
  eq: (...args: unknown[]) => PgChain;
  not: (...args: unknown[]) => PgChain;
  neq: (...args: unknown[]) => PgChain;
  in: (...args: unknown[]) => PgChain;
  gte: (...args: unknown[]) => PgChain;
  lte: (...args: unknown[]) => PgChain;
  order: (...args: unknown[]) => PgChain;
  limit: (...args: unknown[]) => PgChain;
  range: (...args: unknown[]) => PgChain;
  maybeSingle: (...args: unknown[]) => PgChain;
  single: (...args: unknown[]) => PgChain;
  is: (...args: unknown[]) => PgChain;
};

export type PunchServiceClient = {
  from: (table: string) => PgChain;
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown | null }>;
};

export type PunchDeps = {
  getEnv: () => PunchEnv;
  createUserClient: (authHeader: string) => PunchUserClient;
  createServiceClient: () => PunchServiceClient;
  /** Injected clock for deterministic tests. */
  now?: () => Date;
};

type DayScheduleJson = { start: string; end: string };
type WorkScheduleJson = Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', DayScheduleJson>>;
const TIME_24H_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

type ProfileRow = {
  org_id: string;
  work_schedule?: unknown | null;
};

type SessionRow = {
  id: string;
  org_id?: string;
  user_id?: string;
  date?: string;
  check_in_time: string;
  check_out_time?: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  status: 'present' | 'late';
  is_overtime: boolean;
  duration_minutes?: number;
  last_action_at?: string;
  is_auto_punch_out?: boolean;
  is_early_departure?: boolean;
  needs_review?: boolean;
};

type DailySummaryRow = {
  id: string;
  user_id: string;
  date: string;
  first_check_in: string | null;
  last_check_out: string | null;
  total_work_minutes: number;
  total_overtime_minutes: number;
  effective_status: 'present' | 'late' | 'absent' | 'on_leave' | null;
  is_incomplete_shift: boolean;
  has_overtime: boolean;
  session_count: number;
};

type PolicyRow = {
  work_schedule?: unknown | null;
  grace_period_minutes?: number | null;
  early_login_minutes?: number | null;
  minimum_overtime_minutes?: number | null;
  minimum_required_minutes?: number | null;
};

type ResolvedSchedule = {
  hasShift: boolean;
  isWorkingDay: boolean;
  workStartTime: string | null;
  workEndTime: string | null;
  gracePeriodMinutes: number;
  earlyLoginMinutes: number;
  minimumRequiredMinutes: number | null;
};

function errMsg(e: unknown): string {
  return typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
    ? (e as { message: string }).message
    : 'Error';
}

function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function toSecondsHHMM(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60;
}

function currentSecondsOfDay(d: Date): number {
  const local = toOrgLocalDate(d);
  return local.getUTCHours() * 3600 + local.getUTCMinutes() * 60 + local.getUTCSeconds();
}

function fromSeconds(sec: number): number {
  if (sec < 0) return sec + 86400;
  if (sec >= 86400) return sec - 86400;
  return sec;
}

/** Whole-minute span between two timestamps. */
export function diffMinutesFromTimestamps(checkInAt: Date, checkOutAt: Date): number {
  return Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000);
}

/**
 * Combine a Baghdad-local YYYY-MM-DD date and HH:MM time into a UTC ISO timestamp.
 * Used to anchor a shift HH:MM schedule to the calendar date the session belongs to.
 */
export function localDateTimeToUtcIso(dateStr: string, timeHHMM: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeHHMM.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - 3 * 3600 * 1000).toISOString();
}

export function localDateTimeToDate(dateStr: string, timeHHMM: string): Date {
  return new Date(localDateTimeToUtcIso(dateStr, timeHHMM));
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
}

/**
 * Resolve a session's check_in_at, falling back to (date, check_in_time) for
 * legacy rows whose backfill might have missed.
 */
export function sessionCheckInAt(s: { check_in_at?: string | null; date?: string | null; check_in_time: string }): string {
  if (s.check_in_at) return s.check_in_at;
  return localDateTimeToUtcIso(s.date ?? '', s.check_in_time);
}

/**
 * Resolve shiftStartAt / shiftEndAt timestamps for a given session date and
 * HH:MM schedule. For overnight shifts (end <= start) the end is bumped to the
 * next calendar day so the returned interval is always non-empty.
 */
export function resolveShiftBounds(
  sessionDate: string,
  workStartTime: string | null,
  workEndTime: string | null
): { shiftStartAt: Date | null; shiftEndAt: Date | null } {
  if (!workStartTime || !workEndTime) {
    return { shiftStartAt: null, shiftEndAt: null };
  }
  const startAt = localDateTimeToDate(sessionDate, workStartTime);
  let endAt = localDateTimeToDate(sessionDate, workEndTime);
  if (endAt.getTime() <= startAt.getTime()) {
    endAt = new Date(endAt.getTime() + 24 * 3600 * 1000);
  }
  return { shiftStartAt: startAt, shiftEndAt: endAt };
}

/** Late-stay: regular session extends past shift end → split into regular [check_in, shiftEnd] + OT [shiftEnd, checkout]. */
function normalizeMinimumOvertimeMinutes(minimumOvertimeMinutes?: number | null): number {
  if (typeof minimumOvertimeMinutes !== 'number' || Number.isNaN(minimumOvertimeMinutes)) {
    return DEFAULT_MINIMUM_OVERTIME_MINUTES;
  }
  return Math.max(0, Math.trunc(minimumOvertimeMinutes));
}

export function shouldKeepOvertimeSession(
  durationMinutes: number,
  minimumOvertimeMinutes?: number | null
): boolean {
  return durationMinutes >= normalizeMinimumOvertimeMinutes(minimumOvertimeMinutes);
}

export type OvertimeSegment = {
  type: 'overtime' | 'regular';
  checkInAt: Date;
  checkOutAt: Date;
  durationMinutes: number;
};

/**
 * Splits a closed overtime session that overlaps a regular shift into pre-shift
 * OT, in-shift regular, and post-shift OT segments. Operates purely on
 * timestamps so overnight shifts and multi-day spans work naturally.
 *
 * Returns a single-element array (the original OT) when no split applies:
 * - shift bounds unset, or
 * - session does not overlap the shift window.
 */
export function resolveOvertimeSessionSplit(input: {
  checkInAt: Date;
  checkOutAt: Date;
  shiftStartAt: Date | null;
  shiftEndAt: Date | null;
  minimumOvertimeMinutes?: number | null;
}): OvertimeSegment[] {
  const original: OvertimeSegment[] = [
    {
      type: 'overtime',
      checkInAt: input.checkInAt,
      checkOutAt: input.checkOutAt,
      durationMinutes: diffMinutesFromTimestamps(input.checkInAt, input.checkOutAt),
    },
  ];

  if (!input.shiftStartAt || !input.shiftEndAt) return original;

  const checkInMs = input.checkInAt.getTime();
  const checkOutMs = input.checkOutAt.getTime();
  const shiftStartMs = input.shiftStartAt.getTime();
  const shiftEndMs = input.shiftEndAt.getTime();

  if (checkOutMs <= shiftStartMs || checkInMs >= shiftEndMs) return original;

  const minOt = normalizeMinimumOvertimeMinutes(input.minimumOvertimeMinutes);
  const segments: OvertimeSegment[] = [];

  if (checkInMs < shiftStartMs) {
    const dur = Math.round((shiftStartMs - checkInMs) / 60000);
    if (dur >= minOt) {
      segments.push({
        type: 'overtime',
        checkInAt: input.checkInAt,
        checkOutAt: input.shiftStartAt,
        durationMinutes: dur,
      });
    }
  }

  const regStartMs = Math.max(checkInMs, shiftStartMs);
  const regEndMs = Math.min(checkOutMs, shiftEndMs);
  segments.push({
    type: 'regular',
    checkInAt: new Date(regStartMs),
    checkOutAt: new Date(regEndMs),
    durationMinutes: Math.round((regEndMs - regStartMs) / 60000),
  });

  if (checkOutMs > shiftEndMs) {
    const dur = Math.round((checkOutMs - shiftEndMs) / 60000);
    if (dur >= minOt) {
      segments.push({
        type: 'overtime',
        checkInAt: input.shiftEndAt,
        checkOutAt: input.checkOutAt,
        durationMinutes: dur,
      });
    }
  }

  return segments.length > 1 ? segments : original;
}

export function resolveCheckoutOvertimeHandling(input: {
  hasShift: boolean;
  isWorkingDay: boolean;
  shiftStartAt: Date | null;
  shiftEndAt: Date | null;
  openSessionIsOvertime: boolean;
  checkInAt: Date;
  checkoutAt: Date;
  minimumOvertimeMinutes?: number | null;
}): {
  shouldSplitOvertime: boolean;
  regularCheckOutAt: Date;
  regularDurationMinutes: number;
  overtimeDurationMinutes: number;
  shiftEndAt: Date | null;
} {
  const actualDurationMinutes = diffMinutesFromTimestamps(input.checkInAt, input.checkoutAt);

  if (!input.hasShift || !input.isWorkingDay || !input.shiftEndAt || input.openSessionIsOvertime) {
    return {
      shouldSplitOvertime: false,
      regularCheckOutAt: input.checkoutAt,
      regularDurationMinutes: actualDurationMinutes,
      overtimeDurationMinutes: 0,
      shiftEndAt: input.shiftEndAt,
    };
  }

  const checkInMs = input.checkInAt.getTime();
  const checkoutMs = input.checkoutAt.getTime();
  const shiftEndMs = input.shiftEndAt.getTime();

  if (checkoutMs <= shiftEndMs || checkInMs >= shiftEndMs) {
    return {
      shouldSplitOvertime: false,
      regularCheckOutAt: input.checkoutAt,
      regularDurationMinutes: actualDurationMinutes,
      overtimeDurationMinutes: 0,
      shiftEndAt: input.shiftEndAt,
    };
  }

  const overtimeDurationMinutes = Math.round((checkoutMs - shiftEndMs) / 60000);
  if (!shouldKeepOvertimeSession(overtimeDurationMinutes, input.minimumOvertimeMinutes)) {
    return {
      shouldSplitOvertime: false,
      regularCheckOutAt: input.checkoutAt,
      regularDurationMinutes: actualDurationMinutes,
      overtimeDurationMinutes: 0,
      shiftEndAt: input.shiftEndAt,
    };
  }

  return {
    shouldSplitOvertime: true,
    regularCheckOutAt: input.shiftEndAt,
    regularDurationMinutes: Math.round((shiftEndMs - checkInMs) / 60000),
    overtimeDurationMinutes,
    shiftEndAt: input.shiftEndAt,
  };
}

function parseWorkSchedule(raw: unknown): WorkScheduleJson {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result: WorkScheduleJson = {};
  for (const key of ['0', '1', '2', '3', '4', '5', '6'] as const) {
    const day = (raw as Record<string, unknown>)[key];
    if (
      day !== null &&
      typeof day === 'object' &&
      typeof (day as { start?: unknown }).start === 'string' &&
      typeof (day as { end?: unknown }).end === 'string' &&
      TIME_24H_REGEX.test((day as DayScheduleJson).start) &&
      TIME_24H_REGEX.test((day as DayScheduleJson).end)
    ) {
      result[key] = { start: (day as DayScheduleJson).start, end: (day as DayScheduleJson).end };
    }
  }
  return result;
}

function resolveSchedule(profile: ProfileRow, policy: PolicyRow | null, date: Date): ResolvedSchedule {
  const userSchedule = parseWorkSchedule(profile.work_schedule);
  const orgSchedule = parseWorkSchedule(policy?.work_schedule);
  const hasAnyConfig =
    Object.keys(userSchedule).length > 0 || Object.keys(orgSchedule).length > 0;
  const weekday = toOrgLocalDate(date).getUTCDay();
  const key = String(weekday) as '0' | '1' | '2' | '3' | '4' | '5' | '6';
  const effective = userSchedule[key] ?? orgSchedule[key] ?? null;

  const workStartTime = effective?.start ?? null;
  const workEndTime = effective?.end ?? null;
  const hasShift = hasAnyConfig;
  const isWorkingDay = !!effective;

  return {
    hasShift,
    isWorkingDay,
    workStartTime,
    workEndTime,
    gracePeriodMinutes: policy?.grace_period_minutes ?? 15,
    earlyLoginMinutes: policy?.early_login_minutes ?? 60,
    minimumRequiredMinutes: policy?.minimum_required_minutes ?? null,
  };
}

function classifySessionCheckIn(
  nowSeconds: number,
  schedule: ResolvedSchedule
): { status: 'present' | 'late'; isOvertime: boolean } {
  if (!schedule.hasShift) {
    return { status: 'present', isOvertime: false };
  }
  if (!schedule.isWorkingDay) {
    return { status: 'present', isOvertime: true };
  }

  const shiftStartSeconds = toSecondsHHMM(schedule.workStartTime!);
  const shiftEndSeconds = toSecondsHHMM(schedule.workEndTime!);
  const earlyLoginStartSeconds = fromSeconds(shiftStartSeconds - schedule.earlyLoginMinutes * 60);
  const overnight = shiftEndSeconds < shiftStartSeconds;

  const withinWindow = overnight
    ? nowSeconds >= earlyLoginStartSeconds || nowSeconds <= shiftEndSeconds
    : nowSeconds >= earlyLoginStartSeconds && nowSeconds <= shiftEndSeconds;

  if (!withinWindow) {
    return { status: 'present', isOvertime: true };
  }

  const onStartSide = !overnight || nowSeconds >= shiftStartSeconds;
  if (onStartSide && nowSeconds > shiftStartSeconds + schedule.gracePeriodMinutes * 60) {
    return { status: 'late', isOvertime: false };
  }

  return { status: 'present', isOvertime: false };
}

async function hasApprovedLeaveForDate(
  admin: PunchServiceClient,
  userId: string,
  dateStr: string
): Promise<boolean> {
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;
  const { data } = await admin
    .from('leave_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .neq('type', 'overtime')
    .lte('from_date_time', dayEnd)
    .gte('to_date_time', dayStart)
    .limit(1)
    .maybeSingle();

  return !!data;
}

function resolveEffectiveStatus(
  sessions: SessionRow[],
  isWorkingDay: boolean,
  hasApprovedLeave: boolean,
  isPastOrToday: boolean
): DailySummaryRow['effective_status'] {
  if (hasApprovedLeave) return 'on_leave';
  if (!isWorkingDay) return null;

  if (sessions.length === 0) {
    return isPastOrToday ? 'absent' : null;
  }

  const nonOvertime = sessions.filter((s) => !s.is_overtime);
  const hasPresent = nonOvertime.some((s) => s.status === 'present');
  const hasLate = nonOvertime.some((s) => s.status === 'late');

  if (hasLate && !hasPresent) return 'late';
  if (hasPresent) return 'present';
  if (sessions.every((s) => s.is_overtime)) return 'absent';
  return null;
}

/**
 * Day-of-belonging rule: a session contributes to exactly one daily summary,
 * the one for `check_in_at::date` in Asia/Baghdad. Cross-midnight sessions are
 * NOT split across two summaries (see "Out of Scope" in the timestamp
 * migration plan). Ordering uses `check_in_at` so multiple sessions on the
 * same belonging-date sort by their actual instant, not just their HH:MM.
 */
export async function recalculateDailySummary(
  admin: PunchServiceClient,
  input: {
    orgId: string;
    userId: string;
    dateStr: string;
    schedule: ResolvedSchedule;
  }
): Promise<DailySummaryRow | null> {
  const { orgId, userId, dateStr, schedule } = input;
  const { data: sessionsRaw } = await admin
    .from('attendance_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .order('check_in_at', { ascending: true });

  const sessions = (sessionsRaw ?? []) as SessionRow[];
  const totalWorkMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  const totalOvertimeMinutes = sessions
    .filter((s) => s.is_overtime)
    .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  const hasOvertime = sessions.some((s) => s.is_overtime);
  const firstCheckIn = sessions.length ? sessions[0].check_in_time : null;
  const lastCheckOut = sessions
    .filter((s) => !!s.check_out_time)
    .map((s) => {
      const time = s.check_out_time as string;
      let sortKey: number;
      if (s.check_out_at) {
        sortKey = new Date(s.check_out_at).getTime();
      } else {
        const baseDate = s.date ?? dateStr;
        const wrapsMidnight = toMinutes(time) < toMinutes(s.check_in_time);
        sortKey =
          new Date(localDateTimeToUtcIso(baseDate, time)).getTime() +
          (wrapsMidnight ? 24 * 3600 * 1000 : 0);
      }
      return { time, sortKey };
    })
    .sort((a, b) => a.sortKey - b.sortKey)
    .at(-1)?.time ?? null;
  const hasApprovedLeave = await hasApprovedLeaveForDate(admin, userId, dateStr);
  const todayDate = toDateStr(new Date());
  const isPastOrToday = dateStr <= todayDate;
  const effectiveStatus = resolveEffectiveStatus(sessions, schedule.isWorkingDay, hasApprovedLeave, isPastOrToday);
  const isIncompleteShift =
    (effectiveStatus === 'present' || effectiveStatus === 'late') &&
    schedule.minimumRequiredMinutes != null
      ? totalWorkMinutes < schedule.minimumRequiredMinutes
      : false;

  const payload = {
    org_id: orgId,
    user_id: userId,
    date: dateStr,
    first_check_in: firstCheckIn,
    last_check_out: lastCheckOut,
    total_work_minutes: totalWorkMinutes,
    total_overtime_minutes: totalOvertimeMinutes,
    effective_status: effectiveStatus,
    is_incomplete_shift: isIncompleteShift,
    has_overtime: hasOvertime,
    session_count: sessions.length,
    updated_at: new Date().toISOString(),
  };

  const { data: summary, error } = await admin
    .from('attendance_daily_summary')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select('*')
    .single();
  if (error) {
    throw error;
  }
  return summary as DailySummaryRow;
}

export async function handlePunch(req: Request, deps: PunchDeps): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientWithAuth = deps.createUserClient(authHeader);
    const { data: { user: caller } } = await clientWithAuth.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'انتهت الجلسة أو لا تملك الصلاحية', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as PunchBody;
    const action = body?.action;
    if (action !== 'check_in' && action !== 'check_out') {
      return new Response(
        JSON.stringify({ error: 'action must be check_in or check_out', code: 'INVALID_ACTION' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveNow = deps.now?.() ?? new Date();

    const today = toDateStr(effectiveNow);
    const time = toTimeStr(effectiveNow);

    const admin = deps.createServiceClient();

    const { data: profileRaw, error: profileError } = await admin
      .from('profiles')
      .select('org_id, work_schedule')
      .eq('id', caller.id)
      .single();

    const profile = profileRaw as ProfileRow | null;
    if (!profile || profileError) {
      const profileErrorMessage =
        typeof profileError === 'object' &&
        profileError !== null &&
        'message' in profileError &&
        typeof (profileError as { message?: unknown }).message === 'string'
          ? (profileError as { message: string }).message
          : 'لم يتم العثور على الملف الشخصي';
      return new Response(
        JSON.stringify({ error: profileErrorMessage, code: 'NO_PROFILE' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = profile.org_id;

    let openSession: SessionRow | null = null;
    {
      const { data: todayRaw } = await admin
        .from('attendance_sessions')
        .select('*')
        .eq('user_id', caller.id)
        .eq('date', today)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      openSession = todayRaw as SessionRow | null;
    }

    if (!openSession) {
      const yesterday = toDateStr(new Date(effectiveNow.getTime() - 24 * 3600 * 1000));
      const { data: prevRaw } = await admin
        .from('attendance_sessions')
        .select('*')
        .eq('user_id', caller.id)
        .eq('date', yesterday)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      openSession = prevRaw as SessionRow | null;
    }

    const { data: policyRaw } = await admin
      .from('attendance_policy')
      .select('work_schedule, grace_period_minutes, early_login_minutes, minimum_overtime_minutes, minimum_required_minutes')
      .eq('org_id', orgId)
      .limit(1)
      .maybeSingle();

    const policy = policyRaw as PolicyRow | null;
    const schedule = resolveSchedule(profile, policy, effectiveNow);
    const sessionSchedule = openSession && openSession.date !== today
      ? resolveSchedule(profile, policy, new Date(openSession.date + 'T12:00:00.000Z'))
      : schedule;

    if (action === 'check_in') {
      if (openSession) {
        return new Response(
          JSON.stringify(openSession),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const classification = classifySessionCheckIn(currentSecondsOfDay(effectiveNow), schedule);

      const { data: inserted, error } = await admin
        .from('attendance_sessions')
        .insert({
          org_id: orgId,
          user_id: caller.id,
          date: today,
          check_in_time: time,
          check_in_at: effectiveNow.toISOString(),
          status: classification.status,
          is_overtime: classification.isOvertime,
          duration_minutes: 0,
          last_action_at: effectiveNow.toISOString(),
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: errMsg(error), code: 'INSERT_FAILED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const insertedSession = inserted as SessionRow;

      if (insertedSession.is_overtime) {
        // Best effort: attendance session is source of truth.
        await admin
          .from('overtime_requests')
          .upsert({
            org_id: orgId,
            user_id: caller.id,
            session_id: insertedSession.id,
            status: 'pending',
          }, { onConflict: 'session_id' });
      }

      await recalculateDailySummary(admin, {
        orgId,
        userId: caller.id,
        dateStr: today,
        schedule,
      });

      return new Response(
        JSON.stringify(insertedSession),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openSession?.check_in_time) {
      return new Response(
        JSON.stringify({ error: 'Must check in before checking out', code: 'NO_CHECK_IN' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const openSessionDate = openSession.date ?? today;
    const openSessionCheckInDate = new Date(sessionCheckInAt(openSession));
    const checkoutAt = effectiveNow;
    const { shiftStartAt: sessionShiftStartAt, shiftEndAt: sessionShiftEndAt } = resolveShiftBounds(
      openSessionDate,
      sessionSchedule.workStartTime,
      sessionSchedule.workEndTime
    );

    const checkoutHandling = resolveCheckoutOvertimeHandling({
      hasShift: sessionSchedule.hasShift,
      isWorkingDay: sessionSchedule.isWorkingDay,
      shiftStartAt: sessionShiftStartAt,
      shiftEndAt: sessionShiftEndAt,
      openSessionIsOvertime: openSession.is_overtime,
      checkInAt: openSessionCheckInDate,
      checkoutAt,
      minimumOvertimeMinutes: policy?.minimum_overtime_minutes,
    });

    if (openSession.is_overtime) {
      const overtimeDurationMinutes = diffMinutesFromTimestamps(openSessionCheckInDate, checkoutAt);
      if (!shouldKeepOvertimeSession(overtimeDurationMinutes, policy?.minimum_overtime_minutes)) {
        await admin
          .from('overtime_requests')
          .delete()
          .eq('session_id', openSession.id);

        const { error: deleteError } = await admin
          .from('attendance_sessions')
          .delete()
          .eq('id', openSession.id)
          .select()
          .single();

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: errMsg(deleteError), code: 'DELETE_FAILED' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await recalculateDailySummary(admin, {
          orgId,
          userId: caller.id,
          dateStr: openSessionDate,
          schedule: sessionSchedule,
        });

        return new Response(
          JSON.stringify({
            session: null,
            discarded_overtime_session_id: openSession.id,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Overtime session that overlapped a regular shift: split into the
      // pre-shift OT, in-shift regular, and post-shift OT segments so the
      // worker doesn't end up with a single 16h-OT block and an "absent" day.
      if (sessionSchedule.hasShift && sessionSchedule.isWorkingDay) {
        const segments = resolveOvertimeSessionSplit({
          checkInAt: openSessionCheckInDate,
          checkOutAt: checkoutAt,
          shiftStartAt: sessionShiftStartAt,
          shiftEndAt: sessionShiftEndAt,
          minimumOvertimeMinutes: policy?.minimum_overtime_minutes,
        });

        if (segments.length > 1 && segments.some((s) => s.type === 'regular')) {
          await admin
            .from('overtime_requests')
            .delete()
            .eq('session_id', openSession.id);

          const { error: delErr } = await admin
            .from('attendance_sessions')
            .delete()
            .eq('id', openSession.id);

          if (delErr) {
            return new Response(
              JSON.stringify({ error: errMsg(delErr), code: 'DELETE_FAILED' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const grace = policy?.grace_period_minutes ?? 15;
          const shiftStartMs = sessionShiftStartAt?.getTime() ?? null;
          const insertedSegments: SessionRow[] = [];

          for (const seg of segments) {
            const isOt = seg.type === 'overtime';
            const segStartMs = seg.checkInAt.getTime();
            const segStatus: 'present' | 'late' = isOt
              ? 'present'
              : shiftStartMs !== null && segStartMs > shiftStartMs + grace * 60000
                ? 'late'
                : 'present';

            const { data: inserted, error: insErr } = await admin
              .from('attendance_sessions')
              .insert({
                org_id: orgId,
                user_id: caller.id,
                date: openSessionDate,
                check_in_time: toTimeStr(seg.checkInAt),
                check_out_time: toTimeStr(seg.checkOutAt),
                check_in_at: seg.checkInAt.toISOString(),
                check_out_at: seg.checkOutAt.toISOString(),
                status: segStatus,
                is_overtime: isOt,
                duration_minutes: seg.durationMinutes,
                last_action_at: effectiveNow.toISOString(),
              })
              .select()
              .single();

            if (insErr) {
              return new Response(
                JSON.stringify({ error: errMsg(insErr), code: 'INSERT_FAILED' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            const insertedSession = inserted as SessionRow;
            insertedSegments.push(insertedSession);

            if (isOt) {
              await admin
                .from('overtime_requests')
                .upsert({
                  org_id: orgId,
                  user_id: caller.id,
                  session_id: insertedSession.id,
                  status: 'pending',
                }, { onConflict: 'session_id' });
            }
          }

          await recalculateDailySummary(admin, {
            orgId,
            userId: caller.id,
            dateStr: openSessionDate,
            schedule: sessionSchedule,
          });

          return new Response(
            JSON.stringify({
              split_overtime_session_id: openSession.id,
              segments: insertedSegments,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (checkoutHandling.shouldSplitOvertime && checkoutHandling.shiftEndAt) {
      const regularDuration = checkoutHandling.regularDurationMinutes;
      const otDuration = checkoutHandling.overtimeDurationMinutes;
      const shiftBoundaryAt = checkoutHandling.regularCheckOutAt;
      const shiftBoundaryTime = toTimeStr(shiftBoundaryAt);

      const { data: updatedRegular, error: errRegular } = await admin
        .from('attendance_sessions')
        .update({
          check_out_time: shiftBoundaryTime,
          check_out_at: shiftBoundaryAt.toISOString(),
          duration_minutes: regularDuration,
          is_early_departure: false,
          is_auto_punch_out: false,
          needs_review: false,
          last_action_at: effectiveNow.toISOString(),
        })
        .eq('id', openSession.id)
        .select()
        .single();

      if (errRegular) {
        return new Response(
          JSON.stringify({ error: errMsg(errRegular), code: 'UPDATE_FAILED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: insertedOt, error: errOt } = await admin
        .from('attendance_sessions')
        .insert({
          org_id: orgId,
          user_id: caller.id,
          date: openSessionDate,
          check_in_time: shiftBoundaryTime,
          check_out_time: time,
          check_in_at: shiftBoundaryAt.toISOString(),
          check_out_at: effectiveNow.toISOString(),
          status: 'present',
          is_overtime: true,
          duration_minutes: otDuration,
          last_action_at: effectiveNow.toISOString(),
        })
        .select()
        .single();

      if (errOt) {
        return new Response(
          JSON.stringify({ error: errMsg(errOt), code: 'INSERT_FAILED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const otSession = insertedOt as SessionRow;

      await admin
        .from('overtime_requests')
        .upsert({
          org_id: orgId,
          user_id: caller.id,
          session_id: otSession.id,
          status: 'pending',
        }, { onConflict: 'session_id' });

      await recalculateDailySummary(admin, {
        orgId,
        userId: caller.id,
        dateStr: openSessionDate,
        schedule: sessionSchedule,
      });

      return new Response(
        JSON.stringify({
          session: updatedRegular,
          late_stay_overtime_session_id: otSession.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const durationMinutes = diffMinutesFromTimestamps(openSessionCheckInDate, checkoutAt);
    const isEarlyDeparture = (() => {
      if (!sessionSchedule.hasShift || !sessionSchedule.isWorkingDay || openSession.is_overtime || !sessionShiftEndAt) return false;
      return checkoutAt.getTime() < sessionShiftEndAt.getTime();
    })();

    const { data: updated, error } = await admin
      .from('attendance_sessions')
      .update({
        check_out_time: time,
        check_out_at: effectiveNow.toISOString(),
        duration_minutes: durationMinutes,
        is_early_departure: isEarlyDeparture,
        is_auto_punch_out: false,
        needs_review: false,
        last_action_at: effectiveNow.toISOString(),
      })
      .eq('id', openSession.id)
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: errMsg(error), code: 'UPDATE_FAILED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await recalculateDailySummary(admin, {
      orgId,
      userId: caller.id,
      dateStr: openSessionDate,
      schedule: sessionSchedule,
    });

    return new Response(
      JSON.stringify(updated),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (_e) {
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Supabase Edge Function: auto punch-out safety net.

import { corsHeaders } from '../_shared/cors.ts';

/** Keep in sync with `src/shared/attendance/constants.ts`. */
const DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES = 5;
import type { PunchServiceClient } from '../punch/handler.ts';
import { resolveCheckoutOvertimeHandling, resolveOvertimeSessionSplit } from '../punch/handler.ts';

type DayScheduleJson = { start: string; end: string };
type WorkScheduleJson = Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', DayScheduleJson>>;
const TIME_24H_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

type AutoPunchOutRule = {
  id: string;
  title: string;
  time: string;
  sessionType: 'all' | 'overtime' | 'regular';
  enabled: boolean;
};

function parseRules(raw: unknown): AutoPunchOutRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is AutoPunchOutRule =>
      r !== null &&
      typeof r === 'object' &&
      typeof (r as AutoPunchOutRule).id === 'string' &&
      typeof (r as AutoPunchOutRule).title === 'string' &&
      typeof (r as AutoPunchOutRule).time === 'string' &&
      TIME_24H_REGEX.test((r as AutoPunchOutRule).time) &&
      ((r as AutoPunchOutRule).sessionType === 'all' ||
        (r as AutoPunchOutRule).sessionType === 'overtime' ||
        (r as AutoPunchOutRule).sessionType === 'regular') &&
      typeof (r as AutoPunchOutRule).enabled === 'boolean'
  );
}

/**
 * Returns the UTC instant of the next occurrence of `ruleTime` (org-local HH:MM)
 * strictly after the session's check-in moment.
 */
function computeRuleDeadline(
  sessionDate: string,
  checkInTime: string,
  ruleTime: string,
  offsetHours = 3
): Date {
  const [y, mo, d] = sessionDate.split('-').map(Number);
  const [ch, cm] = checkInTime.split(':').map(Number);
  const [rh, rm] = ruleTime.split(':').map(Number);

  const ruleSameDayUtcMs =
    Date.UTC(y, mo - 1, d, rh, rm, 0, 0) - offsetHours * 3600 * 1000;
  const checkInUtcMs =
    Date.UTC(y, mo - 1, d, ch, cm, 0, 0) - offsetHours * 3600 * 1000;

  if (ruleSameDayUtcMs > checkInUtcMs) return new Date(ruleSameDayUtcMs);
  return new Date(ruleSameDayUtcMs + 24 * 3600 * 1000);
}

function ruleMatchesSession(rule: AutoPunchOutRule, isOvertimeSession: boolean): boolean {
  if (rule.sessionType === 'all') return true;
  if (rule.sessionType === 'overtime') return isOvertimeSession;
  return !isOvertimeSession;
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

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function formatTimeHHMM(t: string): string {
  const parts = t.split(':');
  return `${parts[0].padStart(2, '0')}:${(parts[1] ?? '0').padStart(2, '0')}`;
}

function nowToTimeHHMM(d: Date): string {
  const local = toOrgLocalDate(d);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

function diffMinutes(checkIn: string, checkOut: string): number {
  const inM = timeToMinutes(checkIn);
  const outM = timeToMinutes(checkOut);
  const diff = outM - inM;
  return diff >= 0 ? diff : diff + 1440;
}

function parseJwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export type AutoPunchEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
  cronAuthToken?: string | null;
};

export type AutoPunchUserClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown | null }> };
};

export type AutoPunchDeps = {
  getEnv: () => AutoPunchEnv;
  createUserClient: (authHeader: string) => AutoPunchUserClient;
  createServiceClient: () => PunchServiceClient;
  /** Injected clock for deterministic tests. */
  now?: () => Date;
};

export async function handleAutoPunchOut(req: Request, deps: AutoPunchDeps): Promise<Response> {
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
        JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const { serviceRoleKey, cronAuthToken } = deps.getEnv();
    const admin = deps.createServiceClient();
    const systemAuthToken = cronAuthToken?.trim() || serviceRoleKey;
    const isServiceRoleJwt = parseJwtRole(token) === 'service_role';

    // Allow secure system calls using the service-role token (e.g., scheduler).
    // Otherwise require a valid logged-in admin user.
    if (!isServiceRoleJwt && token !== systemAuthToken) {
      const clientWithAuth = deps.createUserClient(authHeader);
      const { data: { user: caller } } = await clientWithAuth.auth.getUser();
      if (!caller) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: profileRaw } = await admin
        .from('profiles')
        .select('role')
        .eq('id', caller.id)
        .single();
      const profile = profileRaw as { role?: string } | null;
      if (!profile || profile.role !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Forbidden', code: 'FORBIDDEN' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const effectiveNow = deps.now?.() ?? new Date();

    const today = toDateStr(effectiveNow);
    const yesterday = toDateStr(new Date(effectiveNow.getTime() - 24 * 3600 * 1000));
    const localNow = toOrgLocalDate(effectiveNow);
    const nowMinutes = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();

    const { data: openSessionsRaw, error: sessionsError } = await admin
      .from('attendance_sessions')
      .select('id, user_id, org_id, date, check_in_time, is_overtime')
      .in('date', [today, yesterday])
      .is('check_out_time', null);

    const openSessions = openSessionsRaw as {
      id: string;
      user_id: string;
      org_id: string;
      date: string;
      check_in_time: string;
      is_overtime: boolean;
    }[] | null;

    if (sessionsError) {
      const msg =
        typeof sessionsError === 'object' && sessionsError !== null && 'message' in sessionsError
          ? String((sessionsError as { message: string }).message)
          : 'Query failed';
      return new Response(
        JSON.stringify({ error: msg, code: 'QUERY_FAILED' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openSessions?.length) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No open sessions' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load notification settings keyed by org_id (lazy cache across sessions)
    const notifSettingsCache: Record<string, {
      title: string;
      title_ar: string;
      message: string;
      message_ar: string;
    } | null> = {};

    async function getAutoPunchOutNotifSetting(orgId: string) {
      if (orgId in notifSettingsCache) return notifSettingsCache[orgId];
      const { data } = await admin
        .from('notification_settings')
        .select('title, title_ar, message, message_ar')
        .eq('org_id', orgId)
        .eq('type', 'auto_punch_out_alert')
        .eq('enabled', true)
        .maybeSingle();
      const result = (data as { title: string; title_ar: string; message: string; message_ar: string } | null) ?? null;
      notifSettingsCache[orgId] = result;
      return result;
    }

    let processed = 0;

    for (const session of openSessions) {
      const { data: profileRaw } = await admin
        .from('profiles')
        .select('work_schedule')
        .eq('id', session.user_id)
        .single();

      const profile = profileRaw as {
        work_schedule?: unknown | null;
      } | null;

      const { data: policyRaw } = await admin
        .from('attendance_policy')
        .select('work_schedule, auto_punch_out_buffer_minutes, minimum_overtime_minutes, auto_punch_out_rules')
        .eq('org_id', session.org_id)
        .limit(1)
        .maybeSingle();

      const policy = policyRaw as {
        work_schedule?: unknown | null;
        auto_punch_out_buffer_minutes?: number | null;
        minimum_overtime_minutes?: number | null;
        auto_punch_out_rules?: unknown | null;
      } | null;

      const userSchedule = parseWorkSchedule(profile?.work_schedule);
      const orgSchedule = parseWorkSchedule(policy?.work_schedule);
      const sessionDayOfWeek = toOrgLocalDate(new Date(session.date + 'T12:00:00.000Z')).getUTCDay();
      const dayKey = String(sessionDayOfWeek) as '0' | '1' | '2' | '3' | '4' | '5' | '6';
      const effective = userSchedule[dayKey] ?? orgSchedule[dayKey] ?? null;
      const workEndTime = effective?.end ?? null;
      const workStartTime = effective?.start ?? null;
      const bufferMinutes = policy?.auto_punch_out_buffer_minutes ?? DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES;
      const rules = parseRules(policy?.auto_punch_out_rules).filter((r) => r.enabled);
      const isOvertimeSession = !!session.is_overtime;

      // Determine the trigger: buffer (only for regular sessions on a working day)
      // or any enabled rule whose sessionType matches and whose deadline has passed.
      let trigger: 'buffer' | 'rule' | null = null;
      let actualCheckoutTime: string | null = null;

      if (!isOvertimeSession && effective && workEndTime && workStartTime) {
        const overnight = timeToMinutes(workEndTime) < timeToMinutes(workStartTime);
        const normalizeNow = (m: number) => {
          if (!overnight) return m;
          return m < timeToMinutes(workStartTime) ? m + 1440 : m;
        };
        const normalizedNow = normalizeNow(nowMinutes);
        const normalizedShiftEnd = overnight
          ? timeToMinutes(workEndTime) + 1440
          : timeToMinutes(workEndTime);
        const cutoffMinutes = normalizedShiftEnd + bufferMinutes;

        if (normalizedNow > cutoffMinutes) {
          trigger = 'buffer';
          actualCheckoutTime = nowToTimeHHMM(effectiveNow);
        }
      }

      if (!trigger) {
        for (const rule of rules) {
          if (!ruleMatchesSession(rule, isOvertimeSession)) continue;
          const deadline = computeRuleDeadline(
            session.date,
            session.check_in_time,
            rule.time
          );
          if (effectiveNow.getTime() >= deadline.getTime()) {
            trigger = 'rule';
            actualCheckoutTime = formatTimeHHMM(rule.time);
            break;
          }
        }
      }

      if (!trigger || !actualCheckoutTime) continue;

      // Overtime session that overlapped a regular shift: rebuild the day as
      // pre-shift OT + regular + post-shift OT segments.
      if (isOvertimeSession && effective && workStartTime && workEndTime) {
        const segments = resolveOvertimeSessionSplit({
          checkIn: session.check_in_time,
          checkOut: actualCheckoutTime,
          workStartTime,
          workEndTime,
          minimumOvertimeMinutes: policy?.minimum_overtime_minutes,
        });

        if (segments.length > 1 && segments.some((s) => s.type === 'regular')) {
          await admin.from('overtime_requests').delete().eq('session_id', session.id);
          const { error: delErr } = await admin
            .from('attendance_sessions')
            .delete()
            .eq('id', session.id);
          if (delErr) continue;

          let inserted = 0;
          for (const seg of segments) {
            const isOt = seg.type === 'overtime';
            const { data: insertedRow } = await admin
              .from('attendance_sessions')
              .insert({
                org_id: session.org_id,
                user_id: session.user_id,
                date: session.date,
                check_in_time: seg.checkIn,
                check_out_time: seg.checkOut,
                status: 'present',
                is_overtime: isOt,
                duration_minutes: seg.durationMinutes,
                is_auto_punch_out: true,
                needs_review: true,
                is_early_departure: false,
                last_action_at: effectiveNow.toISOString(),
                updated_at: effectiveNow.toISOString(),
              })
              .select('id')
              .single();

            if (isOt && (insertedRow as { id?: string } | null)?.id) {
              await admin.from('overtime_requests').upsert({
                org_id: session.org_id,
                user_id: session.user_id,
                session_id: (insertedRow as { id: string }).id,
                status: 'pending',
              }, { onConflict: 'session_id' });
            }
            inserted++;
          }

          if (inserted > 0) {
            const notifSetting = await getAutoPunchOutNotifSetting(session.org_id);
            await admin.from('notifications').insert({
              org_id: session.org_id,
              user_id: session.user_id,
              title: notifSetting?.title ?? 'Forgot to punch out',
              title_ar: notifSetting?.title_ar ?? 'نسيت تسجيل الانصراف',
              message: notifSetting
                ? `${notifSetting.message} (${actualCheckoutTime})`
                : `The system recorded your departure at ${actualCheckoutTime}. If this is incorrect, submit a correction request.`,
              message_ar: notifSetting
                ? `${notifSetting.message_ar} (الساعة ${actualCheckoutTime})`
                : `تم تسجيل انصرافك تلقائياً الساعة ${actualCheckoutTime}. إن كان ذلك غير صحيح، قدم طلب تصحيح.`,
              type: 'attendance',
            });
            processed++;
          }
          continue;
        }
      }

      const checkoutHandling = resolveCheckoutOvertimeHandling({
        hasShift: !!effective,
        isWorkingDay: !!effective,
        workStartTime,
        workEndTime,
        openSessionIsOvertime: isOvertimeSession,
        openSessionCheckInTime: session.check_in_time,
        checkoutTime: actualCheckoutTime,
        minimumOvertimeMinutes: policy?.minimum_overtime_minutes,
      });

      const { error: updateError } = await admin
        .from('attendance_sessions')
        .update({
          check_out_time: checkoutHandling.regularCheckOutTime,
          duration_minutes: checkoutHandling.regularDurationMinutes,
          is_auto_punch_out: true,
          needs_review: true,
          is_early_departure: false,
          last_action_at: effectiveNow.toISOString(),
          updated_at: effectiveNow.toISOString(),
        })
        .eq('id', session.id);

      if (updateError) continue;

      if (checkoutHandling.shouldSplitOvertime && checkoutHandling.shiftEndTime) {
        const { data: insertedOt, error: otInsertError } = await admin
          .from('attendance_sessions')
          .insert({
            org_id: session.org_id,
            user_id: session.user_id,
            date: session.date,
            check_in_time: checkoutHandling.shiftEndTime,
            check_out_time: actualCheckoutTime,
            status: 'present',
            is_overtime: true,
            duration_minutes: checkoutHandling.overtimeDurationMinutes,
            is_auto_punch_out: true,
            needs_review: true,
            is_early_departure: false,
            last_action_at: effectiveNow.toISOString(),
            updated_at: effectiveNow.toISOString(),
          })
          .select('id')
          .single();

        const overtimeSessionId = (insertedOt as { id: string } | null)?.id ?? null;
        if (!otInsertError && overtimeSessionId) {
          await admin
            .from('overtime_requests')
            .upsert({
              org_id: session.org_id,
              user_id: session.user_id,
              session_id: overtimeSessionId,
              status: 'pending',
            }, { onConflict: 'session_id' });
        }
      }

      const notifSetting = await getAutoPunchOutNotifSetting(session.org_id);
      await admin.from('notifications').insert({
        org_id: session.org_id,
        user_id: session.user_id,
        title: notifSetting?.title ?? 'Forgot to punch out',
        title_ar: notifSetting?.title_ar ?? 'نسيت تسجيل الانصراف',
        message: notifSetting
          ? `${notifSetting.message} (${actualCheckoutTime})`
          : `The system recorded your departure at ${actualCheckoutTime}. If this is incorrect, submit a correction request.`,
        message_ar: notifSetting
          ? `${notifSetting.message_ar} (الساعة ${actualCheckoutTime})`
          : `تم تسجيل انصرافك تلقائياً الساعة ${actualCheckoutTime}. إن كان ذلك غير صحيح، قدم طلب تصحيح.`,
        type: 'attendance',
      });

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, total: openSessions.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

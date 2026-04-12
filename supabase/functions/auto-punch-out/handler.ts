// Supabase Edge Function: auto punch-out safety net.

import { corsHeaders } from '../_shared/cors.ts';

/** Keep in sync with `src/shared/attendance/constants.ts`. */
const DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES = 5;
import type { PunchServiceClient } from '../punch/handler.ts';
import { resolveCheckoutOvertimeHandling } from '../punch/handler.ts';

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
  return Math.max(0, outM - inM);
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
    const localNow = toOrgLocalDate(effectiveNow);
    const nowMinutes = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();

    const { data: openSessionsRaw, error: sessionsError } = await admin
      .from('attendance_sessions')
      .select('id, user_id, org_id, date, check_in_time, is_overtime')
      .eq('date', today)
      .is('check_out_time', null)
      .eq('is_overtime', false);

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

    const dayOfWeek = toOrgLocalDate(effectiveNow).getUTCDay();
    let processed = 0;

    for (const session of openSessions) {
      const { data: profileRaw } = await admin
        .from('profiles')
        .select('work_days, work_start_time, work_end_time')
        .eq('id', session.user_id)
        .single();

      const profile = profileRaw as {
        work_days?: number[] | null;
        work_start_time?: string | null;
        work_end_time?: string | null;
      } | null;

      const { data: policyRaw } = await admin
        .from('attendance_policy')
        .select('work_end_time, auto_punch_out_buffer_minutes, weekly_off_days, minimum_overtime_minutes')
        .eq('org_id', session.org_id)
        .limit(1)
        .maybeSingle();

      const policy = policyRaw as {
        work_end_time?: string | null;
        auto_punch_out_buffer_minutes?: number | null;
        weekly_off_days?: number[] | null;
        minimum_overtime_minutes?: number | null;
      } | null;

      const hasCustomSchedule =
        profile?.work_days &&
        profile.work_days.length > 0 &&
        profile.work_start_time &&
        profile.work_end_time;

      const workEndTime = hasCustomSchedule ? profile!.work_end_time! : policy?.work_end_time ?? null;
      const bufferMinutes = policy?.auto_punch_out_buffer_minutes ?? DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES;
      const weeklyOff = policy?.weekly_off_days ?? [5, 6];

      // No user schedule + no org policy means no configured shift, so this
      // safety-net job should not invent a fallback shift end and auto-close it.
      if (!workEndTime) continue;

      const isWorkingDay = hasCustomSchedule
        ? (profile!.work_days ?? []).includes(dayOfWeek)
        : !weeklyOff.includes(dayOfWeek);
      if (!isWorkingDay) continue;

      const shiftEndMinutes = timeToMinutes(workEndTime);
      const cutoffMinutes = shiftEndMinutes + bufferMinutes;

      if (nowMinutes <= cutoffMinutes) continue;

      const actualCheckoutTime = nowToTimeHHMM(effectiveNow);
      const checkoutHandling = resolveCheckoutOvertimeHandling({
        hasShift: true,
        isWorkingDay: true,
        workEndTime,
        openSessionIsOvertime: false,
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

      await admin.from('notifications').insert({
        org_id: session.org_id,
        user_id: session.user_id,
        title: 'Forgot to punch out',
        title_ar: 'نسيت تسجيل الانصراف',
        message: `The system recorded your departure at ${actualCheckoutTime}. If this is incorrect, submit a correction request.`,
        message_ar: `تم تسجيل انصرافك تلقائياً الساعة ${actualCheckoutTime}. إن كان ذلك غير صحيح، قدم طلب تصحيح.`,
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

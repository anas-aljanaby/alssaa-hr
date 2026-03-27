// Supabase Edge Function: auto punch-out safety net.

import { corsHeaders } from '../_shared/cors.ts';
import type { PunchServiceClient } from '../punch/handler.ts';

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

export type AutoPunchEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
  isProduction: boolean;
};

export type AutoPunchDeps = {
  getEnv: () => AutoPunchEnv;
  createServiceClient: () => PunchServiceClient;
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

    const { isProduction } = deps.getEnv();

    let effectiveNow: Date;
    try {
      const body = (await req.json()) as { devOverrideTime?: string };
      if (!isProduction && typeof body?.devOverrideTime === 'string' && body.devOverrideTime) {
        const parsed = new Date(body.devOverrideTime);
        if (isNaN(parsed.getTime())) throw new Error('Invalid date');
        effectiveNow = parsed;
      } else {
        effectiveNow = new Date();
      }
    } catch {
      effectiveNow = new Date();
    }

    const today = toDateStr(effectiveNow);
    const localNow = toOrgLocalDate(effectiveNow);
    const nowMinutes = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();

    const admin = deps.createServiceClient();

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
        .select('work_end_time, auto_punch_out_buffer_minutes, weekly_off_days')
        .eq('org_id', session.org_id)
        .limit(1)
        .maybeSingle();

      const policy = policyRaw as {
        work_end_time?: string | null;
        auto_punch_out_buffer_minutes?: number | null;
        weekly_off_days?: number[] | null;
      } | null;

      const hasCustomSchedule =
        profile?.work_days &&
        profile.work_days.length > 0 &&
        profile.work_start_time &&
        profile.work_end_time;

      const workEndTime = hasCustomSchedule ? profile!.work_end_time! : policy?.work_end_time ?? '16:00';
      const bufferMinutes = policy?.auto_punch_out_buffer_minutes ?? 30;
      const weeklyOff = policy?.weekly_off_days ?? [5, 6];

      const isWorkingDay = hasCustomSchedule
        ? (profile!.work_days ?? []).includes(dayOfWeek)
        : !weeklyOff.includes(dayOfWeek);
      if (!isWorkingDay) continue;

      const shiftEndMinutes = timeToMinutes(workEndTime);
      const cutoffMinutes = shiftEndMinutes + bufferMinutes;

      if (nowMinutes <= cutoffMinutes) continue;

      const actualCheckoutTime = nowToTimeHHMM(effectiveNow);
      const durationMinutes = diffMinutes(session.check_in_time, actualCheckoutTime);

      const { error: updateError } = await admin
        .from('attendance_sessions')
        .update({
          check_out_time: actualCheckoutTime,
          duration_minutes: durationMinutes,
          is_auto_punch_out: true,
          needs_review: true,
          is_early_departure: false,
          last_action_at: effectiveNow.toISOString(),
        })
        .eq('id', session.id);

      if (updateError) continue;

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

/**
 * Testable punch handler: check-in / check-out with optional devOverrideTime.
 * Geofence / coords are not implemented (N/A for tests).
 */

import { corsHeaders } from '../_shared/cors.ts';

export interface PunchBody {
  action: 'check_in' | 'check_out';
  devOverrideTime?: string;
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export type PunchEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
  isProduction: boolean;
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
};

export type PunchDeps = {
  getEnv: () => PunchEnv;
  createUserClient: (authHeader: string) => PunchUserClient;
  createServiceClient: () => PunchServiceClient;
};

type ProfileRow = {
  org_id: string;
  work_days?: number[] | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
};

type AttendanceLogRow = {
  id: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
};

type PolicyRow = { work_start_time?: string | null; grace_period_minutes?: number | null };

function errMsg(e: unknown): string {
  return typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
    ? (e as { message: string }).message
    : 'Error';
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

    const { supabaseUrl, supabaseAnonKey, serviceRoleKey, isProduction } = deps.getEnv();

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

    let effectiveNow: Date;
    if (!isProduction && typeof body?.devOverrideTime === 'string' && body.devOverrideTime) {
      const parsed = new Date(body.devOverrideTime);
      if (isNaN(parsed.getTime())) {
        return new Response(
          JSON.stringify({ error: 'Invalid devOverrideTime', code: 'INVALID_TIME' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      effectiveNow = parsed;
    } else {
      effectiveNow = new Date();
    }

    const today = toDateStr(effectiveNow);
    const time = toTimeStr(effectiveNow);

    const admin = deps.createServiceClient();

    const { data: profileRaw } = await admin
      .from('profiles')
      .select('org_id, work_days, work_start_time, work_end_time')
      .eq('id', caller.id)
      .single();

    const profile = profileRaw as ProfileRow | null;
    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'لم يتم العثور على الملف الشخصي', code: 'NO_PROFILE' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = profile.org_id;

    const { data: existingRaw } = await admin
      .from('attendance_logs')
      .select('*')
      .eq('user_id', caller.id)
      .eq('date', today)
      .maybeSingle();

    const existing = existingRaw as AttendanceLogRow | null;

    if (action === 'check_in') {
      if (existing?.check_in_time) {
        return new Response(
          JSON.stringify({ error: 'Already checked in today', code: 'ALREADY_CHECKED_IN' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let status: 'present' | 'late' = 'present';
      const hasCustomSchedule =
        profile.work_days &&
        (profile.work_days as number[]).length > 0 &&
        profile.work_start_time &&
        profile.work_end_time;

      const { data: policyRaw } = await admin
        .from('attendance_policy')
        .select('work_start_time, grace_period_minutes')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle();

      const policy = policyRaw as PolicyRow | null;
      const workStartTime = hasCustomSchedule ? profile.work_start_time : policy?.work_start_time;
      const grace = policy?.grace_period_minutes ?? 0;

      if (workStartTime) {
        const [startH, startM] = (workStartTime as string).split(':').map(Number);
        const [nowH, nowM] = time.split(':').map(Number);
        const startMinutes = startH * 60 + startM + grace;
        const nowMinutes = nowH * 60 + nowM;
        if (nowMinutes > startMinutes) status = 'late';
      }

      const isDev = !isProduction && typeof body?.devOverrideTime === 'string' && !!body.devOverrideTime;

      if (existing) {
        const { data: updated, error } = await admin
          .from('attendance_logs')
          .update({
            check_in_time: time,
            status,
            is_dev: isDev,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: errMsg(error), code: 'UPDATE_FAILED' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify(updated),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: inserted, error } = await admin
        .from('attendance_logs')
        .insert({
          org_id: orgId,
          user_id: caller.id,
          date: today,
          check_in_time: time,
          status,
          is_dev: isDev,
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: errMsg(error), code: 'INSERT_FAILED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify(inserted),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!existing?.check_in_time) {
      return new Response(
        JSON.stringify({ error: 'Must check in before checking out', code: 'NO_CHECK_IN' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (existing.check_out_time) {
      return new Response(
        JSON.stringify({ error: 'Already checked out today', code: 'ALREADY_CHECKED_OUT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isDev = !isProduction && typeof body?.devOverrideTime === 'string' && !!body.devOverrideTime;

    const { data: updated, error } = await admin
      .from('attendance_logs')
      .update({
        check_out_time: time,
        is_dev: isDev,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: errMsg(error), code: 'UPDATE_FAILED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
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

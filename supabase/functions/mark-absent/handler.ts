// Supabase Edge Function: end-of-day backfill for attendance_daily_summary.
// Ensures every active user has a summary row for today (absent / on_leave / off-day)
// even if they never punched in.

import { corsHeaders } from '../_shared/cors.ts';
import type { PunchServiceClient } from '../punch/handler.ts';

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

export type MarkAbsentEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
};

export type MarkAbsentUserClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown | null }> };
};

export type MarkAbsentDeps = {
  getEnv: () => MarkAbsentEnv;
  createUserClient: (authHeader: string) => MarkAbsentUserClient;
  createServiceClient: () => PunchServiceClient;
  /** Injected clock for deterministic tests. */
  now?: () => Date;
};

type MarkAbsentBody = {
  date?: string;
  from_date?: string;
  to_date?: string;
};

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function enumerateDatesInclusive(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

export async function handleMarkAbsent(req: Request, deps: MarkAbsentDeps): Promise<Response> {
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
    const { serviceRoleKey } = deps.getEnv();
    const admin = deps.createServiceClient();

    if (token !== serviceRoleKey) {
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

    let body: MarkAbsentBody = {};
    try {
      body = await req.json() as MarkAbsentBody;
    } catch {
      body = {};
    }

    if ((body.from_date && !body.to_date) || (!body.from_date && body.to_date)) {
      return new Response(
        JSON.stringify({
          error: 'from_date and to_date must be provided together',
          code: 'INVALID_DATE_RANGE',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.date && !isDateOnlyString(body.date)) {
      return new Response(
        JSON.stringify({ error: 'date must use YYYY-MM-DD format', code: 'INVALID_DATE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.from_date && !isDateOnlyString(body.from_date)) {
      return new Response(
        JSON.stringify({ error: 'from_date must use YYYY-MM-DD format', code: 'INVALID_DATE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.to_date && !isDateOnlyString(body.to_date)) {
      return new Response(
        JSON.stringify({ error: 'to_date must use YYYY-MM-DD format', code: 'INVALID_DATE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.from_date && body.to_date && body.from_date > body.to_date) {
      return new Response(
        JSON.stringify({ error: 'from_date must be on or before to_date', code: 'INVALID_DATE_RANGE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dates =
      body.from_date && body.to_date
        ? enumerateDatesInclusive(body.from_date, body.to_date)
        : [body.date ?? today];

    const { data: allProfiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, join_date, created_at');

    if (profilesError) {
      const msg = typeof profilesError === 'object' && profilesError !== null && 'message' in profilesError
        ? String((profilesError as { message: string }).message)
        : 'Query failed';
      return new Response(
        JSON.stringify({ error: msg, code: 'QUERY_FAILED' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profiles = (allProfiles ?? []) as { id: string; join_date: string | null; created_at: string }[];

    let processed = 0;
    let skipped = 0;

    for (const dateStr of dates) {
      const { data: existingSummaries, error: summariesError } = await admin
        .from('attendance_daily_summary')
        .select('user_id')
        .eq('date', dateStr);

      if (summariesError) {
        const msg = typeof summariesError === 'object' && summariesError !== null && 'message' in summariesError
          ? String((summariesError as { message: string }).message)
          : 'Query failed';
        return new Response(
          JSON.stringify({ error: msg, code: 'QUERY_FAILED' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const coveredUserIds = new Set(
        ((existingSummaries ?? []) as { user_id: string }[]).map((summary) => summary.user_id)
      );

      for (const profile of profiles) {
        if (coveredUserIds.has(profile.id)) {
          skipped++;
          continue;
        }

        const joinDate = profile.join_date ?? profile.created_at?.slice(0, 10) ?? null;
        if (joinDate && dateStr < joinDate) {
          skipped++;
          continue;
        }

        const { error: rpcError } = await admin.rpc('recalculate_attendance_daily_summary', {
          p_user_id: profile.id,
          p_date: dateStr,
        });

        if (rpcError) {
          continue;
        }

        processed++;
      }
    }

    return new Response(
      JSON.stringify({
        processed,
        skipped,
        total: profiles.length * dates.length,
        date: dates.length === 1 ? dates[0] : undefined,
        dates,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

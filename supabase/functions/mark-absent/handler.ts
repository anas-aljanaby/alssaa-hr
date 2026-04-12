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

    const { data: existingSummaries, error: summariesError } = await admin
      .from('attendance_daily_summary')
      .select('user_id')
      .eq('date', today);

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
      ((existingSummaries ?? []) as { user_id: string }[]).map((s) => s.user_id)
    );

    let processed = 0;
    let skipped = 0;

    for (const profile of profiles) {
      if (coveredUserIds.has(profile.id)) {
        skipped++;
        continue;
      }

      const joinDate = profile.join_date ?? profile.created_at?.slice(0, 10) ?? null;
      if (joinDate && today < joinDate) {
        skipped++;
        continue;
      }

      const { error: rpcError } = await admin.rpc('recalculate_attendance_daily_summary', {
        p_user_id: profile.id,
        p_date: today,
      });

      if (rpcError) {
        continue;
      }

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, skipped, total: profiles.length, date: today }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

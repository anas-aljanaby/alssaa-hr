// Supabase Edge Function: check-in / check-out with optional devOverrideTime.
// In production, devOverrideTime is ignored. In non-production, it is used as effective "now".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PunchBody {
  action: 'check_in' | 'check_out';
  coords?: { lat: number; lng: number };
  devOverrideTime?: string; // ISO string
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const isProduction = Deno.env.get('ENVIRONMENT') === 'production';

    const clientWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
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
    const coords = body?.coords;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await admin
      .from('profiles')
      .select('org_id')
      .eq('id', caller.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'لم يتم العثور على الملف الشخصي', code: 'NO_PROFILE' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = profile.org_id;

    const { data: existing } = await admin
      .from('attendance_logs')
      .select('*')
      .eq('user_id', caller.id)
      .eq('date', today)
      .maybeSingle();

    if (action === 'check_in') {
      if (existing?.check_in_time) {
        return new Response(
          JSON.stringify({ error: 'Already checked in today', code: 'ALREADY_CHECKED_IN' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let status: 'present' | 'late' = 'present';
      const { data: policy } = await admin
        .from('attendance_policy')
        .select('work_start_time, grace_period_minutes')
        .eq('org_id', orgId)
        .limit(1)
        .single();

      if (policy) {
        const [startH, startM] = policy.work_start_time.split(':').map(Number);
        const grace = policy.grace_period_minutes ?? 0;
        const [nowH, nowM] = time.split(':').map(Number);
        const startMinutes = startH * 60 + startM + grace;
        const nowMinutes = nowH * 60 + nowM;
        if (nowMinutes > startMinutes) status = 'late';
      }

      if (existing) {
        const { data: updated, error } = await admin
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

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message, code: 'UPDATE_FAILED' }),
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
          check_in_lat: coords?.lat ?? null,
          check_in_lng: coords?.lng ?? null,
          status,
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message, code: 'INSERT_FAILED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify(inserted),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // check_out
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

    const { data: updated, error } = await admin
      .from('attendance_logs')
      .update({
        check_out_time: time,
        check_out_lat: coords?.lat ?? null,
        check_out_lng: coords?.lng ?? null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message, code: 'UPDATE_FAILED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify(updated),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

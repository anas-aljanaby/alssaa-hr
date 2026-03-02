// Supabase Edge Function: seed one month of varied attendance for the authenticated user.
// Returns 403 in production. Dev only.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (Deno.env.get('ENVIRONMENT') === 'production') {
    return new Response(
      JSON.stringify({ error: 'Not available in production', code: 'FORBIDDEN' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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

    const clientWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await clientWithAuth.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'انتهت الجلسة', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const { data: policy } = await admin
      .from('attendance_policy')
      .select('work_start_time, work_end_time, grace_period_minutes, weekly_off_days')
      .eq('org_id', profile.org_id)
      .limit(1)
      .single();

    const workStart = policy?.work_start_time ?? '08:00';
    const workEnd = policy?.work_end_time ?? '16:00';
    const graceMinutes = policy?.grace_period_minutes ?? 15;
    const offDays = policy?.weekly_off_days ?? [5, 6]; // default Fri, Sat

    const [startH, startM] = workStart.split(':').map(Number);
    const [endH, endM] = workEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const graceEndMinutes = startMinutes + graceMinutes;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastMonth = month === 0 ? 11 : month - 1;
    const lastMonthYear = month === 0 ? year - 1 : year;
    const daysInMonth = new Date(lastMonthYear, lastMonth + 1, 0).getDate();

    type DayKind = 'on_time' | 'late' | 'absent' | 'overtime';
    const rows: { date: string; check_in_time: string; check_out_time: string; status: 'present' | 'late' }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(lastMonthYear, lastMonth, day);
      const dayOfWeek = d.getDay();
      if (offDays.includes(dayOfWeek)) continue;

      const dateStr = toDateStr(d);
      const seed = (lastMonthYear * 10000 + lastMonth * 100 + day) % 100;
      let kind: DayKind;
      if (seed < 50) kind = 'on_time';
      else if (seed < 75) kind = 'late';
      else if (seed < 90) kind = 'absent';
      else kind = 'overtime';

      if (kind === 'absent') continue;

      let checkInH: number;
      let checkInM: number;
      let checkOutH: number;
      let checkOutM: number;
      let status: 'present' | 'late' = 'present';

      if (kind === 'on_time') {
        const inMinutes = startMinutes + Math.floor(Math.min(graceMinutes - 1, seed % graceMinutes));
        checkInH = Math.floor(inMinutes / 60);
        checkInM = inMinutes % 60;
        checkOutH = endH;
        checkOutM = endM;
      } else if (kind === 'late') {
        const lateBy = 5 + (seed % 45);
        const inMinutes = graceEndMinutes + lateBy;
        checkInH = Math.floor(inMinutes / 60);
        checkInM = inMinutes % 60;
        checkOutH = endH;
        checkOutM = endM;
        status = 'late';
      } else {
        checkInH = startH - 1;
        checkInM = startM;
        checkOutH = endH + 1;
        checkOutM = endM;
      }

      rows.push({
        date: dateStr,
        check_in_time: `${pad2(checkInH)}:${pad2(checkInM)}`,
        check_out_time: `${pad2(checkOutH)}:${pad2(checkOutM)}`,
        status,
      });
    }

    let inserted = 0;
    for (const row of rows) {
      const { error } = await admin.from('attendance_logs').upsert(
        {
          org_id: profile.org_id,
          user_id: caller.id,
          date: row.date,
          check_in_time: row.check_in_time,
          check_out_time: row.check_out_time,
          status: row.status,
        },
        { onConflict: 'user_id,date' }
      );
      if (!error) inserted++;
    }

    return new Response(
      JSON.stringify({ seeded: true, daysCreated: inserted, message: `Seeded ${inserted} days` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Supabase Edge Function: auto punch-out safety net.
// Run on a schedule (e.g. every 15 min). For each open attendance log (check-in, no check-out)
// where current time > shift_end + buffer, set check_out_time = shift_end, auto_punch_out = true,
// and send the employee a notification.

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

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatTimeHHMM(t: string): string {
  const parts = t.split(':');
  return `${parts[0].padStart(2, '0')}:${(parts[1] ?? '0').padStart(2, '0')}`;
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
        JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const isProduction = Deno.env.get('ENVIRONMENT') === 'production';

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
    const nowMinutes = effectiveNow.getHours() * 60 + effectiveNow.getMinutes();

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: openLogs, error: logsError } = await admin
      .from('attendance_logs')
      .select('id, user_id, org_id, date, check_in_time')
      .eq('date', today)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null);

    if (logsError) {
      return new Response(
        JSON.stringify({ error: logsError.message, code: 'QUERY_FAILED' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openLogs?.length) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No open logs' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dayOfWeek = effectiveNow.getDay();
    let processed = 0;

    for (const log of openLogs) {
      const { data: profile } = await admin
        .from('profiles')
        .select('work_days, work_start_time, work_end_time')
        .eq('id', log.user_id)
        .single();

      const { data: policy } = await admin
        .from('attendance_policy')
        .select('work_end_time, auto_punch_out_buffer_minutes, weekly_off_days')
        .eq('org_id', log.org_id)
        .limit(1)
        .maybeSingle();

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

      const shiftEndTimeStr = formatTimeHHMM(workEndTime);

      const { error: updateError } = await admin
        .from('attendance_logs')
        .update({
          check_out_time: shiftEndTimeStr,
          auto_punch_out: true,
        })
        .eq('id', log.id);

      if (updateError) continue;

      const titleAr = 'نسيت تسجيل الانصراف';
      const messageAr = `تم تسجيل انصرافك تلقائياً الساعة ${shiftEndTimeStr}. إن كان ذلك غير صحيح، قدم طلب تصحيح.`;

      await admin.from('notifications').insert({
        org_id: log.org_id,
        user_id: log.user_id,
        title: 'Forgot to punch out',
        title_ar: titleAr,
        message: `The system recorded your departure at ${shiftEndTimeStr}. If this is incorrect, submit a correction request.`,
        message_ar: messageAr,
        type: 'attendance',
      });

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, total: openLogs.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Supabase Edge Function: send scheduled shift notifications.
// Runs every minute via pg_cron.
// Fires in-app notifications (+ web push when VAPID keys are configured) for:
//   • pre_shift_reminder  – X minutes before work starts
//   • work_start          – exactly at work start time
//   • punch_out_reminder  – X minutes before work ends

import { corsHeaders } from '../_shared/cors.ts';
import { sendWebPushToUser } from '../_shared/web-push.ts';

const UTC_OFFSET_HOURS = 3; // UTC+3

function toOrgLocalDate(d: Date): Date {
  return new Date(d.getTime() + UTC_OFFSET_HOURS * 3600 * 1000);
}

function toDateStr(d: Date): string {
  const local = toOrgLocalDate(d);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function parseJwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

type NotificationSetting = {
  id: string;
  type: string;
  enabled: boolean;
  title: string;
  title_ar: string;
  message: string;
  message_ar: string;
  minutes_before: number | null;
};

type Profile = {
  id: string;
  work_days: number[] | null;
  work_start_time: string | null;
  work_end_time: string | null;
};

type Policy = {
  work_start_time: string;
  work_end_time: string;
  weekly_off_days: number[];
};

// deno-lint-ignore no-explicit-any
type ServiceClient = any;

export type ScheduledNotifEnv = {
  serviceRoleKey: string;
  cronAuthToken?: string | null;
  isProduction: boolean;
};

export type ScheduledNotifDeps = {
  getEnv: () => ScheduledNotifEnv;
  createServiceClient: () => ServiceClient;
};

export async function handleSendScheduledNotifications(
  req: Request,
  deps: ScheduledNotifDeps
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const { serviceRoleKey, cronAuthToken, isProduction } = deps.getEnv();
    const systemToken = cronAuthToken?.trim() || serviceRoleKey;
    const isServiceRoleJwt = parseJwtRole(token) === 'service_role';

    if (!isServiceRoleJwt && token !== systemToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let effectiveNow = new Date();
    try {
      const body = (await req.json()) as { devOverrideTime?: string };
      if (!isProduction && typeof body?.devOverrideTime === 'string' && body.devOverrideTime) {
        const parsed = new Date(body.devOverrideTime);
        if (!isNaN(parsed.getTime())) effectiveNow = parsed;
      }
    } catch { /* empty body */ }

    const admin: ServiceClient = deps.createServiceClient();
    const today = toDateStr(effectiveNow);
    const localNow = toOrgLocalDate(effectiveNow);
    const nowMinutes = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
    const dayOfWeek = localNow.getUTCDay();

    const { data: orgsRaw } = await admin
      .from('organizations')
      .select('id');
    const orgs = (orgsRaw as { id: string }[]) ?? [];

    let totalSent = 0;

    for (const org of orgs) {
      // Load notification settings for this org
      const { data: settingsRaw } = await admin
        .from('notification_settings')
        .select('id, type, enabled, title, title_ar, message, message_ar, minutes_before')
        .eq('org_id', org.id);

      const settings = (settingsRaw as NotificationSetting[]) ?? [];
      const settingByType: Record<string, NotificationSetting> = {};
      for (const s of settings) {
        if (s.enabled) settingByType[s.type] = s;
      }

      // Skip org if all time-based notifications are disabled
      const hasAnyEnabled =
        settingByType['pre_shift_reminder'] ||
        settingByType['work_start'] ||
        settingByType['punch_out_reminder'];
      if (!hasAnyEnabled) continue;

      // Load org policy
      const { data: policyRaw } = await admin
        .from('attendance_policy')
        .select('work_start_time, work_end_time, weekly_off_days')
        .eq('org_id', org.id)
        .maybeSingle();

      const policy = policyRaw as Policy | null;
      if (!policy) continue;

      // Load all profiles for this org
      const { data: profilesRaw } = await admin
        .from('profiles')
        .select('id, work_days, work_start_time, work_end_time')
        .eq('org_id', org.id);

      const profiles = (profilesRaw as Profile[]) ?? [];

      for (const profile of profiles) {
        const hasCustomSchedule =
          profile.work_days && profile.work_days.length > 0 &&
          profile.work_start_time && profile.work_end_time;

        const isWorkingDay = hasCustomSchedule
          ? profile.work_days!.includes(dayOfWeek)
          : !policy.weekly_off_days.includes(dayOfWeek);

        if (!isWorkingDay) continue;

        const workStart = hasCustomSchedule ? profile.work_start_time! : policy.work_start_time;
        const workEnd = hasCustomSchedule ? profile.work_end_time! : policy.work_end_time;

        if (!workStart || !workEnd) continue;

        const startMinutes = timeToMinutes(workStart);
        const endMinutes = timeToMinutes(workEnd);

        // Determine which notifications should fire this minute
        const toSend: Array<{ type: string; setting: NotificationSetting }> = [];

        const preShift = settingByType['pre_shift_reminder'];
        if (preShift && nowMinutes === startMinutes - (preShift.minutes_before ?? 30)) {
          toSend.push({ type: 'pre_shift_reminder', setting: preShift });
        }

        const workStartSetting = settingByType['work_start'];
        if (workStartSetting && nowMinutes === startMinutes) {
          toSend.push({ type: 'work_start', setting: workStartSetting });
        }

        const punchOutReminder = settingByType['punch_out_reminder'];
        if (punchOutReminder && nowMinutes === endMinutes - (punchOutReminder.minutes_before ?? 15)) {
          toSend.push({ type: 'punch_out_reminder', setting: punchOutReminder });
        }

        for (const { type, setting } of toSend) {
          // Atomic deduplication: insert returns data only if the row is new
          const { data: dedupRows } = await admin
            .from('sent_scheduled_notifications')
            .upsert(
              { user_id: profile.id, org_id: org.id, date: today, notification_type: type },
              { onConflict: 'user_id,date,notification_type', ignoreDuplicates: true }
            )
            .select('id');

          if (!dedupRows || dedupRows.length === 0) continue; // already sent today

          // Insert in-app notification and capture the ID to include in the push payload
          // so the app can mark it as read when the user taps the notification banner.
          const { data: insertedNotif } = await admin
            .from('notifications')
            .insert({
              org_id: org.id,
              user_id: profile.id,
              title: setting.title,
              title_ar: setting.title_ar,
              message: setting.message,
              message_ar: setting.message_ar,
              type: 'attendance',
            })
            .select('id')
            .maybeSingle();

          // Web push: send to all subscribed devices for this user
          // Requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT env vars.
          await sendWebPushToUser(admin, profile.id, {
            title: setting.title_ar,
            body: setting.message_ar,
            url: '/',
            notificationId: (insertedNotif as { id?: string } | null)?.id,
          });

          totalSent++;
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

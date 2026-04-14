import { parseBearerToken } from '../_shared/bearer.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { sendWebPushToUser } from '../_shared/web-push.ts';

// deno-lint-ignore no-explicit-any
type ServiceClient = any;
type UserClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown | null }>;
  };
};

export type SendTestNotificationDeps = {
  createUserClient: (authHeader: string) => UserClient;
  createServiceClient: () => ServiceClient;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function handleSendTestNotification(
  req: Request,
  deps: SendTestNotificationDeps
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  const token = parseBearerToken(req);
  if (!authHeader || !token) {
    return jsonResponse({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    let body: { settingId?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    if (typeof body.settingId !== 'string' || !body.settingId.trim()) {
      return jsonResponse({ error: 'Setting id is required', code: 'INVALID_SETTING_ID' }, 400);
    }

    const userClient = deps.createUserClient(authHeader);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const admin = deps.createServiceClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return jsonResponse({ error: 'Profile lookup failed', code: 'PROFILE_LOOKUP_FAILED' }, 500);
    }
    if (!profile?.org_id) {
      return jsonResponse({ error: 'No profile', code: 'NO_PROFILE' }, 404);
    }
    if (profile.role !== 'admin') {
      return jsonResponse({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({ error: 'Push is not configured', code: 'NO_PUSH_CONFIG' }, 503);
    }

    const { data: setting, error: settingError } = await admin
      .from('notification_settings')
      .select('id, type, title, title_ar, message, message_ar')
      .eq('id', body.settingId.trim())
      .eq('org_id', profile.org_id)
      .maybeSingle();

    if (settingError) {
      return jsonResponse({ error: 'Setting lookup failed', code: 'SETTING_LOOKUP_FAILED' }, 500);
    }
    if (!setting) {
      return jsonResponse({ error: 'Setting not found', code: 'SETTING_NOT_FOUND' }, 404);
    }

    const { data: profiles, error: usersError } = await admin
      .from('profiles')
      .select('id')
      .eq('org_id', profile.org_id);

    if (usersError) {
      return jsonResponse({ error: 'Users lookup failed', code: 'USERS_LOOKUP_FAILED' }, 500);
    }

    const userRows = ((profiles ?? []) as Array<{ id: string }>).filter((row) => !!row.id);
    if (userRows.length === 0) {
      return jsonResponse({
        totalUsers: 0,
        pushedUsers: 0,
        deliveredPushes: 0,
        subscriptionTargets: 0,
      });
    }

    const title = `[TEST] ${setting.title}`;
    const titleAr = `اختبار: ${setting.title_ar}`;
    const message = `${setting.message} (Test notification sent by your administrator.)`;
    const messageAr = `${setting.message_ar} هذا إشعار تجريبي مرسل من إدارة النظام.`;

    const { error: insertError } = await admin.from('notifications').insert(
      userRows.map((row) => ({
        org_id: profile.org_id,
        user_id: row.id,
        title,
        title_ar: titleAr,
        message,
        message_ar: messageAr,
        type: 'attendance',
      }))
    );

    if (insertError) {
      return jsonResponse({ error: 'Failed to save notification', code: 'INSERT_FAILED' }, 500);
    }

    let pushedUsers = 0;
    let deliveredPushes = 0;
    let subscriptionTargets = 0;

    for (const row of userRows) {
      const pushResult = await sendWebPushToUser(admin, row.id, {
        title: titleAr,
        body: messageAr,
        url: '/notifications',
      });

      subscriptionTargets += pushResult.subscriptionCount;
      deliveredPushes += pushResult.sent;
      if (pushResult.sent > 0) pushedUsers += 1;
    }

    return jsonResponse({
      totalUsers: userRows.length,
      pushedUsers,
      deliveredPushes,
      subscriptionTargets,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Internal error',
        code: 'INTERNAL',
      },
      500
    );
  }
}

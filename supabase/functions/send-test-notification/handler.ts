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

    const admin = deps.createServiceClient();
    const userResult = await admin.auth.getUser(token);
    const user = (userResult as { data?: { user?: { id: string } | null } })?.data?.user ?? null;
    const userError = (userResult as { error?: unknown })?.error ?? null;

    if (userError || !user) {
      console.error('[send-test-notification] getUser failed:', JSON.stringify({ userError, hasUser: !!user }));
      return jsonResponse(
        {
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
          // Include auth detail so the caller can see WHY it failed
          detail: userError
            ? typeof userError === 'object' && 'message' in (userError as Record<string, unknown>)
              ? (userError as { message: string }).message
              : String(userError)
            : 'No user returned from token',
        },
        401
      );
    }

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

    // Test notifications are sent only to the requesting admin — not org-wide.
    // The payload is identical to the real notification so the admin sees exactly
    // what employees will receive.
    const { data: insertedNotifications, error: insertError } = await admin
      .from('notifications')
      .insert([{
        org_id: profile.org_id,
        user_id: user.id,
        title: setting.title,
        title_ar: setting.title_ar,
        message: setting.message,
        message_ar: setting.message_ar,
        type: 'attendance',
      }])
      .select('id, user_id');

    if (insertError) {
      return jsonResponse({ error: 'Failed to save notification', code: 'INSERT_FAILED' }, 500);
    }

    const notifId = ((insertedNotifications ?? []) as Array<{ id: string; user_id: string }>)[0]?.id;

    const pushResult = await sendWebPushToUser(admin, user.id, {
      title: setting.title_ar,
      body: setting.message_ar,
      url: '/',
      notificationId: notifId,
    });

    return jsonResponse({
      totalUsers: 1,
      pushedUsers: pushResult.sent > 0 ? 1 : 0,
      deliveredPushes: pushResult.sent,
      subscriptionTargets: pushResult.subscriptionCount,
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

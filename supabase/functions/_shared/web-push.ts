// Shared helper for sending web push notifications to a user's subscribed devices.

// deno-lint-ignore no-explicit-any
type ServiceClient = any;

export type WebPushResult = {
  configured: boolean;
  subscriptionCount: number;
  sent: number;
  staleRemoved: number;
};

export async function sendWebPushToUser(
  admin: ServiceClient,
  userId: string,
  payload: { title: string; body: string; url?: string; notificationId?: string }
): Promise<WebPushResult> {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@alssaa.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    return {
      configured: false,
      subscriptionCount: 0,
      sent: 0,
      staleRemoved: 0,
    };
  }

  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, subscription')
    .eq('user_id', userId);

  const rows = (subscriptions ?? []) as { id: string; endpoint: string; subscription: object }[];
  if (!rows.length) {
    return {
      configured: true,
      subscriptionCount: 0,
      sent: 0,
      staleRemoved: 0,
    };
  }

  const webpush = (await import('npm:web-push')).default;
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const staleIds: string[] = [];
  let sent = 0;

  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload));
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        staleIds.push(row.id);
      }
    }
  }

  if (staleIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', staleIds);
  }

  return {
    configured: true,
    subscriptionCount: rows.length,
    sent,
    staleRemoved: staleIds.length,
  };
}

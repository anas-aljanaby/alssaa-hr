import { assertEquals } from 'jsr:@std/assert';
import { createQueuedFromClient, json, type QResult } from '../_test/queued_supabase.ts';
import { handleSendTestNotification, type SendTestNotificationDeps } from './handler.ts';

const baseToken = 'header.payload.signature';

function post(body: Record<string, unknown> = { settingId: 'setting-1' }) {
  return new Request('http://x', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${baseToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function makeDeps(queue: QResult[], userId = 'u1'): SendTestNotificationDeps {
  const admin = createQueuedFromClient(queue);
  // Attach auth.getUser to the service client mock since the handler now uses
  // admin.auth.getUser(token) instead of a separate user client.
  (admin as Record<string, unknown>).auth = {
    getUser: async () => ({ data: { user: { id: userId } }, error: null }),
  };
  return {
    createUserClient: () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: userId } }, error: null }),
        },
      }),
    createServiceClient: () => admin,
  };
}

Deno.test('OPTIONS returns 200', async () => {
  const res = await handleSendTestNotification(
    new Request('http://x', { method: 'OPTIONS' }),
    makeDeps([])
  );
  assertEquals(res.status, 200);
});

Deno.test('missing auth returns 401', async () => {
  const res = await handleSendTestNotification(
    new Request('http://x', { method: 'POST', body: '{}' }),
    makeDeps([])
  );
  assertEquals(res.status, 401);
});

Deno.test('non-admin caller returns 403', async () => {
  const queue: QResult[] = [
    { data: { org_id: 'o1', role: 'employee' }, error: null },
  ];

  const res = await handleSendTestNotification(post(), makeDeps(queue));
  assertEquals(res.status, 403);
  assertEquals(((await json(res)) as { code: string }).code, 'FORBIDDEN');
});

Deno.test('missing push config returns 503 before sending', async () => {
  const queue: QResult[] = [
    { data: { org_id: 'o1', role: 'admin' }, error: null },
  ];

  const originalPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const originalPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  Deno.env.delete('VAPID_PUBLIC_KEY');
  Deno.env.delete('VAPID_PRIVATE_KEY');

  try {
    const res = await handleSendTestNotification(post(), makeDeps(queue));
    assertEquals(res.status, 503);
    assertEquals(((await json(res)) as { code: string }).code, 'NO_PUSH_CONFIG');
  } finally {
    if (originalPublic == null) Deno.env.delete('VAPID_PUBLIC_KEY');
    else Deno.env.set('VAPID_PUBLIC_KEY', originalPublic);
    if (originalPrivate == null) Deno.env.delete('VAPID_PRIVATE_KEY');
    else Deno.env.set('VAPID_PRIVATE_KEY', originalPrivate);
  }
});

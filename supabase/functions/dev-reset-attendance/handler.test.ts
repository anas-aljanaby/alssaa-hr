import { assertEquals } from 'jsr:@std/assert';
import { createQueuedFromClient, json, type QResult } from '../_test/queued_supabase.ts';
import type { PunchServiceClient } from '../punch/handler.ts';
import { handleDevResetAttendance, type DevResetDeps, type DevResetUserClient } from './handler.ts';

function makeDeps(queue: QResult[]): DevResetDeps {
  const admin = createQueuedFromClient(queue);
  return {
    getEnv: () => ({
      supabaseUrl: 'https://x.supabase.co',
      supabaseAnonKey: 'anon',
      serviceRoleKey: 'service',
      isProduction: false,
    }),
    createUserClient: () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }),
        },
      }) as DevResetUserClient,
    createServiceClient: () => admin as unknown as PunchServiceClient,
  };
}

function post() {
  return new Request('http://x', {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: '{}',
  });
}

Deno.test('production returns 403 FORBIDDEN', async () => {
  const admin = createQueuedFromClient([]);
  const res = await handleDevResetAttendance(post(), {
    getEnv: () => ({
      supabaseUrl: 'x',
      supabaseAnonKey: 'a',
      serviceRoleKey: 's',
      isProduction: true,
    }),
    createUserClient: () =>
      ({
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      }) as DevResetUserClient,
    createServiceClient: () => admin as unknown as PunchServiceClient,
  });
  assertEquals(res.status, 403);
});

Deno.test('non-POST returns 405', async () => {
  const res = await handleDevResetAttendance(new Request('http://x', { method: 'GET' }), makeDeps([]));
  assertEquals(res.status, 405);
});

Deno.test('missing Bearer returns 401', async () => {
  const res = await handleDevResetAttendance(
    new Request('http://x', { method: 'POST', body: '{}' }),
    makeDeps([])
  );
  assertEquals(res.status, 401);
});

Deno.test('delete returns deleted count', async () => {
  const q: QResult[] = [
    { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], error: null },
  ];
  const res = await handleDevResetAttendance(post(), makeDeps(q));
  assertEquals(res.status, 200);
  const b = (await json(res)) as { deleted?: number };
  assertEquals(b.deleted, 3);
});

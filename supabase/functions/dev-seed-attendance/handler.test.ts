import { assertEquals } from 'jsr:@std/assert';
import { createQueuedFromClient, json, type QResult } from '../_test/queued_supabase.ts';
import type { PunchServiceClient } from '../punch/handler.ts';
import { handleDevSeedAttendance, type DevSeedDeps, type DevSeedUserClient } from './handler.ts';

function makeDeps(queue: QResult[], now: Date): DevSeedDeps {
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
      }) as DevSeedUserClient,
    createServiceClient: () => admin as unknown as PunchServiceClient,
    now: () => now,
  };
}

function post() {
  return new Request('http://x', {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: '{}',
  });
}

Deno.test('production returns 403 FORBIDDEN before auth', async () => {
  const admin = createQueuedFromClient([]);
  const res = await handleDevSeedAttendance(post(), {
    getEnv: () => ({
      supabaseUrl: 'x',
      supabaseAnonKey: 'a',
      serviceRoleKey: 's',
      isProduction: true,
    }),
    createUserClient: () =>
      ({
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      }) as DevSeedUserClient,
    createServiceClient: () => admin as unknown as PunchServiceClient,
  });
  assertEquals(res.status, 403);
  assertEquals(((await json(res)) as { code: string }).code, 'FORBIDDEN');
});

Deno.test('non-POST returns 405', async () => {
  const res = await handleDevSeedAttendance(
    new Request('http://x', { method: 'GET' }),
    makeDeps([], new Date(2025, 5, 15))
  );
  assertEquals(res.status, 405);
});

Deno.test('missing Bearer returns 401', async () => {
  const res = await handleDevSeedAttendance(
    new Request('http://x', { method: 'POST', body: '{}' }),
    makeDeps([], new Date(2025, 5, 15))
  );
  assertEquals(res.status, 401);
});

Deno.test('happy path seeds with mocked upserts', async () => {
  const policy = {
    work_start_time: '08:00',
    work_end_time: '16:00',
    grace_period_minutes: 15,
    weekly_off_days: [] as number[],
  };
  const upsertOk: QResult = { data: null, error: null };
  const queue: QResult[] = [
    { data: { org_id: 'o1' }, error: null },
    { data: policy, error: null },
    ...Array.from({ length: 50 }, () => upsertOk),
  ];
  const res = await handleDevSeedAttendance(post(), makeDeps(queue, new Date(2025, 5, 15)));
  assertEquals(res.status, 200);
  const b = (await json(res)) as { seeded?: boolean; daysCreated?: number };
  assertEquals(b.seeded, true);
  assertEquals((b.daysCreated ?? 0) > 0, true);
});

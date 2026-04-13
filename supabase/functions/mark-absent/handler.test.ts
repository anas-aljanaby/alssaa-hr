import { assertEquals } from 'jsr:@std/assert';
import { createQueuedFromClient, json, type QResult } from '../_test/queued_supabase.ts';
import type { PunchServiceClient } from '../punch/handler.ts';
import {
  handleMarkAbsent,
  type MarkAbsentDeps,
  type MarkAbsentEnv,
  type MarkAbsentUserClient,
} from './handler.ts';

const baseEnv: MarkAbsentEnv = {
  supabaseUrl: 'https://x.supabase.co',
  supabaseAnonKey: 'anon',
  serviceRoleKey: 'service',
};

function makeDeps(queue: QResult[], nowIso?: string): MarkAbsentDeps {
  const admin = createQueuedFromClient(queue);
  return {
    getEnv: () => baseEnv,
    createUserClient: () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }) as MarkAbsentUserClient,
    createServiceClient: () => admin as unknown as PunchServiceClient,
    ...(nowIso ? { now: () => new Date(nowIso) } : {}),
  };
}

function post(body?: unknown) {
  return new Request('http://x', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${baseEnv.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? '{}' : JSON.stringify(body),
  });
}

Deno.test('mark-absent defaults to today when no date params are provided', async () => {
  const queue: QResult[] = [
    {
      data: [{ id: 'u1', join_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z' }],
      error: null,
    },
    { data: [], error: null },
    { data: null, error: null },
  ];

  const res = await handleMarkAbsent(
    post(),
    makeDeps(queue, '2025-06-13T10:00:00.000Z')
  );

  assertEquals(res.status, 200);
  const body = (await json(res)) as {
    processed: number;
    skipped: number;
    total: number;
    date?: string;
    dates: string[];
  };
  assertEquals(body.processed, 1);
  assertEquals(body.skipped, 0);
  assertEquals(body.total, 1);
  assertEquals(body.date, '2025-06-13');
  assertEquals(body.dates, ['2025-06-13']);
});

Deno.test('mark-absent processes inclusive date ranges and skips already covered summaries', async () => {
  const queue: QResult[] = [
    {
      data: [{ id: 'u1', join_date: '2025-01-01', created_at: '2025-01-01T00:00:00Z' }],
      error: null,
    },
    { data: [{ user_id: 'u1' }], error: null },
    { data: [], error: null },
    { data: null, error: null },
  ];

  const res = await handleMarkAbsent(
    post({ from_date: '2025-06-10', to_date: '2025-06-11' }),
    makeDeps(queue, '2025-06-13T10:00:00.000Z')
  );

  assertEquals(res.status, 200);
  const body = (await json(res)) as {
    processed: number;
    skipped: number;
    total: number;
    date?: string;
    dates: string[];
  };
  assertEquals(body.processed, 1);
  assertEquals(body.skipped, 1);
  assertEquals(body.total, 2);
  assertEquals(body.date, undefined);
  assertEquals(body.dates, ['2025-06-10', '2025-06-11']);
});

Deno.test('mark-absent rejects partial date ranges', async () => {
  const res = await handleMarkAbsent(post({ from_date: '2025-06-10' }), makeDeps([]));

  assertEquals(res.status, 400);
  assertEquals(((await json(res)) as { code: string }).code, 'INVALID_DATE_RANGE');
});

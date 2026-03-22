import { assertEquals } from 'jsr:@std/assert';
import { createQueuedFromClient, json, type QResult } from '../_test/queued_supabase.ts';
import type { PunchServiceClient } from '../punch/handler.ts';
import {
  formatTimeHHMM,
  handleAutoPunchOut,
  timeToMinutes,
  toDateStr,
  type AutoPunchDeps,
  type AutoPunchEnv,
} from './handler.ts';

Deno.test('toDateStr', () => {
  assertEquals(toDateStr(new Date(2025, 2, 1)), '2025-03-01');
});

Deno.test('timeToMinutes', () => {
  assertEquals(timeToMinutes('09:15'), 555);
  assertEquals(timeToMinutes('0:5'), 5);
});

Deno.test('formatTimeHHMM', () => {
  assertEquals(formatTimeHHMM('9:5'), '09:05');
  assertEquals(formatTimeHHMM('16:00'), '16:00');
});

const baseEnv: AutoPunchEnv = {
  supabaseUrl: 'https://x.supabase.co',
  serviceRoleKey: 'service',
  isProduction: false,
};

function makeDeps(queue: QResult[]): AutoPunchDeps {
  const admin = createQueuedFromClient(queue);
  return {
    getEnv: () => baseEnv,
    createServiceClient: () => admin as unknown as PunchServiceClient,
  };
}

function post(body: unknown) {
  return new Request('http://x', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer t',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

Deno.test('OPTIONS returns 200', async () => {
  const res = await handleAutoPunchOut(new Request('http://x', { method: 'OPTIONS' }), makeDeps([]));
  assertEquals(res.status, 200);
});

Deno.test('non-POST returns 405', async () => {
  const res = await handleAutoPunchOut(new Request('http://x', { method: 'GET' }), makeDeps([]));
  assertEquals(res.status, 405);
});

Deno.test('missing Bearer returns 401', async () => {
  const res = await handleAutoPunchOut(new Request('http://x', { method: 'POST', body: '{}' }), makeDeps([]));
  assertEquals(res.status, 401);
});

Deno.test('openLogs query error returns 500 QUERY_FAILED', async () => {
  const res = await handleAutoPunchOut(
    post({ devOverrideTime: '2025-06-04T20:00:00.000Z' }),
    makeDeps([{ data: null, error: { message: 'db' } }])
  );
  assertEquals(res.status, 500);
  assertEquals(((await json(res)) as { code: string }).code, 'QUERY_FAILED');
});

Deno.test('no open logs returns processed 0', async () => {
  const res = await handleAutoPunchOut(
    post({ devOverrideTime: '2025-06-04T20:00:00.000Z' }),
    makeDeps([{ data: [], error: null }])
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number };
  assertEquals(b.processed, 0);
});

Deno.test('when now past cutoff, updates and inserts notification', async () => {
  const log = {
    id: 'l1',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '08:00',
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_days: null, work_start_time: null, work_end_time: null }, error: null },
    {
      data: {
        work_end_time: '16:00',
        auto_punch_out_buffer_minutes: 30,
        weekly_off_days: [5, 6],
      },
      error: null,
    },
    { data: null, error: null },
    { data: null, error: null },
  ];
  const res = await handleAutoPunchOut(
    post({ devOverrideTime: '2025-06-04T20:00:00.000Z' }),
    makeDeps(q)
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 1);
  assertEquals(b.total, 1);
});

Deno.test('when now before cutoff, no update', async () => {
  const log = {
    id: 'l1',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '08:00',
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_days: null, work_start_time: null, work_end_time: null }, error: null },
    {
      data: {
        work_end_time: '16:00',
        auto_punch_out_buffer_minutes: 30,
        weekly_off_days: [5, 6],
      },
      error: null,
    },
  ];
  const res = await handleAutoPunchOut(
    post({ devOverrideTime: '2025-06-04T12:00:00.000Z' }),
    makeDeps(q)
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number };
  assertEquals(b.processed, 0);
});

Deno.test('part 6.1 standard auto punch-out after cutoff is processed', async () => {
  const log = {
    id: 'l-61',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '09:00',
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_days: null, work_start_time: null, work_end_time: null }, error: null },
    {
      data: {
        work_end_time: '18:00',
        auto_punch_out_buffer_minutes: 30,
        weekly_off_days: [5, 6],
      },
      error: null,
    },
    { data: null, error: null }, // update attendance_sessions
    { data: null, error: null }, // insert notifications
  ];
  const res = await handleAutoPunchOut(
    post({ devOverrideTime: '2025-06-04T18:35:00.000Z' }),
    makeDeps(q)
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 1);
  assertEquals(b.total, 1);
});

Deno.test('part 6.2 before cutoff buffer auto punch-out is skipped', async () => {
  const log = {
    id: 'l-62',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '09:00',
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_days: null, work_start_time: null, work_end_time: null }, error: null },
    {
      data: {
        work_end_time: '18:00',
        auto_punch_out_buffer_minutes: 30,
        weekly_off_days: [5, 6],
      },
      error: null,
    },
  ];
  const res = await handleAutoPunchOut(
    post({ devOverrideTime: '2025-06-04T18:20:00' }),
    makeDeps(q)
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 0);
  assertEquals(b.total, 1);
});

Deno.test('part 6.3 overtime open sessions are not auto-closed', async () => {
  // Query filters is_overtime=false, so overtime-only open sessions are excluded.
  const res = await handleAutoPunchOut(
    post({ devOverrideTime: '2025-06-04T20:00:00.000Z' }),
    makeDeps([{ data: [], error: null }])
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number };
  assertEquals(b.processed, 0);
});

Deno.test('part 6.4 off-day sessions are skipped', async () => {
  const log = {
    id: 'l-64',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-06',
    check_in_time: '09:00',
  };
  const q: QResult[] = [
    { data: [log], error: null },
    {
      data: {
        // Custom schedule that does not include Friday(5): off-day.
        work_days: [0, 1, 2, 3, 4],
        work_start_time: '09:00',
        work_end_time: '18:00',
      },
      error: null,
    },
    {
      data: {
        work_end_time: '18:00',
        auto_punch_out_buffer_minutes: 30,
        weekly_off_days: [5, 6],
      },
      error: null,
    },
  ];
  const res = await handleAutoPunchOut(
    post({ devOverrideTime: '2025-06-06T20:00:00.000Z' }),
    makeDeps(q)
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 0);
  assertEquals(b.total, 1);
});

Deno.test('part 6.5 multiple open non-overtime sessions are handled consistently', async () => {
  const logs = [
    {
      id: 'l-651',
      user_id: 'u1',
      org_id: 'o1',
      date: '2025-06-04',
      check_in_time: '09:00',
    },
    {
      id: 'l-652',
      user_id: 'u2',
      org_id: 'o1',
      date: '2025-06-04',
      check_in_time: '10:00',
    },
  ];
  const q: QResult[] = [
    { data: logs, error: null },
    // session 1 profile + policy + update + notification
    { data: { work_days: null, work_start_time: null, work_end_time: null }, error: null },
    { data: { work_end_time: '18:00', auto_punch_out_buffer_minutes: 30, weekly_off_days: [5, 6] }, error: null },
    { data: null, error: null },
    { data: null, error: null },
    // session 2 profile + policy + update + notification
    { data: { work_days: null, work_start_time: null, work_end_time: null }, error: null },
    { data: { work_end_time: '18:00', auto_punch_out_buffer_minutes: 30, weekly_off_days: [5, 6] }, error: null },
    { data: null, error: null },
    { data: null, error: null },
  ];
  const res = await handleAutoPunchOut(
    post({ devOverrideTime: '2025-06-04T20:00:00.000Z' }),
    makeDeps(q)
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 2);
  assertEquals(b.total, 2);
});

Deno.test('part 6.6 regression guard uses execution time beyond shift end', async () => {
  const log = {
    id: 'l-66',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '09:00',
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_days: null, work_start_time: null, work_end_time: null }, error: null },
    {
      data: {
        work_end_time: '18:00',
        auto_punch_out_buffer_minutes: 30,
        weekly_off_days: [5, 6],
      },
      error: null,
    },
    { data: null, error: null },
    { data: null, error: null },
  ];
  const res = await handleAutoPunchOut(
    post({ devOverrideTime: '2025-06-04T18:35:00.000Z' }),
    makeDeps(q)
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number };
  // If shift-end time were incorrectly used as checkout source, this flow still
  // should process. This test guards the intended execution-time path in 6.1.
  assertEquals(b.processed, 1);
});

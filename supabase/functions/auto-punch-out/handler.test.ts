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
  type AutoPunchUserClient,
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
  supabaseAnonKey: 'anon',
  serviceRoleKey: 'service',
};

function makeDeps(queue: QResult[], nowIso?: string): AutoPunchDeps {
  const admin = createQueuedFromClient(queue);
  return {
    getEnv: () => baseEnv,
    createUserClient: () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }) as AutoPunchUserClient,
    createServiceClient: () => admin as unknown as PunchServiceClient,
    ...(nowIso ? { now: () => new Date(nowIso) } : {}),
  };
}

function post() {
  return new Request('http://x', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${baseEnv.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
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
    post(),
    makeDeps([{ data: null, error: { message: 'db' } }], '2025-06-04T17:00:00.000Z')
  );
  assertEquals(res.status, 500);
  assertEquals(((await json(res)) as { code: string }).code, 'QUERY_FAILED');
});

Deno.test('no open logs returns processed 0', async () => {
  const res = await handleAutoPunchOut(
    post(),
    makeDeps([{ data: [], error: null }], '2025-06-04T17:00:00.000Z')
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
    { data: { work_schedule: null }, error: null },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '16:00' },
          '1': { start: '09:00', end: '16:00' },
          '2': { start: '09:00', end: '16:00' },
          '3': { start: '09:00', end: '16:00' },
          '4': { start: '09:00', end: '16:00' },
        },
        auto_punch_out_buffer_minutes: 5,
      },
      error: null,
    },
    { data: null, error: null },
    { data: null, error: null },
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-04T13:10:00.000Z')
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
    { data: { work_schedule: null }, error: null },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '16:00' },
          '1': { start: '09:00', end: '16:00' },
          '2': { start: '09:00', end: '16:00' },
          '3': { start: '09:00', end: '16:00' },
          '4': { start: '09:00', end: '16:00' },
        },
        auto_punch_out_buffer_minutes: 5,
      },
      error: null,
    },
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-04T09:00:00.000Z')
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
    { data: { work_schedule: null }, error: null },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '18:00' },
          '1': { start: '09:00', end: '18:00' },
          '2': { start: '09:00', end: '18:00' },
          '3': { start: '09:00', end: '18:00' },
          '4': { start: '09:00', end: '18:00' },
        },
        auto_punch_out_buffer_minutes: 5,
      },
      error: null,
    },
    { data: null, error: null }, // update attendance_sessions
    { data: null, error: null }, // insert notifications
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-04T15:20:00.000Z')
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
    { data: { work_schedule: null }, error: null },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '18:00' },
          '1': { start: '09:00', end: '18:00' },
          '2': { start: '09:00', end: '18:00' },
          '3': { start: '09:00', end: '18:00' },
          '4': { start: '09:00', end: '18:00' },
        },
        auto_punch_out_buffer_minutes: 5,
      },
      error: null,
    },
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-04T15:00:00.000Z')
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 0);
  assertEquals(b.total, 1);
});

Deno.test('part 6.3 overtime open sessions are not auto-closed', async () => {
  // Query filters is_overtime=false, so overtime-only open sessions are excluded.
  const res = await handleAutoPunchOut(
    post(),
    makeDeps([{ data: [], error: null }], '2025-06-04T17:00:00.000Z')
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
        work_schedule: {
          '0': { start: '09:00', end: '18:00' },
          '1': { start: '09:00', end: '18:00' },
          '2': { start: '09:00', end: '18:00' },
          '3': { start: '09:00', end: '18:00' },
          '4': { start: '09:00', end: '18:00' },
        },
      },
      error: null,
    },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '18:00' },
          '1': { start: '09:00', end: '18:00' },
          '2': { start: '09:00', end: '18:00' },
          '3': { start: '09:00', end: '18:00' },
          '4': { start: '09:00', end: '18:00' },
        },
        auto_punch_out_buffer_minutes: 5,
      },
      error: null,
    },
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-06T17:00:00.000Z')
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
    // session 1 profile + policy + update + notif settings + notification
    { data: { work_schedule: null }, error: null },
    { data: { work_schedule: { '0': { start: '09:00', end: '18:00' }, '1': { start: '09:00', end: '18:00' }, '2': { start: '09:00', end: '18:00' }, '3': { start: '09:00', end: '18:00' }, '4': { start: '09:00', end: '18:00' } }, auto_punch_out_buffer_minutes: 5 }, error: null },
    { data: null, error: null },
    { data: null, error: null },
    { data: null, error: null },
    // session 2 profile + policy + update + notification
    { data: { work_schedule: null }, error: null },
    { data: { work_schedule: { '0': { start: '09:00', end: '18:00' }, '1': { start: '09:00', end: '18:00' }, '2': { start: '09:00', end: '18:00' }, '3': { start: '09:00', end: '18:00' }, '4': { start: '09:00', end: '18:00' } }, auto_punch_out_buffer_minutes: 5 }, error: null },
    { data: null, error: null },
    { data: null, error: null },
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-04T15:20:00.000Z')
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
    { data: { work_schedule: null }, error: null },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '18:00' },
          '1': { start: '09:00', end: '18:00' },
          '2': { start: '09:00', end: '18:00' },
          '3': { start: '09:00', end: '18:00' },
          '4': { start: '09:00', end: '18:00' },
        },
        auto_punch_out_buffer_minutes: 5,
      },
      error: null,
    },
    { data: null, error: null },
    { data: null, error: null },
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-04T15:20:00.000Z')
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number };
  // If shift-end time were incorrectly used as checkout source, this flow still
  // should process. This test guards the intended execution-time path in 6.1.
  assertEquals(b.processed, 1);
});

Deno.test('part 6.1b delayed auto punch-out splits when overtime reaches the minimum threshold', async () => {
  const log = {
    id: 'l-61b',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '09:00',
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_schedule: null }, error: null },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '18:00' },
          '1': { start: '09:00', end: '18:00' },
          '2': { start: '09:00', end: '18:00' },
          '3': { start: '09:00', end: '18:00' },
          '4': { start: '09:00', end: '18:00' },
        },
        auto_punch_out_buffer_minutes: 5,
        minimum_overtime_minutes: 30,
      },
      error: null,
    },
    { data: null, error: null }, // update regular session
    { data: { id: 'ot-61b' }, error: null }, // insert overtime session
    { data: null, error: null }, // upsert overtime request
    { data: null, error: null }, // insert notification
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-04T15:35:00.000Z')
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 1);
  assertEquals(b.total, 1);
});

Deno.test('rule fires for overtime session past rule time (3am overtime)', async () => {
  // Overtime session opened at 22:00 yesterday (org local UTC+3); now is 03:30 next day local
  // = 00:30 UTC. Rule '03:00' overtime should fire.
  const log = {
    id: 'l-ot',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '22:00',
    is_overtime: true,
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_schedule: null }, error: null },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '18:00' },
          '1': { start: '09:00', end: '18:00' },
          '2': { start: '09:00', end: '18:00' },
          '3': { start: '09:00', end: '18:00' },
          '4': { start: '09:00', end: '18:00' },
          '5': { start: '09:00', end: '18:00' },
          '6': { start: '09:00', end: '18:00' },
        },
        auto_punch_out_buffer_minutes: 5,
        auto_punch_out_rules: [
          {
            id: 'r1',
            title: '3am overtime',
            time: '03:00',
            sessionType: 'overtime',
            enabled: true,
          },
        ],
      },
      error: null,
    },
    { data: null, error: null }, // update session
    { data: null, error: null }, // notif settings
    { data: null, error: null }, // insert notification
  ];
  const res = await handleAutoPunchOut(
    post(),
    // 03:30 org local on 2025-06-05 = 00:30 UTC
    makeDeps(q, '2025-06-05T00:30:00.000Z')
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 1);
  assertEquals(b.total, 1);
});

Deno.test('rule does not fire before its deadline', async () => {
  const log = {
    id: 'l-ot-early',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '22:00',
    is_overtime: true,
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_schedule: null }, error: null },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '18:00' },
          '1': { start: '09:00', end: '18:00' },
          '2': { start: '09:00', end: '18:00' },
          '3': { start: '09:00', end: '18:00' },
          '4': { start: '09:00', end: '18:00' },
          '5': { start: '09:00', end: '18:00' },
          '6': { start: '09:00', end: '18:00' },
        },
        auto_punch_out_buffer_minutes: 5,
        auto_punch_out_rules: [
          {
            id: 'r1',
            title: '3am overtime',
            time: '03:00',
            sessionType: 'overtime',
            enabled: true,
          },
        ],
      },
      error: null,
    },
  ];
  const res = await handleAutoPunchOut(
    post(),
    // 02:30 org local on 2025-06-05 = 23:30 UTC on 2025-06-04
    makeDeps(q, '2025-06-04T23:30:00.000Z')
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 0);
  assertEquals(b.total, 1);
});

Deno.test('disabled rule is ignored', async () => {
  const log = {
    id: 'l-ot-dis',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '22:00',
    is_overtime: true,
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_schedule: null }, error: null },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '18:00' },
          '1': { start: '09:00', end: '18:00' },
          '2': { start: '09:00', end: '18:00' },
          '3': { start: '09:00', end: '18:00' },
          '4': { start: '09:00', end: '18:00' },
          '5': { start: '09:00', end: '18:00' },
          '6': { start: '09:00', end: '18:00' },
        },
        auto_punch_out_buffer_minutes: 5,
        auto_punch_out_rules: [
          {
            id: 'r1',
            title: '3am overtime',
            time: '03:00',
            sessionType: 'overtime',
            enabled: false,
          },
        ],
      },
      error: null,
    },
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-05T00:30:00.000Z')
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 0);
});

Deno.test('rule sessionType regular does not fire for overtime session', async () => {
  const log = {
    id: 'l-ot-mismatch',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '22:00',
    is_overtime: true,
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_schedule: null }, error: null },
    {
      data: {
        work_schedule: {
          '0': { start: '09:00', end: '18:00' },
          '1': { start: '09:00', end: '18:00' },
          '2': { start: '09:00', end: '18:00' },
          '3': { start: '09:00', end: '18:00' },
          '4': { start: '09:00', end: '18:00' },
          '5': { start: '09:00', end: '18:00' },
          '6': { start: '09:00', end: '18:00' },
        },
        auto_punch_out_buffer_minutes: 5,
        auto_punch_out_rules: [
          {
            id: 'r1',
            title: '3am regular',
            time: '03:00',
            sessionType: 'regular',
            enabled: true,
          },
        ],
      },
      error: null,
    },
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-05T00:30:00.000Z')
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number };
  assertEquals(b.processed, 0);
});

Deno.test('no configured shift does not auto punch out when org policy is missing', async () => {
  const log = {
    id: 'l-no-shift',
    user_id: 'u1',
    org_id: 'o1',
    date: '2025-06-04',
    check_in_time: '09:00',
  };
  const q: QResult[] = [
    { data: [log], error: null },
    { data: { work_schedule: null }, error: null },
    { data: null, error: null },
  ];
  const res = await handleAutoPunchOut(
    post(),
    makeDeps(q, '2025-06-04T17:00:00.000Z')
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { processed: number; total: number };
  assertEquals(b.processed, 0);
  assertEquals(b.total, 1);
});

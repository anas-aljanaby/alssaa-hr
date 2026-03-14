/**
 * Contract tests for punch handler.
 * Geofence / outside-area flows are not implemented (N/A).
 */

import { assertEquals } from 'jsr:@std/assert';
import { createQueuedFromClient, json, type QResult } from '../_test/queued_supabase.ts';
import { handlePunch, type PunchDeps, type PunchEnv, type PunchServiceClient } from './handler.ts';

const baseEnv: PunchEnv = {
  supabaseUrl: 'https://x.supabase.co',
  supabaseAnonKey: 'anon',
  serviceRoleKey: 'service',
  isProduction: true,
};

function userDeps(
  queue: QResult[],
  opts: {
    user: { id: string } | null;
    env?: Partial<PunchEnv>;
  }
): PunchDeps {
  const admin = createQueuedFromClient(queue);
  return {
    getEnv: () => ({ ...baseEnv, ...opts.env }),
    createUserClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: opts.user },
          error: null,
        }),
      },
    }),
    createServiceClient: () => admin as unknown as PunchServiceClient,
  };
}

type EdgeCase = {
  id: string;
  punchInTime: string;
  expectedStatus: 'present' | 'late';
  expectedIsOvertime: boolean;
  note: string;
};

type OffDayCase = {
  id: string;
  date: string;
  punchInTime: string;
  workDays: number[];
  expectedStatus: 'present' | 'late';
  expectedIsOvertime: boolean;
  note: string;
};

function edgeCaseDeps(
  opts: {
    userId?: string;
    profile?: { org_id: string; work_days: number[] | null; work_start_time: string | null; work_end_time: string | null };
    policy?: { work_start_time: string; grace_period_minutes: number };
    existingToday?: { id: string; check_in_time: string | null; check_out_time: string | null } | null;
  } = {}
): { deps: PunchDeps; getLastInsert: () => Record<string, unknown> | null } {
  const profile = opts.profile ?? { org_id: 'o1', work_days: null, work_start_time: null, work_end_time: null };
  const policy = opts.policy ?? { work_start_time: '09:00', grace_period_minutes: 15 };
  const existingToday = opts.existingToday ?? null;
  const userId = opts.userId ?? 'u1';

  let lastInsert: Record<string, unknown> | null = null;

  const admin: PunchServiceClient = {
    from: (table: string) => {
      let op: 'select' | 'insert' | 'update' = 'select';
      let payload: Record<string, unknown> | null = null;

      const chain = {
        select: () => chain,
        insert: (v: unknown) => {
          op = 'insert';
          payload = (v ?? null) as Record<string, unknown> | null;
          lastInsert = payload;
          return chain;
        },
        update: (v: unknown) => {
          op = 'update';
          payload = (v ?? null) as Record<string, unknown> | null;
          return chain;
        },
        upsert: () => chain,
        delete: () => chain,
        eq: () => chain,
        not: () => chain,
        neq: () => chain,
        in: () => chain,
        gte: () => chain,
        lte: () => chain,
        order: () => chain,
        limit: () => chain,
        range: () => chain,
        maybeSingle: () => chain,
        single: () => chain,
        is: () => chain,
        then: <TResult1 = QResult, TResult2 = never>(
          onF?: ((v: QResult) => TResult1 | PromiseLike<TResult1>) | null,
          onR?: ((e: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ): PromiseLike<TResult1 | TResult2> => {
          let result: QResult = { data: null, error: null };

          if (table === 'profiles') {
            result = { data: profile, error: null };
          } else if (table === 'attendance_policy') {
            result = { data: policy, error: null };
          } else if (table === 'attendance_logs' && op === 'select') {
            result = { data: existingToday, error: null };
          } else if (table === 'attendance_logs' && op === 'insert') {
            result = { data: { id: 'edge-new', ...(payload ?? {}) }, error: null };
          } else if (table === 'attendance_logs' && op === 'update') {
            result = { data: { id: 'edge-update', ...(payload ?? {}) }, error: null };
          }

          return Promise.resolve(result).then(onF ?? undefined, onR ?? undefined);
        },
      };

      return chain;
    },
  };

  return {
    deps: {
      getEnv: () => ({ ...baseEnv, isProduction: false }),
      createUserClient: () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: userId } },
            error: null,
          }),
        },
      }),
      createServiceClient: () => admin,
    },
    getLastInsert: () => lastInsert,
  };
}

async function runPunchInEdgeCase(tc: EdgeCase): Promise<void> {
  const { deps, getLastInsert } = edgeCaseDeps();
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_in', devOverrideTime: `2025-06-01T${tc.punchInTime}:00.000Z` }),
    }),
    deps
  );

  assertEquals(res.status, 200);
  const body = (await json(res)) as { status?: string; is_overtime?: boolean };
  const inserted = getLastInsert() as { status?: string; is_overtime?: boolean } | null;

  assertEquals(body.status, tc.expectedStatus);
  assertEquals(inserted?.status, tc.expectedStatus);
  assertEquals(Boolean(body.is_overtime), tc.expectedIsOvertime);
  assertEquals(Boolean(inserted?.is_overtime), tc.expectedIsOvertime);
}

async function runOffDayPunchInCase(tc: OffDayCase): Promise<void> {
  const { deps, getLastInsert } = edgeCaseDeps({
    profile: {
      org_id: 'o1',
      work_days: tc.workDays,
      work_start_time: '09:00',
      work_end_time: '18:00',
    },
    policy: { work_start_time: '09:00', grace_period_minutes: 15 },
  });

  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_in', devOverrideTime: `${tc.date}T${tc.punchInTime}:00` }),
    }),
    deps
  );

  assertEquals(res.status, 200);
  const body = (await json(res)) as { status?: string; is_overtime?: boolean };
  const inserted = getLastInsert() as { status?: string; is_overtime?: boolean } | null;

  assertEquals(body.status, tc.expectedStatus);
  assertEquals(inserted?.status, tc.expectedStatus);
  assertEquals(Boolean(body.is_overtime), tc.expectedIsOvertime);
  assertEquals(Boolean(inserted?.is_overtime), tc.expectedIsOvertime);
}

Deno.test('OPTIONS returns 200 with CORS', async () => {
  const res = await handlePunch(new Request('http://x', { method: 'OPTIONS' }), userDeps([], { user: null }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('non-POST returns 405 METHOD_NOT_ALLOWED', async () => {
  const res = await handlePunch(
    new Request('http://x', { method: 'GET', headers: { Authorization: 'Bearer t' } }),
    userDeps([], { user: { id: 'u1' } })
  );
  assertEquals(res.status, 405);
  const body = (await json(res)) as { code?: string };
  assertEquals(body.code, 'METHOD_NOT_ALLOWED');
});

Deno.test('missing Authorization returns 401 UNAUTHORIZED', async () => {
  const res = await handlePunch(
    new Request('http://x', { method: 'POST', body: '{}' }),
    userDeps([], { user: { id: 'u1' } })
  );
  assertEquals(res.status, 401);
  const body = (await json(res)) as { code?: string };
  assertEquals(body.code, 'UNAUTHORIZED');
});

Deno.test('non-Bearer Authorization returns 401', async () => {
  const res = await handlePunch(
    new Request('http://x', { method: 'POST', headers: { Authorization: 'Basic x' }, body: '{}' }),
    userDeps([], { user: { id: 'u1' } })
  );
  assertEquals(res.status, 401);
});

Deno.test('getUser null returns 401 UNAUTHORIZED', async () => {
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_in' }),
    }),
    userDeps([], { user: null })
  );
  assertEquals(res.status, 401);
});

Deno.test('invalid action returns 400 INVALID_ACTION', async () => {
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'noop' }),
    }),
    userDeps([], { user: { id: 'u1' } })
  );
  assertEquals(res.status, 400);
  const body = (await json(res)) as { code?: string };
  assertEquals(body.code, 'INVALID_ACTION');
});

Deno.test('non-prod invalid devOverrideTime returns 400 INVALID_TIME', async () => {
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_in', devOverrideTime: 'not-a-date' }),
    }),
    userDeps([], { user: { id: 'u1' }, env: { isProduction: false } })
  );
  assertEquals(res.status, 400);
  const body = (await json(res)) as { code?: string };
  assertEquals(body.code, 'INVALID_TIME');
});

Deno.test('no profile returns 403 NO_PROFILE', async () => {
  const q: QResult[] = [{ data: null, error: null }];
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_in' }),
    }),
    userDeps(q, { user: { id: 'u1' } })
  );
  assertEquals(res.status, 403);
  const body = (await json(res)) as { code?: string };
  assertEquals(body.code, 'NO_PROFILE');
});

Deno.test('check_in when already checked in returns 400 ALREADY_CHECKED_IN', async () => {
  const q: QResult[] = [
    { data: { org_id: 'o1', work_days: null, work_start_time: null, work_end_time: null }, error: null },
    { data: { id: 'l1', check_in_time: '08:00' }, error: null },
  ];
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_in' }),
    }),
    userDeps(q, { user: { id: 'u1' } })
  );
  assertEquals(res.status, 400);
  const body = (await json(res)) as { code?: string };
  assertEquals(body.code, 'ALREADY_CHECKED_IN');
});

Deno.test('check_out without check_in returns 400 NO_CHECK_IN', async () => {
  const q: QResult[] = [
    { data: { org_id: 'o1', work_days: null, work_start_time: null, work_end_time: null }, error: null },
    { data: { id: 'l1', check_in_time: null }, error: null },
  ];
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_out' }),
    }),
    userDeps(q, { user: { id: 'u1' } })
  );
  assertEquals(res.status, 400);
  const body = (await json(res)) as { code?: string };
  assertEquals(body.code, 'NO_CHECK_IN');
});

Deno.test('check_out when already checked out returns 400 ALREADY_CHECKED_OUT', async () => {
  const q: QResult[] = [
    { data: { org_id: 'o1', work_days: null, work_start_time: null, work_end_time: null }, error: null },
    { data: { id: 'l1', check_in_time: '08:00', check_out_time: '17:00' }, error: null },
  ];
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_out' }),
    }),
    userDeps(q, { user: { id: 'u1' } })
  );
  assertEquals(res.status, 400);
  const body = (await json(res)) as { code?: string };
  assertEquals(body.code, 'ALREADY_CHECKED_OUT');
});

Deno.test('happy check_in insert returns 200 with inserted row', async () => {
  const inserted = {
    id: 'new1',
    org_id: 'o1',
    user_id: 'u1',
    date: '2025-06-01',
    check_in_time: '10:00',
    status: 'present',
  };
  const q: QResult[] = [
    { data: { org_id: 'o1', work_days: null, work_start_time: null, work_end_time: null }, error: null },
    { data: null, error: null },
    { data: { work_start_time: '09:00', grace_period_minutes: 15 }, error: null },
    { data: inserted, error: null },
  ];
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_in', devOverrideTime: '2025-06-01T10:00:00.000Z' }),
    }),
    userDeps(q, { user: { id: 'u1' }, env: { isProduction: false } })
  );
  assertEquals(res.status, 200);
  const body = (await json(res)) as { id?: string; status?: string };
  assertEquals(body.id, 'new1');
  assertEquals(body.status, 'present');
});

Deno.test('check_in late when now past start + grace', async () => {
  const inserted = {
    id: 'new1',
    org_id: 'o1',
    user_id: 'u1',
    date: '2025-06-01',
    check_in_time: '09:20',
    status: 'late',
  };
  const q: QResult[] = [
    { data: { org_id: 'o1', work_days: null, work_start_time: null, work_end_time: null }, error: null },
    { data: null, error: null },
    { data: { work_start_time: '09:00', grace_period_minutes: 15 }, error: null },
    { data: inserted, error: null },
  ];
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_in', devOverrideTime: '2025-06-01T09:20:00.000Z' }),
    }),
    userDeps(q, { user: { id: 'u1' }, env: { isProduction: false } })
  );
  assertEquals(res.status, 200);
  const body = (await json(res)) as { status?: string };
  assertEquals(body.status, 'late');
});

Deno.test('happy check_out updates row', async () => {
  const updated = { id: 'l1', check_out_time: '18:00' };
  const q: QResult[] = [
    { data: { org_id: 'o1', work_days: null, work_start_time: null, work_end_time: null }, error: null },
    { data: { id: 'l1', check_in_time: '08:00', check_out_time: null }, error: null },
    { data: updated, error: null },
  ];
  const res = await handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_out', devOverrideTime: '2025-06-01T18:00:00.000Z' }),
    }),
    userDeps(q, { user: { id: 'u1' }, env: { isProduction: false } })
  );
  assertEquals(res.status, 200);
  const body = (await json(res)) as { check_out_time?: string };
  assertEquals(body.check_out_time, '18:00');
});

const punchInEdgeCases: EdgeCase[] = [
  { id: '1.1.1', punchInTime: '09:00', expectedStatus: 'present', expectedIsOvertime: false, note: 'shift start' },
  { id: '1.1.2', punchInTime: '09:14', expectedStatus: 'present', expectedIsOvertime: false, note: 'inside grace' },
  { id: '1.1.3', punchInTime: '09:15', expectedStatus: 'present', expectedIsOvertime: false, note: 'grace boundary inclusive' },
  { id: '1.1.4', punchInTime: '09:16', expectedStatus: 'late', expectedIsOvertime: false, note: 'first minute after grace' },
  { id: '1.1.5', punchInTime: '09:30', expectedStatus: 'late', expectedIsOvertime: false, note: 'clearly late' },
  { id: '1.1.6', punchInTime: '17:59', expectedStatus: 'late', expectedIsOvertime: false, note: 'still within shift' },
  { id: '1.1.7', punchInTime: '18:00', expectedStatus: 'late', expectedIsOvertime: false, note: 'exactly shift end' },
  { id: '1.2.1', punchInTime: '08:00', expectedStatus: 'present', expectedIsOvertime: false, note: 'early window start' },
  { id: '1.2.2', punchInTime: '08:01', expectedStatus: 'present', expectedIsOvertime: false, note: 'inside early window' },
  { id: '1.2.3', punchInTime: '08:59', expectedStatus: 'present', expectedIsOvertime: false, note: 'early window end' },
  { id: '1.2.4', punchInTime: '07:59', expectedStatus: 'present', expectedIsOvertime: true, note: 'before early window' },
  { id: '1.2.5', punchInTime: '07:00', expectedStatus: 'present', expectedIsOvertime: true, note: 'well before early window' },
  { id: '1.3.1', punchInTime: '18:00', expectedStatus: 'late', expectedIsOvertime: false, note: 'shift end strict overtime boundary' },
  { id: '1.3.2', punchInTime: '18:01', expectedStatus: 'present', expectedIsOvertime: true, note: 'first overtime minute' },
  { id: '1.3.3', punchInTime: '20:00', expectedStatus: 'present', expectedIsOvertime: true, note: 'post-shift overtime' },
  { id: '1.3.4', punchInTime: '23:59', expectedStatus: 'present', expectedIsOvertime: true, note: 'end of day overtime' },
  { id: '1.4.1', punchInTime: '00:00', expectedStatus: 'present', expectedIsOvertime: true, note: 'midnight overtime' },
  { id: '1.4.2', punchInTime: '02:00', expectedStatus: 'present', expectedIsOvertime: true, note: 'overnight overtime' },
  { id: '1.4.3', punchInTime: '07:59', expectedStatus: 'present', expectedIsOvertime: true, note: 'one minute before early window' },
];

for (const tc of punchInEdgeCases) {
  Deno.test(`edge case ${tc.id} check_in ${tc.punchInTime} -> ${tc.expectedStatus} (overtime=${tc.expectedIsOvertime})`, async () => {
    await runPunchInEdgeCase(tc);
  });
}

const nonWorkingDayCases: OffDayCase[] = [
  {
    id: '2.1',
    date: '2025-06-06',
    punchInTime: '10:00',
    workDays: [0, 1, 2, 3, 4],
    expectedStatus: 'present',
    expectedIsOvertime: true,
    note: 'Friday off-day punch-in',
  },
  {
    id: '2.2',
    date: '2025-06-07',
    punchInTime: '09:00',
    workDays: [0, 1, 2, 3, 4],
    expectedStatus: 'present',
    expectedIsOvertime: true,
    note: 'Saturday off-day punch-in',
  },
  {
    id: '2.3',
    date: '2025-06-06',
    punchInTime: '08:00',
    workDays: [0, 1, 2, 3, 4],
    expectedStatus: 'present',
    expectedIsOvertime: true,
    note: 'Friday off-day early punch-in',
  },
  {
    id: '2.4',
    date: '2025-06-06',
    punchInTime: '00:01',
    workDays: [0, 1, 2, 3, 4],
    expectedStatus: 'present',
    expectedIsOvertime: true,
    note: 'Friday off-day very early punch-in',
  },
  {
    id: '2.5',
    date: '2025-06-06',
    punchInTime: '23:59',
    workDays: [0, 1, 2, 3, 4],
    expectedStatus: 'present',
    expectedIsOvertime: true,
    note: 'Friday off-day end-of-day punch-in',
  },
  {
    id: '2.6',
    date: '2025-06-09',
    punchInTime: '10:00',
    workDays: [0, 2, 3, 4, 5, 6],
    expectedStatus: 'present',
    expectedIsOvertime: true,
    note: 'Custom user off-day punch-in',
  },
];

for (const tc of nonWorkingDayCases) {
  Deno.test(`edge case ${tc.id} non-working-day check_in ${tc.date} ${tc.punchInTime} -> ${tc.expectedStatus} (overtime=${tc.expectedIsOvertime})`, async () => {
    await runOffDayPunchInCase(tc);
  });
}

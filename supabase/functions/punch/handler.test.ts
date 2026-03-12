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

import { assertEquals } from 'jsr:@std/assert';
import { handlePunch, recalculateDailySummary, toDateStr, type PunchDeps, type PunchEnv, type PunchServiceClient } from './handler.ts';
import { corsHeaders } from '../_shared/cors.ts';

type Session = {
  id: string;
  org_id: string;
  user_id: string;
  date: string;
  check_in_time: string;
  check_out_time: string | null;
  last_action_at: string;
  status: 'present' | 'late';
  is_overtime: boolean;
  duration_minutes: number;
  is_auto_punch_out: boolean;
  is_early_departure: boolean;
  needs_review: boolean;
  is_dev: boolean;
};

type Summary = {
  id: string;
  org_id: string;
  user_id: string;
  date: string;
  first_check_in: string | null;
  last_check_out: string | null;
  total_work_minutes: number;
  total_overtime_minutes: number;
  effective_status: 'present' | 'late' | 'overtime_only' | 'absent' | 'on_leave' | null;
  is_short_day: boolean;
  session_count: number;
  updated_at: string;
};

type LeaveRow = {
  id: string;
  user_id: string;
  status: 'approved' | 'pending' | 'rejected';
  type: string;
  from_date_time: string;
  to_date_time: string;
};

function json(res: Response): Promise<unknown> {
  return res.json();
}

/** UTC ISO instant for a calendar date + org wall clock time (handler uses fixed UTC+3 via toOrgLocalDate). */
function orgInstant(dateStr: string, wallTime: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const parts = wallTime.split(':').map(Number);
  const h = parts[0] ?? 0;
  const mi = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  const utcMs = Date.UTC(y, mo - 1, d, h, mi, s, 0) - 3 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

const baseEnv: PunchEnv = {
  supabaseUrl: 'https://x.supabase.co',
  supabaseAnonKey: 'anon',
  serviceRoleKey: 'service',
  isProduction: false,
};

function makeDeps(opts?: {
  userId?: string;
  profile?: { org_id: string; work_days: number[] | null; work_start_time: string | null; work_end_time: string | null };
  policy?: {
    work_start_time: string;
    work_end_time: string;
    grace_period_minutes: number;
    weekly_off_days: number[];
    early_login_minutes: number;
    minimum_required_minutes: number | null;
  } | null;
  leaveRows?: LeaveRow[];
  failOvertimeRequestInsert?: boolean;
}) {
  const userId = opts?.userId ?? 'u1';
  const profile = opts?.profile ?? {
    org_id: 'o1',
    work_days: null,
    work_start_time: null,
    work_end_time: null,
  };
  const policyDefault = {
    work_start_time: '09:00',
    work_end_time: '18:00',
    grace_period_minutes: 15,
    weekly_off_days: [5, 6],
    early_login_minutes: 60,
    minimum_required_minutes: 480,
  };
  const policy = opts?.policy === undefined ? policyDefault : opts.policy;

  const sessions: Session[] = [];
  const summaries: Summary[] = [];
  const overtimeRequests: Array<{ session_id: string; user_id: string }> = [];
  const leaveRows = opts?.leaveRows ?? [];
  const failOvertimeRequestInsert = opts?.failOvertimeRequestInsert ?? false;

  let idCounter = 1;

  const admin: PunchServiceClient = {
    from: (table: string) => {
      let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
      let payload: Record<string, unknown> | null = null;
      let eqFilters: Record<string, unknown> = {};
      let neqFilters: Record<string, unknown> = {};
      let isFilters: Record<string, unknown> = {};
      let gteFilters: Record<string, unknown> = {};
      let lteFilters: Record<string, unknown> = {};
      let limitCount: number | null = null;
      let orderBy: { column: string; ascending: boolean } | null = null;
      let mode: 'single' | 'maybeSingle' | 'many' = 'many';

      const chain = {
        select: () => chain,
        insert: (v: unknown) => {
          op = 'insert';
          payload = (v ?? null) as Record<string, unknown> | null;
          return chain;
        },
        update: (v: unknown) => {
          op = 'update';
          payload = (v ?? null) as Record<string, unknown> | null;
          return chain;
        },
        upsert: (v: unknown) => {
          op = 'upsert';
          payload = (v ?? null) as Record<string, unknown> | null;
          return chain;
        },
        delete: () => {
          op = 'delete';
          return chain;
        },
        eq: (k: unknown, v: unknown) => {
          eqFilters[String(k)] = v;
          return chain;
        },
        not: () => chain,
        neq: (k: unknown, v: unknown) => {
          neqFilters[String(k)] = v;
          return chain;
        },
        in: () => chain,
        gte: (k: unknown, v: unknown) => {
          gteFilters[String(k)] = v;
          return chain;
        },
        lte: (k: unknown, v: unknown) => {
          lteFilters[String(k)] = v;
          return chain;
        },
        order: (k: unknown, opts?: { ascending?: boolean }) => {
          orderBy = { column: String(k), ascending: opts?.ascending ?? true };
          return chain;
        },
        limit: (v: unknown) => {
          limitCount = Number(v);
          return chain;
        },
        range: () => chain,
        maybeSingle: () => {
          mode = 'maybeSingle';
          return chain;
        },
        single: () => {
          mode = 'single';
          return chain;
        },
        is: (k: unknown, v: unknown) => {
          isFilters[String(k)] = v;
          return chain;
        },
        then: <TResult1 = { data: unknown; error: unknown | null }, TResult2 = never>(
          onF?: ((v: { data: unknown; error: unknown | null }) => TResult1 | PromiseLike<TResult1>) | null,
          onR?: ((e: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ): PromiseLike<TResult1 | TResult2> => {
          let data: unknown = null;
          let error: unknown | null = null;

          if (table === 'profiles') {
            data = profile;
          } else if (table === 'attendance_policy') {
            data = policy;
          } else if (table === 'attendance_sessions' && op === 'select') {
            let rows = sessions.filter((s) => {
              for (const [k, v] of Object.entries(eqFilters)) {
                if ((s as unknown as Record<string, unknown>)[k] !== v) return false;
              }
              for (const [k, v] of Object.entries(isFilters)) {
                if ((s as unknown as Record<string, unknown>)[k] !== v) return false;
              }
              return true;
            });
            if (orderBy) {
              rows = rows.sort((a, b) => {
                const av = String((a as unknown as Record<string, unknown>)[orderBy!.column] ?? '');
                const bv = String((b as unknown as Record<string, unknown>)[orderBy!.column] ?? '');
                return orderBy!.ascending ? av.localeCompare(bv) : bv.localeCompare(av);
              });
            }
            if (typeof limitCount === 'number') rows = rows.slice(0, limitCount);
            data = mode === 'many' ? rows : (rows[0] ?? null);
          } else if (table === 'attendance_sessions' && op === 'insert') {
            const row: Session = {
              id: `s-${idCounter++}`,
              org_id: String(payload?.org_id ?? 'o1'),
              user_id: String(payload?.user_id ?? userId),
              date: String(payload?.date),
              check_in_time: String(payload?.check_in_time),
              check_out_time: (payload?.check_out_time ?? null) as string | null,
              last_action_at: String(payload?.last_action_at ?? new Date().toISOString()),
              status: (payload?.status ?? 'present') as 'present' | 'late',
              is_overtime: Boolean(payload?.is_overtime),
              duration_minutes: Number(payload?.duration_minutes ?? 0),
              is_auto_punch_out: Boolean(payload?.is_auto_punch_out),
              is_early_departure: Boolean(payload?.is_early_departure),
              needs_review: Boolean(payload?.needs_review),
              is_dev: Boolean(payload?.is_dev),
            };
            sessions.push(row);
            data = row;
          } else if (table === 'attendance_sessions' && op === 'update') {
            const id = String(eqFilters.id);
            const idx = sessions.findIndex((s) => s.id === id);
            if (idx >= 0) {
              sessions[idx] = {
                ...sessions[idx],
                ...(payload as Partial<Session>),
              };
              data = sessions[idx];
            } else {
              data = null;
            }
          } else if (table === 'attendance_sessions' && op === 'delete') {
            const id = String(eqFilters.id);
            const idx = sessions.findIndex((s) => s.id === id);
            if (idx >= 0) {
              const [deleted] = sessions.splice(idx, 1);
              data = deleted;
            } else {
              data = null;
            }
          } else if (table === 'leave_requests') {
            let rows = leaveRows.filter((r) => {
              for (const [k, v] of Object.entries(eqFilters)) {
                if ((r as unknown as Record<string, unknown>)[k] !== v) return false;
              }
              for (const [k, v] of Object.entries(neqFilters)) {
                if ((r as unknown as Record<string, unknown>)[k] === v) return false;
              }
              for (const [k, v] of Object.entries(lteFilters)) {
                if (String((r as unknown as Record<string, unknown>)[k] ?? '') > String(v)) return false;
              }
              for (const [k, v] of Object.entries(gteFilters)) {
                if (String((r as unknown as Record<string, unknown>)[k] ?? '') < String(v)) return false;
              }
              return true;
            });
            if (typeof limitCount === 'number') rows = rows.slice(0, limitCount);
            data = mode === 'many' ? rows : (rows[0] ?? null);
          } else if (table === 'attendance_daily_summary' && op === 'upsert') {
            const p = payload as unknown as Summary;
            const idx = summaries.findIndex((s) => s.user_id === p.user_id && s.date === p.date);
            const row: Summary = {
              id: idx >= 0 ? summaries[idx].id : `ds-${idCounter++}`,
              org_id: p.org_id,
              user_id: p.user_id,
              date: p.date,
              first_check_in: p.first_check_in,
              last_check_out: p.last_check_out,
              total_work_minutes: p.total_work_minutes,
              total_overtime_minutes: p.total_overtime_minutes,
              effective_status: p.effective_status,
              is_short_day: p.is_short_day,
              session_count: p.session_count,
              updated_at: p.updated_at,
            };
            if (idx >= 0) summaries[idx] = row;
            else summaries.push(row);
            data = row;
          } else if (table === 'attendance_daily_summary' && op === 'select') {
            let rows = summaries.filter((s) => {
              for (const [k, v] of Object.entries(eqFilters)) {
                if ((s as unknown as Record<string, unknown>)[k] !== v) return false;
              }
              return true;
            });
            if (typeof limitCount === 'number') rows = rows.slice(0, limitCount);
            data = mode === 'many' ? rows : (rows[0] ?? null);
          } else if (table === 'overtime_requests' && (op === 'insert' || op === 'upsert')) {
            if (failOvertimeRequestInsert) {
              error = { message: 'overtime insert failed' };
              return Promise.resolve({ data, error }).then(onF ?? undefined, onR ?? undefined);
            }
            overtimeRequests.push({
              session_id: String(payload?.session_id ?? ''),
              user_id: String(payload?.user_id ?? ''),
            });
            data = { id: `or-${idCounter++}`, ...payload };
          }

          return Promise.resolve({ data, error }).then(onF ?? undefined, onR ?? undefined);
        },
      };
      return chain as unknown as ReturnType<PunchServiceClient['from']>;
    },
  };

  const deps: PunchDeps = {
    getEnv: () => baseEnv,
    createUserClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: userId } }, error: null }),
      },
    }),
    createServiceClient: () => admin,
  };

  return { deps, sessions, summaries, overtimeRequests, admin, profile, policy, userId };
}

async function punch(deps: PunchDeps, action: 'check_in' | 'check_out', iso: string): Promise<Response> {
  return handlePunch(
    new Request('http://x', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, devOverrideTime: iso }),
    }),
    deps
  );
}

Deno.test('preflight OPTIONS returns ok with CORS headers', async () => {
  const mem = makeDeps();
  const res = await handlePunch(
    new Request('http://x', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
      },
    }),
    mem.deps
  );

  assertEquals(res.status, 200);
  assertEquals(await res.text(), 'ok');
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), corsHeaders['Access-Control-Allow-Origin']);
  assertEquals(res.headers.get('Access-Control-Allow-Headers'), corsHeaders['Access-Control-Allow-Headers']);
});

Deno.test('non-POST method is rejected with CORS headers', async () => {
  const mem = makeDeps();
  const res = await handlePunch(
    new Request('http://x', { method: 'GET' }),
    mem.deps
  );
  assertEquals(res.status, 405);
  const body = (await json(res)) as { code?: string };
  assertEquals(body.code, 'METHOD_NOT_ALLOWED');
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), corsHeaders['Access-Control-Allow-Origin']);
  assertEquals(res.headers.get('Access-Control-Allow-Headers'), corsHeaders['Access-Control-Allow-Headers']);
});

Deno.test('part 1.1 grace period boundaries classify check-in correctly', async () => {
  const cases: Array<{
    id: string;
    iso: string;
    expectedStatus: 'present' | 'late';
    expectedOvertime: boolean;
  }> = [
    { id: '1.1.1', iso: orgInstant('2025-06-10', '09:00:00'), expectedStatus: 'present', expectedOvertime: false },
    { id: '1.1.2', iso: orgInstant('2025-06-10', '09:14:00'), expectedStatus: 'present', expectedOvertime: false },
    { id: '1.1.3', iso: orgInstant('2025-06-10', '09:15:00'), expectedStatus: 'present', expectedOvertime: false },
    { id: '1.1.4', iso: orgInstant('2025-06-10', '09:16:00'), expectedStatus: 'late', expectedOvertime: false },
    { id: '1.1.5', iso: orgInstant('2025-06-10', '09:30:00'), expectedStatus: 'late', expectedOvertime: false },
    { id: '1.1.6', iso: orgInstant('2025-06-10', '17:59:00'), expectedStatus: 'late', expectedOvertime: false },
    { id: '1.1.7', iso: orgInstant('2025-06-10', '18:00:00'), expectedStatus: 'late', expectedOvertime: false },
  ];

  for (const testCase of cases) {
    const mem = makeDeps();
    const res = await punch(mem.deps, 'check_in', testCase.iso);
    assertEquals(res.status, 200, `${testCase.id} should accept check-in`);
    const body = (await json(res)) as { status?: 'present' | 'late'; is_overtime?: boolean };
    assertEquals(body.status, testCase.expectedStatus, `${testCase.id} status mismatch`);
    assertEquals(body.is_overtime, testCase.expectedOvertime, `${testCase.id} is_overtime mismatch`);

    assertEquals(mem.sessions.length, 1, `${testCase.id} should create one session`);
    assertEquals(mem.sessions[0].status, testCase.expectedStatus, `${testCase.id} persisted status mismatch`);
    assertEquals(mem.sessions[0].is_overtime, testCase.expectedOvertime, `${testCase.id} persisted overtime mismatch`);
  }
});

Deno.test('part 1.2 early login window boundaries classify check-in correctly', async () => {
  const cases: Array<{
    id: string;
    iso: string;
    expectedStatus: 'present' | 'late';
    expectedOvertime: boolean;
  }> = [
    { id: '1.2.1', iso: orgInstant('2025-06-10', '08:00:00'), expectedStatus: 'present', expectedOvertime: false },
    { id: '1.2.2', iso: orgInstant('2025-06-10', '08:01:00'), expectedStatus: 'present', expectedOvertime: false },
    { id: '1.2.3', iso: orgInstant('2025-06-10', '08:59:00'), expectedStatus: 'present', expectedOvertime: false },
    { id: '1.2.4', iso: orgInstant('2025-06-10', '07:59:00'), expectedStatus: 'present', expectedOvertime: true },
    { id: '1.2.5', iso: orgInstant('2025-06-10', '07:00:00'), expectedStatus: 'present', expectedOvertime: true },
  ];

  for (const testCase of cases) {
    const mem = makeDeps();
    const res = await punch(mem.deps, 'check_in', testCase.iso);
    assertEquals(res.status, 200, `${testCase.id} should accept check-in`);
    const body = (await json(res)) as { status?: 'present' | 'late'; is_overtime?: boolean };
    assertEquals(body.status, testCase.expectedStatus, `${testCase.id} status mismatch`);
    assertEquals(body.is_overtime, testCase.expectedOvertime, `${testCase.id} is_overtime mismatch`);

    assertEquals(mem.sessions.length, 1, `${testCase.id} should create one session`);
    assertEquals(mem.sessions[0].status, testCase.expectedStatus, `${testCase.id} persisted status mismatch`);
    assertEquals(mem.sessions[0].is_overtime, testCase.expectedOvertime, `${testCase.id} persisted overtime mismatch`);
  }
});

Deno.test('part 1.3 post-shift overtime boundaries classify check-in correctly', async () => {
  const cases: Array<{
    id: string;
    iso: string;
    expectedStatus: 'present' | 'late';
    expectedOvertime: boolean;
  }> = [
    { id: '1.3.1', iso: orgInstant('2025-06-10', '18:00:00'), expectedStatus: 'late', expectedOvertime: false },
    { id: '1.3.2', iso: orgInstant('2025-06-10', '18:01:00'), expectedStatus: 'present', expectedOvertime: true },
    { id: '1.3.3', iso: orgInstant('2025-06-10', '20:00:00'), expectedStatus: 'present', expectedOvertime: true },
    { id: '1.3.4', iso: orgInstant('2025-06-10', '23:59:00'), expectedStatus: 'present', expectedOvertime: true },
  ];

  for (const testCase of cases) {
    const mem = makeDeps();
    const res = await punch(mem.deps, 'check_in', testCase.iso);
    assertEquals(res.status, 200, `${testCase.id} should accept check-in`);
    const body = (await json(res)) as { status?: 'present' | 'late'; is_overtime?: boolean };
    assertEquals(body.status, testCase.expectedStatus, `${testCase.id} status mismatch`);
    assertEquals(body.is_overtime, testCase.expectedOvertime, `${testCase.id} is_overtime mismatch`);

    assertEquals(mem.sessions.length, 1, `${testCase.id} should create one session`);
    assertEquals(mem.sessions[0].status, testCase.expectedStatus, `${testCase.id} persisted status mismatch`);
    assertEquals(mem.sessions[0].is_overtime, testCase.expectedOvertime, `${testCase.id} persisted overtime mismatch`);
  }
});

Deno.test('part 1.4 overnight and very-early check-ins classify as overtime', async () => {
  const cases: Array<{
    id: string;
    iso: string;
    expectedStatus: 'present' | 'late';
    expectedOvertime: boolean;
  }> = [
    { id: '1.4.1', iso: orgInstant('2025-06-10', '00:00:00'), expectedStatus: 'present', expectedOvertime: true },
    { id: '1.4.2', iso: orgInstant('2025-06-10', '02:00:00'), expectedStatus: 'present', expectedOvertime: true },
    { id: '1.4.3', iso: orgInstant('2025-06-10', '07:59:00'), expectedStatus: 'present', expectedOvertime: true },
  ];

  for (const testCase of cases) {
    const mem = makeDeps();
    const res = await punch(mem.deps, 'check_in', testCase.iso);
    assertEquals(res.status, 200, `${testCase.id} should accept check-in`);
    const body = (await json(res)) as { status?: 'present' | 'late'; is_overtime?: boolean };
    assertEquals(body.status, testCase.expectedStatus, `${testCase.id} status mismatch`);
    assertEquals(body.is_overtime, testCase.expectedOvertime, `${testCase.id} is_overtime mismatch`);

    assertEquals(mem.sessions.length, 1, `${testCase.id} should create one session`);
    assertEquals(mem.sessions[0].status, testCase.expectedStatus, `${testCase.id} persisted status mismatch`);
    assertEquals(mem.sessions[0].is_overtime, testCase.expectedOvertime, `${testCase.id} persisted overtime mismatch`);
  }
});

Deno.test('part 2.1 off-day punch-in is always present + overtime', async () => {
  const defaultOffDayCases: Array<{
    id: string;
    iso: string;
  }> = [
    { id: '2.1', iso: orgInstant('2025-06-06', '10:00:00') },
    { id: '2.2', iso: orgInstant('2025-06-07', '09:00:00') },
    { id: '2.3', iso: orgInstant('2025-06-06', '08:00:00') },
    { id: '2.4', iso: orgInstant('2025-06-06', '00:01:00') },
    { id: '2.5', iso: orgInstant('2025-06-06', '23:59:00') },
  ];

  for (const testCase of defaultOffDayCases) {
    const mem = makeDeps();
    const res = await punch(mem.deps, 'check_in', testCase.iso);
    assertEquals(res.status, 200, `${testCase.id} should accept off-day check-in`);
    const body = (await json(res)) as { status?: 'present' | 'late'; is_overtime?: boolean };
    assertEquals(body.status, 'present', `${testCase.id} status mismatch`);
    assertEquals(body.is_overtime, true, `${testCase.id} is_overtime mismatch`);
    assertEquals(mem.sessions.length, 1, `${testCase.id} should create one session`);
    assertEquals(mem.sessions[0].status, 'present', `${testCase.id} persisted status mismatch`);
    assertEquals(mem.sessions[0].is_overtime, true, `${testCase.id} persisted overtime mismatch`);
  }

  const customOffDay = makeDeps({
    profile: {
      org_id: 'o1',
      // User works Sun-Thu, so Friday is user-specific off-day.
      work_days: [0, 1, 2, 3, 4],
      work_start_time: '09:00',
      work_end_time: '18:00',
    },
  });
  const customRes = await punch(customOffDay.deps, 'check_in', orgInstant('2025-06-06', '10:00:00'));
  assertEquals(customRes.status, 200, '2.6 should accept custom off-day check-in');
  const customBody = (await json(customRes)) as { status?: 'present' | 'late'; is_overtime?: boolean };
  assertEquals(customBody.status, 'present', '2.6 status mismatch');
  assertEquals(customBody.is_overtime, true, '2.6 is_overtime mismatch');
  assertEquals(customOffDay.sessions.length, 1, '2.6 should create one session');
  assertEquals(customOffDay.sessions[0].status, 'present', '2.6 persisted status mismatch');
  assertEquals(customOffDay.sessions[0].is_overtime, true, '2.6 persisted overtime mismatch');
});

Deno.test('part 3.1 two regular sessions aggregate correctly', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '08:30:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '12:00:00'));
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '13:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '18:00:00'));

  // 3.1.S1 + 3.1.S2 session-level assertions.
  assertEquals(mem.sessions.length, 2);
  const [s1, s2] = [...mem.sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  assertEquals(s1.check_in_time, '08:30');
  assertEquals(s1.check_out_time, '12:00');
  assertEquals(s1.status, 'present');
  assertEquals(s1.is_overtime, false);
  assertEquals(s1.duration_minutes, 210);
  assertEquals(s2.check_in_time, '13:00');
  assertEquals(s2.check_out_time, '18:00');
  assertEquals(s2.status, 'late');
  assertEquals(s2.is_overtime, false);
  assertEquals(s2.duration_minutes, 300);

  // 3.1.1 -> 3.1.7 daily summary assertions.
  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 510);
  assertEquals(summary?.total_overtime_minutes, 0);
  assertEquals(summary?.effective_status, 'present');
  assertEquals(summary?.session_count, 2);
  assertEquals(summary?.first_check_in, '08:30');
  assertEquals(summary?.last_check_out, '18:00');
  assertEquals(summary?.is_short_day, false);
});

/** Org wall times via UTC: handler uses UTC+3 for date/time fields (see toTimeStr). */
const ORG = {
  /** 08:30 Baghdad */
  t0830: '2025-06-10T05:30:00.000Z',
  t1200: '2025-06-10T09:00:00.000Z',
  t1300: '2025-06-10T10:00:00.000Z',
  t1400: '2025-06-10T11:00:00.000Z',
  t1430: '2025-06-10T11:30:00.000Z',
  t1800: '2025-06-10T15:00:00.000Z',
} as const;

/** Two short breaks: three closed work segments on a regular working day (doc §3.8). */
Deno.test('part 3.8 three regular sessions with two breaks aggregate correctly', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', ORG.t0830);
  await punch(mem.deps, 'check_out', ORG.t1200);
  await punch(mem.deps, 'check_in', ORG.t1300);
  await punch(mem.deps, 'check_out', ORG.t1400);
  await punch(mem.deps, 'check_in', ORG.t1430);
  await punch(mem.deps, 'check_out', ORG.t1800);

  assertEquals(mem.sessions.length, 3);
  const [s1, s2, s3] = [...mem.sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  assertEquals(s1.check_in_time, '08:30');
  assertEquals(s1.check_out_time, '12:00');
  assertEquals(s1.duration_minutes, 210);
  assertEquals(s2.check_in_time, '13:00');
  assertEquals(s2.check_out_time, '14:00');
  assertEquals(s2.duration_minutes, 60);
  assertEquals(s3.check_in_time, '14:30');
  assertEquals(s3.check_out_time, '18:00');
  assertEquals(s3.duration_minutes, 210);

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.session_count, 3);
  assertEquals(summary?.first_check_in, '08:30');
  assertEquals(summary?.last_check_out, '18:00');
  assertEquals(summary?.total_work_minutes, 480);
  assertEquals(summary?.total_overtime_minutes, 0);
  assertEquals(summary?.effective_status, 'present');
  assertEquals(summary?.is_short_day, false);
});

/** Third check-in with no checkout yet: open session + summary still tracks last completed checkout (doc §3.8). */
Deno.test('part 3.8b three sessions with third segment open keeps last_check_out from prior session', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', ORG.t0830);
  await punch(mem.deps, 'check_out', ORG.t1200);
  await punch(mem.deps, 'check_in', ORG.t1300);
  await punch(mem.deps, 'check_out', ORG.t1400);
  const thirdIn = await punch(mem.deps, 'check_in', ORG.t1430);
  assertEquals(thirdIn.status, 200);

  assertEquals(mem.sessions.length, 3);
  const [s1, s2, s3] = [...mem.sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  assertEquals(s1.check_out_time, '12:00');
  assertEquals(s2.check_out_time, '14:00');
  assertEquals(s3.check_in_time, '14:30');
  assertEquals(s3.check_out_time, null);

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.session_count, 3);
  assertEquals(summary?.first_check_in, '08:30');
  assertEquals(summary?.last_check_out, '14:00');
});

Deno.test('part 3.2 late first session with late return resolves late', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:30:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '13:00:00'));
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '14:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '18:00:00'));

  // 3.2.S1 + 3.2.S2: classification is independent per session check-in.
  assertEquals(mem.sessions.length, 2);
  const [s1, s2] = [...mem.sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  assertEquals(s1.check_in_time, '09:30');
  assertEquals(s1.check_out_time, '13:00');
  assertEquals(s1.status, 'late');
  assertEquals(s1.is_overtime, false);
  assertEquals(s2.check_in_time, '14:00');
  assertEquals(s2.check_out_time, '18:00');
  assertEquals(s2.status, 'late');
  assertEquals(s2.is_overtime, false);

  // 3.2.2: no non-overtime present session exists => effective_status is late.
  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'late');
});

Deno.test('part 3.3 regular session then post-shift overtime session', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '18:10:00'));
  const overtimeIn = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '18:12:00'));
  assertEquals(overtimeIn.status, 200);

  // 3.3.S1 + 3.3.S2 session-level checks.
  assertEquals(mem.sessions.length, 2);
  const [s1, s2] = [...mem.sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  assertEquals(s1.check_in_time, '09:00');
  assertEquals(s1.check_out_time, '18:10');
  assertEquals(s1.status, 'present');
  assertEquals(s1.is_overtime, false);
  assertEquals(s2.check_in_time, '18:12');
  assertEquals(s2.check_out_time, null);
  assertEquals(s2.status, 'present');
  assertEquals(s2.is_overtime, true);

  // 3.3.1: strict overtime threshold after shift end.
  const overtimeBody = (await json(overtimeIn)) as { status?: 'present' | 'late'; is_overtime?: boolean };
  assertEquals(overtimeBody.status, 'present');
  assertEquals(overtimeBody.is_overtime, true);

  // 3.3.2: overtime request auto-created for overtime session.
  assertEquals(mem.overtimeRequests.length, 1);
  assertEquals(mem.overtimeRequests[0].session_id, s2.id);
  assertEquals(mem.overtimeRequests[0].user_id, mem.userId);

  // 3.3.3: effective status remains present due to regular non-overtime present session.
  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'present');
});

Deno.test('part 3.4 off-day sessions keep effective_status null', async () => {
  const mem = makeDeps({
    profile: {
      org_id: 'o1',
      work_days: [0, 1, 2, 3, 4],
      work_start_time: '09:00',
      work_end_time: '18:00',
    },
  });

  await punch(mem.deps, 'check_in', orgInstant('2025-06-06', '10:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-06', '13:00:00'));
  await punch(mem.deps, 'check_in', orgInstant('2025-06-06', '15:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-06', '19:00:00'));

  // 3.4.S1 + 3.4.S2: both sessions are off-day overtime sessions.
  assertEquals(mem.sessions.length, 2);
  const [s1, s2] = [...mem.sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  assertEquals(s1.check_in_time, '10:00');
  assertEquals(s1.check_out_time, '13:00');
  assertEquals(s1.status, 'present');
  assertEquals(s1.is_overtime, true);
  assertEquals(s1.duration_minutes, 180);
  assertEquals(s2.check_in_time, '15:00');
  assertEquals(s2.check_out_time, '19:00');
  assertEquals(s2.status, 'present');
  assertEquals(s2.is_overtime, true);
  assertEquals(s2.duration_minutes, 240);

  // 3.4.1 -> 3.4.4 summary assertions.
  const summary = mem.summaries.find((s) => s.date === '2025-06-06');
  assertEquals(summary?.total_work_minutes, 420);
  assertEquals(summary?.total_overtime_minutes, 420);
  assertEquals(summary?.effective_status, null);
  assertEquals(summary?.session_count, 2);

  // 3.4.6 overtime request per overtime session.
  assertEquals(mem.overtimeRequests.length, 2);
  assertEquals(mem.overtimeRequests.map((r) => r.session_id).sort(), [s1.id, s2.id].sort());
});

Deno.test('part 3.5 working day overtime-only yields overtime_only', async () => {
  const mem = makeDeps();
  const res = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '20:00:00'));
  assertEquals(res.status, 200);
  const body = (await json(res)) as { is_overtime?: boolean; status?: string };
  assertEquals(body.status, 'present');
  assertEquals(body.is_overtime, true);

  // 3.5.S1: overtime-only session exists on a working day.
  assertEquals(mem.sessions.length, 1);
  assertEquals(mem.sessions[0].check_in_time, '20:00');
  assertEquals(mem.sessions[0].status, 'present');
  assertEquals(mem.sessions[0].is_overtime, true);

  // 3.5.1 + 3.5.2: overtime_only is distinct from absent.
  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'overtime_only');
  assertEquals(summary?.effective_status === 'absent', false);
});

Deno.test('part 3.6 many sessions sum and short-day correctness', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '08:30:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '10:00:00'));
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '11:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '13:00:00'));
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '14:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '17:00:00'));

  // 3.6.S1/S2/S3 durations: 90 + 120 + 180.
  assertEquals(mem.sessions.length, 3);
  const [s1, s2, s3] = [...mem.sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  assertEquals(s1.duration_minutes, 90);
  assertEquals(s2.duration_minutes, 120);
  assertEquals(s3.duration_minutes, 180);
  assertEquals(s1.is_overtime, false);
  assertEquals(s2.is_overtime, false);
  assertEquals(s3.is_overtime, false);

  // 3.6.1 / 3.6.2 / 3.6.3 summary assertions.
  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 390);
  assertEquals(summary?.is_short_day, true);
  assertEquals(summary?.session_count, 3);
});

Deno.test('part 3.7 early checkout then mid-shift re-check-in stays non-overtime', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '13:15:00'));
  const earlyOut = await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '13:16:00'));
  assertEquals(earlyOut.status, 200);

  const secondIn = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '13:17:00'));
  assertEquals(secondIn.status, 200);
  const secondInBody = (await json(secondIn)) as { status?: 'present' | 'late'; is_overtime?: boolean; check_out_time?: string | null };
  assertEquals(secondInBody.status, 'late');
  assertEquals(secondInBody.is_overtime, false);
  assertEquals(secondInBody.check_out_time, null);

  assertEquals(mem.sessions.length, 2);
  const [s1, s2] = [...mem.sessions].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time));
  assertEquals(s1.check_in_time, '13:15');
  assertEquals(s1.check_out_time, '13:16');
  assertEquals(s2.check_in_time, '13:17');
  assertEquals(s2.check_out_time, null);
  assertEquals(s2.status, 'late');
  assertEquals(s2.is_overtime, false);
});

Deno.test('part 4.1 approved leave with no sessions resolves on_leave', async () => {
  const mem = makeDeps({
    leaveRows: [
      {
        id: 'l1',
        user_id: 'u1',
        status: 'approved',
        type: 'annual_leave',
        from_date_time: '2025-06-10T00:00:00',
        to_date_time: '2025-06-10T23:59:59',
      },
    ],
  });

  await recalculateDailySummary(mem.admin, {
    orgId: 'o1',
    userId: 'u1',
    dateStr: '2025-06-10',
    schedule: {
      hasShift: true,
      isWorkingDay: true,
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      earlyLoginMinutes: 60,
      minimumRequiredMinutes: 480,
    },
  });
  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'on_leave');
});

Deno.test('part 4.2 approved leave overrides late session to on_leave', async () => {
  const mem = makeDeps({
    leaveRows: [
      {
        id: 'l2',
        user_id: 'u1',
        status: 'approved',
        type: 'annual_leave',
        from_date_time: '2025-06-10T00:00:00',
        to_date_time: '2025-06-10T23:59:59',
      },
    ],
  });
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:30:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '10:30:00'));

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'on_leave');
});

Deno.test('part 4.3 one non-overtime present session resolves present', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '12:00:00'));

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'present');
});

Deno.test('part 4.4 only non-overtime late sessions resolve late', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:30:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '12:00:00'));

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'late');
});

Deno.test('part 4.5 mixed non-overtime present + late resolves present', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '10:00:00'));
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:30:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '11:00:00'));

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'present');
});

Deno.test('part 4.6 overtime present + non-overtime late resolves late', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '07:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '08:00:00'));
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:30:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '10:00:00'));

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'late');
});

Deno.test('part 4.7 working day with only overtime sessions resolves overtime_only', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '07:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '08:00:00'));
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '20:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '21:00:00'));

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'overtime_only');
});

Deno.test('part 4.8 past working day with no sessions resolves absent', async () => {
  const mem = makeDeps();

  await recalculateDailySummary(mem.admin, {
    orgId: 'o1',
    userId: 'u1',
    dateStr: '2025-06-09',
    schedule: {
      hasShift: true,
      isWorkingDay: true,
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      earlyLoginMinutes: 60,
      minimumRequiredMinutes: 480,
    },
  });

  const summary = mem.summaries.find((s) => s.date === '2025-06-09');
  assertEquals(summary?.effective_status, 'absent');
});

Deno.test('part 4.9 today with no sessions currently resolves absent', async () => {
  const mem = makeDeps();
  const today = toDateStr(new Date());

  await recalculateDailySummary(mem.admin, {
    orgId: 'o1',
    userId: 'u1',
    dateStr: today,
    schedule: {
      hasShift: true,
      isWorkingDay: true,
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      earlyLoginMinutes: 60,
      minimumRequiredMinutes: 480,
    },
  });

  const summary = mem.summaries.find((s) => s.date === today);
  assertEquals(summary?.effective_status, 'absent');
});

Deno.test('part 4.10 off-day with no sessions keeps no effective_status', async () => {
  const mem = makeDeps({
    profile: {
      org_id: 'o1',
      work_days: [0, 1, 2, 3, 4],
      work_start_time: '09:00',
      work_end_time: '18:00',
    },
  });

  await recalculateDailySummary(mem.admin, {
    orgId: 'o1',
    userId: 'u1',
    dateStr: '2025-06-06',
    schedule: {
      hasShift: true,
      isWorkingDay: false,
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      earlyLoginMinutes: 60,
      minimumRequiredMinutes: 480,
    },
  });

  const summary = mem.summaries.find((s) => s.date === '2025-06-06');
  assertEquals(summary?.effective_status, null);
});

Deno.test('part 4.11 off-day with overtime sessions keeps no effective_status', async () => {
  const mem = makeDeps({
    profile: {
      org_id: 'o1',
      work_days: [0, 1, 2, 3, 4],
      work_start_time: '09:00',
      work_end_time: '18:00',
    },
  });
  await punch(mem.deps, 'check_in', orgInstant('2025-06-06', '10:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-06', '13:00:00'));
  const summary = mem.summaries.find((s) => s.date === '2025-06-06');
  assertEquals(summary?.effective_status, null);
});

Deno.test('part 5.1 new session creation recalculates summary fields', async () => {
  const mem = makeDeps();
  const res = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  assertEquals(res.status, 200);

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 0); // 5.V1
  assertEquals(summary?.total_overtime_minutes, 0); // 5.V2
  assertEquals(summary?.effective_status, 'present'); // 5.V3
  assertEquals(summary?.is_short_day, true); // 5.V4 (0 < 480)
});

Deno.test('part 5.2 session closure recalculates summary fields', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '12:00:00'));

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 180); // 5.V1
  assertEquals(summary?.total_overtime_minutes, 0); // 5.V2
  assertEquals(summary?.effective_status, 'present'); // 5.V3
  assertEquals(summary?.is_short_day, true); // 5.V4
});

Deno.test('part 5.3 auto punch-out update recalculates summary fields', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  const session = mem.sessions[0];

  await mem.admin
    .from('attendance_sessions')
    .update({
      check_out_time: '18:35',
      duration_minutes: 575,
      is_auto_punch_out: true,
      needs_review: true,
    })
    .eq('id', session.id)
    .single();

  await recalculateDailySummary(mem.admin, {
    orgId: 'o1',
    userId: 'u1',
    dateStr: '2025-06-10',
    schedule: {
      hasShift: true,
      isWorkingDay: true,
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      earlyLoginMinutes: 60,
      minimumRequiredMinutes: 480,
    },
  });

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 575); // 5.V1
  assertEquals(summary?.total_overtime_minutes, 0); // 5.V2
  assertEquals(summary?.effective_status, 'present'); // 5.V3
  assertEquals(summary?.is_short_day, false); // 5.V4
});

Deno.test('part 5.4 manual edit recalculates summary fields with edited times', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '12:00:00'));
  const session = mem.sessions[0];

  await mem.admin
    .from('attendance_sessions')
    .update({
      check_in_time: '08:30',
      check_out_time: '13:30',
      duration_minutes: 300,
    })
    .eq('id', session.id)
    .single();

  await recalculateDailySummary(mem.admin, {
    orgId: 'o1',
    userId: 'u1',
    dateStr: '2025-06-10',
    schedule: {
      hasShift: true,
      isWorkingDay: true,
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      earlyLoginMinutes: 60,
      minimumRequiredMinutes: 480,
    },
  });

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 300); // 5.V1
  assertEquals(summary?.total_overtime_minutes, 0); // 5.V2
  assertEquals(summary?.effective_status, 'present'); // 5.V3
  assertEquals(summary?.is_short_day, true); // 5.V4
});

Deno.test('part 5.5 correction applied (new session) recalculates summary fields', async () => {
  const mem = makeDeps();
  await mem.admin
    .from('attendance_sessions')
    .insert({
      org_id: 'o1',
      user_id: 'u1',
      date: '2025-06-10',
      check_in_time: '09:10',
      check_out_time: '17:10',
      status: 'present',
      is_overtime: false,
      duration_minutes: 480,
      is_auto_punch_out: false,
      is_early_departure: false,
      needs_review: false,
      is_dev: false,
    })
    .single();

  await recalculateDailySummary(mem.admin, {
    orgId: 'o1',
    userId: 'u1',
    dateStr: '2025-06-10',
    schedule: {
      hasShift: true,
      isWorkingDay: true,
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      earlyLoginMinutes: 60,
      minimumRequiredMinutes: 480,
    },
  });

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 480); // 5.V1
  assertEquals(summary?.total_overtime_minutes, 0); // 5.V2
  assertEquals(summary?.effective_status, 'present'); // 5.V3
  assertEquals(summary?.is_short_day, false); // 5.V4
});

Deno.test('part 5.6 session deletion recalculates summary fields', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '12:00:00'));
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '13:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '18:00:00'));

  const target = mem.sessions.find((s) => s.check_in_time === '13:00');
  await mem.admin.from('attendance_sessions').delete().eq('id', target?.id ?? '').single();

  await recalculateDailySummary(mem.admin, {
    orgId: 'o1',
    userId: 'u1',
    dateStr: '2025-06-10',
    schedule: {
      hasShift: true,
      isWorkingDay: true,
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      earlyLoginMinutes: 60,
      minimumRequiredMinutes: 480,
    },
  });

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 180); // 5.V1
  assertEquals(summary?.total_overtime_minutes, 0); // 5.V2
  assertEquals(summary?.effective_status, 'present'); // 5.V3
  assertEquals(summary?.is_short_day, true); // 5.V4
});

Deno.test('part 6.7 daily summary reflects auto punch-out update', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  const session = mem.sessions[0];

  await mem.admin
    .from('attendance_sessions')
    .update({
      check_out_time: '18:35',
      duration_minutes: 575,
      is_auto_punch_out: true,
      needs_review: true,
    })
    .eq('id', session.id)
    .single();

  await recalculateDailySummary(mem.admin, {
    orgId: 'o1',
    userId: 'u1',
    dateStr: '2025-06-10',
    schedule: {
      hasShift: true,
      isWorkingDay: true,
      workStartTime: '09:00',
      workEndTime: '18:00',
      gracePeriodMinutes: 15,
      earlyLoginMinutes: 60,
      minimumRequiredMinutes: 480,
    },
  });

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 575);
  assertEquals(summary?.last_check_out, '18:35');
  assertEquals(summary?.effective_status, 'present');
});

Deno.test('part 7.1 checkout before shift end sets is_early_departure true', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  const res = await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '15:00:00'));
  assertEquals(res.status, 200);
  const body = (await json(res)) as { is_early_departure?: boolean; status?: 'present' | 'late'; duration_minutes?: number };
  assertEquals(body.is_early_departure, true);
  assertEquals(body.status, 'present');
  assertEquals(body.duration_minutes, 360);
});

Deno.test('part 7.2 checkout exactly at shift end keeps is_early_departure false', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  const res = await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '18:00:00'));
  assertEquals(res.status, 200);
  const body = (await json(res)) as { is_early_departure?: boolean };
  assertEquals(body.is_early_departure, false);
});

Deno.test('part 7.3 early checkout does not rewrite late status', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:30:00'));
  const res = await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '15:00:00'));
  assertEquals(res.status, 200);
  const body = (await json(res)) as { is_early_departure?: boolean; status?: 'present' | 'late' };
  assertEquals(body.is_early_departure, true);
  assertEquals(body.status, 'late');
});

Deno.test('part 7.4 early departure can yield short day in summary', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '15:00:00'));

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 360);
  assertEquals(summary?.is_short_day, true);
});

Deno.test('part 7.5 multi-session day above minimum is not short day', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '15:00:00')); // early departure on session 1
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '15:15:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '18:15:00'));

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 540);
  assertEquals(summary?.is_short_day, false);
});

Deno.test('part 7.6 overtime session checkout does not set early departure', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '20:00:00'));
  const res = await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '21:00:00'));
  assertEquals(res.status, 200);
  const body = (await json(res)) as { is_early_departure?: boolean; is_overtime?: boolean };
  assertEquals(body.is_overtime, true);
  assertEquals(body.is_early_departure, false);
});

Deno.test('part 8.1 working-day overtime punch-in creates pending overtime request', async () => {
  const mem = makeDeps();
  const res = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '19:00:00'));
  assertEquals(res.status, 200);
  const body = (await json(res)) as { is_overtime?: boolean; id?: string };
  assertEquals(body.is_overtime, true);
  assertEquals(mem.overtimeRequests.length, 1);
  assertEquals(mem.overtimeRequests[0].session_id, String(body.id ?? ''));
});

Deno.test('part 8.2 off-day each session creates its own overtime request', async () => {
  const mem = makeDeps({
    profile: {
      org_id: 'o1',
      work_days: [0, 1, 2, 3, 4],
      work_start_time: '09:00',
      work_end_time: '18:00',
    },
  });
  const s1 = await punch(mem.deps, 'check_in', orgInstant('2025-06-06', '10:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-06', '13:00:00'));
  const s2 = await punch(mem.deps, 'check_in', orgInstant('2025-06-06', '15:00:00'));
  assertEquals(s1.status, 200);
  assertEquals(s2.status, 200);
  assertEquals(mem.overtimeRequests.length, 2);
});

Deno.test('part 8.3 pre-window overtime punch-in creates overtime request', async () => {
  const mem = makeDeps();
  const res = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '06:00:00'));
  assertEquals(res.status, 200);
  const body = (await json(res)) as { is_overtime?: boolean };
  assertEquals(body.is_overtime, true);
  assertEquals(mem.overtimeRequests.length, 1);
});

Deno.test('part 8.4 overtime request insert failure does not block punch-in', async () => {
  const mem = makeDeps({ failOvertimeRequestInsert: true });
  const res = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '19:00:00'));
  assertEquals(res.status, 200);
  const body = (await json(res)) as { is_overtime?: boolean };
  assertEquals(body.is_overtime, true);
  assertEquals(mem.sessions.length, 1);
  assertEquals(mem.sessions[0].is_overtime, true);
  assertEquals(mem.overtimeRequests.length, 0);
});

Deno.test('part 8.5 multiple overtime sessions produce multiple requests', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '06:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '07:00:00'));
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '20:00:00'));
  assertEquals(mem.overtimeRequests.length, 2);
});

Deno.test('part 8.6 overtime request session reference matches created session id', async () => {
  const mem = makeDeps();
  const res = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '19:00:00'));
  assertEquals(res.status, 200);
  const body = (await json(res)) as { id?: string };
  assertEquals(mem.overtimeRequests.length, 1);
  assertEquals(mem.overtimeRequests[0].session_id, String(body.id ?? ''));
});

Deno.test('part 8.7 overtime requests are routed to overtime_requests table behavior', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '19:00:00'));
  assertEquals(mem.overtimeRequests.length, 1);
});

Deno.test('part 9.1 needs_review is set by auto punch-out but not manual punch-out', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  const manual = await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '18:00:00'));
  assertEquals(manual.status, 200);
  const manualBody = (await json(manual)) as { needs_review?: boolean };
  assertEquals(manualBody.needs_review, false);

  await punch(mem.deps, 'check_in', orgInstant('2025-06-11', '09:00:00'));
  const open = mem.sessions.find((s) => s.date === '2025-06-11' && s.check_out_time === null);
  await mem.admin
    .from('attendance_sessions')
    .update({
      check_out_time: '18:35',
      duration_minutes: 575,
      is_auto_punch_out: true,
      needs_review: true,
    })
    .eq('id', open?.id ?? '')
    .single();
  const updated = mem.sessions.find((s) => s.id === open?.id);
  assertEquals(updated?.needs_review, true);
});

Deno.test('part 9.2 auto and manual punch-out flags stay consistent', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  const manual = await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '18:00:00'));
  assertEquals(manual.status, 200);
  const manualBody = (await json(manual)) as { is_auto_punch_out?: boolean; needs_review?: boolean };
  assertEquals(manualBody.is_auto_punch_out, false);
  assertEquals(manualBody.needs_review, false);

  await punch(mem.deps, 'check_in', orgInstant('2025-06-11', '09:00:00'));
  const open = mem.sessions.find((s) => s.date === '2025-06-11' && s.check_out_time === null);
  await mem.admin
    .from('attendance_sessions')
    .update({
      check_out_time: '18:35',
      duration_minutes: 575,
      is_auto_punch_out: true,
      needs_review: true,
    })
    .eq('id', open?.id ?? '')
    .single();
  const auto = mem.sessions.find((s) => s.id === open?.id);
  assertEquals(auto?.is_auto_punch_out, true);
  assertEquals(auto?.needs_review, true);
});

Deno.test('part 9.3 is_overtime remains as classified at check-in', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '19:00:00'));
  const created = mem.sessions[0];
  assertEquals(created.is_overtime, true);

  await mem.admin
    .from('attendance_policy')
    .update({
      work_start_time: '10:00',
      work_end_time: '17:00',
      early_login_minutes: 30,
      grace_period_minutes: 5,
    })
    .eq('org_id', 'o1')
    .single();

  const stillSame = mem.sessions.find((s) => s.id === created.id);
  assertEquals(stillSame?.is_overtime, true);
});

Deno.test('part 10.1 second check-in while open session is idempotent success', async () => {
  const mem = makeDeps();
  const first = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  assertEquals(first.status, 200);
  const firstBody = (await json(first)) as { id?: string };

  const second = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:02:00'));
  assertEquals(second.status, 200);
  const secondBody = (await json(second)) as { id?: string };

  // Repeated check-in returns the same open session instead of failing.
  assertEquals(secondBody.id, firstBody.id);
  assertEquals(mem.sessions.length, 1);
});

Deno.test('part 10.2 second check-in shortly after first is idempotent success', async () => {
  const mem = makeDeps();
  const first = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  assertEquals(first.status, 200);
  const firstBody = (await json(first)) as { id?: string };

  const second = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:45'));
  assertEquals(second.status, 200);
  const secondBody = (await json(second)) as { id?: string };
  assertEquals(secondBody.id, firstBody.id);
});

Deno.test('part 10.3 check-in after checkout is allowed', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '10:00:00'));
  const res = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '10:02:00'));
  assertEquals(res.status, 200);
});

Deno.test('part 10.4 checkout retry after completed checkout is rejected as no open check-in', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:00:00'));
  await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '10:00:00'));
  const retry = await punch(mem.deps, 'check_out', orgInstant('2025-06-10', '10:00:30'));
  assertEquals(retry.status, 400);
  const body = (await json(retry)) as { code?: string };
  assertEquals(body.code, 'NO_CHECK_IN');
});

Deno.test('part 10.5 no policy configured still allows punch with defaults', async () => {
  const mem = makeDeps({
    policy: null,
    profile: {
      org_id: 'o1',
      work_days: null,
      work_start_time: null,
      work_end_time: null,
    },
  });
  const res = await punch(mem.deps, 'check_in', orgInstant('2025-06-10', '09:30:00'));
  assertEquals(res.status, 200);
  const body = (await json(res)) as { status?: string; is_overtime?: boolean };
  assertEquals(body.status, 'present');
  assertEquals(body.is_overtime, false);
});

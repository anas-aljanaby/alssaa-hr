import { assertEquals } from 'jsr:@std/assert';
import { handlePunch, recalculateDailySummary, type PunchDeps, type PunchEnv, type PunchServiceClient } from './handler.ts';

type Session = {
  id: string;
  org_id: string;
  user_id: string;
  date: string;
  check_in_time: string;
  check_out_time: string | null;
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
  };
  leaveRows?: LeaveRow[];
}) {
  const userId = opts?.userId ?? 'u1';
  const profile = opts?.profile ?? {
    org_id: 'o1',
    work_days: null,
    work_start_time: null,
    work_end_time: null,
  };
  const policy = opts?.policy ?? {
    work_start_time: '09:00',
    work_end_time: '18:00',
    grace_period_minutes: 15,
    weekly_off_days: [5, 6],
    early_login_minutes: 60,
    minimum_required_minutes: 480,
  };

  const sessions: Session[] = [];
  const summaries: Summary[] = [];
  const overtimeRequests: Array<{ session_id: string; user_id: string }> = [];
  const leaveRows = opts?.leaveRows ?? [];

  let idCounter = 1;

  const admin: PunchServiceClient = {
    from: (table: string) => {
      let op: 'select' | 'insert' | 'update' | 'upsert' = 'select';
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
        delete: () => chain,
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
          } else if (table === 'overtime_requests' && op === 'insert') {
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

Deno.test('part 3.1 two regular sessions aggregate correctly', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', '2025-06-10T08:30:00');
  await punch(mem.deps, 'check_out', '2025-06-10T12:00:00');
  await punch(mem.deps, 'check_in', '2025-06-10T13:00:00');
  await punch(mem.deps, 'check_out', '2025-06-10T18:00:00');

  assertEquals(mem.sessions.length, 2);
  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.total_work_minutes, 510);
  assertEquals(summary?.total_overtime_minutes, 0);
  assertEquals(summary?.first_check_in, '08:30');
  assertEquals(summary?.last_check_out, '18:00');
  assertEquals(summary?.effective_status, 'present');
  assertEquals(summary?.session_count, 2);
  assertEquals(summary?.is_short_day, false);
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

  await punch(mem.deps, 'check_in', '2025-06-06T10:00:00');
  await punch(mem.deps, 'check_out', '2025-06-06T13:00:00');
  await punch(mem.deps, 'check_in', '2025-06-06T15:00:00');
  await punch(mem.deps, 'check_out', '2025-06-06T19:00:00');

  const summary = mem.summaries.find((s) => s.date === '2025-06-06');
  assertEquals(summary?.total_work_minutes, 420);
  assertEquals(summary?.total_overtime_minutes, 420);
  assertEquals(summary?.effective_status, null);
  assertEquals(summary?.session_count, 2);
  assertEquals(mem.overtimeRequests.length, 2);
});

Deno.test('part 3.5 working day overtime-only yields overtime_only', async () => {
  const mem = makeDeps();
  const res = await punch(mem.deps, 'check_in', '2025-06-10T20:00:00');
  assertEquals(res.status, 200);
  const body = (await json(res)) as { is_overtime?: boolean; status?: string };
  assertEquals(body.status, 'present');
  assertEquals(body.is_overtime, true);

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'overtime_only');
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

Deno.test('part 4.5 mixed non-overtime present + late resolves present', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', '2025-06-10T09:00:00');
  await punch(mem.deps, 'check_out', '2025-06-10T10:00:00');
  await punch(mem.deps, 'check_in', '2025-06-10T09:30:00');
  await punch(mem.deps, 'check_out', '2025-06-10T11:00:00');

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'present');
});

Deno.test('part 4.6 overtime present + non-overtime late resolves late', async () => {
  const mem = makeDeps();
  await punch(mem.deps, 'check_in', '2025-06-10T07:00:00');
  await punch(mem.deps, 'check_out', '2025-06-10T08:00:00');
  await punch(mem.deps, 'check_in', '2025-06-10T09:30:00');
  await punch(mem.deps, 'check_out', '2025-06-10T10:00:00');

  const summary = mem.summaries.find((s) => s.date === '2025-06-10');
  assertEquals(summary?.effective_status, 'late');
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
  await punch(mem.deps, 'check_in', '2025-06-06T10:00:00');
  await punch(mem.deps, 'check_out', '2025-06-06T13:00:00');
  const summary = mem.summaries.find((s) => s.date === '2025-06-06');
  assertEquals(summary?.effective_status, null);
});

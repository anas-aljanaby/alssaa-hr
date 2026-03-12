import { assertEquals } from 'jsr:@std/assert';
import { createQueuedFromClient, json, type QResult } from '../_test/queued_supabase.ts';
import {
  handleInviteUser,
  type InviteAdminClient,
  type InviteDeps,
  type InviteUserClient,
} from './handler.ts';

function makeDeps(opts: {
  user: { id: string } | null;
  queue: QResult[];
  inviteResult?: { data: { user: { id: string } | null } | null; error: { message?: string } | null };
}): InviteDeps {
  const adminFrom = createQueuedFromClient(opts.queue);
  const inviteResult = opts.inviteResult ?? {
    data: { user: { id: 'new-user' } },
    error: null,
  };
  const admin = {
    ...adminFrom,
    auth: {
      admin: {
        inviteUserByEmail: async () => inviteResult,
      },
    },
  } as unknown as InviteAdminClient;

  return {
    createUserClient: () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: opts.user }, error: null }),
        },
      }) as InviteUserClient,
    createServiceClient: () => admin,
  };
}

function post(body: unknown, headers?: Record<string, string>) {
  return new Request('http://x', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1MSJ9.x',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

Deno.test('missing token returns 401 UNAUTHORIZED', async () => {
  const res = await handleInviteUser(
    new Request('http://x', { method: 'POST', body: '{}' }),
    makeDeps({ user: { id: 'u1' }, queue: [] })
  );
  assertEquals(res.status, 401);
  const b = (await json(res)) as { code?: string };
  assertEquals(b.code, 'UNAUTHORIZED');
});

Deno.test('getUser null returns 401 PGRST301', async () => {
  const res = await handleInviteUser(post({}), makeDeps({ user: null, queue: [] }));
  assertEquals(res.status, 401);
  const b = (await json(res)) as { code?: string };
  assertEquals(b.code, 'PGRST301');
});

Deno.test('non-admin returns 403 42501', async () => {
  const q: QResult[] = [{ data: { org_id: 'o1', role: 'employee' }, error: null }];
  const res = await handleInviteUser(
    post({
      email: 'a@b.com',
      name: 'Ab',
      role: 'employee',
      department_id: 'd1',
    }),
    makeDeps({ user: { id: 'u1' }, queue: q })
  );
  assertEquals(res.status, 403);
  const b = (await json(res)) as { code?: string };
  assertEquals(b.code, '42501');
});

Deno.test('validation INVALID_EMAIL', async () => {
  const q: QResult[] = [{ data: { org_id: 'o1', role: 'admin' }, error: null }];
  const res = await handleInviteUser(
    post({ email: 'bad', name: 'Ab', role: 'employee', department_id: 'd1' }),
    makeDeps({ user: { id: 'u1' }, queue: q })
  );
  assertEquals(res.status, 400);
  assertEquals(((await json(res)) as { code: string }).code, 'INVALID_EMAIL');
});

Deno.test('validation INVALID_NAME', async () => {
  const q: QResult[] = [{ data: { org_id: 'o1', role: 'admin' }, error: null }];
  const res = await handleInviteUser(
    post({ email: 'a@b.com', name: 'A', role: 'employee', department_id: 'd1' }),
    makeDeps({ user: { id: 'u1' }, queue: q })
  );
  assertEquals(res.status, 400);
  assertEquals(((await json(res)) as { code: string }).code, 'INVALID_NAME');
});

Deno.test('validation INVALID_ROLE', async () => {
  const q: QResult[] = [{ data: { org_id: 'o1', role: 'admin' }, error: null }];
  const res = await handleInviteUser(
    post({ email: 'a@b.com', name: 'Ab', role: 'other', department_id: 'd1' }),
    makeDeps({ user: { id: 'u1' }, queue: q })
  );
  assertEquals(res.status, 400);
  assertEquals(((await json(res)) as { code: string }).code, 'INVALID_ROLE');
});

Deno.test('validation INVALID_DEPARTMENT', async () => {
  const q: QResult[] = [{ data: { org_id: 'o1', role: 'admin' }, error: null }];
  const res = await handleInviteUser(
    post({ email: 'a@b.com', name: 'Ab', role: 'employee', department_id: '' }),
    makeDeps({ user: { id: 'u1' }, queue: q })
  );
  assertEquals(res.status, 400);
  assertEquals(((await json(res)) as { code: string }).code, 'INVALID_DEPARTMENT');
});

Deno.test('inviteUserByEmail duplicate message returns 409 DUPLICATE_EMAIL', async () => {
  const q: QResult[] = [{ data: { org_id: 'o1', role: 'admin' }, error: null }];
  const res = await handleInviteUser(
    post({ email: 'a@b.com', name: 'Ab', role: 'employee', department_id: 'd1' }),
    makeDeps({
      user: { id: 'u1' },
      queue: q,
      inviteResult: { data: null, error: { message: 'User already exists' } },
    })
  );
  assertEquals(res.status, 409);
  assertEquals(((await json(res)) as { code: string }).code, 'DUPLICATE_EMAIL');
});

Deno.test('success returns 200 with user_id', async () => {
  const q: QResult[] = [{ data: { org_id: 'o1', role: 'admin' }, error: null }];
  const res = await handleInviteUser(
    post({ email: 'a@b.com', name: 'Ab', role: 'employee', department_id: 'd1' }),
    makeDeps({
      user: { id: 'u1' },
      queue: q,
      inviteResult: { data: { user: { id: 'uid-xyz' } }, error: null },
    })
  );
  assertEquals(res.status, 200);
  const b = await json(res) as { success?: boolean; user_id?: string };
  assertEquals(b.success, true);
  assertEquals(b.user_id, 'uid-xyz');
});

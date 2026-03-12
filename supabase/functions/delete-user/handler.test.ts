import { assertEquals } from 'jsr:@std/assert';
import { createQueuedFromClient, json, type QResult } from '../_test/queued_supabase.ts';
import {
  handleDeleteUser,
  type DeleteAdminClient,
  type DeleteDeps,
  type DeleteUserClient,
} from './handler.ts';

function makeDeps(opts: {
  callerId: string;
  user: { id: string } | null;
  queue: QResult[];
  deleteResult?: { data: { user: { id: string } | null } | null; error: { message?: string } | null };
}): DeleteDeps {
  const adminFrom = createQueuedFromClient(opts.queue);
  const deleteResult = opts.deleteResult ?? {
    data: { user: { id: 'deleted' } },
    error: null,
  };
  const admin = {
    ...adminFrom,
    auth: {
      admin: {
        deleteUser: async () => deleteResult,
      },
    },
  } as unknown as DeleteAdminClient;

  return {
    createUserClient: () =>
      ({
        auth: {
          getUser: async () => ({ data: { user: opts.user }, error: null }),
        },
      }) as DeleteUserClient,
    createServiceClient: () => admin,
  };
}

function post(body: unknown) {
  return new Request('http://x', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1MSJ9.x',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

Deno.test('missing token returns 401 UNAUTHORIZED', async () => {
  const res = await handleDeleteUser(
    new Request('http://x', { method: 'POST', body: '{}' }),
    makeDeps({ callerId: 'u1', user: { id: 'u1' }, queue: [] })
  );
  assertEquals(res.status, 401);
  assertEquals(((await json(res)) as { code: string }).code, 'UNAUTHORIZED');
});

Deno.test('empty user_id returns 400 INVALID_USER_ID', async () => {
  const res = await handleDeleteUser(
    post({ user_id: '' }),
    makeDeps({ callerId: 'u1', user: { id: 'u1' }, queue: [] })
  );
  assertEquals(res.status, 400);
  assertEquals(((await json(res)) as { code: string }).code, 'INVALID_USER_ID');
});

Deno.test('self-delete returns 400 CANNOT_DELETE_SELF', async () => {
  const res = await handleDeleteUser(
    post({ user_id: 'same-id' }),
    makeDeps({ callerId: 'same-id', user: { id: 'same-id' }, queue: [] })
  );
  assertEquals(res.status, 400);
  assertEquals(((await json(res)) as { code: string }).code, 'CANNOT_DELETE_SELF');
});

Deno.test('target not found returns 404 USER_NOT_FOUND', async () => {
  const q: QResult[] = [
    { data: { org_id: 'o1', role: 'admin' }, error: null },
    { data: null, error: null },
  ];
  const res = await handleDeleteUser(
    post({ user_id: 'target-1' }),
    makeDeps({ callerId: 'admin-1', user: { id: 'admin-1' }, queue: q })
  );
  assertEquals(res.status, 404);
  assertEquals(((await json(res)) as { code: string }).code, 'USER_NOT_FOUND');
});

Deno.test('org mismatch returns 403 ORG_MISMATCH', async () => {
  const q: QResult[] = [
    { data: { org_id: 'o1', role: 'admin' }, error: null },
    { data: { id: 't1', org_id: 'o2', role: 'employee' }, error: null },
  ];
  const res = await handleDeleteUser(
    post({ user_id: 'target-1' }),
    makeDeps({ callerId: 'admin-1', user: { id: 'admin-1' }, queue: q })
  );
  assertEquals(res.status, 403);
  assertEquals(((await json(res)) as { code: string }).code, 'ORG_MISMATCH');
});

Deno.test('target admin returns 400 CANNOT_DELETE_ADMIN', async () => {
  const q: QResult[] = [
    { data: { org_id: 'o1', role: 'admin' }, error: null },
    { data: { id: 't1', org_id: 'o1', role: 'admin' }, error: null },
  ];
  const res = await handleDeleteUser(
    post({ user_id: 't1' }),
    makeDeps({ callerId: 'admin-1', user: { id: 'admin-1' }, queue: q })
  );
  assertEquals(res.status, 400);
  assertEquals(((await json(res)) as { code: string }).code, 'CANNOT_DELETE_ADMIN');
});

Deno.test('success returns 200', async () => {
  const q: QResult[] = [
    { data: { org_id: 'o1', role: 'admin' }, error: null },
    { data: { id: 't1', org_id: 'o1', role: 'employee' }, error: null },
  ];
  const res = await handleDeleteUser(
    post({ user_id: 't1' }),
    makeDeps({ callerId: 'admin-1', user: { id: 'admin-1' }, queue: q })
  );
  assertEquals(res.status, 200);
  const b = (await json(res)) as { success?: boolean };
  assertEquals(b.success, true);
});

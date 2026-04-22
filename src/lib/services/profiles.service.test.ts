import { describe, it, expect, vi, beforeEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

const profileRow = {
  id: 'u1',
  org_id: 'o1',
  employee_id: 'E1',
  name: 'N',
  name_ar: 'ن',
  email: 'e@e.com',
  phone: '',
  role: 'employee' as const,
  department_id: 'd1',
  avatar_url: null as string | null,
  join_date: '2020-01-01',
  work_schedule: null as unknown,
};

function sessionToken(expiresAt: number) {
  return {
    data: {
      session: { access_token: 'tok', expires_at: expiresAt },
    },
    error: null,
  };
}

describe('profiles.service', () => {
  beforeEach(() => {
    sb.clearQueue();
    sb.functions.invoke.mockReset();
    sb.auth.getSession.mockReset();
    sb.auth.refreshSession.mockReset();
  });

  it('getUserById returns null on error', async () => {
    sb.queueResult({ data: null, error: { message: 'not found' } });
    const { getUserById } = await import('./profiles.service');
    expect(await getUserById('u1')).toBeNull();
  });

  it('getUserById returns profile', async () => {
    sb.queueResult({ data: profileRow, error: null });
    const { getUserById } = await import('./profiles.service');
    const p = await getUserById('u1');
    expect(p?.id).toBe('u1');
  });

  it('listUsers returns rows', async () => {
    sb.queueResult({ data: [profileRow], error: null });
    const { listUsers } = await import('./profiles.service');
    expect(await listUsers()).toHaveLength(1);
  });

  it('getDepartmentEmployees filters department', async () => {
    sb.queueResult({ data: [profileRow], error: null });
    const { getDepartmentEmployees } = await import('./profiles.service');
    await getDepartmentEmployees('d1');
    expect(sb.from).toHaveBeenCalledWith('profiles');
  });

  it('getUsersByRole filters role', async () => {
    sb.queueResult({ data: [profileRow], error: null });
    const { getUsersByRole } = await import('./profiles.service');
    await getUsersByRole('manager');
  });

  it('createUser inserts', async () => {
    sb.queueResult({ data: profileRow, error: null });
    const { createUser } = await import('./profiles.service');
    const row = await createUser({
      id: 'u1',
      employee_id: 'E1',
      name: 'N',
      name_ar: 'ن',
    });
    expect(row.id).toBe('u1');
  });

  it('updateUser updates', async () => {
    sb.queueResult({ data: { ...profileRow, name_ar: 'x' }, error: null });
    const { updateUser } = await import('./profiles.service');
    const row = await updateUser('u1', { name_ar: 'x' });
    expect(row.name_ar).toBe('x');
  });

  it('inviteUser calls invoke with payload and bearer token', async () => {
    const far = Math.floor(Date.now() / 1000) + 3600;
    sb.auth.getSession.mockResolvedValue(sessionToken(far));
    sb.functions.invoke.mockResolvedValue({
      data: { success: true, user_id: 'new-u' },
      error: null,
      response: new Response(),
    });
    const { inviteUser } = await import('./profiles.service');
    const r = await inviteUser({
      email: 'n@n.com',
      name: 'New',
      password: 'Abc12345',
      role: 'employee',
      department_id: 'd1',
    });
    expect(r).toEqual({ success: true, user_id: 'new-u' });
    expect(sb.functions.invoke).toHaveBeenCalledWith(
      'invite-user',
      expect.objectContaining({
        body: expect.objectContaining({ email: 'n@n.com' }),
        headers: { Authorization: 'Bearer tok' },
      }),
    );
  });

  it('inviteUser retries on 401 after refresh', async () => {
    const far = Math.floor(Date.now() / 1000) + 3600;
    sb.auth.getSession.mockResolvedValue(sessionToken(far));
    const res401 = new Response(null, { status: 401 });
    sb.functions.invoke
      .mockResolvedValueOnce({ data: null, error: { message: 'jwt' }, response: res401 })
      .mockResolvedValueOnce({
        data: { success: true, user_id: 'u2' },
        error: null,
        response: new Response(),
      });
    sb.auth.refreshSession.mockResolvedValue(sessionToken(far));
    const { inviteUser } = await import('./profiles.service');
    const r = await inviteUser({
      email: 'n@n.com',
      name: 'New',
      password: 'Abc12345',
      role: 'manager',
      department_id: 'd1',
    });
    expect(r.user_id).toBe('u2');
    expect(sb.functions.invoke).toHaveBeenCalledTimes(2);
  });

  it('deleteUser succeeds', async () => {
    const far = Math.floor(Date.now() / 1000) + 3600;
    sb.auth.getSession.mockResolvedValue(sessionToken(far));
    sb.functions.invoke.mockResolvedValue({
      data: { success: true, user_id: 'del-u' },
      error: null,
      response: new Response(),
    });
    const { deleteUser } = await import('./profiles.service');
    const r = await deleteUser({ user_id: 'del-u' });
    expect(r).toEqual({ success: true, user_id: 'del-u' });
    expect(sb.functions.invoke).toHaveBeenCalledWith(
      'delete-user',
      expect.objectContaining({ body: { user_id: 'del-u' } }),
    );
  });

  it('inviteUser throws on invoke error with response body', async () => {
    const far = Math.floor(Date.now() / 1000) + 3600;
    sb.auth.getSession.mockResolvedValue(sessionToken(far));
    sb.functions.invoke.mockResolvedValue({
      data: { error: 'bad', code: 'INVALID_EMAIL' },
      error: { message: 'fn error' },
      response: new Response(),
    });
    const { inviteUser } = await import('./profiles.service');
    await expect(
      inviteUser({ email: 'x', name: 'N', password: 'Abc12345', role: 'employee', department_id: 'd1' }),
    ).rejects.toThrow();
  });
});

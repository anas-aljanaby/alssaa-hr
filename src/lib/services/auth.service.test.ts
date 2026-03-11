import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  work_days: null as number[] | null,
  work_start_time: null as string | null,
  work_end_time: null as string | null,
};

describe('auth.service', () => {
  beforeEach(() => {
    sb.clearQueue();
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('login returns ok on success', async () => {
    sb.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 't' } },
      error: null,
    });
    const { login } = await import('./auth.service');
    const r = await login('a@b.com', 'secret');
    expect(r.ok).toBe(true);
    expect(sb.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' });
  });

  it('login maps invalid credentials to Arabic', async () => {
    sb.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    const { login } = await import('./auth.service');
    const r = await login('a@b.com', 'bad');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('غير صحيحة');
  });

  it('login maps confirm email hint', async () => {
    sb.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Please confirm your email' },
    });
    const { login } = await import('./auth.service');
    const r = await login('a@b.com', 'x');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('تأكيد');
  });

  it('login fails when no session after success', async () => {
    sb.auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null });
    const { login } = await import('./auth.service');
    const r = await login('a@b.com', 'x');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('فشل');
  });

  it('signUp passes emailRedirectTo', async () => {
    sb.auth.signUp.mockResolvedValue({ data: { user: { id: '1' }, session: {} }, error: null });
    const { signUp } = await import('./auth.service');
    await signUp('a@b.com', 'Secret1a', 'Ali');
    expect(sb.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'a@b.com',
        password: 'Secret1a',
        options: expect.objectContaining({
          emailRedirectTo: 'http://localhost/auth/callback',
        }),
      }),
    );
  });

  it('signUp returns error on failure', async () => {
    sb.auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'bad' } });
    const { signUp } = await import('./auth.service');
    const r = await signUp('a@b.com', 'Secret1a', 'Ali');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('bad');
  });

  it('signUp returns message when user without session', async () => {
    sb.auth.signUp.mockResolvedValue({ data: { user: { id: '1' }, session: null }, error: null });
    const { signUp } = await import('./auth.service');
    const r = await signUp('a@b.com', 'Secret1a', 'Ali');
    expect(r.ok).toBe(true);
    expect(r.message).toBeTruthy();
  });

  it('logout calls signOut', async () => {
    sb.auth.signOut.mockResolvedValue(undefined);
    const { logout } = await import('./auth.service');
    await logout();
    expect(sb.auth.signOut).toHaveBeenCalled();
  });

  it('updatePassword succeeds after reauth', async () => {
    sb.auth.getUser.mockResolvedValue({ data: { user: { email: 'a@b.com' } }, error: null });
    sb.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    sb.auth.updateUser.mockResolvedValue({ data: {}, error: null });
    const { updatePassword } = await import('./auth.service');
    const r = await updatePassword('old', 'Newpass1a');
    expect(r.ok).toBe(true);
    expect(sb.auth.updateUser).toHaveBeenCalledWith({ password: 'Newpass1a' });
  });

  it('updatePassword fails without user email', async () => {
    sb.auth.getUser.mockResolvedValue({ data: { user: {} }, error: null });
    const { updatePassword } = await import('./auth.service');
    const r = await updatePassword('old', 'Newpass1a');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('الجلسة');
  });

  it('updatePassword maps invalid current password', async () => {
    sb.auth.getUser.mockResolvedValue({ data: { user: { email: 'a@b.com' } }, error: null });
    sb.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    const { updatePassword } = await import('./auth.service');
    const r = await updatePassword('wrong', 'Newpass1a');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('الحالية');
  });

  it('fetchProfileForSession returns User', async () => {
    sb.queueResult({ data: profileRow, error: null });
    const { fetchProfileForSession } = await import('./auth.service');
    const session = { user: { id: 'u1', email: 'x@y.com' } } as import('@supabase/supabase-js').Session;
    const user = await fetchProfileForSession(session);
    expect(user?.email).toBe('x@y.com');
    expect(user?.uid).toBe('u1');
  });

  it('fetchProfileForSession returns null on error', async () => {
    sb.queueResult({ data: null, error: { message: 'x' } });
    const { fetchProfileForSession } = await import('./auth.service');
    const session = { user: { id: 'u1', email: 'x@y.com' } } as import('@supabase/supabase-js').Session;
    expect(await fetchProfileForSession(session)).toBeNull();
  });

  it('onAuthStateChange calls callback null without session', async () => {
    const cb = vi.fn();
    sb.auth.onAuthStateChange.mockImplementation((handler) => {
      handler('SIGNED_OUT', null);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    const { onAuthStateChange } = await import('./auth.service');
    const unsub = onAuthStateChange(cb);
    expect(cb).toHaveBeenCalledWith(null);
    unsub();
  });

  it('onAuthStateChange defers profile fetch with setTimeout', async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    sb.auth.onAuthStateChange.mockImplementation((handler) => {
      handler('SIGNED_IN', { user: { id: 'u1', email: 'e@e.com' } } as never);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    sb.queueResult({ data: profileRow, error: null });
    const { onAuthStateChange } = await import('./auth.service');
    onAuthStateChange(cb);
    expect(cb).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(cb).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

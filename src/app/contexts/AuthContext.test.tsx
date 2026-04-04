import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { saveAuthSnapshot } from '@/lib/authSnapshot';

vi.mock('@/lib/supabase', async () => {
  const { activeMockSupabase } = await import('@/test/mocks/active-supabase-mock');
  return {
    supabase: activeMockSupabase.supabase,
    setRememberMePreference: vi.fn(),
  };
});

vi.mock('@/lib/authSnapshot', () => {
  let snapshot: { user: unknown; cachedAt: string } | null = null;
  return {
    saveAuthSnapshot: vi.fn((user: unknown) => {
      snapshot = { user, cachedAt: new Date().toISOString() };
    }),
    getAuthSnapshot: vi.fn((expectedUserId?: string) => {
      const user = snapshot?.user as { uid?: string } | undefined;
      if (!user) return null;
      if (expectedUserId && user.uid !== expectedUserId) return null;
      return user;
    }),
    clearAuthSnapshot: vi.fn(() => {
      snapshot = null;
    }),
  };
});

function AuthProbe() {
  const { currentUser, authReady } = useAuth();
  return (
    <div>
      <span data-testid="ready">{String(authReady)}</span>
      <span data-testid="user">{currentUser?.nameAr ?? 'none'}</span>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(async () => {
    const { activeMockSupabase } = await import('@/test/mocks/active-supabase-mock');
    const { clearAuthSnapshot } = await import('@/lib/authSnapshot');
    clearAuthSnapshot();
    activeMockSupabase.clearQueue();
    activeMockSupabase.auth.getSession.mockReset();
    activeMockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    activeMockSupabase.auth.signOut.mockResolvedValue({ error: null });
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
  });

  it('restores a cached user when session exists and profile hydration fails offline', async () => {
    const { activeMockSupabase } = await import('@/test/mocks/active-supabase-mock');
    saveAuthSnapshot({
      uid: 'user-1',
      employeeId: 'EMP-001',
      name: 'Ahmed Hassan',
      nameAr: 'أحمد حسن',
      email: 'ahmed@example.com',
      role: 'employee',
      departmentId: 'dept-1',
      joinDate: '2024-01-01',
    });

    activeMockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
            email: 'ahmed@example.com',
          },
        },
      },
      error: null,
    });
    activeMockSupabase.queueResult({ data: null, error: new Error('Failed to fetch') });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
      expect(screen.getByTestId('user')).toHaveTextContent('أحمد حسن');
    });
  });

  it('does not restore a cached user when the cached snapshot belongs to another session', async () => {
    const { activeMockSupabase } = await import('@/test/mocks/active-supabase-mock');
    saveAuthSnapshot({
      uid: 'user-2',
      employeeId: 'EMP-002',
      name: 'Sara Ali',
      nameAr: 'سارة علي',
      email: 'sara@example.com',
      role: 'employee',
      departmentId: 'dept-2',
      joinDate: '2024-01-01',
    });

    activeMockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
            email: 'ahmed@example.com',
          },
        },
      },
      error: null,
    });
    activeMockSupabase.queueResult({ data: null, error: new Error('Failed to fetch') });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
      expect(screen.getByTestId('user')).toHaveTextContent('none');
    });
  });
});

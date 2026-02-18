import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '../data/mockData';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import type { Session } from '@supabase/supabase-js';

interface AuthResult {
  ok: boolean;
  error?: string;
  /** Non-error informational message (e.g. "please confirm your email") */
  message?: string;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  loginAs: ((role: UserRole) => void) | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function profileToUser(profile: Tables<'profiles'>, email: string): User {
  return {
    uid: profile.id,
    employeeId: profile.employee_id,
    name: profile.name,
    nameAr: profile.name_ar,
    email,
    phone: profile.phone ?? '',
    role: profile.role,
    departmentId: profile.department_id ?? '',
    status: profile.status,
    avatar: profile.avatar_url ?? undefined,
    joinDate: profile.join_date,
  };
}

async function fetchProfileForSession(session: Session): Promise<User | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) return null;
  return profileToUser(profile, session.user.email ?? '');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Use onAuthStateChange exclusively to avoid Navigator lock contention.
    // Do NOT call supabase (e.g. fetchProfileForSession) inside this callback:
    // the auth client holds a Navigator LockManager lock while the callback runs,
    // and any supabase call would try to acquire the same lock → timeout/deadlock.
    // Defer profile fetch so the callback returns and the lock is released first.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthReady(true);
      if (!session) {
        setCurrentUser(null);
        return;
      }
      const s = session;
      setTimeout(() => {
        fetchProfileForSession(s).then(setCurrentUser);
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const message =
          error.message === 'Invalid login credentials'
            ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
            : error.message.includes('confirmed') || error.message.includes('confirm')
              ? 'يرجى تأكيد بريدك الإلكتروني من الرابط المرسل إليك، أو تفعيل "Auto Confirm User" عند إنشاء المستخدم من لوحة التحكم.'
              : error.message;
        return { ok: false, error: message };
      }
      if (!data.session) return { ok: false, error: 'فشل تسجيل الدخول' };
      // onAuthStateChange will pick up the new session automatically
      return { ok: true };
    },
    []
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      name: string
    ): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, name_ar: name, role: 'employee' },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) return { ok: false, error: error.message };
      if (data.user && !data.session) {
        return {
          ok: true,
          message: 'تم إنشاء الحساب. يرجى تأكيد بريدك الإلكتروني من الرابط المرسل إليك.',
        };
      }
      // onAuthStateChange will pick up the new session automatically
      return { ok: true };
    },
    []
  );

  const loginAsFn = useCallback((role: UserRole) => {
    if (!import.meta.env.DEV) return;
    import('../data/mockData').then(({ users: mockUsers }) => {
      const demoUser = mockUsers.find(u => u.role === role);
      if (demoUser) setCurrentUser(demoUser);
    });
  }, []);
  const loginAs: ((role: UserRole) => void) | null = import.meta.env.DEV ? loginAsFn : null;

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        authReady,
        login,
        signUp,
        loginAs,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

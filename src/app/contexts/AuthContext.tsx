import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '../data/mockData';
import { users as mockUsers } from '../data/mockData';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  loginAs: (role: UserRole) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USERS: Record<UserRole, User> = {
  admin: mockUsers.find(u => u.role === 'admin')!,
  manager: mockUsers.find(u => u.role === 'manager')!,
  employee: mockUsers.find(u => u.role === 'employee')!,
};

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

async function fetchUserFromSession(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

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

  const setUserFromSession = useCallback(async () => {
    const user = await fetchUserFromSession();
    setCurrentUser(user);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    setUserFromSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const user = await fetchUserFromSession();
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, [setUserFromSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
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

      const user = await fetchUserFromSession();
      setCurrentUser(user);
      return { ok: true };
    },
    []
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      name: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, name_ar: name, role: 'employee' },
        },
      });
      if (error) return { ok: false, error: error.message };
      if (data.user && !data.session) {
        return { ok: true, error: 'تم إنشاء الحساب. يرجى تأكيد بريدك الإلكتروني من الرابط المرسل إليك.' };
      }
      const user = await fetchUserFromSession();
      setCurrentUser(user ?? null);
      return { ok: true };
    },
    []
  );

  const loginAs = useCallback((role: UserRole) => {
    setCurrentUser(DEMO_USERS[role]);
  }, []);

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

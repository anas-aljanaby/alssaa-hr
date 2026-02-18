import { supabase } from '../supabase';
import type { Tables } from '../database.types';
import type { User, UserRole } from '@/app/data/mockData';
import type { Session } from '@supabase/supabase-js';

export interface AuthResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export function profileToUser(profile: Tables<'profiles'>, email: string): User {
  return {
    uid: profile.id,
    employeeId: profile.employee_id,
    name: profile.name,
    nameAr: profile.name_ar,
    email,
    phone: profile.phone ?? '',
    role: profile.role as UserRole,
    departmentId: profile.department_id ?? '',
    status: profile.status as 'active' | 'inactive',
    avatar: profile.avatar_url ?? undefined,
    joinDate: profile.join_date,
  };
}

export async function fetchProfileForSession(session: Session): Promise<User | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) return null;
  return profileToUser(profile, session.user.email ?? '');
}

export async function login(email: string, password: string): Promise<AuthResult> {
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
  return { ok: true };
}

export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<AuthResult> {
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

  return { ok: true };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export function onAuthStateChange(
  callback: (user: User | null) => void
): () => void {
  // Defer profile fetch to avoid Navigator LockManager contention (auth lock held during callback).
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      callback(null);
      return;
    }
    const s = session;
    setTimeout(() => {
      fetchProfileForSession(s).then(callback);
    }, 0);
  });

  return () => subscription.unsubscribe();
}

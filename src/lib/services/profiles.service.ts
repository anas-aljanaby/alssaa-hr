import { supabase } from '../supabase';
import type { Tables, InsertTables, UpdateTables } from '../database.types';

export type Profile = Tables<'profiles'>;
export type ProfileInsert = InsertTables<'profiles'>;
export type ProfileUpdate = UpdateTables<'profiles'>;

export async function getUserById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

export async function listUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name_ar');

  if (error) throw error;
  return data ?? [];
}

export async function getDepartmentEmployees(departmentId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('department_id', departmentId)
    .order('name_ar');

  if (error) throw error;
  return data ?? [];
}

export async function getUsersByRole(role: Profile['role']): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', role)
    .order('name_ar');

  if (error) throw error;
  return data ?? [];
}

export async function createUser(profile: ProfileInsert): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert(profile)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUser(
  userId: string,
  updates: ProfileUpdate
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function countUsersByStatus(): Promise<{ active: number; inactive: number }> {
  const { count: active, error: e1 } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: inactive, error: e2 } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'inactive');

  if (e1 || e2) throw e1 ?? e2;
  return { active: active ?? 0, inactive: inactive ?? 0 };
}

export interface InviteUserPayload {
  email: string;
  name: string;
  phone?: string;
  role: Profile['role'];
  department_id: string;
}

export interface InviteUserResult {
  success: true;
  user_id: string;
}

/**
 * Invites a new user via the invite-user Edge Function (uses service role on the server).
 * On success the trigger handle_new_user creates profile and leave_balances.
 * On failure throws an error with optional response body for getAddUserErrorMessage.
 */
export async function inviteUser(payload: InviteUserPayload): Promise<InviteUserResult> {
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: payload,
  });

  const body = (data as { success?: boolean; user_id?: string; error?: string; code?: string } | null) ?? null;
  if (error) {
    const e = new Error(error.message || 'فشل إضافة المستخدم') as Error & { response?: typeof body };
    e.response = body;
    throw e;
  }
  if (body?.error && !body?.success) {
    const e = new Error(body.error) as Error & { response?: typeof body };
    e.response = body;
    throw e;
  }
  if (body?.success && body?.user_id) {
    return { success: true, user_id: body.user_id };
  }
  throw new Error('فشل إضافة المستخدم');
}

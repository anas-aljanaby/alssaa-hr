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

export interface InviteUserPayload {
  email: string;
  name: string;
  phone?: string;
  role: 'employee' | 'manager';
  department_id: string;
}

export interface InviteUserResult {
  success: true;
  user_id: string;
}

export interface DeleteUserPayload {
  user_id: string;
}

export interface DeleteUserResult {
  success: true;
  user_id: string;
}

async function getValidAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('انتهت الجلسة أو لا تملك صلاحية تنفيذ هذه العملية');
  }

  const now = Math.floor(Date.now() / 1000);
  const isExpiredOrNearExpiry = !session.expires_at || session.expires_at <= now + 60;
  if (!isExpiredOrNearExpiry) return session.access_token;

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.session?.access_token) {
    throw new Error('انتهت الجلسة أو لا تملك صلاحية تنفيذ هذه العملية');
  }
  return refreshed.session.access_token;
}

function getErrorBodyFromData(data: unknown): { error?: string; code?: string } | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const error =
    (typeof obj.error === 'string' && obj.error) ||
    (typeof obj.message === 'string' && obj.message) ||
    undefined;
  const code =
    (typeof obj.code === 'string' && obj.code) ||
    (typeof obj.code === 'number' && String(obj.code)) ||
    undefined;
  if (!error && !code) return null;
  return { error, code };
}

async function invokeInviteUser(
  payload: InviteUserPayload,
  accessToken: string
): Promise<{
  data: unknown;
  error: { message?: string } | null;
  response: Response | undefined;
}> {
  const { data, error, response } = await supabase.functions.invoke('invite-user', {
    body: payload,
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  });
  return { data, error, response };
}

async function invokeDeleteUser(
  payload: DeleteUserPayload,
  accessToken: string
): Promise<{
  data: unknown;
  error: { message?: string } | null;
  response: Response | undefined;
}> {
  const { data, error, response } = await supabase.functions.invoke('delete-user', {
    body: payload,
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  });
  return { data, error, response };
}

/**
 * Invites a new user via the invite-user Edge Function (uses service role on the server).
 * On success the trigger handle_new_user creates profile and leave_balances.
 * On failure throws an error with optional response body for getAddUserErrorMessage.
 */
export async function inviteUser(payload: InviteUserPayload): Promise<InviteUserResult> {
  let accessToken = await getValidAccessToken();
  let { data, error, response } = await invokeInviteUser(payload, accessToken);
  let errorBody = error ? getErrorBodyFromData(data) : null;

  // If Supabase gateway rejects the JWT (401), refresh and retry once.
  if (error && response?.status === 401) {
    accessToken = await getValidAccessToken();
    const retried = await invokeInviteUser(payload, accessToken);
    data = retried.data;
    error = retried.error;
    response = retried.response;
    errorBody = error ? getErrorBodyFromData(data) : null;
  }

  const body =
    (data as { success?: boolean; user_id?: string; error?: string; code?: string } | null) ?? null;

  if (error) {
    const e = new Error(error.message || 'فشل إضافة المستخدم') as Error & {
      response?: { error?: string; code?: string } | null;
    };
    e.response = errorBody;
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

/**
 * Deletes a user via the delete-user Edge Function.
 * On success the auth user is removed and related profile rows are cascaded.
 */
export async function deleteUser(payload: DeleteUserPayload): Promise<DeleteUserResult> {
  let accessToken = await getValidAccessToken();
  let { data, error, response } = await invokeDeleteUser(payload, accessToken);
  let errorBody = error ? getErrorBodyFromData(data) : null;

  // If Supabase gateway rejects the JWT (401), refresh and retry once.
  if (error && response?.status === 401) {
    accessToken = await getValidAccessToken();
    const retried = await invokeDeleteUser(payload, accessToken);
    data = retried.data;
    error = retried.error;
    response = retried.response;
    errorBody = error ? getErrorBodyFromData(data) : null;
  }

  const body =
    (data as { success?: boolean; user_id?: string; error?: string; code?: string } | null) ?? null;

  if (error) {
    const e = new Error(error.message || 'فشل حذف المستخدم') as Error & {
      response?: { error?: string; code?: string } | null;
    };
    e.response = errorBody;
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

  throw new Error('فشل حذف المستخدم');
}

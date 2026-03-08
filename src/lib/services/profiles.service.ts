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

/**
 * Invites a new user via the invite-user Edge Function (uses service role on the server).
 * On success the trigger handle_new_user creates profile and leave_balances.
 * On failure throws an error with optional response body for getAddUserErrorMessage.
 */
export async function inviteUser(payload: InviteUserPayload): Promise<InviteUserResult> {
  // The edge function requires an Authorization: Bearer <JWT> header.
  // In some timing/session-restore scenarios, `functions.invoke` may not attach it reliably,
  // so we explicitly read the current session and set the header.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('انتهت الجلسة أو لا تملك صلاحية تنفيذ هذه العملية');
  }

  // `functions.invoke` should send Authorization automatically when the client is configured,
  // but for robustness we set it explicitly on the FunctionsClient instance.
  const functions = supabase.functions;
  functions.setAuth(accessToken);

  const { data, error, response } = await functions.invoke('invite-user', {
    body: payload,
  });

  const body =
    (data as { success?: boolean; user_id?: string; error?: string; code?: string } | null) ?? null;

  // When the function returns a non-2xx response, we can still parse the JSON body
  // so the UI can show the correct `code` (e.g. UNAUTHORIZED / PGRST301).
  let errorBody: { error?: string; code?: string } | null = null;
  if (error && response) {
    try {
      errorBody = (await response.json()) as { error?: string; code?: string };
    } catch {
      // ignore (fallback to generic error handling below)
    }
  }

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

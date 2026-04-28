import { supabase } from '../supabase';

export type NotificationPreferences = {
  user_id: string;
  leave_requests_team: boolean;
  overtime_requests_team: boolean;
  updated_at: string;
};

export type NotificationPreferencesPatch = Partial<
  Pick<NotificationPreferences, 'leave_requests_team' | 'overtime_requests_team'>
>;

export async function getMyPreferences(): Promise<NotificationPreferences> {
  const sessionResult = await supabase.auth.getSession();
  const userId = sessionResult?.data?.session?.user?.id;
  if (!userId) throw new Error('لا يمكن تحميل الإعدادات بدون تسجيل الدخول.');

  const { data: existing, error: selectError } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing as NotificationPreferences;

  const now = new Date().toISOString();
  const defaults = {
    user_id: userId,
    leave_requests_team: true,
    overtime_requests_team: true,
    updated_at: now,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('notification_preferences')
    .insert(defaults)
    .select('*')
    .single();

  if (insertError) throw insertError;
  return inserted as NotificationPreferences;
}

export async function updateMyPreferences(
  patch: NotificationPreferencesPatch
): Promise<NotificationPreferences> {
  const sessionResult = await supabase.auth.getSession();
  const userId = sessionResult?.data?.session?.user?.id;
  if (!userId) throw new Error('لا يمكن تحديث الإعدادات بدون تسجيل الدخول.');

  const updates = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('notification_preferences')
    .update(updates)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data as NotificationPreferences;
}

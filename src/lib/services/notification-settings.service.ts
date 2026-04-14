import { supabase } from '../supabase';

export type NotificationSettingType =
  | 'pre_shift_reminder'
  | 'work_start'
  | 'punch_out_reminder'
  | 'auto_punch_out_alert';

export type NotificationSetting = {
  id: string;
  org_id: string;
  type: NotificationSettingType;
  enabled: boolean;
  title: string;
  title_ar: string;
  message: string;
  message_ar: string;
  minutes_before: number | null;
  created_at: string;
  updated_at: string;
};

export async function getNotificationSettings(): Promise<NotificationSetting[]> {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .order('type');
  if (error) throw error;
  return (data ?? []) as NotificationSetting[];
}

export async function updateNotificationSetting(
  id: string,
  updates: Partial<Pick<NotificationSetting, 'enabled' | 'title_ar' | 'message_ar' | 'minutes_before'>>
): Promise<NotificationSetting> {
  const { data, error } = await supabase
    .from('notification_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as NotificationSetting;
}

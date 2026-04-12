import { supabase } from '../supabase';

export interface NotificationTemplates {
  checkInMessage: string | null;
  checkOutMessage: string | null;
}

const DEFAULT_CHECK_IN_MESSAGE = 'تم تسجيل حضورك بنجاح الساعة {time}. يوم عمل موفق!';
const DEFAULT_CHECK_OUT_MESSAGE = 'تم تسجيل انصرافك تلقائياً الساعة {time}. إن كان ذلك غير صحيح، قدم طلب تصحيح.';

export { DEFAULT_CHECK_IN_MESSAGE, DEFAULT_CHECK_OUT_MESSAGE };

export async function getNotificationTemplates(): Promise<NotificationTemplates> {
  const { data, error } = await supabase
    .from('attendance_policy')
    .select('check_in_notification_message, check_out_notification_message')
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    checkInMessage: data?.check_in_notification_message ?? null,
    checkOutMessage: data?.check_out_notification_message ?? null,
  };
}

export async function updateNotificationTemplates(
  templates: Partial<NotificationTemplates>
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('attendance_policy')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing) throw new Error('لا توجد سياسة حضور');

  const updates: Record<string, string | null> = {};
  if ('checkInMessage' in templates) {
    updates.check_in_notification_message = templates.checkInMessage ?? null;
  }
  if ('checkOutMessage' in templates) {
    updates.check_out_notification_message = templates.checkOutMessage ?? null;
  }

  const { error } = await supabase
    .from('attendance_policy')
    .update(updates)
    .eq('id', existing.id);

  if (error) throw error;
}

export function resolveMessage(template: string | null, defaultMsg: string, time: string): string {
  const msg = template?.trim() || defaultMsg;
  return msg.replace(/\{time\}/g, time);
}

export async function createCheckInNotification(userId: string, time: string): Promise<void> {
  const templates = await getNotificationTemplates();
  const messageAr = resolveMessage(templates.checkInMessage, DEFAULT_CHECK_IN_MESSAGE, time);

  await supabase.from('notifications').insert({
    user_id: userId,
    title: 'Check-in recorded',
    title_ar: 'تسجيل حضور',
    message: `Your attendance was recorded at ${time}.`,
    message_ar: messageAr,
    type: 'attendance' as const,
  });
}

export async function createCheckOutNotification(userId: string, time: string): Promise<void> {
  const templates = await getNotificationTemplates();
  const messageAr = resolveMessage(templates.checkOutMessage, DEFAULT_CHECK_OUT_MESSAGE, time);

  await supabase.from('notifications').insert({
    user_id: userId,
    title: 'Signed out',
    title_ar: 'تسجيل انصراف',
    message: `Your departure was recorded at ${time}.`,
    message_ar: messageAr,
    type: 'attendance' as const,
  });
}

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

type EdgeInvokeResult = {
  data?: unknown;
  error?: { message?: string } | null;
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

export async function sendNotificationSettingTest(
  settingId: string
): Promise<{ totalUsers: number; pushedUsers: number; deliveredPushes: number }> {
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult?.data?.session;
  const sessionError = sessionResult?.error;
  if (sessionError || !session?.access_token) {
    throw new Error('انتهت الجلسة أو أنك غير مسجل الدخول. يرجى تسجيل الدخول مرة أخرى.');
  }

  const invoked = await supabase.functions.invoke('send-test-notification', {
    method: 'POST',
    body: { settingId },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  }) as EdgeInvokeResult;

  // supabase.functions.invoke puts non-2xx response bodies in `error`, not `data`.
  // We need to extract the structured JSON from either location.
  let edgeData: {
    error?: string;
    code?: string;
    detail?: string;
    totalUsers?: number;
    pushedUsers?: number;
    deliveredPushes?: number;
  } | null = null;

  if (invoked.data && typeof invoked.data === 'object') {
    edgeData = invoked.data as typeof edgeData;
  } else if (invoked.error) {
    // FunctionsHttpError — try to parse the context (the raw JSON body)
    try {
      const errObj = invoked.error as { context?: { json?: () => Promise<unknown> }; message?: string };
      if (typeof errObj.context?.json === 'function') {
        edgeData = (await errObj.context.json()) as typeof edgeData;
      }
    } catch {
      // fall through
    }
  }

  const errorMessage = edgeData?.error ?? (invoked.error as { message?: string })?.message;
  if (errorMessage) {
    const code = edgeData?.code;
    const detail = edgeData?.detail ? ` (${edgeData.detail})` : '';
    if (code === 'UNAUTHORIZED') {
      throw new Error(`انتهت الجلسة أو أنك غير مسجل الدخول. يرجى تسجيل الدخول مرة أخرى.${detail}`);
    }
    if (code === 'FORBIDDEN') {
      throw new Error('هذه العملية متاحة للمدير العام فقط.');
    }
    if (code === 'SETTING_NOT_FOUND') {
      throw new Error('تعذر العثور على نوع الإشعار المطلوب اختباره.');
    }
    if (code === 'NO_PUSH_CONFIG') {
      throw new Error('إشعارات الجهاز غير مفعّلة على الخادم بعد.');
    }

    throw new Error(errorMessage + detail || 'تعذر إرسال الإشعار التجريبي.');
  }

  return {
    totalUsers: Number(edgeData?.totalUsers ?? 0),
    pushedUsers: Number(edgeData?.pushedUsers ?? 0),
    deliveredPushes: Number(edgeData?.deliveredPushes ?? 0),
  };
}

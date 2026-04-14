import React, { useEffect, useState } from 'react';
import { BellRing, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext';
import { usePwa } from '@/app/contexts/PwaContext';
import {
  getPushPermission,
  isPushSupported,
  requestAndSubscribe,
  subscribeToPush,
} from '@/lib/push/push-manager';

export function DeviceNotificationsBanner() {
  const { currentUser } = useAuth();
  const { isOffline } = usePwa();
  const [permission, setPermission] = useState<NotificationPermission>(() => getPushPermission());
  const [syncFailed, setSyncFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pushSupported = isPushSupported();

  useEffect(() => {
    const refreshPermission = () => {
      setPermission(getPushPermission());
    };

    window.addEventListener('focus', refreshPermission);
    document.addEventListener('visibilitychange', refreshPermission);

    return () => {
      window.removeEventListener('focus', refreshPermission);
      document.removeEventListener('visibilitychange', refreshPermission);
    };
  }, []);

  useEffect(() => {
    if (!currentUser || isOffline || !pushSupported || permission !== 'granted') return;

    let cancelled = false;

    void subscribeToPush(currentUser.uid).then((ok) => {
      if (cancelled) return;
      setSyncFailed(!ok);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser, isOffline, permission, pushSupported]);

  if (!currentUser || isOffline || !pushSupported) return null;
  if (permission === 'granted' && !syncFailed) return null;

  const isRetryState = permission === 'granted' && syncFailed;
  const isDeniedState = permission === 'denied';

  const title = isRetryState
    ? 'تعذر ربط هذا الجهاز بإشعارات الدوام'
    : isDeniedState
      ? 'إشعارات الجهاز متوقفة'
      : 'فعّل إشعارات الجهاز';

  const description = isRetryState
    ? 'يوجد إذن للإشعارات، لكن تسجيل هذا الجهاز فشل. أعد المحاولة لإكمال الربط.'
    : isDeniedState
      ? 'اسمح بالإشعارات من إعدادات Safari أو iPhone، ثم ارجع واضغط "تحقق مجدداً".'
      : 'لتصلك تنبيهات الدوام على الهاتف حتى عند إغلاق التطبيق، فعّل إشعارات الجهاز مرة واحدة.';

  const buttonLabel = isDeniedState
    ? 'تحقق مجدداً'
    : isRetryState
      ? 'إعادة المحاولة'
      : 'تفعيل الإشعارات';

  async function handleAction() {
    if (!currentUser || isSubmitting) return;

    if (isDeniedState) {
      setPermission(getPushPermission());
      return;
    }

    setIsSubmitting(true);
    try {
      const nextPermission = await requestAndSubscribe(currentUser.uid);
      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        toast.info('لن تصلك إشعارات الجهاز حتى تسمح بها من المتصفح.');
        setSyncFailed(false);
        return;
      }

      const synced = await subscribeToPush(currentUser.uid);
      setSyncFailed(!synced);

      if (synced) {
        toast.success('تم تفعيل إشعارات الجهاز لهذا الهاتف.');
      } else {
        toast.error('تم السماح بالإشعارات، لكن تسجيل هذا الجهاز لم يكتمل.');
      }
    } catch {
      setSyncFailed(true);
      toast.error('تعذر تفعيل إشعارات الجهاز حالياً.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-indigo-600">
            <BellRing className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm">{title}</p>
            <p className="mt-1 text-xs leading-5 text-indigo-900/80">{description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleAction()}
          disabled={isSubmitting}
          className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-xs text-white disabled:opacity-60"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-1">
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
              جاري التفعيل
            </span>
          ) : (
            buttonLabel
          )}
        </button>
      </div>
    </div>
  );
}

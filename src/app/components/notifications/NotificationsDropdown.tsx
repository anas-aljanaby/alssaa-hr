import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Bell, CheckCircle2, Clock, FileText, Info, Settings } from 'lucide-react';
import { useApp } from '@/app/contexts/AppContext';
import { usePwa } from '@/app/contexts/PwaContext';
import { EmptyState } from '@/app/components/shared/EmptyState';
import * as notificationsService from '@/lib/services/notifications.service';
import type { Notification } from '@/lib/services/notifications.service';
import { getTimeAgoLabel } from '@/lib/ui-helpers';
import { isOfflineError } from '@/lib/network';

type NotificationsDropdownProps = {
  userId: string;
  onClose: () => void;
};

export function NotificationsDropdown({ userId, onClose }: NotificationsDropdownProps) {
  const { markNotificationRead, markAllNotificationsRead } = useApp();
  const { isOffline, refreshApp } = usePwa();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      try {
        setLoading(true);
        const data = await notificationsService.getUserNotifications(userId);
        if (!cancelled) setLoadError(null);
        if (!cancelled) setNotifications(data);
      } catch (error) {
        if (!cancelled) {
          const message = isOfflineError(error)
            ? 'تعذر تحميل الإشعارات بدون اتصال بالإنترنت.'
            : 'فشل تحميل الإشعارات.';
          setLoadError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNotifications();

    if (isOffline) {
      return () => {
        cancelled = true;
      };
    }

    const unsubscribe = notificationsService.subscribeToUserNotifications(userId, (event) => {
      setNotifications((prev) => {
        if (event.eventType === 'INSERT') return [event.new, ...prev];
        return prev.map((n) => (n.id === event.new.id ? event.new : n));
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isOffline, userId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_status).length,
    [notifications]
  );

  const handleMarkRead = async (notifId: string) => {
    await markNotificationRead(notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read_status: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_status: true })));
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'request_update':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'attendance':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'approval':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'system':
        return <Settings className="w-4 h-4 text-purple-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        dir="rtl"
        className="fixed left-4 right-4 top-[4.25rem] z-50 mx-auto max-w-lg overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-gray-800">الإشعارات</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              تعليم الكل كمقروء
            </button>
          )}
        </div>

        <div className="max-h-[65vh] overflow-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-xl h-16 animate-pulse" />
              ))}
            </div>
          ) : loadError && notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />}
              title="تعذر تحميل الإشعارات"
              description={loadError}
              actionLabel="إعادة المحاولة"
              onAction={refreshApp}
            />
          ) : notifications.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="space-y-2 p-1">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleMarkRead(notif.id)}
                  className={`w-full text-right rounded-xl p-3 border transition-all ${
                    notif.read_status
                      ? 'bg-white border-gray-100'
                      : 'bg-blue-50/50 border-blue-100'
                  }`}
                >
                  <div className="flex gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      {typeIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-gray-800 truncate">{notif.title_ar}</p>
                        {!notif.read_status && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message_ar}</p>
                      <p className="text-xs text-gray-400 mt-1">{getTimeAgoLabel(notif.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

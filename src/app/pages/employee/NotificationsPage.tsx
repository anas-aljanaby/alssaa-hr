import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { usePwa } from '../../contexts/PwaContext';
import { useAppTopBar } from '../../contexts/AppTopBarContext';
import { toast } from 'sonner';
import * as notificationsService from '@/lib/services/notifications.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import type { Notification } from '@/lib/services/notifications.service';
import { EmptyState } from '../../components/shared/EmptyState';
import { UnavailableState } from '../../components/shared/UnavailableState';
import {
  Bell,
  Clock,
  FileText,
  Settings,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { getTimeAgoLabel } from '@/lib/ui-helpers';
import { isOfflineError } from '@/lib/network';

export function NotificationsPage() {
  const { currentUser } = useAuth();
  const { markNotificationRead, markAllNotificationsRead } = useApp();
  const { isOffline } = usePwa();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    loadNotifications();
  }, [currentUser?.uid]);

  useRealtimeSubscription(
    () => {
      if (!currentUser || isOffline) return undefined;
      return notificationsService.subscribeToUserNotifications(currentUser.uid, (event) => {
        if (event.eventType === 'INSERT') {
          setNotifications((prev) => [event.new, ...prev]);
        } else if (event.eventType === 'UPDATE') {
          setNotifications((prev) =>
            prev.map((n) => (n.id === event.new.id ? event.new : n))
          );
        }
      });
    },
    [currentUser?.uid, isOffline]
  );

  async function loadNotifications() {
    if (!currentUser) return;
    try {
      setLoading(true);
      const data = await notificationsService.getUserNotifications(currentUser.uid);
      setLoadError(null);
      setNotifications(data);
    } catch (error) {
      const message = isOfflineError(error)
        ? 'تعذر تحميل الإشعارات بدون اتصال بالإنترنت.'
        : 'فشل تحميل الإشعارات.';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read_status).length;

  const handleMarkRead = async (notifId: string) => {
    await markNotificationRead(notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read_status: true } : n))
    );
  };

  const handleMarkAllRead = useCallback(async () => {
    if (!currentUser) return;
    await markAllNotificationsRead(currentUser.uid);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_status: true })));
  }, [currentUser, markAllNotificationsRead]);

  const topBarAction = useMemo(
    () =>
      unreadCount > 0 ? (
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={isOffline}
          aria-disabled={isOffline}
          title={isOffline ? 'يتطلب اتصالاً بالإنترنت' : undefined}
          className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          تعليم الكل
        </button>
      ) : null,
    [handleMarkAllRead, unreadCount, isOffline]
  );

  useAppTopBar({
    title: currentUser ? 'الإشعارات' : undefined,
    meta: unreadCount > 0 ? `${unreadCount} غير مقروءة` : 'كلها مقروءة',
    action: topBarAction,
  });

  if (!currentUser) return null;

  const typeIcon = (type: string) => {
    switch (type) {
      case 'request_update': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'attendance': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'approval': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'system': return <Settings className="w-5 h-5 text-purple-500" />;
      default: return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const typeBg = (type: string) => {
    switch (type) {
      case 'request_update': return 'bg-blue-50';
      case 'attendance': return 'bg-amber-50';
      case 'approval': return 'bg-emerald-50';
      case 'system': return 'bg-purple-50';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 pb-24 pt-3">
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : loadError && notifications.length === 0 ? (
        <UnavailableState
          title="تعذر تحميل الإشعارات"
          description={loadError}
          actionLabel="إعادة المحاولة"
          onAction={() => void loadNotifications()}
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />}
          title="لا توجد إشعارات"
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => handleMarkRead(notif.id)}
              disabled={isOffline && !notif.read_status}
              aria-disabled={isOffline && !notif.read_status}
              className={`w-full text-right rounded-xl p-4 border transition-all disabled:cursor-not-allowed ${
                notif.read_status
                  ? 'bg-white border-gray-100'
                  : 'bg-blue-50/50 border-blue-100'
              }`}
            >
              <div className="flex gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeBg(notif.type)}`}
                >
                  {typeIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-sm truncate ${!notif.read_status ? 'text-gray-900' : 'text-gray-700'}`}
                    >
                      {notif.title_ar}
                    </h4>
                    {!notif.read_status && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                    {notif.message_ar}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {getTimeAgoLabel(notif.created_at)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import {
  Bell,
  Clock,
  FileText,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';

export function NotificationsPage() {
  const { currentUser } = useAuth();
  const { notifications, markNotificationRead } = useApp();

  if (!currentUser) return null;

  const userNotifications = notifications
    .filter(n => n.userId === currentUser.uid)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = userNotifications.filter(n => !n.readStatus).length;

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

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${days} يوم`;
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-gray-800">الإشعارات</h1>
          {unreadCount > 0 && (
            <span className="px-2.5 py-0.5 bg-red-500 text-white rounded-full text-xs">
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {userNotifications.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>لا توجد إشعارات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {userNotifications.map(notif => (
            <button
              key={notif.id}
              onClick={() => markNotificationRead(notif.id)}
              className={`w-full text-right rounded-xl p-4 border transition-all ${
                notif.readStatus
                  ? 'bg-white border-gray-100'
                  : 'bg-blue-50/50 border-blue-100'
              }`}
            >
              <div className="flex gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${typeBg(notif.type)}`}>
                  {typeIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-sm truncate ${!notif.readStatus ? 'text-gray-900' : 'text-gray-700'}`}>
                      {notif.titleAr}
                    </h4>
                    {!notif.readStatus && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{notif.messageAr}</p>
                  <p className="text-xs text-gray-400 mt-1">{getTimeAgo(notif.createdAt)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

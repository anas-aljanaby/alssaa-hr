import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTopBar } from '../../contexts/AppTopBarContext';
import * as departmentsService from '@/lib/services/departments.service';
import * as attendanceService from '@/lib/services/attendance.service';
import type { Department } from '@/lib/services/departments.service';
import { displayProfileEmail } from '@/lib/profileDisplay';
import {
  User,
  Shield,
  LogOut,
  ChevronLeft,
  FileText,
  Mail,
  Building2,
  Calendar,
  BadgeCheck,
  Clock,
  LoaderCircle,
  WandSparkles,
  Bell,
  BellOff,
  BellRing,
  Info,
} from 'lucide-react';
import {
  isPushSupported,
  getPushPermission,
  requestAndSubscribe,
} from '@/lib/push/push-manager';

export function MorePage() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<Department | null>(null);
  const [isRunningAutoPunchOut, setIsRunningAutoPunchOut] = useState(false);

  // ── push notification state ──────────────────────────────────────────────
  const pushSupported = isPushSupported();
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [showDeniedHint, setShowDeniedHint] = useState(false);

  useEffect(() => {
    if (!currentUser?.departmentId) return;
    departmentsService
      .getDepartmentById(currentUser.departmentId)
      .then(setDepartment)
      .catch(() => toast.error('فشل تحميل بيانات القسم'));
  }, [currentUser?.departmentId]);

  useEffect(() => {
    if (!pushSupported) return;
    const permission = getPushPermission();
    setPushPermission(permission);
    if (permission === 'granted') {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setIsSubscribed(!!sub))
        .catch(() => {});
    }
  }, [pushSupported]);

  useAppTopBar(currentUser ? { title: 'المزيد' } : null);

  if (!currentUser) return null;

  async function handleNotificationToggle() {
    if (!pushSupported || pushLoading) return;

    if (pushPermission === 'denied') {
      setShowDeniedHint((v) => !v);
      return;
    }

    // Already active — nothing to do
    if (pushPermission === 'granted' && isSubscribed) return;

    setPushLoading(true);
    try {
      const result = await requestAndSubscribe(currentUser.uid);
      setPushPermission(result);
      if (result === 'granted') {
        setIsSubscribed(true);
        toast.success('تم تفعيل إشعارات الجهاز');
      } else if (result === 'denied') {
        setShowDeniedHint(true);
      }
    } catch {
      toast.error('تعذر تفعيل الإشعارات');
    } finally {
      setPushLoading(false);
    }
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRunAutoPunchOut = async () => {
    if (isRunningAutoPunchOut) return;
    setIsRunningAutoPunchOut(true);
    try {
      const result = await attendanceService.runAutoPunchOut();
      if (result.total === 0 || result.message === 'No open sessions') {
        toast.success('لا توجد جلسات مفتوحة تحتاج إلى تسجيل انصراف تلقائي');
        return;
      }

      toast.success(
        result.total != null
          ? `تمت معالجة ${result.processed} من أصل ${result.total} جلسة مفتوحة`
          : `تم تسجيل الانصراف التلقائي لـ ${result.processed} مستخدم`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تشغيل الانصراف التلقائي';
      toast.error(message);
    } finally {
      setIsRunningAutoPunchOut(false);
    }
  };

  const menuSections = [
    {
      title: 'الحساب',
      items: [
        {
          icon: User,
          label: 'الملف الشخصي',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          onClick: () => navigate(`/user-details/${currentUser.uid}`),
        },
        {
          icon: Shield,
          label: 'الأمان والخصوصية',
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-50',
          onClick: () => navigate('/security-privacy'),
        },
        ...(currentUser.role === 'manager'
          ? [
              {
                icon: FileText,
                label: 'طلباتي',
                color: 'text-blue-500',
                bgColor: 'bg-blue-50',
                onClick: () => navigate('/requests'),
              } as const,
            ]
          : []),
      ],
    },
    {
      title: 'الدعم',
      items: [
        {
          icon: Clock,
          label: 'سياسة الحضور',
          color: 'text-slate-600',
          bgColor: 'bg-slate-50',
          onClick: () => navigate('/attendance-policy'),
        },
        {
          icon: FileText,
          label: 'الشروط والأحكام',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          onClick: () => navigate('/terms-conditions'),
        },
      ],
    },
    ...(currentUser.role === 'admin'
      ? [
          {
            title: 'إدارة النظام',
            items: [
              {
                    icon: Shield,
                    label: 'تغيير المدير العام',
                    color: 'text-purple-500',
                    bgColor: 'bg-purple-50',
                    onClick: () => navigate('/transfer-general-manager'),
                  },
              {
                icon: Bell,
                label: 'إعدادات الإشعارات',
                color: 'text-indigo-500',
                bgColor: 'bg-indigo-50',
                onClick: () => navigate('/notification-settings'),
              },
              {
                icon: Calendar,
                label: 'تسجيل الحضور',
                color: 'text-emerald-500',
                bgColor: 'bg-emerald-50',
                onClick: () => navigate('/attendance'),
              },
              {
                icon: Building2,
                label: 'إدارة الأقسام',
                color: 'text-amber-600',
                bgColor: 'bg-amber-50',
                onClick: () => navigate('/departments'),
              },
              {
                icon: FileText,
                label: 'طلباتي',
                color: 'text-blue-500',
                bgColor: 'bg-blue-50',
                onClick: () => navigate('/requests'),
              },
            ],
          } as const,
        ]
      : []),
    ...(currentUser.role === 'manager'
      ? [
          {
            title: 'الإدارة',
            items: [
              {
                icon: Building2,
                label: 'إدارة الأقسام',
                color: 'text-amber-600',
                bgColor: 'bg-amber-50',
                onClick: () => navigate('/departments'),
              },
            ],
          } as const,
        ]
      : []),
    ...(currentUser.role === 'employee'
      ? [
          {
            title: 'الأقسام',
            items: [
              {
                icon: Building2,
                label: 'الأقسام',
                color: 'text-amber-600',
                bgColor: 'bg-amber-50',
                onClick: () => navigate('/departments'),
              },
            ],
          } as const,
        ]
      : []),
    ...(currentUser.role === 'manager' || currentUser.role === 'admin'
      ? [
          {
            title: 'التقارير',
            items: [
              {
                icon: FileText,
                label: 'تقارير الحضور',
                color: 'text-indigo-500',
                bgColor: 'bg-indigo-50',
                onClick: () => navigate('/reports'),
              },
            ],
          } as const,
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 pb-24 pt-3">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl text-blue-600">{currentUser.nameAr.charAt(0)}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-gray-800">{currentUser.nameAr}</h2>
            <p className="text-sm text-gray-500">{displayProfileEmail(currentUser.email)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <BadgeCheck className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-blue-600">
                {currentUser.role === 'admin'
                  ? 'المدير العام'
                  : currentUser.role === 'manager'
                    ? 'مدير قسم'
                    : 'موظف'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span>{department?.name_ar ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{new Date(currentUser.joinDate).toLocaleDateString('ar-IQ')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="truncate" dir="ltr">
              {displayProfileEmail(currentUser.email)}
            </span>
          </div>
        </div>
      </div>

      {/* Device Notifications Row */}
      {pushSupported && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="text-xs text-gray-500">الجهاز</span>
          </div>
          <button
            type="button"
            onClick={() => void handleNotificationToggle()}
            disabled={pushLoading || (pushPermission === 'granted' && isSubscribed)}
            className="w-full flex items-center justify-between px-4 py-3.5 transition-colors disabled:cursor-default enabled:hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  pushPermission === 'granted' && isSubscribed
                    ? 'bg-emerald-50'
                    : pushPermission === 'denied'
                    ? 'bg-red-50'
                    : 'bg-gray-100'
                }`}
              >
                {pushLoading ? (
                  <LoaderCircle className="w-4.5 h-4.5 text-gray-400 animate-spin" />
                ) : pushPermission === 'granted' && isSubscribed ? (
                  <BellRing className="w-4.5 h-4.5 text-emerald-500" />
                ) : pushPermission === 'denied' ? (
                  <BellOff className="w-4.5 h-4.5 text-red-400" />
                ) : (
                  <Bell className="w-4.5 h-4.5 text-gray-400" />
                )}
              </div>
              <div className="text-right">
                <span className="text-sm text-gray-800">إشعارات الجهاز</span>
                <p className={`text-xs mt-0.5 ${
                  pushPermission === 'granted' && isSubscribed
                    ? 'text-emerald-600'
                    : pushPermission === 'denied'
                    ? 'text-red-400'
                    : 'text-gray-400'
                }`}>
                  {pushPermission === 'granted' && isSubscribed
                    ? 'مفعّلة'
                    : pushPermission === 'denied'
                    ? 'محظورة — اضغط لمعرفة كيفية التفعيل'
                    : 'غير مفعّلة — اضغط للتفعيل'}
                </p>
              </div>
            </div>
            {pushPermission === 'granted' && isSubscribed ? null : pushPermission === 'denied' ? (
              <Info className="w-4 h-4 text-red-300" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-300" />
            )}
          </button>

          {/* Denied state hint */}
          {showDeniedHint && pushPermission === 'denied' && (
            <div className="px-4 pb-4 pt-1 border-t border-gray-50">
              <p className="text-xs text-gray-500 leading-relaxed">
                لقد رفضت الإذن سابقاً. لإعادة تفعيل الإشعارات:
              </p>
              <ol className="mt-2 space-y-1 text-xs text-gray-500 list-decimal list-inside leading-relaxed">
                <li>افتح إعدادات المتصفح أو الجهاز</li>
                <li>ابحث عن هذا الموقع ضمن إعدادات الإشعارات</li>
                <li>غيّر الإذن إلى "السماح"</li>
                <li>أعد تحميل الصفحة</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Menu Sections */}
      {menuSections.map((section) => (
        <div
          key={section.title}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="text-xs text-gray-500">{section.title}</span>
          </div>
          {section.items.map((item, idx) => {
            const href = 'href' in item ? (item as { href?: string }).href : undefined;
            const content = (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.bgColor}`}
                  >
                    <item.icon className={`w-4.5 h-4.5 ${item.color}`} />
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-800">{item.label}</span>
                    {'subtitle' in item && item.subtitle && (
                      <p className="text-xs text-gray-400">{item.subtitle}</p>
                    )}
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-gray-300" />
              </>
            );
            return href ? (
              <Link
                key={idx}
                to={href}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                {content}
              </Link>
            ) : (
              <button
                key={idx}
                type="button"
                onClick={item.onClick}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                {content}
              </button>
            );
          })}
        </div>
      ))}

      {currentUser.role === 'admin' && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100">
            <span className="text-xs text-amber-700">إجراءات الحضور</span>
          </div>
          <button
            type="button"
            onClick={handleRunAutoPunchOut}
            disabled={isRunningAutoPunchOut}
            className="w-full flex items-center justify-between px-4 py-3.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 hover:bg-amber-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100">
                {isRunningAutoPunchOut ? (
                  <LoaderCircle className="w-4.5 h-4.5 text-amber-700 animate-spin" />
                ) : (
                  <WandSparkles className="w-4.5 h-4.5 text-amber-700" />
                )}
              </div>
              <div className="text-right">
                <span className="text-sm text-gray-800">تشغيل الانصراف التلقائي الآن</span>
                <p className="text-xs text-gray-400">يغلق الجلسات المفتوحة المطابقة للسياسة فقط</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors border border-red-100"
      >
        <LogOut className="w-5 h-5" />
        تسجيل الخروج
      </button>

      <p className="text-center text-xs text-gray-400 pb-4">
        الإصدار 1.0.0 - شبكة الساعة
      </p>
    </div>
  );
}

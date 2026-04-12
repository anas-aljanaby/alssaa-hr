import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { usePwa } from '../../contexts/PwaContext';
import { AppTopBarProvider, useAppTopBarState } from '../../contexts/AppTopBarContext';
import * as notificationsService from '@/lib/services/notifications.service';
import * as requestsService from '@/lib/services/requests.service';
import { NotificationsDropdown } from '@/app/components/notifications/NotificationsDropdown';
import {
  ChevronRight,
  Home,
  Clock,
  FileText,
  Bell,
  MoreHorizontal,
  Users,
  CheckSquare,
  UsersRound,
} from 'lucide-react';

const MOBILE_TOP_BAR_OFFSET = 'calc(env(safe-area-inset-top, 0px) + 3.5rem)';
const MOBILE_SAFE_AREA_TOP = 'env(safe-area-inset-top, 0px)';

export function MobileLayout() {
  return (
    <AppTopBarProvider>
      <MobileLayoutContent />
    </AppTopBarProvider>
  );
}

function MobileLayoutContent() {
  const { currentUser, authReady } = useAuth();
  const { isOffline, updateAvailable, applyUpdate, refreshApp } = usePwa();
  const navigate = useNavigate();
  const location = useLocation();
  const { topBar } = useAppTopBarState();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    if (isOffline) return;

    notificationsService
      .getUnreadCount(currentUser.uid)
      .then(setUnreadCount)
      .catch((e) => {
        console.warn('Failed to load unread notification count', e);
        setUnreadCount(0);
      });

    const unsubscribe = notificationsService.subscribeToNotifications(
      currentUser.uid,
      () => {
        notificationsService
          .getUnreadCount(currentUser.uid)
          .then(setUnreadCount)
          .catch((e) => console.warn('Failed to refresh unread count', e));
      }
    );

    return unsubscribe;
  }, [currentUser?.uid, isOffline]);

  useEffect(() => {
    if (!currentUser || location.pathname === '/notifications') return;
    if (isOffline) return;
    notificationsService
      .getUnreadCount(currentUser.uid)
      .then(setUnreadCount)
      .catch((e) => console.warn('Failed to load unread count', e));
  }, [location.pathname, currentUser?.uid, isOffline]);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!currentUser) {
      setPendingApprovals(0);
      return;
    }
    if (isOffline) return;

    async function loadPendingApprovals() {
      try {
        if (currentUser.role === 'admin') {
          const reqs = await requestsService.getAllPendingRequests();
          setPendingApprovals(reqs.length);
        } else if (currentUser.role === 'manager' && currentUser.departmentId) {
          const reqs = await requestsService.getPendingDepartmentRequests(currentUser.departmentId);
          setPendingApprovals(reqs.length);
        } else {
          setPendingApprovals(0);
        }
      } catch (e) {
        console.warn('Failed to load pending approvals count', e);
        setPendingApprovals(0);
      }
    }

    loadPendingApprovals();
  }, [currentUser?.uid, currentUser?.role, currentUser?.departmentId, location.pathname, isOffline]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }
  if (!currentUser) return <Navigate to="/login" replace />;

  const employeeNav = [
    { path: '/', icon: Home, label: 'الرئيسية' },
    { path: '/attendance', icon: Clock, label: 'الحضور' },
    { path: '/requests', icon: FileText, label: 'الطلبات' },
    { path: '/team-attendance', icon: UsersRound, label: 'حضور الفريق' },
    { path: '/more', icon: MoreHorizontal, label: 'المزيد' },
  ];

  const managerNav = [
    { path: '/', icon: Home, label: 'الرئيسية' },
    { path: '/attendance', icon: Clock, label: 'الحضور' },
    { path: '/approvals', icon: CheckSquare, label: 'الموافقات', badge: pendingApprovals },
    { path: '/team-attendance', icon: UsersRound, label: 'حضور الفريق' },
    { path: '/more', icon: MoreHorizontal, label: 'المزيد' },
  ];

  const adminNav = [
    { path: '/', icon: Home, label: 'الرئيسية' },
    { path: '/users', icon: Users, label: 'المستخدمون' },
    { path: '/approvals', icon: CheckSquare, label: 'الموافقات', badge: pendingApprovals },
    { path: '/team-attendance', icon: UsersRound, label: 'حضور الفريق' },
    { path: '/more', icon: MoreHorizontal, label: 'المزيد' },
  ];

  const navItems =
    currentUser.role === 'admin'
      ? adminNav
      : currentUser.role === 'manager'
        ? managerNav
        : employeeNav;

  const currentPath = location.pathname;
  const currentPathSegments = currentPath.split('/');
  const currentPathUserId = currentPathSegments[2];
  const defaultTopBar = (() => {
    const departmentPageTitle =
      currentUser.role === 'admin' || currentUser.role === 'manager' ? 'إدارة الأقسام' : 'صفحة الأقسام';

    if (currentPath === '/') return { title: 'الرئيسية' };
    if (currentPath.startsWith('/attendance-policy')) {
      return { title: 'سياسة الحضور', backPath: '/more' as const };
    }
    if (currentPath.startsWith('/team-attendance')) return { title: 'حضور الفريق' };
    if (currentPath.startsWith('/attendance')) return { title: 'الحضور والانصراف' };
    if (currentPath.startsWith('/requests')) return { title: 'الطلبات' };
    if (currentPath.startsWith('/notifications')) return { title: 'الإشعارات' };
    if (currentPath.startsWith('/more')) return { title: 'المزيد' };
    if (currentPath.startsWith('/security-privacy')) {
      return { title: 'الأمان والخصوصية', backPath: '/more' as const };
    }
    if (currentPath.startsWith('/terms-conditions')) {
      return { title: 'الشروط والأحكام', backPath: '/more' as const };
    }
    if (currentPath.startsWith('/approvals')) return { title: 'الموافقات' };
    if (currentPath === '/users') return { title: 'إدارة المستخدمين' };
    if (currentPath === '/departments') return { title: departmentPageTitle, backPath: '/more' as const };
    if (currentPath.startsWith('/departments/')) {
      return { title: 'تفاصيل القسم', backPath: '/departments' as const };
    }
    if (currentPath.startsWith('/reports')) return { title: 'التقارير', backPath: '/more' as const };
    if (currentPath.startsWith('/transfer-general-manager')) {
      return { title: 'تغيير المدير العام', backPath: '/more' as const };
    }
    if (currentPath.startsWith('/user-details/')) {
      return {
        title: currentPathUserId === currentUser.uid ? 'الملف الشخصي' : 'تفاصيل الموظف',
      };
    }
    return { title: '' };
  })();
  const resolvedTopBar = {
    ...defaultTopBar,
    ...topBar,
  };

  const isMoreRelatedPath = () => {
    if (currentPath === '/more') return true;

    const moreRoutes = [
      '/attendance-policy',
      '/security-privacy',
      '/terms-conditions',
      '/reports',
      '/departments',
      '/transfer-general-manager',
    ];

    if (moreRoutes.some((route) => currentPath.startsWith(route))) return true;

    // Treat self profile as part of "More" for a consistent return path.
    if (currentPath.startsWith('/user-details') && currentPathUserId === currentUser.uid) return true;

    return false;
  };

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    if (path === '/more') return isMoreRelatedPath();
    if (path === '/users' && currentPath.startsWith('/user-details')) {
      return currentPathUserId !== currentUser.uid;
    }
    return currentPath.startsWith(path);
  };

  const handleTopBarBack = () => {
    if (!resolvedTopBar.backPath) return;
    if (resolvedTopBar.backPath === 'back') {
      navigate(-1);
      return;
    }
    navigate(resolvedTopBar.backPath);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-background flex flex-col"
      style={{ '--mobile-top-bar-offset': MOBILE_TOP_BAR_OFFSET } as React.CSSProperties}
    >
      <div
        className="fixed inset-x-0 top-0 z-[1000] bg-white shadow-[0_1px_8px_rgba(15,23,42,0.08)]"
        style={{ paddingTop: MOBILE_SAFE_AREA_TOP }}
      >
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            {resolvedTopBar.backPath ? (
              <button
                type="button"
                onClick={handleTopBarBack}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
                aria-label="رجوع"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-gray-900">
                {resolvedTopBar.title}
              </h1>
              {resolvedTopBar.meta ? (
                <div className="inline-flex max-w-[10rem] items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                  <span className="truncate">{resolvedTopBar.meta}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {resolvedTopBar.action}
<button
              type="button"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              aria-label="الإشعارات"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {notificationsOpen && (
        <NotificationsDropdown userId={currentUser.uid} onClose={() => setNotificationsOpen(false)} />
      )}

      <div className="flex-1 pb-20" style={{ paddingTop: 'var(--mobile-top-bar-offset, 3.5rem)' }}>
        <div className="sticky top-0 z-30 px-4 pt-2 space-y-2">
          {isOffline && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm">أنت الآن في وضع عدم الاتصال.</p>
                <p className="text-xs opacity-80">يمكنك تصفح الواجهة، لكن العمليات تحتاج إلى الإنترنت.</p>
              </div>
              <button
                type="button"
                onClick={refreshApp}
                className="shrink-0 rounded-xl bg-white text-amber-900 px-3 py-2 text-xs border border-amber-200"
              >
                إعادة تحميل
              </button>
            </div>
          )}

          {updateAvailable && (
            <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm">يوجد تحديث جديد للتطبيق.</p>
                <p className="text-xs opacity-80">ثبّت التحديث لإعادة تحميل أحدث نسخة.</p>
              </div>
              <button
                type="button"
                onClick={() => void applyUpdate()}
                className="shrink-0 rounded-xl bg-blue-600 text-white px-3 py-2 text-xs"
              >
                تحديث الآن
              </button>
            </div>
          )}
        </div>

        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 z-[1100] safe-area-bottom">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all relative ${
                  active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <div className="relative">
                  <item.icon className={`w-5 h-5 ${active ? 'text-blue-600' : ''}`} />
                  {'badge' in item && (item as any).badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">
                      {(item as any).badge}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] mt-1 ${active ? 'text-blue-600' : ''}`}>
                  {item.label}
                </span>
                {active && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

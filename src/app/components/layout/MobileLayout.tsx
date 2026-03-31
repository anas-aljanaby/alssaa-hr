import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import * as notificationsService from '@/lib/services/notifications.service';
import * as requestsService from '@/lib/services/requests.service';
import {
  Home,
  Clock,
  FileText,
  Bell,
  MoreHorizontal,
  Users,
  CheckSquare,
  BarChart3,
  Building2,
} from 'lucide-react';

export function MobileLayout() {
  const { currentUser, authReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

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
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser || location.pathname === '/notifications') return;
    notificationsService
      .getUnreadCount(currentUser.uid)
      .then(setUnreadCount)
      .catch((e) => console.warn('Failed to load unread count', e));
  }, [location.pathname, currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) {
      setPendingApprovals(0);
      return;
    }

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
  }, [currentUser?.uid, currentUser?.role, currentUser?.departmentId, location.pathname]);

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
    { path: '/notifications', icon: Bell, label: 'الإشعارات', badge: unreadCount },
    { path: '/more', icon: MoreHorizontal, label: 'المزيد' },
  ];

  const managerNav = [
    { path: '/', icon: Home, label: 'الرئيسية' },
    { path: '/attendance', icon: Clock, label: 'الحضور' },
    { path: '/approvals', icon: CheckSquare, label: 'الموافقات', badge: pendingApprovals },
    { path: '/notifications', icon: Bell, label: 'الإشعارات', badge: unreadCount },
    { path: '/more', icon: MoreHorizontal, label: 'المزيد' },
  ];

  const adminNav = [
    { path: '/', icon: Home, label: 'الرئيسية' },
    { path: '/users', icon: Users, label: 'المستخدمون' },
    { path: '/approvals', icon: CheckSquare, label: 'الموافقات', badge: pendingApprovals },
    { path: '/notifications', icon: Bell, label: 'الإشعارات', badge: unreadCount },
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

  return (
    <div dir="rtl" className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 pb-20 overflow-auto">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 z-50 safe-area-bottom">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
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

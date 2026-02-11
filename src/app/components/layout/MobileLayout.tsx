import React from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import {
  Home,
  Clock,
  FileText,
  Bell,
  MoreHorizontal,
  Users,
  CheckSquare,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  Building2,
} from 'lucide-react';

export function MobileLayout() {
  const { currentUser, authReady, logout } = useAuth();
  const { getUnreadCount } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }
  if (!currentUser) return <Navigate to="/login" replace />;

  const unreadCount = getUnreadCount(currentUser.uid);

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
    { path: '/approvals', icon: CheckSquare, label: 'الموافقات' },
    { path: '/notifications', icon: Bell, label: 'الإشعارات', badge: unreadCount },
    { path: '/more', icon: MoreHorizontal, label: 'المزيد' },
  ];

  const adminNav = [
    { path: '/', icon: Home, label: 'الرئيسية' },
    { path: '/users', icon: Users, label: 'المستخدمون' },
    { path: '/departments', icon: Building2, label: 'الأقسام' },
    { path: '/reports', icon: BarChart3, label: 'التقارير' },
    { path: '/more', icon: MoreHorizontal, label: 'المزيد' },
  ];

  const navItems = currentUser.role === 'admin' ? adminNav : currentUser.role === 'manager' ? managerNav : employeeNav;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    // Special handling for user details page - keep /users tab active
    if (path === '/users' && location.pathname.startsWith('/user-details')) return true;
    return location.pathname.startsWith(path);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <div className="flex-1 pb-20 overflow-auto">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
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
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] mt-1 ${active ? 'text-blue-600' : ''}`}>{item.label}</span>
                {active && <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
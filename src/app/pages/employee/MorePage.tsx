import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePwa } from '../../contexts/PwaContext';
import * as departmentsService from '@/lib/services/departments.service';
import type { Department } from '@/lib/services/departments.service';
import { displayProfileEmail } from '@/lib/profileDisplay';
import {
  User,
  Settings,
  Shield,
  LogOut,
  ChevronLeft,
  FileText,
  Mail,
  Building2,
  Calendar,
  BadgeCheck,
  Clock,
  Download,
  RefreshCw,
  Smartphone,
} from 'lucide-react';

export function MorePage() {
  const { currentUser, logout } = useAuth();
  const { isInstalled, isInstallable, isOffline, updateAvailable, install, applyUpdate, refreshApp } = usePwa();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<Department | null>(null);

  useEffect(() => {
    if (!currentUser?.departmentId) return;
    departmentsService
      .getDepartmentById(currentUser.departmentId)
      .then(setDepartment)
      .catch(() => toast.error('فشل تحميل بيانات القسم'));
  }, [currentUser?.departmentId]);

  if (!currentUser) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
      title: 'التطبيق',
      items: [
        ...(!isInstalled
          ? [
              {
                icon: Smartphone,
                label: isInstallable ? 'تثبيت التطبيق' : 'إضافة للشاشة الرئيسية',
                subtitle: isInstallable
                  ? 'تثبيت مباشر للوصول السريع من الهاتف'
                  : 'يمكنك إضافته للشاشة الرئيسية من قائمة المتصفح',
                color: 'text-blue-600',
                bgColor: 'bg-blue-50',
                onClick: () => {
                  void install();
                },
              } as const,
            ]
          : []),
        ...(updateAvailable
          ? [
              {
                icon: Download,
                label: 'تثبيت التحديث الجديد',
                subtitle: 'سيعاد تحميل التطبيق بعد التحديث',
                color: 'text-emerald-600',
                bgColor: 'bg-emerald-50',
                onClick: () => {
                  void applyUpdate();
                },
              } as const,
            ]
          : []),
        {
          icon: RefreshCw,
          label: 'إعادة تحميل التطبيق',
          subtitle: isOffline
            ? 'سيحاول استعادة أحدث حالة عند توفر الإنترنت'
            : 'تحديث يدوي للواجهة والبيانات',
          color: 'text-slate-600',
          bgColor: 'bg-slate-50',
          onClick: () => refreshApp(),
        },
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
                icon: Calendar,
                label: 'تسجيل الحضور',
                color: 'text-emerald-500',
                bgColor: 'bg-emerald-50',
                onClick: () => navigate('/attendance'),
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
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-gray-800">المزيد</h1>

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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTopBar } from '../../contexts/AppTopBarContext';
import { toast } from 'sonner';
import * as profilesService from '@/lib/services/profiles.service';
import * as departmentsService from '@/lib/services/departments.service';
import { workScheduleSchema } from '@/lib/validations';
import { getDeleteUserErrorMessage, getProfileUpdateErrorMessage } from '@/lib/errorMessages';
import * as attendanceService from '@/lib/services/attendance.service';
import * as leaveBalanceService from '@/lib/services/leave-balance.service';
import * as requestsService from '@/lib/services/requests.service';
import * as auditService from '@/lib/services/audit.service';
import {
  formatRequestCalendarDate,
  formatRequestDateTime,
  formatRequestTime,
  isFullDayLeaveRequestType,
} from '@/lib/requestDateDisplay';
import * as XLSX from 'xlsx';
import { getRequestTypeAr, getStatusAr } from '../../data/mockData';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import type { Profile } from '@/lib/services/profiles.service';
import type { Department } from '@/lib/services/departments.service';
import type {
  AttendanceHistoryDay,
  AttendanceHistoryStats,
  TodayRecord,
} from '@/lib/services/attendance.service';
import type { LeaveBalance } from '@/lib/services/leave-balance.service';
import type { LeaveRequest } from '@/lib/services/requests.service';
import type { AuditLog } from '@/lib/services/audit.service';
import {
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  Users,
  User as UserIcon,
  Building2,
  Edit2,
  MoreVertical,
  FileText,
  History,
  Trash2,
  X,
  Download,
  TimerReset,
  ClipboardList,
} from 'lucide-react';
import { AttendanceHistoryList } from '../../components/attendance/AttendanceHistoryList';
import { StatCard } from '../../components/shared/StatCard';
import { useBodyScrollLock } from '@/app/hooks/useBodyScrollLock';
import {
  getStatusConfig,
  type DisplayStatus,
} from '@/shared/attendance';
import { resolveTodayRecordDisplayStatus } from '@/shared/attendance/todayRecord';
import { toWorkSchedule, type WorkSchedule } from '@/shared/attendance/workSchedule';
import { WorkScheduleEditor } from '@/shared/attendance/WorkScheduleEditor';
import { StatusBadge } from '@/shared/components';

const DAY_LABELS_AR: Record<string, string> = {
  '0': 'الأحد',
  '1': 'الإثنين',
  '2': 'الثلاثاء',
  '3': 'الأربعاء',
  '4': 'الخميس',
  '5': 'الجمعة',
  '6': 'السبت',
};

type AttendanceFilter =
  | 'all'
  | 'fulfilled_shift'
  | 'incomplete_shift'
  | 'late'
  | 'absent'
  | 'on_leave'
  | 'overtime';

const ATTENDANCE_FILTER_OPTIONS: Array<{ key: AttendanceFilter; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'fulfilled_shift', label: getStatusConfig('fulfilled_shift').label },
  { key: 'incomplete_shift', label: getStatusConfig('incomplete_shift').label },
  { key: 'late', label: getStatusConfig('late').label },
  { key: 'absent', label: getStatusConfig('absent').label },
  { key: 'on_leave', label: getStatusConfig('on_leave').label },
  { key: 'overtime', label: 'عمل إضافي' },
];

function getDisplayEmail(email: string | null): string {
  const value = email?.trim();
  return value && value.length > 0 ? value : '—';
}

function resolveTodayDisplayStatus(todayRecord: TodayRecord, at: Date): DisplayStatus {
  return resolveTodayRecordDisplayStatus(todayRecord, at);
}

function getTodayFirstCheckIn(todayRecord: TodayRecord | null): string | null {
  if (!todayRecord) return null;
  return (
    todayRecord.summary?.first_check_in ??
    [...(todayRecord.sessions ?? [])].sort((a, b) => a.check_in_time.localeCompare(b.check_in_time))[0]
      ?.check_in_time ??
    null
  );
}

const identityEditSchema = z.object({
  name_ar: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  email: z
    .string()
    .optional()
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      'البريد الإلكتروني غير صالح'
    ),
});
type IdentityEditFormData = z.infer<typeof identityEditSchema>;

const scheduleEditSchema = z.object({
  work_schedule: workScheduleSchema,
});
type ScheduleEditFormData = z.infer<typeof scheduleEditSchema>;

function getCurrentWorkSchedule(profile: Profile): WorkSchedule {
  return toWorkSchedule(profile.work_schedule);
}

export function UserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [userRequests, setUserRequests] = useState<LeaveRequest[]>([]);
  const [allTimeHistory, setAllTimeHistory] = useState<AttendanceHistoryDay[]>([]);
  const [rangeHistory, setRangeHistory] = useState<AttendanceHistoryDay[]>([]);
  const [allTimeStats, setAllTimeStats] = useState<AttendanceHistoryStats | null>(null);
  const [userAuditLogs, setUserAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'leaves' | 'requests'>(
    'overview'
  );
  const [requestFilter, setRequestFilter] = useState<'all' | LeaveRequest['status']>('all');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all');
  const [attendanceViewMode, setAttendanceViewMode] = useState<'all_time' | 'range'>('all_time');
  const [dateFrom, setDateFrom] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  });
  const [showIdentityEditModal, setShowIdentityEditModal] = useState(false);
  const [showScheduleEditModal, setShowScheduleEditModal] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [showLeaveBalanceModal, setShowLeaveBalanceModal] = useState(false);
  const [updatingLeaveBalance, setUpdatingLeaveBalance] = useState(false);
  const [editAnnualTotal, setEditAnnualTotal] = useState('');
  useBodyScrollLock(
    showIdentityEditModal ||
    showScheduleEditModal ||
    showDeleteConfirm ||
    showAuditLog ||
    showLeaveBalanceModal
  );

  const identityEditForm = useForm<IdentityEditFormData>({
    resolver: zodResolver(identityEditSchema),
    defaultValues: {
      name_ar: '',
      email: '',
    },
  });

  const scheduleEditForm = useForm<ScheduleEditFormData>({
    resolver: zodResolver(scheduleEditSchema),
    defaultValues: {
      work_schedule: {},
    },
  });

  const backPath = useMemo(() => {
    if (!currentUser) return '/';
    if (currentUser.role === 'admin') {
      return currentUser.uid === userId ? '/more' : '/users';
    }
    if (currentUser.role === 'manager') return '/approvals';
    return '/more';
  }, [currentUser, userId]);

  const handleBack = useCallback(() => {
    navigate(backPath);
  }, [backPath, navigate]);

  const todayFirstCheckIn = useMemo(() => getTodayFirstCheckIn(todayRecord), [todayRecord]);

  const canAccess = useMemo(() => {
    if (!currentUser || !userId) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'employee') return currentUser.uid === userId;
    if (currentUser.role === 'manager') return true;
    return false;
  }, [currentUser, userId]);

  useEffect(() => {
    if (!userId || !canAccess) return;
    loadData();
  }, [userId, canAccess]);

  useEffect(() => {
    if (!userId || attendanceViewMode !== 'range') return;
    attendanceService
      .getAttendanceHistoryRange(userId, dateFrom, dateTo)
      .then(setRangeHistory)
      .catch(() => toast.error('فشل تحميل سجلات الحضور'));
  }, [userId, dateFrom, dateTo, attendanceViewMode]);

  const requestFromUrl = searchParams.get('request');

  useEffect(() => {
    if (!requestFromUrl || !userId || loading) return;
    setActiveTab('requests');
    setRequestFilter('all');
  }, [requestFromUrl, userId, loading]);

  useEffect(() => {
    if (!requestFromUrl || loading || activeTab !== 'requests') return;
    const t = window.setTimeout(() => {
      document.getElementById(`request-card-${requestFromUrl}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 200);
    return () => clearTimeout(t);
  }, [requestFromUrl, loading, activeTab, userRequests.length]);

  const openIdentityEditModal = useCallback(() => {
    if (!profile) return;
    setShowIdentityEditModal(true);
    identityEditForm.reset({
      name_ar: profile.name_ar,
      email: profile.email ?? '',
    });
  }, [profile, identityEditForm]);

  const openScheduleEditModal = useCallback(() => {
    if (!profile) return;
    setShowScheduleEditModal(true);
    scheduleEditForm.reset({
      work_schedule: getCurrentWorkSchedule(profile),
    });
  }, [profile, scheduleEditForm]);

  useEffect(() => {
    if (searchParams.get('edit') !== '1') return;
    if (!profile || currentUser?.role !== 'admin') return;
    openIdentityEditModal();
  }, [searchParams, profile, currentUser?.role, openIdentityEditModal]);
 
  const handleIdentityEditModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowIdentityEditModal(false);
      identityEditForm.reset();
    }
  }, [identityEditForm]);

  const handleScheduleEditModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowScheduleEditModal(false);
      scheduleEditForm.reset();
    }
  }, [scheduleEditForm]);

  const handleDeleteModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !deletingUser) {
      setShowDeleteConfirm(false);
    }
  }, [deletingUser]);

  const openLeaveBalanceModal = useCallback(() => {
    if (!leaveBalance) return;
    setEditAnnualTotal(String(leaveBalance.total_annual));
    setShowLeaveBalanceModal(true);
  }, [leaveBalance]);

  const closeLeaveBalanceModal = useCallback(() => {
    if (updatingLeaveBalance) return;
    setShowLeaveBalanceModal(false);
  }, [updatingLeaveBalance]);

  const handleLeaveBalanceUpdate = useCallback(async () => {
    if (!profile || !leaveBalance) return;
    const nextAnnualTotal = Number(editAnnualTotal);

    if (!Number.isFinite(nextAnnualTotal)) {
      toast.error('يرجى إدخال أرقام صحيحة');
      return;
    }
    if (nextAnnualTotal < 0) {
      toast.error('لا يمكن أن تكون القيم سالبة');
      return;
    }

    const usedAnnual = leaveBalance.used_annual;

    try {
      setUpdatingLeaveBalance(true);
      const updated = await leaveBalanceService.updateBalance(profile.id, {
        total_annual: nextAnnualTotal,
        remaining_annual: Math.max(nextAnnualTotal - usedAnnual, 0),
      });
      setLeaveBalance(updated);
      toast.success('تم تحديث رصيد الإجازات للموظف');
      setShowLeaveBalanceModal(false);
    } catch {
      toast.error('فشل تحديث رصيد الإجازات');
    } finally {
      setUpdatingLeaveBalance(false);
    }
  }, [profile, leaveBalance, editAnnualTotal]);



  async function loadData() {
    if (!userId) return;
    try {
      setLoading(true);
      const [prof, today, balance, reqs, audit, allHistory, rangeDays] = await Promise.all([
        profilesService.getUserById(userId),
        attendanceService.getAttendanceToday(userId),
        leaveBalanceService.getUserBalance(userId),
        requestsService.getUserRequests(userId),
        auditService.getAuditLogsForTarget(userId),
        attendanceService.getAttendanceHistoryAllTime(userId),
        attendanceService.getAttendanceHistoryRange(userId, dateFrom, dateTo),
      ]);
      setProfile(prof);
      setTodayRecord(today);
      setLeaveBalance(balance);
      setUserRequests(reqs);
      setUserAuditLogs(audit.slice(0, 10));
      setAllTimeHistory(allHistory);
      setRangeHistory(rangeDays);
      setAllTimeStats(attendanceService.calculateAttendanceHistoryStats(allHistory));

      if (prof?.department_id) {
        const dept = await departmentsService.getDepartmentById(prof.department_id);
        setDepartment(dept);
      }
    } catch {
      toast.error('فشل تحميل بيانات الموظف');
    } finally {
      setLoading(false);
    }
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'مدير عام';
      case 'manager': return 'مدير قسم';
      case 'employee': return 'موظف';
      default: return role;
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'manager': return 'bg-emerald-100 text-emerald-700';
      case 'employee': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'manager': return <Users className="w-4 h-4" />;
      default: return <UserIcon className="w-4 h-4" />;
    }
  };

  const statusColor = (status: LeaveRequest['status']) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredRequests =
    requestFilter === 'all'
      ? userRequests
      : userRequests.filter((r) => r.status === requestFilter);
  const displayedHistory = attendanceViewMode === 'all_time' ? allTimeHistory : rangeHistory;
  const todayDisplayStatus = useMemo(
    () => (todayRecord ? resolveTodayDisplayStatus(todayRecord, new Date()) : null),
    [todayRecord]
  );
  const todayStatusConfig = todayDisplayStatus ? getStatusConfig(todayDisplayStatus) : null;
  const filteredHistory =
    attendanceFilter === 'all'
      ? displayedHistory
      : displayedHistory.filter((day) =>
          attendanceFilter === 'overtime'
            ? day.hasOvertime
            : day.primaryState === attendanceFilter
        );
  const onIdentityEditSubmit = async (data: IdentityEditFormData) => {
    if (!profile) return;
    const oldEmail = (profile.email ?? '').trim().toLowerCase();
    const nextEmail = (data.email ?? '').trim().toLowerCase();
    const emailChanged = nextEmail !== oldEmail;
    if (emailChanged) {
      const confirmed = window.confirm(
        'تغيير البريد الإلكتروني إجراء حساس وقد يؤثر على تسجيل الدخول لهذا المستخدم. هل تريد المتابعة؟'
      );
      if (!confirmed) return;
    }
    setEditSubmitting(true);
    try {
      await profilesService.updateUser(profile.id, {
        name_ar: data.name_ar.trim(),
        email: data.email?.trim() || null,
        role: profile.role,
        department_id: profile.department_id,
        work_schedule: profile.work_schedule,
      });
      toast.success('تم تحديث المستخدم');
      setShowIdentityEditModal(false);
      identityEditForm.reset();
      await loadData();
    } catch (err) {
      toast.error(getProfileUpdateErrorMessage(err, 'فشل تحديث المستخدم'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const onScheduleEditSubmit = async (data: ScheduleEditFormData) => {
    if (!profile) return;
    setEditSubmitting(true);
    try {
      await profilesService.updateUser(profile.id, {
        name_ar: profile.name_ar,
        email: profile.email?.trim() || null,
        role: profile.role,
        department_id: profile.department_id,
        work_schedule: (data.work_schedule ?? {}) as never,
      });
      toast.success('تم تحديث جدول العمل');
      setShowScheduleEditModal(false);
      scheduleEditForm.reset();
      await loadData();
    } catch (err) {
      toast.error(getProfileUpdateErrorMessage(err, 'فشل تحديث جدول العمل'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const canDeleteUser =
    currentUser?.role === 'admin' &&
    !!profile &&
    currentUser.uid !== profile.id &&
    profile.role !== 'admin';

  const handleDeleteUser = async () => {
    if (!profile) return;
    setDeletingUser(true);
    try {
      await profilesService.deleteUser({ user_id: profile.id });
      toast.success('تم حذف المستخدم');
      setShowDeleteConfirm(false);
      navigate('/users');
    } catch (err) {
      const msg = getDeleteUserErrorMessage(
        err,
        (err as { response?: { error?: string; code?: string } })?.response
      );
      toast.error(msg);
    } finally {
      setDeletingUser(false);
    }
  };

  const handleExportAttendance = () => {
    if (filteredHistory.length === 0 || !profile) return;
    const rows = filteredHistory.map((day) => ({
      'التاريخ': day.date,
      'الحالة': getStatusConfig(day.primaryState).label,
      'أول دخول': day.firstCheckIn ?? '—',
      'آخر خروج': day.lastCheckOut ?? '—',
      'دقائق عادية': day.totalRegularMinutes,
      'دقائق إضافية': day.totalOvertimeMinutes,
      'إجمالي الدقائق': day.totalWorkedMinutes,
      'عدد الجلسات': day.sessionCount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل الحضور');
    const name = `حضور_${profile.name_ar}_${dateFrom}_إلى_${dateTo}.xlsx`;
    XLSX.writeFile(wb, name);
  };
  const canDeleteTopBarUser =
    currentUser?.role === 'admin' &&
    !!profile &&
    currentUser.uid !== profile.id &&
    profile.role !== 'admin';
  const topBarAction = useMemo(
    () =>
      currentUser?.role === 'admin' ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowAuditLog(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
            aria-label="سجل النشاط"
          >
            <History className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
                aria-label="خيارات إضافية"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!canDeleteTopBarUser || deletingUser}
                variant="destructive"
                onSelect={() => setShowDeleteConfirm(true)}
                className="cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                حذف المستخدم
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null,
    [canDeleteTopBarUser, currentUser?.role, deletingUser]
  );

  useAppTopBar(
    currentUser
      ? {
          title: currentUser.uid === userId ? 'الملف الشخصي' : 'تفاصيل الموظف',
          meta: profile?.name_ar,
          backPath,
          action: topBarAction,
        }
      : null
  );

  if (!currentUser || !userId) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-red-50 rounded-xl p-6 text-center border border-red-100">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-800">خطأ في تحميل البيانات</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-amber-50 rounded-xl p-6 text-center border border-amber-100">
          <Shield className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-gray-800 mb-2">غير مصرح</h2>
          <p className="text-amber-800 text-sm mb-4">ليس لديك صلاحية لعرض تفاصيل هذا الموظف</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-gray-100 rounded-2xl h-48 animate-pulse" />
        <div className="bg-gray-100 rounded-xl h-12 animate-pulse" />
        <div className="bg-gray-100 rounded-2xl h-40 animate-pulse" />
        <div className="bg-gray-100 rounded-2xl h-32 animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-100">
          <p className="text-gray-600">الموظف غير موجود</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 pb-20 pt-3">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div
              className={`w-16 h-16 shrink-0 rounded-full flex items-center justify-center text-xl ${
                profile.role === 'admin'
                  ? 'bg-purple-100 text-purple-600'
                  : profile.role === 'manager'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-blue-100 text-blue-600'
              }`}
            >
              {profile.name_ar.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-gray-800">{profile.name_ar}</h2>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-600 min-w-0">
                <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-hidden />
                <span className="truncate">{department?.name_ar ?? 'بدون قسم'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs inline-flex items-center gap-1 ${roleColor(profile.role)}`}
                >
                  {roleIcon(profile.role)}
                  {roleLabel(profile.role)}
                </span>
              </div>
            </div>
          </div>
          {currentUser?.role === 'admin' && (
            <div className="shrink-0 flex min-w-[8.75rem] flex-col items-stretch gap-2">
              <button
                type="button"
                onClick={openIdentityEditModal}
                className="self-end rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
                aria-label="تعديل الاسم واسم المستخدم"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={openScheduleEditModal}
                className="flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 shadow-sm shadow-blue-100/50 transition-colors hover:bg-blue-100"
                aria-label="تعديل جدول العمل"
              >
                <Clock className="h-4 w-4" />
                <span>تعديل جدول العمل</span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="truncate" dir="ltr">
              {getDisplayEmail(profile.email)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl p-1 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              { key: 'overview', label: 'نظرة عامة' },
              { key: 'attendance', label: 'الحضور' },
              { key: 'leaves', label: 'الإجازات' },
              { key: 'requests', label: 'الطلبات' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <h3 className="text-sm text-gray-600 mb-3">حالة اليوم</h3>
            {todayDisplayStatus && todayStatusConfig ? (
              <div
                className={`p-3 rounded-xl border ${todayStatusConfig.bgColor} ${todayStatusConfig.borderColor}`}
              >
                <div className="flex items-center justify-between">
                  <StatusBadge status={todayDisplayStatus} />
                  {todayFirstCheckIn && (
                    <span className="text-xs text-gray-600" dir="ltr">
                      دخول: {todayFirstCheckIn}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">لا توجد بيانات لليوم</p>
            )}
          </div>

          {allTimeStats && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h3 className="text-sm text-gray-600 mb-3">إحصائيات كل الوقت</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  label="دوام مكتمل"
                  value={allTimeStats.fulfilledShiftDays}
                  color="bg-emerald-50 border-emerald-100"
                  onClick={() => {
                    setActiveTab('attendance');
                    setAttendanceViewMode('all_time');
                    setAttendanceFilter('fulfilled_shift');
                  }}
                />
                <StatCard
                  icon={<TimerReset className="w-5 h-5 text-sky-500" />}
                  label="دوام غير مكتمل"
                  value={allTimeStats.incompleteShiftDays}
                  color="bg-sky-50 border-sky-100"
                  onClick={() => {
                    setActiveTab('attendance');
                    setAttendanceViewMode('all_time');
                    setAttendanceFilter('incomplete_shift');
                  }}
                />
                <StatCard
                  icon={<Clock className="w-5 h-5 text-amber-500" />}
                  label="أيام التأخير"
                  value={allTimeStats.lateDays}
                  color="bg-amber-50 border-amber-100"
                  onClick={() => {
                    setActiveTab('attendance');
                    setAttendanceViewMode('all_time');
                    setAttendanceFilter('late');
                  }}
                />
                <StatCard
                  icon={<XCircle className="w-5 h-5 text-red-500" />}
                  label="أيام الغياب"
                  value={allTimeStats.absentDays}
                  color="bg-red-50 border-red-100"
                  onClick={() => {
                    setActiveTab('attendance');
                    setAttendanceViewMode('all_time');
                    setAttendanceFilter('absent');
                  }}
                />
                <StatCard
                  icon={<Calendar className="w-5 h-5 text-blue-500" />}
                  label="أيام الإجازة"
                  value={allTimeStats.leaveDays}
                  color="bg-blue-50 border-blue-100"
                  onClick={() => {
                    setActiveTab('attendance');
                    setAttendanceViewMode('all_time');
                    setAttendanceFilter('on_leave');
                  }}
                />
                <StatCard
                  icon={<ClipboardList className="w-5 h-5 text-slate-500" />}
                  label="أيام إضافي"
                  value={allTimeStats.overtimeDays}
                  color="bg-slate-50 border-slate-200"
                  onClick={() => {
                    setActiveTab('attendance');
                    setAttendanceViewMode('all_time');
                    setAttendanceFilter('overtime');
                  }}
                />
              </div>
            </div>
          )}

        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-3">
          {/* Work schedule card: show days and times; admin can edit */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">جدول العمل</h3>
              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={openScheduleEditModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="تعديل جدول العمل"
                >
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
            {(() => {
              const schedule = toWorkSchedule(profile.work_schedule);
              const hasSchedule = Object.keys(schedule).length > 0;
              if (!hasSchedule) {
                return <p className="text-sm text-gray-500">حسب إعدادات المنظمة</p>;
              }
              return (
                <div className="text-xs text-gray-700 space-y-1" dir="rtl">
                  {(['0', '1', '2', '3', '4', '5', '6'] as const).map((key) => {
                    const day = schedule[key];
                    return (
                      <div key={key} className="flex justify-between border-b border-dashed border-gray-100 last:border-0 py-1">
                        <span className="text-gray-500">{DAY_LABELS_AR[key]}</span>
                        {day ? (
                          <span dir="ltr" className="text-gray-800 font-medium">{day.start}–{day.end}</span>
                        ) : (
                          <span className="text-gray-400">راحة</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">عرض السجل</h3>
              {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                <button
                  type="button"
                  onClick={handleExportAttendance}
                  disabled={filteredHistory.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-200"
                  aria-label="تصدير الحضور"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير
                </button>
              )}
            </div>

            <div className="flex gap-1 overflow-x-auto">
              {(
                [
                  { key: 'all_time', label: 'كل الوقت' },
                  { key: 'range', label: 'فترة محددة' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setAttendanceViewMode(mode.key)}
                  className={`px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-colors ${
                    attendanceViewMode === mode.key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {attendanceViewMode === 'range' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">من</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">إلى</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    dir="ltr"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-1 border border-gray-100 shadow-sm">
            <div className="flex gap-1 overflow-x-auto">
              {ATTENDANCE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setAttendanceFilter(option.key)}
                  className={`px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-colors ${
                    attendanceFilter === option.key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <AttendanceHistoryList
            days={filteredHistory}
            title="سجل الحضور"
            emptyMessage={
              attendanceFilter === 'all'
                ? 'لا توجد سجلات حضور ضمن هذا النطاق'
                : `لا توجد سجلات بحالة ${
                    ATTENDANCE_FILTER_OPTIONS.find((option) => option.key === attendanceFilter)?.label ?? ''
                  }`
            }
          />
        </div>
      )}

      {/* Leaves Tab */}
      {activeTab === 'leaves' && (
        <div className="space-y-3">
          {leaveBalance && (
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <h4 className="text-xs text-gray-600 mb-2">رصيد الإجازات</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">الكلي:</span>
                    <span className="text-blue-700">{leaveBalance.total_annual}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">المستخدم:</span>
                    <span className="text-blue-700">{leaveBalance.used_annual}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-blue-200">
                    <span className="text-gray-600">المتبقي:</span>
                    <span className="text-blue-800">{leaveBalance.remaining_annual}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm text-gray-700">سجل الإجازات</h3>
            {userRequests.filter((r) => r.type === 'annual_leave').length > 0 ? (
              userRequests
                .filter((r) => r.type === 'annual_leave')
                .map((req) => (
                  <div
                    key={req.id}
                    className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-xs text-gray-600">{getRequestTypeAr(req.type)}</span>
                        <span
                          className={`inline-block mr-2 px-2 py-0.5 rounded-full text-xs ${statusColor(req.status)}`}
                        >
                          {getStatusAr(req.status)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      {req.type === 'time_adjustment' ? (
                        <div>
                          {formatRequestCalendarDate(req.from_date_time, req.type)}
                          {' — '}
                          {formatRequestTime(req.from_date_time, 'ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                          {' → '}
                          {formatRequestTime(req.to_date_time, 'ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ) : (
                        <>
                          <div>من: {formatRequestCalendarDate(req.from_date_time, req.type)}</div>
                          <div>إلى: {formatRequestCalendarDate(req.to_date_time, req.type)}</div>
                        </>
                      )}
                      {req.note && (
                        <div className="text-gray-500 italic">&ldquo;{req.note}&rdquo;</div>
                      )}
                      {req.decision_note && (
                        <div className="mt-2 pt-2 border-t border-gray-100 text-gray-700">
                          <span className="text-gray-500">القرار: </span>
                          {req.decision_note}
                        </div>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-100">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">لا توجد طلبات إجازات</p>
              </div>
            )}
          </div>

          {currentUser.role === 'admin' && (
            <button
              type="button"
              onClick={openLeaveBalanceModal}
              disabled={!leaveBalance}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
            >
              تعديل رصيد الإجازات
            </button>
          )}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-1 border border-gray-100 shadow-sm">
            <div className="flex gap-1 overflow-x-auto">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setRequestFilter(f)}
                  className={`px-4 py-2 rounded-xl text-xs whitespace-nowrap transition-colors ${
                    requestFilter === f
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? 'الكل' : getStatusAr(f)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredRequests.length > 0 ? (
              filteredRequests.map((req) => (
                <div
                  key={req.id}
                  id={`request-card-${req.id}`}
                  className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm scroll-mt-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-800">{getRequestTypeAr(req.type)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(req.created_at).toLocaleString('ar-IQ')}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColor(req.status)}`}>
                      {getStatusAr(req.status)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    {req.type === 'time_adjustment' ? (
                      <div>
                        {formatRequestCalendarDate(req.from_date_time, req.type)}
                        {' — '}
                        {formatRequestTime(req.from_date_time, 'ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {formatRequestTime(req.to_date_time, 'ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    ) : (
                      <>
                        <div>
                          من:{' '}
                          {isFullDayLeaveRequestType(req.type)
                            ? formatRequestCalendarDate(req.from_date_time, req.type)
                            : formatRequestDateTime(req.from_date_time, 'ar-IQ', {
                                dateStyle: 'medium',
                                timeStyle: req.type === 'hourly_permission' ? 'short' : undefined,
                              })}
                        </div>
                        <div>
                          إلى:{' '}
                          {isFullDayLeaveRequestType(req.type)
                            ? formatRequestCalendarDate(req.to_date_time, req.type)
                            : formatRequestDateTime(req.to_date_time, 'ar-IQ', {
                                dateStyle: 'medium',
                                timeStyle: req.type === 'hourly_permission' ? 'short' : undefined,
                              })}
                        </div>
                      </>
                    )}
                    {req.note && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg text-gray-700">
                        {req.note}
                      </div>
                    )}
                    {req.decision_note && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <span className="text-gray-500">ملاحظة القرار: </span>
                        <span className="text-gray-700">{req.decision_note}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-100">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">لا توجد طلبات</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showLeaveBalanceModal && currentUser.role === 'admin' && leaveBalance && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeLeaveBalanceModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-leave-balance-title"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md mx-auto p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="edit-leave-balance-title" className="text-gray-800">تعديل رصيد الإجازات</h2>
              <button
                type="button"
                onClick={closeLeaveBalanceModal}
                disabled={updatingLeaveBalance}
                className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-xs">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-gray-500 mb-1">الإجازات المستخدمة</p>
                  <p className="text-gray-700">{leaveBalance.used_annual} يوم</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">إجمالي الإجازات</label>
                  <input
                    type="number"
                    min={0}
                    value={editAnnualTotal}
                    onChange={(e) => setEditAnnualTotal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                سيتم تعديل هذا الموظف فقط ولن تتأثر سياسة الإجازات العامة.
              </p>

              <button
                type="button"
                onClick={handleLeaveBalanceUpdate}
                disabled={updatingLeaveBalance}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {updatingLeaveBalance ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAuditLog && currentUser.role === 'admin' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAuditLog(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg mx-auto p-6 max-h-[80vh] overflow-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-800">سجل التغييرات</h2>
              <button
                onClick={() => setShowAuditLog(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-2">
              {userAuditLogs.length > 0 ? (
                userAuditLogs.map((log) => (
                  <div key={log.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-sm text-gray-800">{log.action_ar}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(log.created_at).toLocaleString('ar-IQ')}
                    </p>
                    {log.details && (
                      <p className="text-xs text-gray-600 mt-2">{log.details}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">لا توجد سجلات</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && currentUser.role === 'admin' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !deletingUser && setShowDeleteConfirm(false)}
          onKeyDown={handleDeleteModalKeyDown}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
          aria-describedby="delete-user-description"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm mx-auto p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-user-title" className="text-gray-800 mb-2">حذف المستخدم</h2>
            <p id="delete-user-description" className="text-gray-600 text-sm mb-4">
              هل أنت متأكد من حذف المستخدم &quot;{profile.name_ar}&quot;؟ سيتم حذف حسابه نهائياً.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingUser}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl"
              >
                {deletingUser ? 'جاري الحذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Identity Edit Modal */}
      {showIdentityEditModal && profile && currentUser.role === 'admin' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => { setShowIdentityEditModal(false); identityEditForm.reset(); }}
          onKeyDown={handleIdentityEditModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-identity-title"
        >
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl bg-white p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="edit-identity-title" className="text-gray-800">تعديل الاسم واسم المستخدم</h2>
              <button
                type="button"
                onClick={() => { setShowIdentityEditModal(false); identityEditForm.reset(); }}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={identityEditForm.handleSubmit(onIdentityEditSubmit)}>
              <div>
                <label className="block mb-1.5 text-gray-700">الاسم الكامل</label>
                <input
                  type="text"
                  {...identityEditForm.register('name_ar')}
                  placeholder="أدخل الاسم الكامل"
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    identityEditForm.formState.errors.name_ar ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                {identityEditForm.formState.errors.name_ar && (
                  <p className="text-red-500 text-sm mt-1">{identityEditForm.formState.errors.name_ar.message}</p>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">اسم المستخدم</label>
                <input
                  type="email"
                  {...identityEditForm.register('email')}
                  placeholder="example@alssaa.tv"
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    identityEditForm.formState.errors.email ? 'border-red-400' : 'border-gray-200'
                  }`}
                  dir="ltr"
                />
                {identityEditForm.formState.errors.email && (
                  <p className="text-red-500 text-sm mt-1">{identityEditForm.formState.errors.email.message}</p>
                )}
                <p className="text-amber-700 text-xs mt-1">
                  يُستخدم هذا البريد كاسم المستخدم لتسجيل الدخول، وتغييره إجراء حساس.
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  الدور والقسم يُعدّلان من صفحة الأقسام.
                </p>
              </div>

              <button
                type="submit"
                disabled={editSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {editSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Edit Modal */}
      {showScheduleEditModal && profile && currentUser.role === 'admin' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => { setShowScheduleEditModal(false); scheduleEditForm.reset(); }}
          onKeyDown={handleScheduleEditModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-schedule-title"
        >
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl bg-white p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="edit-schedule-title" className="text-gray-800">تعديل جدول العمل</h2>
              <button
                type="button"
                onClick={() => { setShowScheduleEditModal(false); scheduleEditForm.reset(); }}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={scheduleEditForm.handleSubmit(onScheduleEditSubmit)}>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">جدول العمل</h3>
                <p className="text-xs text-gray-500 mb-3">حدّد أيام العمل ووقت كل يوم. الأيام غير المفعّلة تُعامَل كأيام راحة. إذا تُرك الجدول فارغاً بالكامل، تُستخدم إعدادات المنظمة.</p>
                <WorkScheduleEditor
                  value={scheduleEditForm.watch('work_schedule') ?? {}}
                  onChange={(next) =>
                    scheduleEditForm.setValue('work_schedule', next, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>

              <button
                type="submit"
                disabled={editSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {editSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

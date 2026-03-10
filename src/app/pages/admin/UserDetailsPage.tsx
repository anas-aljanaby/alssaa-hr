import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import * as profilesService from '@/lib/services/profiles.service';
import * as departmentsService from '@/lib/services/departments.service';
import { updateProfileSchema, type UpdateProfileFormData } from '@/lib/validations';
import { getDeleteUserErrorMessage, getProfileUpdateErrorMessage } from '@/lib/errorMessages';
import * as attendanceService from '@/lib/services/attendance.service';
import * as leaveBalanceService from '@/lib/services/leave-balance.service';
import * as requestsService from '@/lib/services/requests.service';
import * as auditService from '@/lib/services/audit.service';
import * as XLSX from 'xlsx';
import { getRequestTypeAr, getStatusAr, getAttendanceStatusAr } from '../../data/mockData';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import type { Profile } from '@/lib/services/profiles.service';
import type { Department } from '@/lib/services/departments.service';
import type { AttendanceLog, MonthlyStats } from '@/lib/services/attendance.service';
import type { LeaveBalance } from '@/lib/services/leave-balance.service';
import type { LeaveRequest } from '@/lib/services/requests.service';
import type { AuditLog } from '@/lib/services/audit.service';
import { now } from '@/lib/time';
import {
  Mail,
  Phone,
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
} from 'lucide-react';


function calculateLateMinutes(
  checkInTime: string,
  workStartTime: string = '08:00',
  gracePeriod: number = 10
): number {
  const [checkHour, checkMin] = checkInTime.split(':').map(Number);
  const [startHour, startMin] = workStartTime.split(':').map(Number);
  const checkMinutes = checkHour * 60 + checkMin;
  const startMinutes = startHour * 60 + startMin + gracePeriod;
  return Math.max(0, checkMinutes - startMinutes);
}

export function UserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [userRequests, setUserRequests] = useState<LeaveRequest[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [userAuditLogs, setUserAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'leaves' | 'requests'>(
    'overview'
  );
  const [requestFilter, setRequestFilter] = useState<'all' | LeaveRequest['status']>('all');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const n = now();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const n = now();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [showLeaveBalanceModal, setShowLeaveBalanceModal] = useState(false);
  const [updatingLeaveBalance, setUpdatingLeaveBalance] = useState(false);
  const [editAnnualTotal, setEditAnnualTotal] = useState('');
  const [editSickTotal, setEditSickTotal] = useState('');
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof departmentsService.listDepartments>>>([]);

  const editProfileForm = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name_ar: '',
      phone: '',
      role: 'employee',
      department_id: '',
      work_days: undefined,
      work_start_time: '',
      work_end_time: '',
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
    if (!userId) return;
    attendanceService
      .getLogsInRange(userId, dateFrom, dateTo)
      .then(setAttendanceLogs)
      .catch(() => toast.error('فشل تحميل سجلات الحضور'));
  }, [userId, dateFrom, dateTo]);

  useEffect(() => {
    if (profile && currentUser?.role === 'admin') {
      departmentsService.listDepartments().then(setDepartments).catch(() => {});
    }
  }, [profile, currentUser?.role]);
 
  const openEditModal = useCallback(() => {
    if (!profile) return;
    setShowEditModal(true);
    editProfileForm.reset({
      name_ar: profile.name_ar,
      phone: profile.phone ?? '',
      role: profile.role,
      department_id: profile.department_id ?? '',
      work_days: profile.work_days ?? undefined,
      work_start_time: profile.work_start_time ?? '',
      work_end_time: profile.work_end_time ?? '',
    });
  }, [profile, editProfileForm]);
 
  const handleEditModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowEditModal(false);
      editProfileForm.reset();
    }
  }, [editProfileForm]);

  const handleDeleteModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !deletingUser) {
      setShowDeleteConfirm(false);
    }
  }, [deletingUser]);

  const openLeaveBalanceModal = useCallback(() => {
    if (!leaveBalance) return;
    setEditAnnualTotal(String(leaveBalance.total_annual));
    setEditSickTotal(String(leaveBalance.total_sick));
    setShowLeaveBalanceModal(true);
  }, [leaveBalance]);

  const closeLeaveBalanceModal = useCallback(() => {
    if (updatingLeaveBalance) return;
    setShowLeaveBalanceModal(false);
  }, [updatingLeaveBalance]);

  const handleLeaveBalanceUpdate = useCallback(async () => {
    if (!profile || !leaveBalance) return;
    const nextAnnualTotal = Number(editAnnualTotal);
    const nextSickTotal = Number(editSickTotal);

    if (!Number.isFinite(nextAnnualTotal) || !Number.isFinite(nextSickTotal)) {
      toast.error('يرجى إدخال أرقام صحيحة');
      return;
    }
    if (nextAnnualTotal < 0 || nextSickTotal < 0) {
      toast.error('لا يمكن أن تكون القيم سالبة');
      return;
    }

    const usedAnnual = leaveBalance.used_annual;
    const usedSick = leaveBalance.used_sick;

    try {
      setUpdatingLeaveBalance(true);
      const updated = await leaveBalanceService.updateBalance(profile.id, {
        total_annual: nextAnnualTotal,
        remaining_annual: Math.max(nextAnnualTotal - usedAnnual, 0),
        total_sick: nextSickTotal,
        remaining_sick: Math.max(nextSickTotal - usedSick, 0),
      });
      setLeaveBalance(updated);
      toast.success('تم تحديث رصيد الإجازات للموظف');
      setShowLeaveBalanceModal(false);
    } catch {
      toast.error('فشل تحديث رصيد الإجازات');
    } finally {
      setUpdatingLeaveBalance(false);
    }
  }, [profile, leaveBalance, editAnnualTotal, editSickTotal]);



  async function loadData() {
    if (!userId) return;
    try {
      setLoading(true);
      const n = now();
      const [prof, log, stats, balance, reqs, audit] = await Promise.all([
        profilesService.getUserById(userId),
        attendanceService.getTodayLog(userId),
        attendanceService.getMonthlyStats(userId, n.getFullYear(), n.getMonth()),
        leaveBalanceService.getUserBalance(userId),
        requestsService.getUserRequests(userId),
        auditService.getAuditLogsForTarget(userId),
      ]);
      setProfile(prof);
      setTodayLog(log);
      setMonthlyStats(stats);
      setLeaveBalance(balance);
      setUserRequests(reqs);
      setUserAuditLogs(audit.slice(0, 10));

      if (prof?.department_id) {
        const dept = await departmentsService.getDepartmentById(prof.department_id);
        setDepartment(dept);
      }

      const logs = await attendanceService.getLogsInRange(userId, dateFrom, dateTo);
      setAttendanceLogs(logs);
    } catch {
      toast.error('فشل تحميل بيانات الموظف');
    } finally {
      setLoading(false);
    }
  }

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
  const onEditProfileSubmit = async (data: UpdateProfileFormData) => {
    if (!profile) return;
    setEditSubmitting(true);
    try {
      const hasWorkDays = data.work_days && data.work_days.length > 0;
      const workStart = data.work_start_time?.trim();
      const workEnd = data.work_end_time?.trim();
      await profilesService.updateUser(profile.id, {
        name_ar: data.name_ar.trim(),
        phone: data.phone?.trim() || undefined,
        role: data.role,
        department_id: data.department_id,
        work_days: hasWorkDays && workStart && workEnd ? data.work_days! : null,
        work_start_time: hasWorkDays && workStart && workEnd ? workStart : null,
        work_end_time: hasWorkDays && workStart && workEnd ? workEnd : null,
      });
      toast.success('تم تحديث المستخدم');
      setShowEditModal(false);
      editProfileForm.reset();
      await loadData();
    } catch (err) {
      toast.error(getProfileUpdateErrorMessage(err, 'فشل تحديث المستخدم'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const canDeleteUser = currentUser.role === 'admin' && currentUser.uid !== profile.id && profile.role !== 'admin';

  const handleDeleteUser = async () => {
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
    if (attendanceLogs.length === 0) return;
    const rows = attendanceLogs.map((log) => ({
      'التاريخ': log.date,
      'الحالة': getAttendanceStatusAr(log.status),
      'وقت الدخول': log.check_in_time ?? '—',
      'وقت الخروج': log.check_out_time ?? '—',
      'تأخير (دقائق)': log.check_in_time ? calculateLateMinutes(log.check_in_time) : 0,
      'انصراف تلقائي': log.auto_punch_out ? 'نعم' : 'لا',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل الحضور');
    const name = `حضور_${profile.name_ar}_${dateFrom}_إلى_${dateTo}.xlsx`;
    XLSX.writeFile(wb, name);
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <span className="sr-only">رجوع</span>
            <span aria-hidden="true" className="text-lg leading-none">
              ‹
            </span>
          </button>
          <h1 className="text-gray-800">تفاصيل الموظف</h1>
        </div>
        {currentUser.role === 'admin' && (
          <div className="flex gap-1">
            <button
              onClick={() => setShowAuditLog(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <History className="w-5 h-5 text-gray-600" />
            </button>
            <button
              type="button"
              onClick={openEditModal}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="تعديل الملف الشخصي"
            >
              <Edit2 className="w-5 h-5 text-gray-600" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="خيارات إضافية"
                >
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!canDeleteUser || deletingUser}
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
        )}
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-xl ${
              profile.role === 'admin'
                ? 'bg-purple-100 text-purple-600'
                : profile.role === 'manager'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-blue-100 text-blue-600'
            }`}
          >
            {profile.name_ar.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-gray-800">{profile.name_ar}</h2>
            <p className="text-xs text-gray-500 mt-0.5" dir="ltr">
              {profile.employee_id}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${roleColor(profile.role)}`}
              >
                {roleIcon(profile.role)}
                {roleLabel(profile.role)}
              </span>
            </div>
            {profile.work_days && profile.work_days.length > 0 && profile.work_start_time && profile.work_end_time && (
              <p className="text-xs text-gray-500 mt-2" dir="rtl">
                أيام العمل:{' '}
                {[
                  { d: 0, label: 'الأحد' },
                  { d: 1, label: 'الإثنين' },
                  { d: 2, label: 'الثلاثاء' },
                  { d: 3, label: 'الأربعاء' },
                  { d: 4, label: 'الخميس' },
                  { d: 5, label: 'الجمعة' },
                  { d: 6, label: 'السبت' },
                ]
                  .filter(({ d }) => profile.work_days!.includes(d))
                  .map(({ label }) => label)
                  .join('، ')}
                {' — '}
                <span dir="ltr">{profile.work_start_time}–{profile.work_end_time}</span>
              </p>
            )}
            {department && (
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-600">
                <Building2 className="w-3.5 h-3.5" />
                {department.name_ar}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          {profile.phone || profile.email ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                <span dir="ltr">{profile.phone ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="truncate" dir="ltr">
                  {profile.email ?? '—'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-gray-400 py-3">لا توجد بيانات اتصال</div>
          )}
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
            {todayLog ? (
              <div
                className={`p-3 rounded-xl ${
                  todayLog.status === 'present'
                    ? 'bg-emerald-50 border border-emerald-100'
                    : todayLog.status === 'late'
                      ? 'bg-amber-50 border border-amber-100'
                      : todayLog.status === 'on_leave'
                        ? 'bg-blue-50 border border-blue-100'
                        : 'bg-red-50 border border-red-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      todayLog.status === 'present'
                        ? 'text-emerald-700'
                        : todayLog.status === 'late'
                          ? 'text-amber-700'
                          : todayLog.status === 'on_leave'
                            ? 'text-blue-700'
                            : 'text-red-700'
                    }`}
                  >
                    {getAttendanceStatusAr(todayLog.status)}
                  </span>
                  {todayLog.check_in_time && (
                    <span className="text-xs text-gray-600" dir="ltr">
                      دخول: {todayLog.check_in_time}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">لا توجد بيانات لليوم</p>
            )}
          </div>

          {monthlyStats && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h3 className="text-sm text-gray-600 mb-3">إحصائيات الشهر الحالي</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs text-gray-600">أيام الحضور</span>
                  </div>
                  <p className="text-xl text-emerald-700">{monthlyStats.presentDays}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-xs text-gray-600">أيام التأخير</span>
                  </div>
                  <p className="text-xl text-amber-700">{monthlyStats.lateDays}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-xs text-gray-600">أيام الغياب</span>
                  </div>
                  <p className="text-xl text-red-700">{monthlyStats.absentDays}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-gray-600">أيام الإجازة</span>
                  </div>
                  <p className="text-xl text-blue-700">{monthlyStats.leaveDays}</p>
                </div>
              </div>
            </div>
          )}

          {leaveBalance && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h3 className="text-sm text-gray-600 mb-3">رصيد الإجازات</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">إجازة اعتيادية</span>
                    <span className="text-sm text-blue-700">
                      {leaveBalance.remaining_annual} متبقي
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-500">الكلي: {leaveBalance.total_annual}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">المستخدم: {leaveBalance.used_annual}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">إجازة مرضية</span>
                    <span className="text-sm text-emerald-700">
                      {leaveBalance.remaining_sick} متبقي
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-500">الكلي: {leaveBalance.total_sick}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">المستخدم: {leaveBalance.used_sick}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-3">
          {/* Work schedule card: show days and times; admin can edit */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">جدول العمل</h3>
              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="تعديل جدول العمل"
                >
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
            {profile.work_days && profile.work_days.length > 0 && profile.work_start_time && profile.work_end_time ? (
              <div className="text-sm text-gray-700">
                <p className="text-xs text-gray-500 mb-1">أيام العمل</p>
                <p className="mb-2">
                  {[
                    { d: 0, label: 'الأحد' },
                    { d: 1, label: 'الإثنين' },
                    { d: 2, label: 'الثلاثاء' },
                    { d: 3, label: 'الأربعاء' },
                    { d: 4, label: 'الخميس' },
                    { d: 5, label: 'الجمعة' },
                    { d: 6, label: 'السبت' },
                  ]
                    .filter(({ d }) => profile.work_days!.includes(d))
                    .map(({ label }) => label)
                    .join('، ')}
                </p>
                <p className="text-xs text-gray-500">وقت الدوام</p>
                <p dir="ltr">{profile.work_start_time} – {profile.work_end_time}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">حسب إعدادات المنظمة</p>
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">الفترة</h3>
              {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                <button
                  type="button"
                  onClick={handleExportAttendance}
                  disabled={attendanceLogs.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-200"
                  aria-label="تصدير الحضور"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير
                </button>
              )}
            </div>
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
          </div>

          <div className="space-y-2">
            {attendanceLogs.length > 0 ? (
              attendanceLogs.map((log) => {
                const lateMinutes = log.check_in_time
                  ? calculateLateMinutes(log.check_in_time)
                  : 0;
                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm text-gray-800" dir="ltr">
                          {log.date}
                        </p>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
                            log.status === 'present'
                              ? 'bg-emerald-100 text-emerald-700'
                              : log.status === 'late'
                                ? 'bg-amber-100 text-amber-700'
                                : log.status === 'on_leave'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {getAttendanceStatusAr(log.status)}
                        </span>
                      </div>
                      {lateMinutes > 0 && (
                        <span className="text-xs text-amber-600">تأخير {lateMinutes} د</span>
                      )}
                    </div>
                    {(log.check_in_time || log.check_out_time) && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">الدخول:</span>
                          <span className="text-gray-700 mr-2" dir="ltr">
                            {log.check_in_time || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">الخروج:</span>
                          <span className="text-gray-700 mr-2" dir="ltr">
                            {log.check_out_time || '—'}
                          </span>
                          {log.auto_punch_out && (
                            <span className="mr-1 px-1.5 py-0.5 text-amber-600 bg-amber-100 rounded text-[10px] border border-amber-200">
                              انصراف تلقائي
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Location details removed: location tracking disabled */}
                  </div>
                );
              })
            ) : (
              <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-100">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">لا توجد سجلات حضور ضمن هذا النطاق</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaves Tab */}
      {activeTab === 'leaves' && (
        <div className="space-y-3">
          {leaveBalance && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <h4 className="text-xs text-gray-600 mb-2">إجازة اعتيادية</h4>
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
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <h4 className="text-xs text-gray-600 mb-2">إجازة مرضية</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">الكلي:</span>
                    <span className="text-emerald-700">{leaveBalance.total_sick}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">المستخدم:</span>
                    <span className="text-emerald-700">{leaveBalance.used_sick}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-emerald-200">
                    <span className="text-gray-600">المتبقي:</span>
                    <span className="text-emerald-800">{leaveBalance.remaining_sick}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm text-gray-700">سجل الإجازات</h3>
            {userRequests.filter(
              (r) => r.type === 'annual_leave' || r.type === 'sick_leave'
            ).length > 0 ? (
              userRequests
                .filter((r) => r.type === 'annual_leave' || r.type === 'sick_leave')
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
                          {new Date(req.from_date_time).toLocaleDateString('ar-IQ')}
                          {' — '}
                          {new Date(req.from_date_time).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                          {' → '}
                          {new Date(req.to_date_time).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ) : (
                        <>
                          <div>من: {new Date(req.from_date_time).toLocaleDateString('ar-IQ')}</div>
                          <div>إلى: {new Date(req.to_date_time).toLocaleDateString('ar-IQ')}</div>
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
                  className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
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
                        {new Date(req.from_date_time).toLocaleDateString('ar-IQ')}
                        {' — '}
                        {new Date(req.from_date_time).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {new Date(req.to_date_time).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    ) : (
                      <>
                        <div>
                          من:{' '}
                          {new Date(req.from_date_time).toLocaleString('ar-IQ', {
                            dateStyle: 'medium',
                            timeStyle: req.type === 'hourly_permission' ? 'short' : undefined,
                          })}
                        </div>
                        <div>
                          إلى:{' '}
                          {new Date(req.to_date_time).toLocaleString('ar-IQ', {
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
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-gray-500 mb-1">المستخدم سنوي</p>
                  <p className="text-gray-700">{leaveBalance.used_annual} يوم</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-gray-500 mb-1">المستخدم مرضي</p>
                  <p className="text-gray-700">{leaveBalance.used_sick} يوم</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">إجمالي السنوي</label>
                  <input
                    type="number"
                    min={0}
                    value={editAnnualTotal}
                    onChange={(e) => setEditAnnualTotal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">إجمالي المرضي</label>
                  <input
                    type="number"
                    min={0}
                    value={editSickTotal}
                    onChange={(e) => setEditSickTotal(e.target.value)}
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

      {/* Edit Profile Modal */}
      {showEditModal && profile && currentUser.role === 'admin' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => { setShowEditModal(false); editProfileForm.reset(); }}
          onKeyDown={handleEditModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
        >
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl bg-white p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="edit-profile-title" className="text-gray-800">تعديل الملف الشخصي</h2>
              <button
                type="button"
                onClick={() => { setShowEditModal(false); editProfileForm.reset(); }}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={editProfileForm.handleSubmit(onEditProfileSubmit)}>
              <div>
                <label className="block mb-1.5 text-gray-700">الاسم الكامل</label>
                <input
                  type="text"
                  {...editProfileForm.register('name_ar')}
                  placeholder="أدخل الاسم الكامل"
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    editProfileForm.formState.errors.name_ar ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                {editProfileForm.formState.errors.name_ar && (
                  <p className="text-red-500 text-sm mt-1">{editProfileForm.formState.errors.name_ar.message}</p>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">رقم الهاتف</label>
                <input
                  type="tel"
                  {...editProfileForm.register('phone')}
                  placeholder="+964 770 000 0000"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5 text-gray-700">الدور</label>
                  <select
                    {...editProfileForm.register('role')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value={profile.role}>
                      {roleLabel(profile.role)}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5 text-gray-700">القسم</label>
                  <select
                    {...editProfileForm.register('department_id')}
                    className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      editProfileForm.formState.errors.department_id ? 'border-red-400' : 'border-gray-200'
                    }`}
                  >
                    <option value="">اختر القسم</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name_ar}
                      </option>
                    ))}
                  </select>
                  {editProfileForm.formState.errors.department_id && (
                    <p className="text-red-500 text-sm mt-1">{editProfileForm.formState.errors.department_id.message}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">جدول العمل</h3>
                <p className="text-xs text-gray-500 mb-3">اختر أيام العمل ووقت البداية والنهاية (نفس التوقيت لجميع الأيام). إن لم تختر أي أيام تُستخدم إعدادات المنظمة.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    { d: 0, label: 'الأحد' },
                    { d: 1, label: 'الإثنين' },
                    { d: 2, label: 'الثلاثاء' },
                    { d: 3, label: 'الأربعاء' },
                    { d: 4, label: 'الخميس' },
                    { d: 5, label: 'الجمعة' },
                    { d: 6, label: 'السبت' },
                  ].map(({ d, label }) => {
                    const workDays = editProfileForm.watch('work_days') ?? [];
                    const checked = workDays.includes(d);
                    return (
                      <label
                        key={d}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                          checked ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const prev = editProfileForm.getValues('work_days') ?? [];
                            const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b);
                            editProfileForm.setValue('work_days', next);
                          }}
                          className="rounded border-gray-300"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">وقت البداية</label>
                    <input
                      type="time"
                      {...editProfileForm.register('work_start_time')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">وقت النهاية</label>
                    <input
                      type="time"
                      {...editProfileForm.register('work_end_time')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      dir="ltr"
                    />
                  </div>
                </div>
                {editProfileForm.formState.errors.work_end_time && (
                  <p className="text-red-500 text-sm mt-1">{editProfileForm.formState.errors.work_end_time.message}</p>
                )}
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

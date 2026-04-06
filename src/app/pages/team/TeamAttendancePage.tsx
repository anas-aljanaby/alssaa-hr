import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext';
import { DayDetailsSheet } from '@/app/components/attendance/DayDetailsSheet';
import { StatCard } from '@/app/components/shared/StatCard';
import { getStatusTheme } from '@/app/components/attendance/attendanceStatusTheme';
import * as attendanceService from '@/lib/services/attendance.service';
import * as departmentsService from '@/lib/services/departments.service';
import type { Department } from '@/lib/services/departments.service';
import type {
  SafeAvailabilityRow,
  TeamAttendanceDayRow,
  TeamAttendanceDisplayStatus,
} from '@/lib/services/attendance.service';
import { now } from '@/lib/time';
import {
  Building2,
  Calendar,
  Clock3,
  ShieldAlert,
  Users,
  UserCheck,
  UserX,
} from 'lucide-react';

const ALL_DEPARTMENTS = '__all_departments__';

type DetailedStatusFilter = 'all' | 'checked_in_now' | 'late' | 'absent' | 'on_leave';

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDays(base: Date, amount: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + amount);
  return toDateInputValue(next);
}

function formatWallTime(time: string | null): string {
  if (!time) return '--:--';
  return time.slice(0, 5);
}

function formatWeekday(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('ar-IQ', {
    weekday: 'long',
  });
}

function displayStatusLabel(status: TeamAttendanceDisplayStatus): string {
  if (!status) return 'لم يسجل بعد';
  return getStatusTheme(status).label;
}

function availabilityLabel(state: SafeAvailabilityRow['availabilityState']): string {
  return state === 'available_now' ? 'متاح الآن' : 'غير متاح الآن';
}

function isAvailable(state: SafeAvailabilityRow['availabilityState']): boolean {
  return state === 'available_now';
}

export function TeamAttendancePage() {
  const { currentUser } = useAuth();
  const today = useMemo(() => now(), []);
  const todayDate = toDateInputValue(today);
  const yesterdayDate = shiftDays(today, -1);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [managerDepartmentId, setManagerDepartmentId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [statusFilter, setStatusFilter] = useState<DetailedStatusFilter>('all');
  const [detailedRows, setDetailedRows] = useState<TeamAttendanceDayRow[]>([]);
  const [availabilityRows, setAvailabilityRows] = useState<SafeAvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDetailUserId, setSelectedDetailUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function loadMeta() {
      try {
        const [allDepartments, managedDepartment] = await Promise.all([
          departmentsService.listDepartments(),
          currentUser.role === 'manager' && !currentUser.departmentId
            ? departmentsService.getDepartmentByManagerUid(currentUser.uid)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setDepartments(allDepartments);
        const nextManagerDepartmentId =
          currentUser.role === 'manager'
            ? currentUser.departmentId || managedDepartment?.id || null
            : null;
        setManagerDepartmentId(nextManagerDepartmentId);

        if (currentUser.role === 'manager') {
          setSelectedDepartmentId(nextManagerDepartmentId ?? ALL_DEPARTMENTS);
        } else {
          setSelectedDepartmentId(ALL_DEPARTMENTS);
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل تحميل الأقسام');
          setDepartments([]);
          setSelectedDepartmentId(ALL_DEPARTMENTS);
        }
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const departmentFilterValue = selectedDepartmentId ?? ALL_DEPARTMENTS;
  const selectedDepartmentDbId =
    departmentFilterValue === ALL_DEPARTMENTS ? null : departmentFilterValue;

  const mode = useMemo<'detailed' | 'availability'>(() => {
    if (!currentUser) return 'availability';
    if (currentUser.role === 'admin') return 'detailed';
    if (
      currentUser.role === 'manager' &&
      managerDepartmentId &&
      selectedDepartmentDbId === managerDepartmentId
    ) {
      return 'detailed';
    }
    return 'availability';
  }, [currentUser, managerDepartmentId, selectedDepartmentDbId]);

  useEffect(() => {
    if (mode === 'availability') {
      setStatusFilter('all');
      setSelectedDetailUserId(null);
    }
  }, [mode]);

  useEffect(() => {
    if (!currentUser || !selectedDepartmentId) return;
    let cancelled = false;

    async function loadRows() {
      try {
        setLoading(true);
        if (mode === 'detailed') {
          const rows = await attendanceService.getTeamAttendanceDay({
            date: selectedDate,
            departmentId:
              currentUser.role === 'admin'
                ? selectedDepartmentDbId
                : managerDepartmentId,
          });
          if (cancelled) return;
          setDetailedRows(rows);
          setAvailabilityRows([]);
        } else {
          const rows = await attendanceService.getRedactedDepartmentAvailability({
            departmentId: selectedDepartmentDbId,
          });
          if (cancelled) return;
          setAvailabilityRows(rows);
          setDetailedRows([]);
        }
      } catch {
        if (!cancelled) {
          toast.error(mode === 'detailed' ? 'فشل تحميل حضور الفريق' : 'فشل تحميل حالة التوفر');
          setDetailedRows([]);
          setAvailabilityRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRows();
    return () => {
      cancelled = true;
    };
  }, [
    currentUser,
    managerDepartmentId,
    mode,
    selectedDate,
    selectedDepartmentDbId,
    selectedDepartmentId,
  ]);

  const selectedDepartmentName = useMemo(() => {
    if (selectedDepartmentDbId == null) return 'كل الأقسام';
    return departments.find((dept) => dept.id === selectedDepartmentDbId)?.name_ar ?? 'القسم';
  }, [departments, selectedDepartmentDbId]);

  const detailedStats = useMemo(() => ({
    total: detailedRows.length,
    checkedInNow: detailedRows.filter((row) => row.isCheckedInNow).length,
    late: detailedRows.filter((row) => row.displayStatus === 'late').length,
    absent: detailedRows.filter((row) => row.displayStatus === 'absent').length,
    onLeave: detailedRows.filter((row) => row.displayStatus === 'on_leave').length,
  }), [detailedRows]);

  const filteredDetailedRows = useMemo(() => {
    return detailedRows.filter((row) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'checked_in_now') return row.isCheckedInNow;
      return row.displayStatus === statusFilter;
    });
  }, [detailedRows, statusFilter]);

  const availabilityStats = useMemo(() => ({
    total: availabilityRows.length,
    available: availabilityRows.filter((row) => isAvailable(row.availabilityState)).length,
    unavailable: availabilityRows.filter((row) => !isAvailable(row.availabilityState)).length,
  }), [availabilityRows]);

  if (!currentUser) return null;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">
      <div>
        <h1 className="text-gray-800 font-semibold text-lg">حضور الفريق</h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'detailed'
            ? 'عرض يومي للحضور والانصراف حسب القسم'
            : 'يعرض التوفر الحالي فقط بدون أوقات الحضور والانصراف'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span className="text-sm">القسم</span>
        </div>
        <select
          value={departmentFilterValue}
          onChange={(e) => setSelectedDepartmentId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
        >
          <option value={ALL_DEPARTMENTS}>كل الأقسام</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name_ar}
            </option>
          ))}
        </select>
      </div>

      {mode === 'detailed' ? (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-sm">اليوم المعروض</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(todayDate)}
                className={`px-3 py-2 rounded-xl text-sm border ${
                  selectedDate === todayDate
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(yesterdayDate)}
                className={`px-3 py-2 rounded-xl text-sm border ${
                  selectedDate === yesterdayDate
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                أمس
              </button>
            </div>
            <input
              type="date"
              value={selectedDate}
              max={todayDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<UserCheck className="w-4 h-4 text-emerald-600" />}
              label="مسجل الآن"
              value={detailedStats.checkedInNow}
              color="bg-emerald-50 border-emerald-100"
            />
            <StatCard
              icon={<Clock3 className="w-4 h-4 text-amber-600" />}
              label="متأخر"
              value={detailedStats.late}
              color="bg-amber-50 border-amber-100"
            />
            <StatCard
              icon={<UserX className="w-4 h-4 text-rose-600" />}
              label="غائب"
              value={detailedStats.absent}
              color="bg-rose-50 border-rose-100"
            />
            <StatCard
              icon={<Users className="w-4 h-4 text-blue-600" />}
              label="إجازة"
              value={detailedStats.onLeave}
              color="bg-blue-50 border-blue-100"
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'all', label: 'الكل' },
                ...(selectedDate === todayDate
                  ? [{ key: 'checked_in_now', label: 'مسجل الآن' }]
                  : []),
                { key: 'late', label: 'متأخر' },
                { key: 'absent', label: 'غائب' },
                { key: 'on_leave', label: 'إجازة' },
              ] as Array<{ key: DetailedStatusFilter; label: string }>).map((filterOption) => (
                <button
                  key={filterOption.key}
                  type="button"
                  onClick={() => setStatusFilter(filterOption.key)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    statusFilter === filterOption.key
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <LoadingCards />
            ) : filteredDetailedRows.length > 0 ? (
              filteredDetailedRows.map((row) => (
                <button
                  key={row.userId}
                  type="button"
                  onClick={() => setSelectedDetailUserId(row.userId)}
                  className="w-full text-right bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-900">{row.nameAr}</p>
                        <StatusBadge status={row.displayStatus} />
                        {row.isCheckedInNow && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700">
                            مباشر الآن
                          </span>
                        )}
                        {row.hasAutoPunchOut && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700">
                            انصراف تلقائي
                          </span>
                        )}
                        {row.needsReview && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700">
                            يحتاج مراجعة
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {row.departmentNameAr ?? 'بدون قسم'} • {formatWeekday(row.date)}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      {row.nameAr.charAt(0)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                    <MetricBlock label="دخول" value={formatWallTime(row.firstCheckIn)} />
                    <MetricBlock label="خروج" value={formatWallTime(row.lastCheckOut)} />
                    <MetricBlock
                      label="إجمالي العمل"
                      value={row.totalWorkMinutes > 0 ? `${Math.floor(row.totalWorkMinutes / 60)}س ${row.totalWorkMinutes % 60}د` : '—'}
                    />
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                title="لا توجد سجلات مطابقة"
                subtitle={`لا توجد نتائج ضمن ${selectedDepartmentName}`}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-900">
            {currentUser.role === 'manager'
              ? 'يمكنك عرض التوفر الحالي لكل الأقسام، بينما تبقى التفاصيل الدقيقة للحضور والانصراف ضمن قسمك فقط.'
              : 'يعرض هذا القسم من هو متاح الآن في الأقسام المختلفة بدون أوقات الحضور والانصراف.'}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Users className="w-4 h-4 text-slate-600" />}
              label="الإجمالي"
              value={availabilityStats.total}
              color="bg-slate-50 border-slate-200"
            />
            <StatCard
              icon={<UserCheck className="w-4 h-4 text-emerald-600" />}
              label="متاح الآن"
              value={availabilityStats.available}
              color="bg-emerald-50 border-emerald-100"
            />
            <StatCard
              icon={<UserX className="w-4 h-4 text-gray-500" />}
              label="غير متاح"
              value={availabilityStats.unavailable}
              color="bg-gray-50 border-gray-200"
            />
          </div>

          <div className="space-y-3">
            {loading ? (
              <LoadingCards />
            ) : availabilityRows.length > 0 ? (
              availabilityRows.map((row) => (
                <div
                  key={row.userId}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-900">{row.nameAr}</p>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] ${
                            isAvailable(row.availabilityState)
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {availabilityLabel(row.availabilityState)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {row.departmentNameAr ?? 'بدون قسم'}
                        {row.role === 'manager' ? ' • مدير' : ''}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      {row.nameAr.charAt(0)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="لا يوجد موظفون لعرضهم"
                subtitle={`لا توجد بيانات توفر حالية ضمن ${selectedDepartmentName}`}
              />
            )}
          </div>
        </>
      )}

      <DayDetailsSheet
        userId={selectedDetailUserId ?? ''}
        date={selectedDetailUserId ? selectedDate : null}
        onClose={() => setSelectedDetailUserId(null)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: TeamAttendanceDisplayStatus }) {
  if (!status) {
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] bg-gray-100 text-gray-600">
        {displayStatusLabel(status)}
      </span>
    );
  }

  const theme = getStatusTheme(status);
  return (
    <span
      className="px-2.5 py-1 rounded-full text-[11px] border"
      style={theme.badgeSoftStyle}
    >
      {theme.label}
    </span>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 mt-1 font-medium">{value}</p>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="bg-gray-100 rounded-2xl h-28 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <ShieldAlert className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

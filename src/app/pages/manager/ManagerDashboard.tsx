import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import * as departmentsService from '@/lib/services/departments.service';
import * as profilesService from '@/lib/services/profiles.service';
import * as attendanceService from '@/lib/services/attendance.service';
import * as requestsService from '@/lib/services/requests.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import type { Profile } from '@/lib/services/profiles.service';
import type { AttendanceLog } from '@/lib/services/attendance.service';
import type { LeaveRequest } from '@/lib/services/requests.service';
import type { Department } from '@/lib/services/departments.service';
import { DashboardSkeleton } from '../../components/skeletons';
import { PendingRequestsCard } from '../../components/PendingRequestsCard';
import {
  AttendanceCharts,
} from '../../components/dashboard';
import { todayStr } from '@/lib/services/attendance.service';
import {
  Users,
  CheckCircle2,
  Timer,
  XCircle,
  Coffee,
} from 'lucide-react';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { PublishingTagCard } from '../../components/shared/PublishingTagCard';
import { StatCard } from '../../components/shared/StatCard';
import { TodayStatusCard } from '../../components/attendance/TodayStatusCard';
import { useTodayPunch } from '../../hooks/useTodayPunch';
import { UnavailableState } from '../../components/shared/UnavailableState';
import { usePublishingTag } from '../../hooks/usePublishingTag';
import { isOfflineError } from '@/lib/network';
import { usePwa } from '../../contexts/PwaContext';

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hasJoinedBy(day: string, joinDate: string | null | undefined): boolean {
  if (!joinDate) return true;
  return joinDate <= day;
}

type ManagerTab = 'overview' | 'analytics';
type DashboardSummaryKey = 'present' | 'late' | 'absent' | 'on_leave';

const DASHBOARD_FILTER_BY_SUMMARY_KEY: Record<DashboardSummaryKey, string> = {
  present: 'present_now',
  late: 'late',
  absent: 'absent',
  on_leave: 'on_leave',
};

export function ManagerDashboard() {
  const { currentUser } = useAuth();
  const { isOffline } = usePwa();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [missingDepartment, setMissingDepartment] = useState(false);
  const [department, setDepartment] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [weekLogs, setWeekLogs] = useState<{ day: string; logs: AttendanceLog[] }[]>([]);
  const [activeTab, setActiveTab] = useState<ManagerTab>('overview');
  const [loadError, setLoadError] = useState<string | null>(null);
  const publishingTag = usePublishingTag({
    orgId: currentUser?.orgId,
    userId: currentUser?.uid,
  });
  const todayPunch = useTodayPunch({
    userId: currentUser?.uid,
  });

  const employeeIds = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);

  const handleSummaryCardClick = useCallback(
    (key: DashboardSummaryKey) => {
      const params = new URLSearchParams({
        mode: 'live',
        date: todayStr(),
        filter: DASHBOARD_FILTER_BY_SUMMARY_KEY[key],
      });

      navigate(`/team-attendance?${params.toString()}`);
    },
    [navigate]
  );

  useEffect(() => {
    if (!currentUser) return;
    void loadData();
  }, [currentUser?.uid]);

  const handleAttendanceEvent = useCallback(
    (event: attendanceService.AttendanceChangeEvent) => {
      if (!employeeIds.has(event.new.user_id)) return;
      const today = todayStr();
      if (event.new.date !== today) return;
      setTodayLogs((prev) => {
        const idx = prev.findIndex((l) => l.id === event.new.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = event.new;
          return updated;
        }
        return [...prev, event.new];
      });
    },
    [employeeIds]
  );

  useRealtimeSubscription(
    () => {
      if (!currentUser || employees.length === 0) return undefined;
      return attendanceService.subscribeToAttendanceLogs(handleAttendanceEvent);
    },
    [currentUser?.uid, employees.length, handleAttendanceEvent]
  );

  useRealtimeSubscription(
    () => {
      if (!currentUser || employees.length === 0) return undefined;
      return requestsService.subscribeToAllRequests((event) => {
        if (!employeeIds.has(event.new.user_id)) return;
        if (event.eventType === 'INSERT' && event.new.status === 'pending') {
          setPendingRequests((prev) => [event.new, ...prev]);
        } else if (event.eventType === 'UPDATE') {
          setPendingRequests((prev) =>
            event.new.status === 'pending'
              ? prev.map((r) => (r.id === event.new.id ? event.new : r))
              : prev.filter((r) => r.id !== event.new.id)
          );
        }
      });
    },
    [currentUser?.uid, employees.length, employeeIds]
  );

  async function loadData() {
    try {
      setLoading(true);
      setMissingDepartment(false);
      let departmentId = currentUser?.departmentId || '';
      if (!departmentId && currentUser?.role === 'manager') {
        const managedDepartment = await departmentsService.getDepartmentByManagerUid(currentUser.uid);
        departmentId = managedDepartment?.id ?? '';
      }
      if (!departmentId) {
        setMissingDepartment(true);
        setLoading(false);
        return;
      }
      const today = todayStr();
      const base = new Date();
      const [dept, emps, logs, reqs] = await Promise.all([
        departmentsService.getDepartmentById(departmentId),
        profilesService.getDepartmentEmployees(departmentId),
        attendanceService.getDepartmentLogsForDate(departmentId, today),
        requestsService.getPendingDepartmentRequests(departmentId),
      ]);
      setLoadError(null);
      setDepartment(dept);
      setEmployees(emps);
      setTodayLogs(logs);
      setPendingRequests(reqs);

      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
      const weekDays = Array.from({ length: 5 }, (_, idx) => {
        const i = 4 - idx;
        const d = new Date(base);
        d.setDate(d.getDate() - i);
        return d;
      });
      const weekData = await Promise.all(
        weekDays.map(async (d) => {
          const ds = dateStr(d);
          const logs = await attendanceService.getDepartmentLogsForDate(
            departmentId,
            ds
          );
          return {
          day: days[d.getDay()] || d.toLocaleDateString('ar-IQ', { weekday: 'short' }),
            logs,
          };
        })
      );
      setWeekLogs(weekData);
    } catch (error) {
      const message = isOfflineError(error)
        ? 'تعذر تحميل لوحة المدير بدون اتصال بالإنترنت.'
        : 'فشل تحميل البيانات.';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const todayStats = useMemo(() => {
    const today = todayStr();
    const activeEmployees = employees.filter((e) => hasJoinedBy(today, e.join_date));
    const present = todayLogs.filter((l) => l.status === 'present').length;
    const late = todayLogs.filter((l) => l.status === 'late').length;
    const onLeave = todayLogs.filter((l) => l.status === 'on_leave').length;
    const checkedIn = todayLogs.filter((l) => l.check_in_time).length;
    return {
      total: activeEmployees.length,
      present,
      late,
      absent: activeEmployees.length - checkedIn,
      onLeave,
    };
  }, [todayLogs, employees]);

  const profilesMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  const pieData = useMemo(
    () =>
      [
        { name: 'حاضر', value: todayStats.present, color: '#059669' },
        { name: 'متأخر', value: todayStats.late, color: '#d97706' },
        { name: 'غائب', value: todayStats.absent, color: '#dc2626' },
        { name: 'إجازة', value: todayStats.onLeave, color: '#2563eb' },
      ].filter((d) => d.value > 0),
    [todayStats]
  );

  const weeklyTrend = useMemo(
    () =>
      weekLogs.map((w) => ({
        day: w.day,
        حضور: w.logs.filter((l) => l.status === 'present').length,
        تأخر: w.logs.filter((l) => l.status === 'late').length,
      })),
    [weekLogs]
  );

  if (!currentUser) return null;

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (loadError) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <UnavailableState
          title="تعذر تحميل لوحة المدير"
          description={loadError}
          actionLabel="إعادة المحاولة"
          onAction={() => void loadData()}
        />
      </div>
    );
  }

  if (missingDepartment) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900">
          لا يمكن تحميل لوحة المدير حالياً. حسابك غير مرتبط بقسم. يرجى التواصل مع المدير العام لإسناد قسم لك.
        </div>
      </div>
    );
  }

  const tabClass = (tab: ManagerTab) =>
    `px-3 py-2 rounded-xl text-sm transition-colors ${
      activeTab === tab ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'
    }`;

  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 pb-24 pt-3">
      <DashboardHeader
        gradientClassName="bg-gradient-to-l from-emerald-600 to-emerald-700"
        title={currentUser.nameAr}
        subtitle={department?.name_ar}
        helperText="لوحة تحكم المدير"
        avatar={<Users className="w-6 h-6" />}
        footer={
          <div className="flex items-center justify-between">
            <span className="text-emerald-200 text-sm">إجمالي الموظفين</span>
            <span className="text-xl">{todayStats.total}</span>
          </div>
        }
      />

      {todayPunch.loading ? (
        <div className="bg-gray-100 rounded-2xl h-64 animate-pulse" />
      ) : (
        <TodayStatusCard
          today={todayPunch.today}
          actionLoading={todayPunch.actionLoading}
          onCheckIn={todayPunch.handleCheckIn}
          onCheckOut={todayPunch.handleCheckOut}
          isOffline={isOffline}
        />
      )}

      {currentUser.orgId && (
        <PublishingTagCard
          holder={publishingTag.holder}
          currentUserId={currentUser.uid}
          loading={publishingTag.loading}
          loadError={publishingTag.loadError}
          actionLoading={publishingTag.actionLoading}
          onClaim={() => void publishingTag.claim()}
          onRelease={() => void publishingTag.release()}
          onRetry={() => void publishingTag.refresh()}
        />
      )}

      <div className="bg-white rounded-2xl p-1 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-2 gap-1">
          {(['overview', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={tabClass(tab)}
            >
              {tab === 'overview' && 'نظرة عامة'}
              {tab === 'analytics' && 'التحليلات'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <div>
            <h3 className="mb-2 text-gray-800">ملخص اليوم</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                label="حاضرون"
                value={todayStats.present}
                color="bg-emerald-50 border-emerald-100"
                onClick={() => handleSummaryCardClick('present')}
              />
              <StatCard
                icon={<Timer className="w-5 h-5 text-amber-500" />}
                label="متأخرون"
                value={todayStats.late}
                color="bg-amber-50 border-amber-100"
                onClick={() => handleSummaryCardClick('late')}
              />
              <StatCard
                icon={<XCircle className="w-5 h-5 text-red-500" />}
                label="غائبون"
                value={todayStats.absent}
                color="bg-red-50 border-red-100"
                onClick={() => handleSummaryCardClick('absent')}
              />
              <StatCard
                icon={<Coffee className="w-5 h-5 text-blue-500" />}
                label="في إجازة"
                value={todayStats.onLeave}
                color="bg-blue-50 border-blue-100"
                onClick={() => handleSummaryCardClick('on_leave')}
              />
            </div>
          </div>
          <PendingRequestsCard
            pendingRequests={pendingRequests}
            profilesMap={profilesMap}
          />
        </>
      )}

      {activeTab === 'analytics' && (
        <AttendanceCharts
          pieData={pieData}
          weeklyTrend={weeklyTrend}
        />
      )}
    </div>
  );
}

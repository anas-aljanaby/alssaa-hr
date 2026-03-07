import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  EmployeeListUnified,
  AttendanceCharts,
  type EmployeeWithTodayStatus,
} from '../../components/dashboard';
import { todayStr } from '@/lib/services/attendance.service';
import { now } from '@/lib/time';
import {
  Users,
  CheckCircle2,
  Timer,
  XCircle,
  Coffee,
} from 'lucide-react';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { StatCard } from '../../components/shared/StatCard';

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ManagerTab = 'overview' | 'analytics';

export function ManagerDashboard() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [monthLogs, setMonthLogs] = useState<AttendanceLog[]>([]);
  const [weekLogs, setWeekLogs] = useState<{ day: string; logs: AttendanceLog[] }[]>([]);
  const [activeTab, setActiveTab] = useState<ManagerTab>('overview');

  const employeeIds = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
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
    if (!currentUser?.departmentId) return;
    try {
      setLoading(true);
      const today = todayStr();
      const base = now();
      const [dept, emps, logs, reqs] = await Promise.all([
        departmentsService.getDepartmentById(currentUser.departmentId),
        profilesService.getDepartmentEmployees(currentUser.departmentId),
        attendanceService.getDepartmentLogsForDate(currentUser.departmentId, today),
        requestsService.getPendingDepartmentRequests(currentUser.departmentId),
      ]);
      setDepartment(dept);
      setEmployees(emps);
      setTodayLogs(logs);
      setPendingRequests(reqs);

      const allMonthLogs: AttendanceLog[] = [];
      for (const emp of emps) {
        const empLogs = await attendanceService.getMonthlyLogs(
          emp.id,
          base.getFullYear(),
          base.getMonth()
        );
        allMonthLogs.push(...empLogs);
      }
      setMonthLogs(allMonthLogs);

      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
      const weekData: { day: string; logs: AttendanceLog[] }[] = [];
      for (let i = 4; i >= 0; i--) {
        const d = new Date(base);
        d.setDate(d.getDate() - i);
        const ds = dateStr(d);
        const dayLogs = await attendanceService.getDepartmentLogsForDate(
          currentUser.departmentId,
          ds
        );
        weekData.push({
          day: days[d.getDay()] || d.toLocaleDateString('ar-IQ', { weekday: 'short' }),
          logs: dayLogs,
        });
      }
      setWeekLogs(weekData);
    } catch {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  const todayStats = useMemo(() => {
    const present = todayLogs.filter((l) => l.status === 'present').length;
    const late = todayLogs.filter((l) => l.status === 'late').length;
    const onLeave = todayLogs.filter((l) => l.status === 'on_leave').length;
    const checkedIn = todayLogs.filter((l) => l.check_in_time).length;
    return {
      total: employees.length,
      present,
      late,
      absent: employees.length - checkedIn,
      onLeave,
    };
  }, [todayLogs, employees]);

  const monthlyStats = useMemo(() => {
    const lateCounts: Record<string, number> = {};
    const absentCounts: Record<string, number> = {};
    monthLogs.forEach((l) => {
      if (l.status === 'late') lateCounts[l.user_id] = (lateCounts[l.user_id] || 0) + 1;
      if (l.status === 'absent') absentCounts[l.user_id] = (absentCounts[l.user_id] || 0) + 1;
    });
    return { lateCounts, absentCounts };
  }, [monthLogs]);

  const todayEmployeeStatus = useMemo((): EmployeeWithTodayStatus[] => {
    const logsMap = new Map(todayLogs.map((l) => [l.user_id, l]));
    return employees.map((emp) => {
      const log = logsMap.get(emp.id);
      return {
        ...emp,
        todayStatus: log?.status || ('absent' as const),
        checkIn: log?.check_in_time || null,
        checkOut: log?.check_out_time || null,
        autoPunchOut: log?.auto_punch_out ?? false,
      };
    });
  }, [employees, todayLogs]);

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

  const tabClass = (tab: ManagerTab) =>
    `px-3 py-2 rounded-xl text-sm transition-colors ${
      activeTab === tab ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'
    }`;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
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
            <h3 className="mb-3 text-gray-800">ملخص اليوم</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                label="حاضرون"
                value={todayStats.present}
                color="bg-emerald-50 border-emerald-100"
              />
              <StatCard
                icon={<Timer className="w-5 h-5 text-amber-500" />}
                label="متأخرون"
                value={todayStats.late}
                color="bg-amber-50 border-amber-100"
              />
              <StatCard
                icon={<XCircle className="w-5 h-5 text-red-500" />}
                label="غائبون"
                value={todayStats.absent}
                color="bg-red-50 border-red-100"
              />
              <StatCard
                icon={<Coffee className="w-5 h-5 text-blue-500" />}
                label="في إجازة"
                value={todayStats.onLeave}
                color="bg-blue-50 border-blue-100"
              />
            </div>
          </div>
          <PendingRequestsCard
            pendingRequests={pendingRequests}
            profilesMap={profilesMap}
          />
          <EmployeeListUnified
            employees={todayEmployeeStatus}
            lateCounts={monthlyStats.lateCounts}
            absentCounts={monthlyStats.absentCounts}
            limit={5}
            to="/users"
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

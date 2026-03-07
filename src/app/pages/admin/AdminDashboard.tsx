import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import * as profilesService from '@/lib/services/profiles.service';
import * as departmentsService from '@/lib/services/departments.service';
import * as attendanceService from '@/lib/services/attendance.service';
import * as requestsService from '@/lib/services/requests.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import type { Profile } from '@/lib/services/profiles.service';
import type { Department } from '@/lib/services/departments.service';
import type { AttendanceLog } from '@/lib/services/attendance.service';
import type { LeaveRequest } from '@/lib/services/requests.service';
import { AdminDashboardSkeleton } from '../../components/skeletons';
import { PendingRequestsCard } from '../../components/PendingRequestsCard';
import {
  EmployeeStatusList,
  MonthlyStatsCard,
  AttendanceCharts,
  type EmployeeWithTodayStatus,
} from '../../components/dashboard';
import {
  CheckCircle2,
  Timer,
  XCircle,
  Coffee,
  Shield,
} from 'lucide-react';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { StatCard } from '../../components/shared/StatCard';
import { now } from '@/lib/time';

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type AdminTab = 'overview' | 'employees' | 'analytics';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [weekLogs, setWeekLogs] = useState<{ day: string; logs: AttendanceLog[] }[]>([]);
  const [monthLogs, setMonthLogs] = useState<AttendanceLog[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const handleAttendanceEvent = useCallback(
    (event: attendanceService.AttendanceChangeEvent) => {
      const today = dateStr(now());
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
    []
  );

  useRealtimeSubscription(
    () => attendanceService.subscribeToAttendanceLogs(handleAttendanceEvent),
    [handleAttendanceEvent]
  );

  useRealtimeSubscription(
    () =>
      requestsService.subscribeToAllRequests((event) => {
        if (event.eventType === 'INSERT' && event.new.status === 'pending') {
          setPendingRequests((prev) => [event.new, ...prev]);
        } else if (event.eventType === 'UPDATE') {
          setPendingRequests((prev) =>
            event.new.status === 'pending'
              ? prev.map((r) => (r.id === event.new.id ? event.new : r))
              : prev.filter((r) => r.id !== event.new.id)
          );
        }
      }),
    []
  );

  async function loadData() {
    try {
      setLoading(true);
      const today = dateStr(now());
      const [profs, depts, logs, pendingReqs] = await Promise.all([
        profilesService.listUsers(),
        departmentsService.listDepartments(),
        attendanceService.getAllLogsForDate(today),
        requestsService.getAllPendingRequests(),
      ]);
      setProfiles(profs);
      setDepartments(depts);
      setTodayLogs(logs);
      setPendingRequests(pendingReqs);

      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
      const weekData: { day: string; logs: AttendanceLog[] }[] = [];
      const base = now();
      for (let i = 4; i >= 0; i--) {
        const d = new Date(base);
        d.setDate(d.getDate() - i);
        const ds = dateStr(d);
        const dayLogs = await attendanceService.getAllLogsForDate(ds);
        weekData.push({
          day: days[d.getDay()] || d.toLocaleDateString('ar-IQ', { weekday: 'short' }),
          logs: dayLogs,
        });
      }
      setWeekLogs(weekData);

      const allNonAdmin = profs.filter((p) => p.role !== 'admin');
      const allMonthLogs: AttendanceLog[] = [];
      for (const emp of allNonAdmin) {
        const empLogs = await attendanceService.getMonthlyLogs(
          emp.id,
          base.getFullYear(),
          base.getMonth()
        );
        allMonthLogs.push(...empLogs);
      }
      setMonthLogs(allMonthLogs);
    } catch {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  const allNonAdmin = useMemo(
    () => profiles.filter((p) => p.role !== 'admin'),
    [profiles]
  );

  const overallStats = useMemo(() => {
    const present = todayLogs.filter((l) => l.status === 'present').length;
    const late = todayLogs.filter((l) => l.status === 'late').length;
    const onLeave = todayLogs.filter((l) => l.status === 'on_leave').length;
    const checkedIn = todayLogs.filter((l) => l.check_in_time).length;
    return {
      totalEmployees: allNonAdmin.length,
      totalDepartments: departments.length,
      present,
      late,
      absent: allNonAdmin.length - checkedIn,
      onLeave,
    };
  }, [todayLogs, allNonAdmin, departments]);

  const profilesMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  const todayEmployeeStatus = useMemo((): EmployeeWithTodayStatus[] => {
    const logsMap = new Map(todayLogs.map((l) => [l.user_id, l]));
    return allNonAdmin.map((emp) => {
      const log = logsMap.get(emp.id);
      return {
        ...emp,
        todayStatus: log?.status || ('absent' as const),
        checkIn: log?.check_in_time || null,
        checkOut: log?.check_out_time || null,
        autoPunchOut: log?.auto_punch_out ?? false,
      };
    });
  }, [allNonAdmin, todayLogs]);

  const monthlyStats = useMemo(() => {
    const lateCounts: Record<string, number> = {};
    const absentCounts: Record<string, number> = {};
    monthLogs.forEach((l) => {
      if (l.status === 'late') lateCounts[l.user_id] = (lateCounts[l.user_id] || 0) + 1;
      if (l.status === 'absent') absentCounts[l.user_id] = (absentCounts[l.user_id] || 0) + 1;
    });
    return { lateCounts, absentCounts };
  }, [monthLogs]);

  const deptChartData = useMemo(() => {
    return departments.map((dept) => {
      const empIds = allNonAdmin.filter((p) => p.department_id === dept.id).map((p) => p.id);
      const deptLogs = todayLogs.filter((l) => empIds.includes(l.user_id));
      return {
        name: dept.name_ar,
        حاضر: deptLogs.filter((l) => l.status === 'present').length,
        متأخر: deptLogs.filter((l) => l.status === 'late').length,
        غائب: empIds.length - deptLogs.filter((l) => l.check_in_time).length,
      };
    });
  }, [departments, allNonAdmin, todayLogs]);

  const pieData = useMemo(
    () =>
      [
        { name: 'حاضر', value: overallStats.present, color: '#059669' },
        { name: 'متأخر', value: overallStats.late, color: '#d97706' },
        { name: 'غائب', value: overallStats.absent, color: '#dc2626' },
        { name: 'إجازة', value: overallStats.onLeave, color: '#2563eb' },
      ].filter((d) => d.value > 0),
    [overallStats]
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

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  const tabClass = (tab: AdminTab) =>
    `px-3 py-2 rounded-xl text-sm transition-colors ${
      activeTab === tab ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-50'
    }`;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <DashboardHeader
        gradientClassName="bg-gradient-to-l from-purple-700 to-indigo-800"
        title="المدير العام"
        helperText="لوحة التحكم الرئيسية"
        subtitle="شبكة الساعة"
        avatar={<Shield className="w-6 h-6" />}
        footer={
          <div className="flex items-center justify-between text-sm">
            <span className="opacity-90">{overallStats.totalEmployees} موظف</span>
            <span className="opacity-90">{overallStats.totalDepartments} قسم</span>
          </div>
        }
      />

      <div className="bg-white rounded-2xl p-1 border border-gray-100 shadow-sm">
        <div className="grid grid-cols-3 gap-1">
          {(['overview', 'employees', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={tabClass(tab)}
            >
              {tab === 'overview' && 'نظرة عامة'}
              {tab === 'employees' && 'الموظفون'}
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
                value={overallStats.present}
                color="bg-emerald-50 border-emerald-100"
              />
              <StatCard
                icon={<Timer className="w-5 h-5 text-amber-500" />}
                label="متأخرون"
                value={overallStats.late}
                color="bg-amber-50 border-amber-100"
              />
              <StatCard
                icon={<XCircle className="w-5 h-5 text-red-500" />}
                label="غائبون"
                value={overallStats.absent}
                color="bg-red-50 border-red-100"
              />
              <StatCard
                icon={<Coffee className="w-5 h-5 text-blue-500" />}
                label="في إجازة"
                value={overallStats.onLeave}
                color="bg-blue-50 border-blue-100"
              />
            </div>
          </div>
          <PendingRequestsCard
            pendingRequests={pendingRequests}
            profilesMap={profilesMap}
          />
        </>
      )}

      {activeTab === 'employees' && (
        <>
          <EmployeeStatusList employees={todayEmployeeStatus} />
          <MonthlyStatsCard
            employees={allNonAdmin}
            lateCounts={monthlyStats.lateCounts}
            absentCounts={monthlyStats.absentCounts}
          />
        </>
      )}

      {activeTab === 'analytics' && (
        <AttendanceCharts
          pieData={pieData}
          weeklyTrend={weeklyTrend}
          deptChartData={deptChartData}
        />
      )}
    </div>
  );
}

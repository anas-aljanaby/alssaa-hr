import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import * as departmentsService from '@/lib/services/departments.service';
import * as profilesService from '@/lib/services/profiles.service';
import * as attendanceService from '@/lib/services/attendance.service';
import * as requestsService from '@/lib/services/requests.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { getAttendanceStatusAr } from '../../data/mockData';
import type { Profile } from '@/lib/services/profiles.service';
import type { AttendanceLog } from '@/lib/services/attendance.service';
import type { LeaveRequest } from '@/lib/services/requests.service';
import type { Department } from '@/lib/services/departments.service';
import { DashboardSkeleton } from '../../components/skeletons';
import { PendingRequestsCard } from '../../components/PendingRequestsCard';
import { todayStr } from '@/lib/services/attendance.service';
import { now } from '@/lib/time';
import {
  Users,
  CheckCircle2,
  Timer,
  XCircle,
  Coffee,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { StatCard } from '../../components/shared/StatCard';
import { getStatusColor } from '@/lib/ui-helpers';

export function ManagerDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [monthLogs, setMonthLogs] = useState<AttendanceLog[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'team'>('overview');

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
          now().getFullYear(),
          now().getMonth()
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

  const todayEmployeeStatus = useMemo(() => {
    const logsMap = new Map(todayLogs.map((l) => [l.user_id, l]));
    return employees.map((emp) => {
      const log = logsMap.get(emp.id);
      return {
        ...emp,
        todayStatus: log?.status || ('absent' as const),
        checkIn: log?.check_in_time || null,
        checkOut: log?.check_out_time || null,
      };
    });
  }, [employees, todayLogs]);

  const profilesMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  if (!currentUser) return null;

  if (loading) {
    return <DashboardSkeleton />;
  }

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
          {(['overview', 'team'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                activeTab === tab ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab === 'overview' ? 'نظرة عامة' : 'فريق العمل'}
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

          {pendingRequests.length > 0 && (
            <PendingRequestsCard
              pendingRequests={pendingRequests}
              profilesMap={profilesMap}
            />
          )}

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <h3 className="text-gray-800">حالة الموظفين اليوم</h3>
            </div>
            <div className="space-y-2">
              {todayEmployeeStatus.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                  onClick={() => navigate(`/user-details/${emp.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigate(`/user-details/${emp.id}`);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm text-blue-600">{emp.name_ar.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-800">{emp.name_ar}</p>
                      <p className="text-xs text-gray-400">
                        {emp.checkIn ? `الحضور: ${emp.checkIn}` : 'لم يسجل بعد'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs ${getStatusColor(emp.todayStatus)}`}>
                    {getAttendanceStatusAr(emp.todayStatus)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {pendingRequests.length === 0 && (
            <PendingRequestsCard
              pendingRequests={pendingRequests}
              profilesMap={profilesMap}
            />
          )}
        </>
      )}

      {activeTab === 'team' && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-gray-800">إحصائيات التأخر الشهرية</h3>
          </div>
          <div className="space-y-2">
            {employees.map((emp) => {
              const lateCount = monthlyStats.lateCounts[emp.id] || 0;
              const absentCount = monthlyStats.absentCounts[emp.id] || 0;
              return (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                  onClick={() => navigate(`/user-details/${emp.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigate(`/user-details/${emp.id}`);
                  }}
                >
                  <span className="text-sm text-gray-800">{emp.name_ar}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${lateCount >= 3 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}
                    >
                      تأخر: {lateCount}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                      غياب: {absentCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

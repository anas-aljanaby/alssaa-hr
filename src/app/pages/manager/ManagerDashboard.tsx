import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import * as departmentsService from '@/lib/services/departments.service';
import * as profilesService from '@/lib/services/profiles.service';
import * as attendanceService from '@/lib/services/attendance.service';
import * as requestsService from '@/lib/services/requests.service';
import { getAttendanceStatusAr } from '../../data/mockData';
import type { Profile } from '@/lib/services/profiles.service';
import type { AttendanceLog } from '@/lib/services/attendance.service';
import type { LeaveRequest } from '@/lib/services/requests.service';
import type { Department } from '@/lib/services/departments.service';
import {
  Users,
  CheckCircle2,
  Timer,
  XCircle,
  Coffee,
  AlertTriangle,
  BarChart3,
  ClipboardList,
} from 'lucide-react';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ManagerDashboard() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [monthLogs, setMonthLogs] = useState<AttendanceLog[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser?.uid]);

  async function loadData() {
    if (!currentUser?.departmentId) return;
    try {
      setLoading(true);
      const today = todayStr();
      const now = new Date();
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
          now.getFullYear(),
          now.getMonth()
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
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-gray-200 rounded-2xl h-36 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
        <div className="bg-gray-100 rounded-2xl h-40 animate-pulse" />
      </div>
    );
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-100 text-emerald-700';
      case 'late': return 'bg-amber-100 text-amber-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'on_leave': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-emerald-200 text-sm">لوحة تحكم المدير</p>
            <h2 className="text-white">{currentUser.nameAr}</h2>
            <p className="text-emerald-200 text-sm">{department?.name_ar}</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white/10 rounded-xl p-3 flex items-center justify-between">
          <span className="text-emerald-200 text-sm">إجمالي الموظفين</span>
          <span className="text-xl">{todayStats.total}</span>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-gray-800">ملخص اليوم</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm text-gray-600">حاضرون</span>
            </div>
            <p className="text-2xl text-gray-800">{todayStats.present}</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-gray-600">متأخرون</span>
            </div>
            <p className="text-2xl text-gray-800">{todayStats.late}</p>
          </div>
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-gray-600">غائبون</span>
            </div>
            <p className="text-2xl text-gray-800">{todayStats.absent}</p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-600">في إجازة</span>
            </div>
            <p className="text-2xl text-gray-800">{todayStats.onLeave}</p>
          </div>
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              <h3 className="text-gray-800">طلبات بانتظار الموافقة</h3>
            </div>
            <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs">
              {pendingRequests.length}
            </span>
          </div>
          <div className="space-y-2">
            {pendingRequests.slice(0, 3).map((req) => {
              const user = profilesMap.get(req.user_id);
              return (
                <div key={req.id} className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-800">{user?.name_ar ?? '—'}</span>
                    <span className="text-xs text-amber-600">
                      {req.type === 'annual_leave'
                        ? 'إجازة سنوية'
                        : req.type === 'sick_leave'
                          ? 'إجازة مرضية'
                          : req.type === 'hourly_permission'
                            ? 'إذن ساعي'
                            : 'تعديل وقت'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{req.note}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="text-gray-800">حالة الموظفين اليوم</h3>
        </div>
        <div className="space-y-2">
          {todayEmployeeStatus.map((emp) => (
            <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
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
              <span className={`px-2.5 py-1 rounded-full text-xs ${statusColor(emp.todayStatus)}`}>
                {getAttendanceStatusAr(emp.todayStatus)}
              </span>
            </div>
          ))}
        </div>
      </div>

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
              <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
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
    </div>
  );
}

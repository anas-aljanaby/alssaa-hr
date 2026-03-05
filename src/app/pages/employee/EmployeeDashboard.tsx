import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import * as attendanceService from '@/lib/services/attendance.service';
import * as leaveBalanceService from '@/lib/services/leave-balance.service';
import * as requestsService from '@/lib/services/requests.service';
import * as departmentsService from '@/lib/services/departments.service';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { getAttendanceStatusAr, getRequestTypeAr, getStatusAr } from '../../data/mockData';
import type { AttendanceLog, MonthlyStats } from '@/lib/services/attendance.service';
import type { LeaveBalance } from '@/lib/services/leave-balance.service';
import type { LeaveRequest } from '@/lib/services/requests.service';
import type { Department } from '@/lib/services/departments.service';
import { DashboardSkeleton } from '../../components/skeletons';
import { now } from '@/lib/time';
import {
  Clock,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
  Coffee,
} from 'lucide-react';
import { StatCard } from '../../components/shared/StatCard';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { getStatusColor } from '@/lib/ui-helpers';

export function EmployeeDashboard() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [userRequests, setUserRequests] = useState<LeaveRequest[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser?.uid]);

  useRealtimeSubscription(
    () => {
      if (!currentUser) return undefined;
      return attendanceService.subscribeToUserAttendance(currentUser.uid, (event) => {
        setTodayLog(event.new);
      });
    },
    [currentUser?.uid]
  );

  useRealtimeSubscription(
    () => {
      if (!currentUser) return undefined;
      return requestsService.subscribeToUserRequests(currentUser.uid, (event) => {
        if (event.eventType === 'INSERT') {
          setUserRequests((prev) => [event.new, ...prev]);
        } else if (event.eventType === 'UPDATE') {
          setUserRequests((prev) =>
            prev.map((r) => (r.id === event.new.id ? event.new : r))
          );
        }
      });
    },
    [currentUser?.uid]
  );

  async function loadData() {
    if (!currentUser) return;
    try {
      setLoading(true);
      const n = now();
      const [log, monthStats, balance, reqs, dept] = await Promise.all([
        attendanceService.getTodayLog(currentUser.uid),
        attendanceService.getMonthlyStats(currentUser.uid, n.getFullYear(), n.getMonth()),
        leaveBalanceService.getUserBalance(currentUser.uid),
        requestsService.getUserRequests(currentUser.uid),
        currentUser.departmentId
          ? departmentsService.getDepartmentById(currentUser.departmentId)
          : Promise.resolve(null),
      ]);
      setTodayLog(log);
      setStats(monthStats);
      setLeaveBalance(balance);
      setUserRequests(reqs);
      setDepartment(dept);
    } catch {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  if (!currentUser) return null;

  if (loading) {
    return <DashboardSkeleton />;
  }

  const pendingRequests = userRequests.filter((r) => r.status === 'pending');
  const upcomingLeaves = userRequests.filter(
    (r) => r.status === 'approved' && new Date(r.from_date_time) > now()
  );

  const current = now();
  const greeting = current.getHours() < 12 ? 'صباح الخير' : 'مساء الخير';

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <DashboardHeader
        gradientClassName="bg-gradient-to-l from-blue-600 to-blue-700"
        title={currentUser.nameAr}
        subtitle={department?.name_ar}
        avatar={<span className="text-xl">{currentUser.nameAr.charAt(0)}</span>}
        helperText={greeting}
        footer={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-200" />
              <span className="text-sm text-blue-200">حالة اليوم</span>
            </div>
            {todayLog ? (
              <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(todayLog.status)}`}>
                {getAttendanceStatusAr(todayLog.status)}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                لم يتم التسجيل
              </span>
            )}
          </div>
        }
      />

      {/* Monthly Statistics */}
      {stats && (
        <div>
          <h3 className="mb-3 text-gray-800">إحصائيات الشهر</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              label="أيام الحضور"
              value={stats.presentDays}
              color="bg-emerald-50 border-emerald-100"
            />
            <StatCard
              icon={<Timer className="w-5 h-5 text-amber-500" />}
              label="أيام التأخر"
              value={stats.lateDays}
              color="bg-amber-50 border-amber-100"
              warningIcon={
                stats.lateDays >= 3 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                ) : null
              }
            />
            <StatCard
              icon={<XCircle className="w-5 h-5 text-red-500" />}
              label="أيام الغياب"
              value={stats.absentDays}
              color="bg-red-50 border-red-100"
            />
            <StatCard
              icon={<Coffee className="w-5 h-5 text-blue-500" />}
              label="أيام الإجازة"
              value={stats.leaveDays}
              color="bg-blue-50 border-blue-100"
            />
          </div>
        </div>
      )}

      {/* Leave Balance */}
      {leaveBalance && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h3 className="mb-3 text-gray-800">رصيد الإجازات</h3>
          <div className="space-y-3">
            <BalanceBar
              label="الإجازة السنوية"
              used={leaveBalance.used_annual}
              total={leaveBalance.total_annual}
              color="bg-blue-500"
            />
            <BalanceBar
              label="الإجازة المرضية"
              used={leaveBalance.used_sick}
              total={leaveBalance.total_sick}
              color="bg-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-gray-800">طلبات قيد الانتظار</h3>
          </div>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div key={req.id} className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-800">{getRequestTypeAr(req.type)}</span>
                  <span className="text-xs px-2 py-1 bg-amber-200 text-amber-800 rounded-full">
                    {getStatusAr(req.status)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{req.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Approved Leaves */}
      {upcomingLeaves.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-blue-500" />
            <h3 className="text-gray-800">إجازات قادمة</h3>
          </div>
          <div className="space-y-2">
            {upcomingLeaves.map((leave) => (
              <div key={leave.id} className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-800">{getRequestTypeAr(leave.type)}</span>
                  <span className="text-xs text-blue-600">
                    {new Date(leave.from_date_time).toLocaleDateString('ar-IQ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceBar({
  label,
  used,
  total,
  color,
}: {
  label: string;
  used: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (used / total) * 100 : 0;
  const remaining = total - used;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">المتبقي: {remaining} يوم</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-400">مستخدم: {used}</span>
        <span className="text-xs text-gray-400">الإجمالي: {total}</span>
      </div>
    </div>
  );
}

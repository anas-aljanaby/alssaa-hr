import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import {
  getUserLeaveBalance,
  getDepartmentById,
  getAttendanceStatusAr,
  getRequestTypeAr,
  getStatusAr,
  type AttendanceLog,
} from '../../data/mockData';
import {
  Clock,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
  TrendingUp,
  Coffee,
  MapPin,
} from 'lucide-react';

export function EmployeeDashboard() {
  const { currentUser } = useAuth();
  const { attendanceLogs, requests, getTodayLog } = useApp();

  if (!currentUser) return null;

  const todayLog = getTodayLog(currentUser.uid);
  const department = getDepartmentById(currentUser.departmentId);
  const leaveBalance = getUserLeaveBalance(currentUser.uid);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const monthLogs = attendanceLogs.filter(log => {
      const d = new Date(log.date);
      return log.userId === currentUser.uid && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    return {
      present: monthLogs.filter(l => l.status === 'present').length,
      late: monthLogs.filter(l => l.status === 'late').length,
      absent: monthLogs.filter(l => l.status === 'absent').length,
      onLeave: monthLogs.filter(l => l.status === 'on_leave').length,
      total: monthLogs.length,
    };
  }, [attendanceLogs, currentUser.uid]);

  const userRequests = requests.filter(r => r.userId === currentUser.uid);
  const pendingRequests = userRequests.filter(r => r.status === 'pending');
  const upcomingLeaves = userRequests.filter(
    r => r.status === 'approved' && new Date(r.fromDateTime) > new Date()
  );

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'صباح الخير' : now.getHours() < 18 ? 'مساء الخير' : 'مساء الخير';

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
      {/* Header */}
      <div className="bg-gradient-to-l from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-blue-200 text-sm">{greeting}</p>
            <h2 className="text-white">{currentUser.nameAr}</h2>
            <p className="text-blue-200 text-sm">{department?.nameAr}</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-xl">{currentUser.nameAr.charAt(0)}</span>
          </div>
        </div>

        {/* Today Status */}
        <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-200" />
              <span className="text-sm text-blue-200">حالة اليوم</span>
            </div>
            {todayLog ? (
              <span className={`px-3 py-1 rounded-full text-xs ${statusColor(todayLog.status)}`}>
                {getAttendanceStatusAr(todayLog.status)}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600">لم يتم التسجيل</span>
            )}
          </div>
          {todayLog?.checkInTime && (
            <div className="flex items-center gap-4 mt-2 text-sm text-blue-100">
              <span>الحضور: {todayLog.checkInTime}</span>
              {todayLog.checkOutTime && <span>الانصراف: {todayLog.checkOutTime}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Statistics */}
      <div>
        <h3 className="mb-3 text-gray-800">إحصائيات الشهر</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            label="أيام الحضور"
            value={monthlyStats.present}
            color="bg-emerald-50 border-emerald-100"
          />
          <StatCard
            icon={<Timer className="w-5 h-5 text-amber-500" />}
            label="أيام التأخر"
            value={monthlyStats.late}
            color="bg-amber-50 border-amber-100"
            warning={monthlyStats.late >= 3}
          />
          <StatCard
            icon={<XCircle className="w-5 h-5 text-red-500" />}
            label="أيام الغياب"
            value={monthlyStats.absent}
            color="bg-red-50 border-red-100"
          />
          <StatCard
            icon={<Coffee className="w-5 h-5 text-blue-500" />}
            label="أيام الإجازة"
            value={monthlyStats.onLeave}
            color="bg-blue-50 border-blue-100"
          />
        </div>
      </div>

      {/* Leave Balance */}
      {leaveBalance && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h3 className="mb-3 text-gray-800">رصيد الإجازات</h3>
          <div className="space-y-3">
            <BalanceBar
              label="الإجازة السنوية"
              used={leaveBalance.usedAnnual}
              total={leaveBalance.totalAnnual}
              color="bg-blue-500"
            />
            <BalanceBar
              label="الإجازة المرضية"
              used={leaveBalance.usedSick}
              total={leaveBalance.totalSick}
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
            {pendingRequests.map(req => (
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
            {upcomingLeaves.map(leave => (
              <div key={leave.id} className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-800">{getRequestTypeAr(leave.type)}</span>
                  <span className="text-xs text-blue-600">
                    {new Date(leave.fromDateTime).toLocaleDateString('ar-IQ')}
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

function StatCard({ icon, label, value, color, warning }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  warning?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 border ${color} relative`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="text-2xl text-gray-800">{value}</p>
      {warning && (
        <div className="absolute top-2 left-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        </div>
      )}
    </div>
  );
}

function BalanceBar({ label, used, total, color }: {
  label: string;
  used: number;
  total: number;
  color: string;
}) {
  const percentage = (used / total) * 100;
  const remaining = total - used;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm text-gray-500">المتبقي: {remaining} يوم</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-400">مستخدم: {used}</span>
        <span className="text-xs text-gray-400">الإجمالي: {total}</span>
      </div>
    </div>
  );
}

import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import {
  getDepartmentById,
  getDepartmentEmployees,
  getUserById,
  getAttendanceStatusAr,
  type User,
} from '../../data/mockData';
import {
  Users,
  CheckCircle2,
  Timer,
  XCircle,
  Coffee,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  ClipboardList,
} from 'lucide-react';

export function ManagerDashboard() {
  const { currentUser } = useAuth();
  const { attendanceLogs, requests } = useApp();

  if (!currentUser) return null;

  const department = getDepartmentById(currentUser.departmentId);
  const departmentEmployees = getDepartmentEmployees(currentUser.departmentId);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const todayStats = useMemo(() => {
    const empIds = departmentEmployees.map(e => e.uid);
    const todayLogs = attendanceLogs.filter(l => empIds.includes(l.userId) && l.date === todayStr);

    return {
      total: departmentEmployees.length,
      present: todayLogs.filter(l => l.status === 'present').length,
      late: todayLogs.filter(l => l.status === 'late').length,
      absent: departmentEmployees.length - todayLogs.filter(l => l.checkInTime).length,
      onLeave: todayLogs.filter(l => l.status === 'on_leave').length,
    };
  }, [attendanceLogs, departmentEmployees, todayStr]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const empIds = departmentEmployees.map(e => e.uid);
    const monthLogs = attendanceLogs.filter(l => {
      const d = new Date(l.date);
      return empIds.includes(l.userId) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const lateCounts: Record<string, number> = {};
    const absentCounts: Record<string, number> = {};
    monthLogs.forEach(l => {
      if (l.status === 'late') {
        lateCounts[l.userId] = (lateCounts[l.userId] || 0) + 1;
      }
      if (l.status === 'absent') {
        absentCounts[l.userId] = (absentCounts[l.userId] || 0) + 1;
      }
    });

    return { lateCounts, absentCounts, totalLogs: monthLogs.length };
  }, [attendanceLogs, departmentEmployees]);

  const pendingRequests = requests.filter(
    r => departmentEmployees.some(e => e.uid === r.userId) && r.status === 'pending'
  );

  const todayEmployeeStatus = useMemo(() => {
    return departmentEmployees.map(emp => {
      const log = attendanceLogs.find(l => l.userId === emp.uid && l.date === todayStr);
      return {
        ...emp,
        todayStatus: log?.status || 'absent',
        checkIn: log?.checkInTime || null,
        checkOut: log?.checkOutTime || null,
      };
    });
  }, [departmentEmployees, attendanceLogs, todayStr]);

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
      <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-emerald-200 text-sm">لوحة تحكم المدير</p>
            <h2 className="text-white">{currentUser.nameAr}</h2>
            <p className="text-emerald-200 text-sm">{department?.nameAr}</p>
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

      {/* Today Summary */}
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

      {/* Pending Approvals */}
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
            {pendingRequests.slice(0, 3).map(req => {
              const user = getUserById(req.userId);
              return (
                <div key={req.id} className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-800">{user?.nameAr}</span>
                    <span className="text-xs text-amber-600">
                      {req.type === 'annual_leave' ? 'إجازة سنوية' :
                       req.type === 'sick_leave' ? 'إجازة مرضية' :
                       req.type === 'hourly_permission' ? 'إذن ساعي' : 'تعديل وقت'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{req.note}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Employee Status Today */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="text-gray-800">حالة الموظفين اليوم</h3>
        </div>
        <div className="space-y-2">
          {todayEmployeeStatus.map(emp => (
            <div key={emp.uid} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm text-blue-600">{emp.nameAr.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-800">{emp.nameAr}</p>
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

      {/* Monthly Late Statistics */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="text-gray-800">إحصائيات التأخر الشهرية</h3>
        </div>
        <div className="space-y-2">
          {departmentEmployees.map(emp => {
            const lateCount = monthlyStats.lateCounts[emp.uid] || 0;
            const absentCount = monthlyStats.absentCounts[emp.uid] || 0;
            return (
              <div key={emp.uid} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-800">{emp.nameAr}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${lateCount >= 3 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
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

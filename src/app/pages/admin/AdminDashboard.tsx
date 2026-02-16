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
import { AdminDashboardSkeleton } from '../../components/skeletons';
import {
  Users,
  Building2,
  CheckCircle2,
  Timer,
  XCircle,
  TrendingUp,
  FileText,
  BarChart3,
  Activity,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [weekLogs, setWeekLogs] = useState<{ day: string; logs: AttendanceLog[] }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const handleAttendanceEvent = useCallback(
    (event: attendanceService.AttendanceChangeEvent) => {
      const today = dateStr(new Date());
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
          setPendingCount((prev) => prev + 1);
        } else if (event.eventType === 'UPDATE') {
          const wasPending = event.old.status === 'pending';
          const isPending = event.new.status === 'pending';
          if (wasPending && !isPending) setPendingCount((prev) => Math.max(0, prev - 1));
          else if (!wasPending && isPending) setPendingCount((prev) => prev + 1);
        }
      }),
    []
  );

  async function loadData() {
    try {
      setLoading(true);
      const today = dateStr(new Date());
      const [profs, depts, logs, pending] = await Promise.all([
        profilesService.listUsers(),
        departmentsService.listDepartments(),
        attendanceService.getAllLogsForDate(today),
        requestsService.countPendingRequests(),
      ]);
      setProfiles(profs);
      setDepartments(depts);
      setTodayLogs(logs);
      setPendingCount(pending);

      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
      const weekData: { day: string; logs: AttendanceLog[] }[] = [];
      for (let i = 4; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = dateStr(d);
        const dayLogs = await attendanceService.getAllLogsForDate(ds);
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
      pendingRequests: pendingCount,
    };
  }, [todayLogs, allNonAdmin, departments, pendingCount]);

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

  const statCards = [
    { icon: Users, label: 'إجمالي الموظفين', value: overallStats.totalEmployees, color: 'bg-blue-50 text-blue-600', iconBg: 'bg-blue-100' },
    { icon: Building2, label: 'الأقسام', value: overallStats.totalDepartments, color: 'bg-purple-50 text-purple-600', iconBg: 'bg-purple-100' },
    { icon: CheckCircle2, label: 'حاضرون اليوم', value: overallStats.present, color: 'bg-emerald-50 text-emerald-600', iconBg: 'bg-emerald-100' },
    { icon: Timer, label: 'متأخرون', value: overallStats.late, color: 'bg-amber-50 text-amber-600', iconBg: 'bg-amber-100' },
    { icon: XCircle, label: 'غائبون', value: overallStats.absent, color: 'bg-red-50 text-red-600', iconBg: 'bg-red-100' },
    { icon: FileText, label: 'طلبات معلقة', value: overallStats.pendingRequests, color: 'bg-indigo-50 text-indigo-600', iconBg: 'bg-indigo-100' },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="bg-gradient-to-l from-purple-700 to-indigo-800 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-purple-200 text-sm">لوحة التحكم الرئيسية</p>
            <h2 className="text-white">المدير العام</h2>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
        </div>
        <p className="text-purple-200 text-sm">شبكة السعاع الإعلامية</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {statCards.map((card, idx) => (
          <div key={idx} className={`rounded-2xl p-3 border border-gray-100 ${card.color}`}>
            <div className={`w-8 h-8 ${card.iconBg} rounded-lg flex items-center justify-center mb-2`}>
              <card.icon className="w-4 h-4" />
            </div>
            <p className="text-xl text-gray-800">{card.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-blue-500" />
          <h3 className="text-gray-800">توزيع الحضور اليوم</h3>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend formatter={(value) => <span style={{ fontSize: '12px' }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          <h3 className="text-gray-800">اتجاهات الأسبوع</h3>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="حضور" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="تأخر" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-indigo-500" />
          <h3 className="text-gray-800">أداء الأقسام</h3>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="حاضر" fill="#059669" stackId="a" />
              <Bar dataKey="متأخر" fill="#d97706" stackId="a" />
              <Bar dataKey="غائب" fill="#dc2626" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {overallStats.pendingRequests > 0 && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-amber-800">تنبيهات</h3>
          </div>
          <p className="text-sm text-amber-700">
            يوجد {overallStats.pendingRequests} طلب بانتظار المراجعة
          </p>
        </div>
      )}
    </div>
  );
}

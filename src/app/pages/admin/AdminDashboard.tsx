import React, { useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import {
  users,
  departments,
  getDepartmentById,
  getDepartmentEmployees,
  getAttendanceStatusAr,
} from '../../data/mockData';
import {
  Users,
  Building2,
  CheckCircle2,
  Timer,
  XCircle,
  Coffee,
  TrendingUp,
  FileText,
  BarChart3,
  Activity,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export function AdminDashboard() {
  const { attendanceLogs, requests } = useApp();

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const overallStats = useMemo(() => {
    const todayLogs = attendanceLogs.filter(l => l.date === todayStr);
    const allNonAdmin = users.filter(u => u.role !== 'admin');
    return {
      totalEmployees: allNonAdmin.length,
      totalDepartments: departments.length,
      present: todayLogs.filter(l => l.status === 'present').length,
      late: todayLogs.filter(l => l.status === 'late').length,
      absent: allNonAdmin.length - todayLogs.filter(l => l.checkInTime).length,
      onLeave: todayLogs.filter(l => l.status === 'on_leave').length,
      pendingRequests: requests.filter(r => r.status === 'pending').length,
    };
  }, [attendanceLogs, requests, todayStr]);

  const deptChartData = useMemo(() => {
    return departments.map(dept => {
      const empIds = getDepartmentEmployees(dept.id).map(e => e.uid);
      const todayLogs = attendanceLogs.filter(l => empIds.includes(l.userId) && l.date === todayStr);
      return {
        name: dept.nameAr,
        حاضر: todayLogs.filter(l => l.status === 'present').length,
        متأخر: todayLogs.filter(l => l.status === 'late').length,
        غائب: empIds.length - todayLogs.filter(l => l.checkInTime).length,
      };
    });
  }, [attendanceLogs, todayStr]);

  const pieData = useMemo(() => {
    return [
      { name: 'حاضر', value: overallStats.present, color: '#059669' },
      { name: 'متأخر', value: overallStats.late, color: '#d97706' },
      { name: 'غائب', value: overallStats.absent, color: '#dc2626' },
      { name: 'إجازة', value: overallStats.onLeave, color: '#2563eb' },
    ].filter(d => d.value > 0);
  }, [overallStats]);

  const weeklyTrend = useMemo(() => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    const now = new Date();
    const result = [];

    for (let i = 4; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayLogs = attendanceLogs.filter(l => l.date === dayStr);
      result.push({
        day: days[d.getDay()] || d.toLocaleDateString('ar-IQ', { weekday: 'short' }),
        حضور: dayLogs.filter(l => l.status === 'present').length,
        تأخر: dayLogs.filter(l => l.status === 'late').length,
      });
    }

    return result;
  }, [attendanceLogs]);

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
      {/* Header */}
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

      {/* Stats Grid */}
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

      {/* Attendance Distribution */}
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
              <Legend
                formatter={(value) => <span style={{ fontSize: '12px' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Trend */}
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

      {/* Department Performance */}
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

      {/* Warnings */}
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

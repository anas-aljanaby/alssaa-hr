import React, { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import {
  users,
  departments,
  getDepartmentEmployees,
  getDepartmentById,
  getUserById,
  auditLogs,
  attendancePolicy,
} from '../../data/mockData';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Clock,
  Shield,
  Settings,
  Calendar,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

export function ReportsPage() {
  const { attendanceLogs, requests } = useApp();
  const [activeTab, setActiveTab] = useState<'reports' | 'audit' | 'policy'>('reports');

  const monthlyReport = useMemo(() => {
    const now = new Date();
    const allNonAdmin = users.filter(u => u.role !== 'admin');

    return allNonAdmin.map(user => {
      const monthLogs = attendanceLogs.filter(l => {
        const d = new Date(l.date);
        return l.userId === user.uid && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });

      return {
        name: user.nameAr,
        dept: getDepartmentById(user.departmentId)?.nameAr || '',
        present: monthLogs.filter(l => l.status === 'present').length,
        late: monthLogs.filter(l => l.status === 'late').length,
        absent: monthLogs.filter(l => l.status === 'absent').length,
        onLeave: monthLogs.filter(l => l.status === 'on_leave').length,
      };
    });
  }, [attendanceLogs]);

  const deptReport = useMemo(() => {
    const now = new Date();
    return departments.map(dept => {
      const empIds = getDepartmentEmployees(dept.id).map(e => e.uid);
      const monthLogs = attendanceLogs.filter(l => {
        const d = new Date(l.date);
        return empIds.includes(l.userId) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });

      const totalWorkDays = empIds.length * 20; // Approximate work days in month
      const presentDays = monthLogs.filter(l => l.status === 'present' || l.status === 'late').length;
      const rate = totalWorkDays > 0 ? Math.round((presentDays / totalWorkDays) * 100) : 0;

      return {
        name: dept.nameAr,
        'نسبة الحضور': rate,
        'عدد الموظفين': empIds.length,
      };
    });
  }, [attendanceLogs]);

  const tabs = [
    { key: 'reports' as const, label: 'التقارير', icon: BarChart3 },
    { key: 'audit' as const, label: 'سجل المراجعة', icon: Shield },
    { key: 'policy' as const, label: 'سياسة الحضور', icon: Settings },
  ];

  const dayNames: Record<number, string> = {
    0: 'الأحد',
    1: 'الاثنين',
    2: 'الثلاثاء',
    3: 'الأربعاء',
    4: 'الخميس',
    5: 'الجمعة',
    6: 'السبت',
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <h1 className="text-gray-800">التقارير والإعدادات</h1>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'reports' && (
        <>
          {/* Export Buttons */}
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="text-sm">تصدير Excel</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-700 rounded-xl border border-red-200 hover:bg-red-100 transition-colors">
              <Download className="w-4 h-4" />
              <span className="text-sm">تصدير PDF</span>
            </button>
          </div>

          {/* Department Attendance Rate */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-blue-500" />
              <h3 className="text-gray-800">نسبة حضور الأقسام</h3>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptReport}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip />
                  <Bar dataKey="نسبة الحضور" fill="#1e40af" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Employee Report */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <h3 className="text-gray-800">تقرير الموظفين الشهري</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-right py-2 text-gray-500">الاسم</th>
                    <th className="text-center py-2 text-gray-500">حضور</th>
                    <th className="text-center py-2 text-gray-500">تأخر</th>
                    <th className="text-center py-2 text-gray-500">غياب</th>
                    <th className="text-center py-2 text-gray-500">إجازة</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyReport.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-50">
                      <td className="py-2.5 text-gray-800">{row.name}</td>
                      <td className="text-center">
                        <span className="text-emerald-600">{row.present}</span>
                      </td>
                      <td className="text-center">
                        <span className={row.late >= 3 ? 'text-red-600' : 'text-amber-600'}>{row.late}</span>
                      </td>
                      <td className="text-center">
                        <span className="text-red-600">{row.absent}</span>
                      </td>
                      <td className="text-center">
                        <span className="text-blue-600">{row.onLeave}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-amber-50 p-3 rounded-xl border border-amber-200 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">سجل المراجعة يتتبع جميع الإجراءات في النظام</p>
          </div>

          {auditLogs
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map(log => {
              const actor = getUserById(log.actorId);
              return (
                <div key={log.id} className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-xs text-gray-600">{actor?.nameAr.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-800">{actor?.nameAr}</p>
                        <p className="text-xs text-blue-600">{log.actionAr}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(log.timestamp).toLocaleDateString('ar-IQ', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg">{log.details}</p>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {activeTab === 'policy' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="text-gray-800">إعدادات الدوام</h3>
            </div>

            <div className="space-y-3">
              <PolicyRow label="وقت بدء العمل" value={attendancePolicy.workStartTime} />
              <PolicyRow label="وقت نهاية العمل" value={attendancePolicy.workEndTime} />
              <PolicyRow label="فترة السماح (دقيقة)" value={`${attendancePolicy.gracePeriodMinutes} دقيقة`} />
              <PolicyRow label="وقت قطع الغياب" value={attendancePolicy.absentCutoffTime} />
              <PolicyRow
                label="أيام الإجازة الأسبوعية"
                value={attendancePolicy.weeklyOffDays.map(d => dayNames[d]).join(' و ')}
              />
              <PolicyRow label="الحد الأقصى للتأخر قبل التنبيه" value={`${attendancePolicy.maxLateDaysBeforeWarning} أيام`} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <h3 className="text-gray-800">سياسة الإجازات</h3>
            </div>

            <div className="space-y-3">
              <PolicyRow label="الإجازة السنوية" value={`${attendancePolicy.annualLeavePerYear} يوم`} />
              <PolicyRow label="الإجازة المرضية" value={`${attendancePolicy.sickLeavePerYear} يوم`} />
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
            <h4 className="text-blue-800 mb-2">منطق التصنيف</h4>
            <div className="space-y-2 text-sm text-blue-700">
              <p>• <strong>حاضر:</strong> تسجيل الحضور قبل انتهاء فترة السماح</p>
              <p>• <strong>متأخر:</strong> تسجيل الحضور بعد فترة السماح</p>
              <p>• <strong>غائب:</strong> عدم تسجيل الحضور قبل وقت القطع</p>
              <p>• <strong>في إجازة:</strong> وجود طلب إجازة معتمد يتداخل مع التاريخ</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm text-gray-800 bg-gray-50 px-3 py-1 rounded-lg">{value}</span>
    </div>
  );
}

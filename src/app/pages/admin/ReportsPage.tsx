import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import * as profilesService from '@/lib/services/profiles.service';
import * as departmentsService from '@/lib/services/departments.service';
import * as attendanceService from '@/lib/services/attendance.service';
import * as auditService from '@/lib/services/audit.service';
import * as policyService from '@/lib/services/policy.service';
import type { Profile } from '@/lib/services/profiles.service';
import type { Department } from '@/lib/services/departments.service';
import type { AttendanceLog } from '@/lib/services/attendance.service';
import type { AuditLog } from '@/lib/services/audit.service';
import type { AttendancePolicy } from '@/lib/services/policy.service';
import { Pagination, usePagination } from '../../components/Pagination';
import { ReportsSkeleton } from '../../components/skeletons';
import { now } from '@/lib/time';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Clock,
  Shield,
  Settings,
  X,
  Calendar,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { PageLayout } from '../../components/layout/PageLayout';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type MonthlyReportRow = {
  name: string;
  dept: string;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
};

type DeptReportRow = {
  name: string;
  'نسبة الحضور': number;
  'عدد الموظفين': number;
};

function downloadExcel(monthlyReport: MonthlyReportRow[], deptReport: DeptReportRow[]) {
  const ws1 = XLSX.utils.json_to_sheet(
    monthlyReport.map((r) => ({
      'الاسم': r.name,
      'القسم': r.dept,
      'حضور': r.present,
      'تأخر': r.late,
      'غياب': r.absent,
      'إجازة': r.onLeave,
    }))
  );
  const ws2 = XLSX.utils.json_to_sheet(deptReport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'تقرير الموظفين');
  XLSX.utils.book_append_sheet(wb, ws2, 'نسبة الأقسام');
  const n = now();
  const name = `تقرير_${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(wb, name);
}

function downloadPdf(monthlyReport: MonthlyReportRow[], deptReport: DeptReportRow[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const n = now();
  const title = `تقرير شهري - ${n.getFullYear()}/${String(n.getMonth() + 1).padStart(2, '0')}`;
  doc.setFontSize(14);
  doc.text(title, 14, 16);

  autoTable(doc, {
    startY: 24,
    head: [['الاسم', 'القسم', 'حضور', 'تأخر', 'غياب', 'إجازة']],
    body: monthlyReport.map((r) => [
      r.name,
      r.dept,
      String(r.present),
      String(r.late),
      String(r.absent),
      String(r.onLeave),
    ]),
    styles: { font: 'Helvetica', fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 24;
  autoTable(doc, {
    startY: finalY + 14,
    head: [['القسم', 'نسبة الحضور %', 'عدد الموظفين']],
    body: deptReport.map((r) => [r.name, String(r['نسبة الحضور']), String(r['عدد الموظفين'])]),
    styles: { font: 'Helvetica', fontSize: 9 },
    headStyles: { fillColor: [16, 185, 129] },
  });

  doc.save(`تقرير_${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}.pdf`);
}

const AUDIT_PAGE_SIZE = 15;
const REPORT_PAGE_SIZE = 20;

export function ReportsPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [monthLogs, setMonthLogs] = useState<AttendanceLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [activeTab, setActiveTab] = useState<'reports' | 'audit' | 'policy'>('reports');
  const [showEditPolicy, setShowEditPolicy] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [editPolicy, setEditPolicy] = useState<AttendancePolicy | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser?.uid, currentUser?.role, currentUser?.departmentId]);

  async function loadData() {
    if (!currentUser) return;
    try {
      setLoading(true);
      const n = now();

      if (isAdmin) {
        const [profs, depts, audit, pol] = await Promise.all([
          profilesService.listUsers(),
          departmentsService.listDepartments(),
          auditService.getRecentAuditLogs(30),
          policyService.getPolicy(),
        ]);
        setProfiles(profs);
        setDepartments(depts);
        setAuditLogs(audit);
        setPolicy(pol);

        const allMonthLogs: AttendanceLog[] = [];
        const nonAdmins = profs.filter((p) => p.role !== 'admin');
        for (const user of nonAdmins) {
          const logs = await attendanceService.getMonthlyLogs(
            user.id,
            n.getFullYear(),
            n.getMonth()
          );
          allMonthLogs.push(...logs);
        }
        setMonthLogs(allMonthLogs);
        return;
      }

      if (isManager) {
        if (!currentUser.departmentId) {
          toast.error('لم يتم تعيين قسم لك بعد');
          setProfiles([]);
          setDepartments([]);
          setAuditLogs([]);
          const pol = await policyService.getPolicy();
          setPolicy(pol);
          setMonthLogs([]);
          return;
        }

        const [emps, dept, pol] = await Promise.all([
          profilesService.getDepartmentEmployees(currentUser.departmentId),
          departmentsService.getDepartmentById(currentUser.departmentId),
          policyService.getPolicy(),
        ]);
        setProfiles(emps);
        setDepartments([dept]);
        setAuditLogs([]);
        setPolicy(pol);

        const allMonthLogs: AttendanceLog[] = [];
        for (const user of emps) {
          const logs = await attendanceService.getMonthlyLogs(
            user.id,
            n.getFullYear(),
            n.getMonth()
          );
          allMonthLogs.push(...logs);
        }
        setMonthLogs(allMonthLogs);
        return;
      }

      // Other roles: only load policy; no detailed reports/audit
      const pol = await policyService.getPolicy();
      setProfiles([]);
      setDepartments([]);
      setAuditLogs([]);
      setPolicy(pol);
      setMonthLogs([]);
    } catch {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  const profilesMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  const deptsMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );

  const allNonAdmin = useMemo(
    () => profiles.filter((p) => p.role !== 'admin'),
    [profiles]
  );

  const monthlyReport = useMemo(() => {
    return allNonAdmin.map((user) => {
      const userLogs = monthLogs.filter((l) => l.user_id === user.id);
      return {
        name: user.name_ar,
        dept: deptsMap.get(user.department_id ?? '')?.name_ar || '',
        present: userLogs.filter((l) => l.status === 'present').length,
        late: userLogs.filter((l) => l.status === 'late').length,
        absent: userLogs.filter((l) => l.status === 'absent').length,
        onLeave: userLogs.filter((l) => l.status === 'on_leave').length,
      };
    });
  }, [allNonAdmin, monthLogs, deptsMap]);

  const deptReport = useMemo(() => {
    return departments.map((dept) => {
      const empIds = allNonAdmin.filter((p) => p.department_id === dept.id).map((p) => p.id);
      const deptLogs = monthLogs.filter((l) => empIds.includes(l.user_id));
      const totalWorkDays = empIds.length * 20;
      const presentDays = deptLogs.filter(
        (l) => l.status === 'present' || l.status === 'late'
      ).length;
      const rate = totalWorkDays > 0 ? Math.round((presentDays / totalWorkDays) * 100) : 0;
      return {
        name: dept.name_ar,
        'نسبة الحضور': rate,
        'عدد الموظفين': empIds.length,
      };
    });
  }, [departments, allNonAdmin, monthLogs]);

  const auditPagination = usePagination(auditLogs, AUDIT_PAGE_SIZE);
  const reportPagination = usePagination(monthlyReport, REPORT_PAGE_SIZE);

  const handleExportExcel = useCallback(() => {
    try {
      downloadExcel(monthlyReport, deptReport);
      toast.success('تم تصدير Excel بنجاح');
    } catch {
      toast.error('فشل تصدير Excel');
    }
  }, [monthlyReport, deptReport]);

  const handleExportPdf = useCallback(() => {
    try {
      downloadPdf(monthlyReport, deptReport);
      toast.success('تم تصدير PDF بنجاح');
    } catch {
      toast.error('فشل تصدير PDF');
    }
  }, [monthlyReport, deptReport]);

  const tabs =
    isAdmin
      ? ([
          { key: 'reports' as const, label: 'التقارير', icon: BarChart3 },
          { key: 'audit' as const, label: 'سجل المراجعة', icon: Shield },
          { key: 'policy' as const, label: 'سياسة الحضور', icon: Settings },
        ] as const)
      : ([
          { key: 'reports' as const, label: 'التقارير', icon: BarChart3 },
          { key: 'policy' as const, label: 'سياسة الحضور', icon: Settings },
        ] as const);

  const dayNames: Record<number, string> = {
    0: 'الأحد',
    1: 'الاثنين',
    2: 'الثلاثاء',
    3: 'الأربعاء',
    4: 'الخميس',
    5: 'الجمعة',
    6: 'السبت',
  };

  if (loading) {
    return <ReportsSkeleton />;
  }

  return (
    <PageLayout title="التقارير والإعدادات" backPath="/more">
      <div className="space-y-4">
        <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
          {tabs.map((tab) => (
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-sm">تصدير Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-700 rounded-xl border border-red-200 hover:bg-red-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">تصدير PDF</span>
              </button>
            </div>

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
                    {reportPagination.paginatedItems.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-50">
                        <td className="py-2.5 text-gray-800">{row.name}</td>
                        <td className="text-center">
                          <span className="text-emerald-600">{row.present}</span>
                        </td>
                        <td className="text-center">
                          <span className={row.late >= 3 ? 'text-red-600' : 'text-amber-600'}>
                            {row.late}
                          </span>
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
              <Pagination
                currentPage={reportPagination.currentPage}
                totalItems={reportPagination.totalItems}
                pageSize={reportPagination.pageSize}
                onPageChange={reportPagination.setCurrentPage}
              />
            </div>
          </>
        )}

        {activeTab === 'audit' && isAdmin && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-amber-50 p-3 rounded-xl border border-amber-200 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                سجل المراجعة يتتبع جميع الإجراءات في النظام
              </p>
            </div>

            {auditPagination.paginatedItems.map((log) => {
              const actor = profilesMap.get(log.actor_id);
              return (
                <div key={log.id} className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-xs text-gray-600">
                          {actor?.name_ar?.charAt(0) ?? '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-800">{actor?.name_ar ?? '—'}</p>
                        <p className="text-xs text-blue-600">{log.action_ar}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(log.created_at).toLocaleDateString('ar-IQ', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg">
                      {log.details}
                    </p>
                  )}
                </div>
              );
            })}

            <Pagination
              currentPage={auditPagination.currentPage}
              totalItems={auditPagination.totalItems}
              pageSize={auditPagination.pageSize}
              onPageChange={auditPagination.setCurrentPage}
            />
          </div>
        )}

        {activeTab === 'policy' && policy && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <h3 className="text-gray-800">إعدادات الدوام</h3>
                </div>
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditPolicy(policy);
                      setShowEditPolicy(true);
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    تعديل
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <PolicyRow label="وقت بدء العمل" value={policy.work_start_time} />
                <PolicyRow label="وقت نهاية العمل" value={policy.work_end_time} />
                <PolicyRow
                  label="فترة السماح (دقيقة)"
                  value={`${policy.grace_period_minutes} دقيقة`}
                />
                <PolicyRow
                  label="مهلة الانصراف التلقائي (دقيقة)"
                  value={`${policy.auto_punch_out_buffer_minutes ?? 30} دقيقة`}
                />
                <PolicyRow label="وقت قطع الغياب" value={policy.absent_cutoff_time} />
                <PolicyRow
                  label="أيام الإجازة الأسبوعية"
                  value={policy.weekly_off_days.map((d) => dayNames[d]).join(' و ')}
                />
                <PolicyRow
                  label="الحد الأقصى للتأخر قبل التنبيه"
                  value={`${policy.max_late_days_before_warning} أيام`}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-emerald-500" />
                <h3 className="text-gray-800">سياسة الإجازات</h3>
              </div>

              <div className="space-y-3">
                <PolicyRow
                  label="الإجازة السنوية"
                  value={`${policy.annual_leave_per_year} يوم`}
                />
                <PolicyRow
                  label="الإجازة المرضية"
                  value={`${policy.sick_leave_per_year} يوم`}
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
              <h4 className="text-blue-800 mb-2">منطق التصنيف</h4>
              <div className="space-y-2 text-sm text-blue-700">
                <p>
                  • <strong>حاضر:</strong> تسجيل الحضور قبل انتهاء فترة السماح
                </p>
                <p>
                  • <strong>متأخر:</strong> تسجيل الحضور بعد فترة السماح
                </p>
                <p>
                  • <strong>غائب:</strong> عدم تسجيل الحضور قبل وقت القطع
                </p>
                <p>
                  • <strong>في إجازة:</strong> وجود طلب إجازة معتمد يتداخل مع التاريخ
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'policy' && !policy && (
          <div className="text-center py-8 text-gray-400">
            <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>لم يتم تعيين سياسة الحضور بعد</p>
          </div>
        )}
      </div>

      {currentUser?.role === 'admin' && showEditPolicy && editPolicy && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (savingPolicy) return;
            setShowEditPolicy(false);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-800">تعديل سياسة الحضور</h2>
              <button
                type="button"
                onClick={() => {
                  if (savingPolicy) return;
                  setShowEditPolicy(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editPolicy) return;
                try {
                  setSavingPolicy(true);
                  const updated = await policyService.updatePolicy({
                    work_start_time: editPolicy.work_start_time,
                    work_end_time: editPolicy.work_end_time,
                    grace_period_minutes: editPolicy.grace_period_minutes,
                    auto_punch_out_buffer_minutes: editPolicy.auto_punch_out_buffer_minutes ?? 30,
                    absent_cutoff_time: editPolicy.absent_cutoff_time,
                    weekly_off_days: editPolicy.weekly_off_days,
                    max_late_days_before_warning: editPolicy.max_late_days_before_warning,
                    annual_leave_per_year: editPolicy.annual_leave_per_year,
                    sick_leave_per_year: editPolicy.sick_leave_per_year,
                  });
                  setPolicy(updated);
                  toast.success('تم تحديث سياسة الحضور');
                  setShowEditPolicy(false);
                } catch {
                  toast.error('فشل تحديث سياسة الحضور');
                } finally {
                  setSavingPolicy(false);
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">وقت بدء العمل</label>
                  <input
                    type="time"
                    value={editPolicy.work_start_time}
                    onChange={(e) =>
                      setEditPolicy((prev) => prev ? { ...prev, work_start_time: e.target.value } : prev)
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">وقت نهاية العمل</label>
                  <input
                    type="time"
                    value={editPolicy.work_end_time}
                    onChange={(e) =>
                      setEditPolicy((prev) => prev ? { ...prev, work_end_time: e.target.value } : prev)
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">فترة السماح (دقيقة)</label>
                  <input
                    type="number"
                    value={editPolicy.grace_period_minutes}
                    onChange={(e) =>
                      setEditPolicy((prev) =>
                        prev ? { ...prev, grace_period_minutes: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">مهلة الانصراف التلقائي (دقيقة)</label>
                  <input
                    type="number"
                    value={editPolicy.auto_punch_out_buffer_minutes ?? 30}
                    onChange={(e) =>
                      setEditPolicy((prev) =>
                        prev ? { ...prev, auto_punch_out_buffer_minutes: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">وقت قطع الغياب</label>
                  <input
                    type="time"
                    value={editPolicy.absent_cutoff_time}
                    onChange={(e) =>
                      setEditPolicy((prev) => prev ? { ...prev, absent_cutoff_time: e.target.value } : prev)
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-2">أيام الإجازة الأسبوعية</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { d: 0, label: 'الأحد' },
                    { d: 1, label: 'الاثنين' },
                    { d: 2, label: 'الثلاثاء' },
                    { d: 3, label: 'الأربعاء' },
                    { d: 4, label: 'الخميس' },
                    { d: 5, label: 'الجمعة' },
                    { d: 6, label: 'السبت' },
                  ].map(({ d, label }) => {
                    const checked = editPolicy.weekly_off_days.includes(d);
                    return (
                      <label
                        key={d}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEditPolicy((prev) => {
                              if (!prev) return prev;
                              const exists = prev.weekly_off_days.includes(d);
                              const next = exists
                                ? prev.weekly_off_days.filter((x) => x !== d)
                                : [...prev.weekly_off_days, d].sort((a, b) => a - b);
                              return { ...prev, weekly_off_days: next };
                            })
                          }
                          className="rounded border-gray-300"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    الحد الأقصى للتأخر قبل التنبيه (أيام)
                  </label>
                  <input
                    type="number"
                    value={editPolicy.max_late_days_before_warning}
                    onChange={(e) =>
                      setEditPolicy((prev) =>
                        prev ? { ...prev, max_late_days_before_warning: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">الإجازة السنوية (يوم)</label>
                  <input
                    type="number"
                    value={editPolicy.annual_leave_per_year}
                    onChange={(e) =>
                      setEditPolicy((prev) =>
                        prev ? { ...prev, annual_leave_per_year: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">الإجازة المرضية (يوم)</label>
                  <input
                    type="number"
                    value={editPolicy.sick_leave_per_year}
                    onChange={(e) =>
                      setEditPolicy((prev) =>
                        prev ? { ...prev, sick_leave_per_year: Number(e.target.value) || 0 } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPolicy}
                className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {savingPolicy ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
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

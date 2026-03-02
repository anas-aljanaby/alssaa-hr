import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  Calendar,
  Activity,
  AlertCircle,
} from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [monthLogs, setMonthLogs] = useState<AttendanceLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [activeTab, setActiveTab] = useState<'reports' | 'audit' | 'policy'>('reports');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const n = now();
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

  if (loading) {
    return <ReportsSkeleton />;
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-gray-800">التقارير والإعدادات</h1>

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

      {activeTab === 'audit' && (
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
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="text-gray-800">إعدادات الدوام</h3>
            </div>

            <div className="space-y-3">
              <PolicyRow label="وقت بدء العمل" value={policy.work_start_time} />
              <PolicyRow label="وقت نهاية العمل" value={policy.work_end_time} />
              <PolicyRow
                label="فترة السماح (دقيقة)"
                value={`${policy.grace_period_minutes} دقيقة`}
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

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import * as profilesService from '@/lib/services/profiles.service';
import * as departmentsService from '@/lib/services/departments.service';
import * as attendanceService from '@/lib/services/attendance.service';
import type { Profile } from '@/lib/services/profiles.service';
import type { Department } from '@/lib/services/departments.service';
import type { AttendanceLog } from '@/lib/services/attendance.service';
import { Pagination, usePagination } from '../../components/Pagination';
import { ReportsSkeleton } from '../../components/skeletons';
import {
  Download,
  FileSpreadsheet,
  Calendar,
  Activity,
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
  const n = new Date();
  const name = `تقرير_${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(wb, name);
}

function downloadPdf(monthlyReport: MonthlyReportRow[], deptReport: DeptReportRow[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const n = new Date();
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

const REPORT_PAGE_SIZE = 20;

export function ReportsPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [monthLogs, setMonthLogs] = useState<AttendanceLog[]>([]);

  useEffect(() => {
    loadData();
  }, [currentUser?.uid, currentUser?.role, currentUser?.departmentId]);

  async function loadData() {
    if (!currentUser) return;
    try {
      setLoading(true);
      const n = new Date();

      if (isAdmin) {
        const [profs, depts] = await Promise.all([
          profilesService.listUsers(),
          departmentsService.listDepartments(),
        ]);
        setProfiles(profs);
        setDepartments(depts);

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
          setMonthLogs([]);
          return;
        }

        const [emps, dept] = await Promise.all([
          profilesService.getDepartmentEmployees(currentUser.departmentId),
          departmentsService.getDepartmentById(currentUser.departmentId),
        ]);
        setProfiles(emps);
        setDepartments(dept ? [dept] : []);

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

      // Other roles: no reports data
      setProfiles([]);
      setDepartments([]);
      setMonthLogs([]);
    } catch {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

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

  if (loading) {
    return <ReportsSkeleton />;
  }

  return (
    <PageLayout title="التقارير" backPath="/more">
      <div className="space-y-4">
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
      </div>
    </PageLayout>
  );
}

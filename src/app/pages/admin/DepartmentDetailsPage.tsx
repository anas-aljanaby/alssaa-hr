import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import * as departmentsService from '@/lib/services/departments.service';
import * as profilesService from '@/lib/services/profiles.service';
import type { Department } from '@/lib/services/departments.service';
import type { Profile } from '@/lib/services/profiles.service';
import { getDepartmentErrorMessage } from '@/lib/errorMessages';
import { useAuth } from '@/app/contexts/AuthContext';
import { Building2, Users, Crown, ArrowRight } from 'lucide-react';

export function DepartmentDetailsPage() {
  const { deptId } = useParams<{ deptId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<(Department & { employee_count: number }) | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);

  useEffect(() => {
    if (!deptId) {
      navigate('/departments', { replace: true });
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [dept, emps] = await Promise.all([
          departmentsService.getDepartmentById(deptId),
          profilesService.getDepartmentEmployees(deptId),
        ]);
        if (cancelled) return;
        if (!dept) {
          toast.error('القسم غير موجود');
          navigate('/departments', { replace: true });
          return;
        }
        setDepartment({ ...dept, employee_count: emps.length });
        setEmployees(emps);
      } catch (err) {
        if (!cancelled) toast.error(getDepartmentErrorMessage(err, 'فشل تحميل بيانات القسم'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [deptId, navigate]);

  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  if (loading || !department) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-gray-100 rounded-2xl h-12 w-32 animate-pulse" />
        <div className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
        <div className="bg-gray-100 rounded-2xl h-48 animate-pulse" />
      </div>
    );
  }

  const manager = employees.find((p) => p.id === department.manager_uid);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <Link
        to="/departments"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
      >
        <ArrowRight className="w-4 h-4" aria-hidden />
        العودة إلى الأقسام
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-medium text-gray-800">{department.name_ar}</h1>
              <p className="text-sm text-gray-500" dir="ltr">{department.name}</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-2">
              <Users className="w-4 h-4" />
              عدد الموظفين
            </span>
            <span className="text-gray-800">{department.employee_count}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-2">
              <Crown className="w-4 h-4" />
              مدير القسم
            </span>
            <span className="text-gray-800">{manager?.name_ar ?? '—'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-gray-800 mb-3">أعضاء القسم</h2>
        {employees.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">لا يوجد موظفين في هذا القسم</p>
        ) : (
          <ul className="space-y-2">
            {employees.map((emp) => (
              <li
                key={emp.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                    {emp.name_ar.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-800">{emp.name_ar}</p>
                    <p className="text-xs text-gray-500">{emp.employee_id}</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    emp.role === 'manager' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {emp.role === 'manager' ? 'مدير' : 'موظف'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

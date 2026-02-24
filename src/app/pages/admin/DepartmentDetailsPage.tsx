import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { toast } from 'sonner';
import * as departmentsService from '@/lib/services/departments.service';
import * as profilesService from '@/lib/services/profiles.service';
import * as auditService from '@/lib/services/audit.service';
import type { Department } from '@/lib/services/departments.service';
import type { Profile } from '@/lib/services/profiles.service';
import { updateDepartmentSchema } from '@/lib/validations';
import { getDepartmentErrorMessage } from '@/lib/errorMessages';
import { useAuth } from '@/app/contexts/AuthContext';
import { Building2, Users, Crown, ArrowRight, Edit2, Trash2, X } from 'lucide-react';

const INITIAL_EDIT_FORM = { nameAr: '', nameEn: '', managerId: '' };

export function DepartmentDetailsPage() {
  const { deptId } = useParams<{ deptId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<(Department & { employee_count: number }) | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState(INITIAL_EDIT_FORM);
  const [editFormErrors, setEditFormErrors] = useState<{ nameAr?: string; nameEn?: string; managerId?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [allDepartments, setAllDepartments] = useState<(Department & { employee_count: number })[]>([]);

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

  const openEditModal = useCallback(async () => {
    if (!department) return;
    setEditFormData({
      nameAr: department.name_ar,
      nameEn: department.name,
      managerId: department.manager_uid ?? '',
    });
    setEditFormErrors({});
    try {
      const [depts, profs] = await Promise.all([
        departmentsService.getDepartmentWithEmployeeCount(),
        profilesService.listUsers(),
      ]);
      setAllDepartments(depts);
      setManagers(profs.filter((p) => p.role === 'manager'));
      setShowEditModal(true);
    } catch (err) {
      toast.error(getDepartmentErrorMessage(err, 'فشل تحميل البيانات'));
    }
  }, [department]);

  const handleEditDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department) return;
    const parsed = updateDepartmentSchema.safeParse(editFormData);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setEditFormErrors({
        nameAr: fieldErrors.nameAr?.[0],
        nameEn: fieldErrors.nameEn?.[0],
        managerId: fieldErrors.managerId?.[0],
      });
      toast.error(fieldErrors.nameAr?.[0] ?? fieldErrors.nameEn?.[0] ?? parsed.error.message);
      return;
    }
    setEditFormErrors({});
    const { nameAr, nameEn, managerId } = parsed.data;
    const nameArTrim = nameAr.trim();
    const nameEnTrim = nameEn.trim();
    if (
      allDepartments.some(
        (d) =>
          d.id !== department.id &&
          (d.name_ar === nameArTrim || d.name === nameEnTrim)
      )
    ) {
      toast.error('اسم القسم (عربي أو إنجليزي) مستخدم مسبقاً في هذه المؤسسة');
      return;
    }
    setSubmitting(true);
    try {
      await departmentsService.updateDepartment(department.id, {
        name_ar: nameAr,
        name: nameEn,
        manager_uid: managerId ?? null,
      });
      await auditService.createAuditLog({
        actor_id: currentUser!.uid,
        action: 'department_updated',
        action_ar: 'تحديث قسم',
        target_id: department.id,
        target_type: 'department',
        details: nameAr,
      });
      toast.success('تم تحديث القسم بنجاح');
      setShowEditModal(false);
      const [dept, emps] = await Promise.all([
        departmentsService.getDepartmentById(department.id),
        profilesService.getDepartmentEmployees(department.id),
      ]);
      if (dept) setDepartment({ ...dept, employee_count: emps.length });
      setEmployees(emps);
    } catch (err) {
      toast.error(getDepartmentErrorMessage(err, 'فشل تحديث القسم'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDept = async () => {
    if (!department) return;
    const id = department.id;
    const nameAr = department.name_ar;
    setDeleting(true);
    try {
      await departmentsService.deleteDepartment(id);
      await auditService.createAuditLog({
        actor_id: currentUser!.uid,
        action: 'department_deleted',
        action_ar: 'حذف قسم',
        target_id: id,
        target_type: 'department',
        details: nameAr,
      });
      toast.success('تم حذف القسم');
      navigate('/departments', { replace: true });
    } catch (err) {
      toast.error(getDepartmentErrorMessage(err, 'فشل حذف القسم'));
    } finally {
      setDeleting(false);
    }
  };

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowEditModal(false);
      setShowDeleteConfirm(false);
    }
  }, []);

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
      <nav aria-label="تنقل">
        <Link
          to="/departments"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium mb-2"
        >
          <ArrowRight className="w-4 h-4" aria-hidden />
          العودة إلى الأقسام
        </Link>
      </nav>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-medium text-gray-800">{department.name_ar}</h1>
                <p className="text-sm text-gray-500" dir="ltr">{department.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openEditModal}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                aria-label="تعديل القسم"
              >
                <Edit2 className="w-4 h-4 text-gray-500" />
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 hover:bg-red-50 rounded-xl transition-colors"
                aria-label="حذف القسم"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
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

      {showEditModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditModal(false)}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-dept-detail-title"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="edit-dept-detail-title" className="text-gray-800">تعديل القسم</h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleEditDept}>
              <div>
                <label className="block mb-1.5 text-gray-700">اسم القسم (عربي)</label>
                <input
                  type="text"
                  value={editFormData.nameAr}
                  onChange={(e) => {
                    setEditFormData((p) => ({ ...p, nameAr: e.target.value }));
                    if (editFormErrors.nameAr) setEditFormErrors((p) => ({ ...p, nameAr: undefined }));
                  }}
                  placeholder="مثال: قسم التصميم"
                  maxLength={100}
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ${editFormErrors.nameAr ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'}`}
                />
                {editFormErrors.nameAr && (
                  <p className="text-sm text-red-600 mt-1">{editFormErrors.nameAr}</p>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">اسم القسم (إنجليزي)</label>
                <input
                  type="text"
                  value={editFormData.nameEn}
                  onChange={(e) => {
                    setEditFormData((p) => ({ ...p, nameEn: e.target.value }));
                    if (editFormErrors.nameEn) setEditFormErrors((p) => ({ ...p, nameEn: undefined }));
                  }}
                  placeholder="e.g. Design Department"
                  maxLength={100}
                  dir="ltr"
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ${editFormErrors.nameEn ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'}`}
                />
                {editFormErrors.nameEn && (
                  <p className="text-sm text-red-600 mt-1">{editFormErrors.nameEn}</p>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">مدير القسم</label>
                <select
                  value={editFormData.managerId}
                  onChange={(e) => {
                    setEditFormData((p) => ({ ...p, managerId: e.target.value }));
                    if (editFormErrors.managerId) setEditFormErrors((p) => ({ ...p, managerId: undefined }));
                  }}
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ${editFormErrors.managerId ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'}`}
                >
                  <option value="">-- اختيار --</option>
                  {managers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name_ar}
                    </option>
                  ))}
                </select>
                {editFormErrors.managerId && (
                  <p className="text-sm text-red-600 mt-1">{editFormErrors.managerId}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {submitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
          onKeyDown={handleModalKeyDown}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-dept-detail-title"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="delete-dept-detail-title" className="text-gray-800">تأكيد حذف القسم</h2>
              <button
                type="button"
                onClick={() => !deleting && setShowDeleteConfirm(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="إغلاق"
                disabled={deleting}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mb-2">
              هل أنت متأكد من حذف قسم &quot;{department?.name_ar}&quot;؟
              {department && department.employee_count > 0 && (
                <span className="block mt-2">
                  سيتم إلغاء ربط {department.employee_count} موظف بهذا القسم.
                </span>
              )}
            </p>
            {department && department.employee_count > 10 && (
              <p className="text-amber-600 text-sm mb-4 font-medium">
                هذا القسم يحتوي على عدد كبير من الموظفين. تأكد من رغبتك في الحذف.
              </p>
            )}
            {(!department || department.employee_count <= 10) && <div className="mb-4" />}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteDept}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl"
              >
                {deleting ? 'جاري الحذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

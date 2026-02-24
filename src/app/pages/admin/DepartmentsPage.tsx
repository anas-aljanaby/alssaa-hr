import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Navigate, Link } from 'react-router';
import { toast } from 'sonner';
import * as departmentsService from '@/lib/services/departments.service';
import * as profilesService from '@/lib/services/profiles.service';
import * as auditService from '@/lib/services/audit.service';
import type { Department } from '@/lib/services/departments.service';
import type { Profile } from '@/lib/services/profiles.service';
import { createDepartmentSchema, updateDepartmentSchema } from '@/lib/validations';
import { getDepartmentErrorMessage } from '@/lib/errorMessages';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Users,
  Crown,
  X,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';

const INITIAL_FORM = { nameAr: '', nameEn: '', managerId: '' };

export function DepartmentsPage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<(Department & { employee_count: number })[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deptEmployees, setDeptEmployees] = useState<Profile[]>([]);
  const [expandLoading, setExpandLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [editingDept, setEditingDept] = useState<(Department & { employee_count: number }) | null>(null);
  const [editFormData, setEditFormData] = useState(INITIAL_FORM);
  const [deptToDelete, setDeptToDelete] = useState<(Department & { employee_count: number }) | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createFormErrors, setCreateFormErrors] = useState<{ nameAr?: string; nameEn?: string; managerId?: string }>({});
  const [editFormErrors, setEditFormErrors] = useState<{ nameAr?: string; nameEn?: string; managerId?: string }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [managerFilterId, setManagerFilterId] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const editModalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [depts, profs] = await Promise.all([
        departmentsService.getDepartmentWithEmployeeCount(),
        profilesService.listUsers(),
      ]);
      setDepartments(depts);
      setAllProfiles(profs);
    } catch (err) {
      toast.error(getDepartmentErrorMessage(err, 'فشل تحميل الأقسام'));
    } finally {
      setLoading(false);
    }
  }

  const profilesMap = useMemo(
    () => new Map(allProfiles.map((p) => [p.id, p])),
    [allProfiles]
  );

  const managers = useMemo(
    () => allProfiles.filter((p) => p.role === 'manager'),
    [allProfiles]
  );

  const filteredDepartments = useMemo(() => {
    let list = departments;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.name_ar.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
      );
    }
    if (managerFilterId) {
      list = list.filter((d) => (d.manager_uid ?? '') === managerFilterId);
    }
    return list;
  }, [departments, searchQuery, managerFilterId]);

  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const handleExpand = async (deptId: string) => {
    if (expandedDept === deptId) {
      setExpandedDept(null);
      return;
    }
    setExpandedDept(deptId);
    setExpandLoading(true);
    try {
      const emps = await profilesService.getDepartmentEmployees(deptId);
      setDeptEmployees(emps);
    } catch (err) {
      toast.error(getDepartmentErrorMessage(err, 'فشل تحميل الموظفين'));
    } finally {
      setExpandLoading(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createDepartmentSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setCreateFormErrors({
        nameAr: fieldErrors.nameAr?.[0],
        nameEn: fieldErrors.nameEn?.[0],
        managerId: fieldErrors.managerId?.[0],
      });
      toast.error(fieldErrors.nameAr?.[0] ?? fieldErrors.nameEn?.[0] ?? parsed.error.message);
      return;
    }
    setCreateFormErrors({});
    const { nameAr, nameEn, managerId } = parsed.data;
    const nameArTrim = nameAr.trim();
    const nameEnTrim = nameEn.trim();
    if (departments.some((d) => d.name_ar === nameArTrim || d.name === nameEnTrim)) {
      toast.error('اسم القسم (عربي أو إنجليزي) مستخدم مسبقاً في هذه المؤسسة');
      return;
    }
    setSubmitting(true);
    try {
      const created = await departmentsService.createDepartment({
        name: nameEn,
        name_ar: nameAr,
        manager_uid: managerId ?? null,
      });
      await auditService.createAuditLog({
        actor_id: currentUser.uid,
        action: 'department_created',
        action_ar: 'إنشاء قسم',
        target_id: created.id,
        target_type: 'department',
        details: nameAr,
      });
      toast.success('تم إضافة القسم بنجاح');
      setShowForm(false);
      setFormData(INITIAL_FORM);
      setCreateFormErrors({});
      await loadData();
    } catch (err) {
      toast.error(getDepartmentErrorMessage(err, 'فشل إضافة القسم'));
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (dept: Department & { employee_count: number }) => {
    setEditingDept(dept);
    setEditFormErrors({});
    setEditFormData({
      nameAr: dept.name_ar,
      nameEn: dept.name,
      managerId: dept.manager_uid ?? '',
    });
  };

  const handleEditDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
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
      departments.some(
        (d) =>
          d.id !== editingDept.id &&
          (d.name_ar === nameArTrim || d.name === nameEnTrim)
      )
    ) {
      toast.error('اسم القسم (عربي أو إنجليزي) مستخدم مسبقاً في هذه المؤسسة');
      return;
    }
    setSubmitting(true);
    try {
      await departmentsService.updateDepartment(editingDept.id, {
        name_ar: nameAr,
        name: nameEn,
        manager_uid: managerId ?? null,
      });
      await auditService.createAuditLog({
        actor_id: currentUser.uid,
        action: 'department_updated',
        action_ar: 'تحديث قسم',
        target_id: editingDept.id,
        target_type: 'department',
        details: nameAr,
      });
      toast.success('تم تحديث القسم بنجاح');
      setEditingDept(null);
      setEditFormData(INITIAL_FORM);
      setEditFormErrors({});
      await loadData();
    } catch (err) {
      toast.error(getDepartmentErrorMessage(err, 'فشل تحديث القسم'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDept = async () => {
    if (!deptToDelete) return;
    const id = deptToDelete.id;
    const nameAr = deptToDelete.name_ar;
    setDeleting(true);
    try {
      await departmentsService.deleteDepartment(id);
      await auditService.createAuditLog({
        actor_id: currentUser.uid,
        action: 'department_deleted',
        action_ar: 'حذف قسم',
        target_id: id,
        target_type: 'department',
        details: nameAr,
      });
      toast.success('تم حذف القسم');
      setDeptToDelete(null);
      setExpandedDept((prev) => (prev === id ? null : prev));
      await loadData();
    } catch (err) {
      toast.error(getDepartmentErrorMessage(err, 'فشل حذف القسم'));
    } finally {
      setDeleting(false);
    }
  };

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowForm(false);
      setEditingDept(null);
      setDeptToDelete(null);
      return;
    }
    if (e.key !== 'Tab') return;
    const container = showForm ? modalRef.current : editingDept ? editModalRef.current : null;
    if (!container) return;
    const focusable = container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [showForm, editingDept]);

  useEffect(() => {
    if (showForm) setCreateFormErrors({});
  }, [showForm]);

  useEffect(() => {
    if (showForm || editingDept) {
      firstInputRef.current?.focus();
    }
  }, [showForm, editingDept]);

  const deptColors = [
    'bg-blue-50 border-blue-200',
    'bg-emerald-50 border-emerald-200',
    'bg-purple-50 border-purple-200',
    'bg-amber-50 border-amber-200',
    'bg-rose-50 border-rose-200',
  ];

  const iconColors = [
    'bg-blue-100 text-blue-600',
    'bg-emerald-100 text-emerald-600',
    'bg-purple-100 text-purple-600',
    'bg-amber-100 text-amber-600',
    'bg-rose-100 text-rose-600',
  ];

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-gray-100 rounded-2xl h-16 animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-gray-800">إدارة الأقسام</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          قسم جديد
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            <span className="text-gray-700">إجمالي الأقسام</span>
          </div>
          <span className="text-2xl text-blue-600">{departments.length}</span>
        </div>
      </div>

      {departments.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم (عربي أو إنجليزي)..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              aria-label="بحث الأقسام"
            />
          </div>
          <select
            value={managerFilterId}
            onChange={(e) => setManagerFilterId(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-gray-700"
            aria-label="تصفية حسب المدير"
          >
            <option value="">جميع المديرين</option>
            {managers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name_ar}
              </option>
            ))}
          </select>
        </div>
      )}

      {departments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">لا توجد أقسام بعد. أضف أول قسم لبدء التنظيم.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            إضافة أول قسم
          </button>
        </div>
      ) : (
      <div className="space-y-3">
        {filteredDepartments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-gray-500">لا توجد أقسام تطابق البحث أو التصفية.</p>
          </div>
        ) : (
        filteredDepartments.map((dept, idx) => {
          const manager = profilesMap.get(dept.manager_uid ?? '');
          const isExpanded = expandedDept === dept.id;
          const colorIdx = idx % deptColors.length;

          return (
            <div
              key={dept.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => handleExpand(dept.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconColors[colorIdx]}`}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <p className="text-gray-800">
                      <Link
                        to={`/departments/${dept.id}`}
                        className="hover:underline focus:underline focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {dept.name_ar}
                      </Link>
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {dept.employee_count} موظف
                      </span>
                      <span className="flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        {manager?.name_ar ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => openEditModal(dept)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg cursor-pointer"
                    aria-label="تعديل القسم"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeptToDelete(dept)}
                    className="p-1.5 hover:bg-red-50 rounded-lg cursor-pointer"
                    aria-label="حذف القسم"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 mb-2">أعضاء القسم</p>
                  {expandLoading ? (
                    <div className="space-y-2">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="bg-gray-100 rounded-xl h-12 animate-pulse" />
                      ))}
                    </div>
                  ) : deptEmployees.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">لا يوجد موظفين في هذا القسم</p>
                  ) : (
                    <div className="space-y-2">
                      {deptEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl ${deptColors[colorIdx]}`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${iconColors[colorIdx]}`}
                            >
                              <span className="text-xs">{emp.name_ar.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-sm text-gray-800">{emp.name_ar}</p>
                              <p className="text-xs text-gray-500">{emp.employee_id}</p>
                            </div>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              emp.role === 'manager'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {emp.role === 'manager' ? 'مدير' : 'موظف'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-dept-title"
        >
          <div
            ref={modalRef}
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="create-dept-title" className="text-gray-800">إضافة قسم جديد</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateDept}>
              <div>
                <label className="block mb-1.5 text-gray-700">اسم القسم (عربي)</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={formData.nameAr}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, nameAr: e.target.value }));
                    if (createFormErrors.nameAr) setCreateFormErrors((p) => ({ ...p, nameAr: undefined }));
                  }}
                  placeholder="مثال: قسم التصميم"
                  maxLength={100}
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ${createFormErrors.nameAr ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'}`}
                  aria-invalid={!!createFormErrors.nameAr}
                  aria-describedby={createFormErrors.nameAr ? 'create-nameAr-error' : undefined}
                />
                {createFormErrors.nameAr && (
                  <p id="create-nameAr-error" className="text-sm text-red-600 mt-1">{createFormErrors.nameAr}</p>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">اسم القسم (إنجليزي)</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, nameEn: e.target.value }));
                    if (createFormErrors.nameEn) setCreateFormErrors((p) => ({ ...p, nameEn: undefined }));
                  }}
                  placeholder="e.g. Design Department"
                  maxLength={100}
                  dir="ltr"
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ${createFormErrors.nameEn ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'}`}
                  aria-invalid={!!createFormErrors.nameEn}
                  aria-describedby={createFormErrors.nameEn ? 'create-nameEn-error' : undefined}
                />
                {createFormErrors.nameEn && (
                  <p id="create-nameEn-error" className="text-sm text-red-600 mt-1">{createFormErrors.nameEn}</p>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">مدير القسم</label>
                <select
                  value={formData.managerId}
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, managerId: e.target.value }));
                    if (createFormErrors.managerId) setCreateFormErrors((p) => ({ ...p, managerId: undefined }));
                  }}
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ${createFormErrors.managerId ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'}`}
                  aria-invalid={!!createFormErrors.managerId}
                  aria-describedby={createFormErrors.managerId ? 'create-managerId-error' : undefined}
                >
                  <option value="">-- اختيار --</option>
                  {managers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name_ar}
                    </option>
                  ))}
                </select>
                {createFormErrors.managerId && (
                  <p id="create-managerId-error" className="text-sm text-red-600 mt-1">{createFormErrors.managerId}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {submitting ? 'جاري الإضافة...' : 'إضافة القسم'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingDept && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingDept(null)}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-dept-title"
        >
          <div
            ref={editModalRef}
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="edit-dept-title" className="text-gray-800">تعديل القسم</h2>
              <button
                type="button"
                onClick={() => setEditingDept(null)}
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
                  ref={firstInputRef}
                  type="text"
                  value={editFormData.nameAr}
                  onChange={(e) => {
                    setEditFormData((p) => ({ ...p, nameAr: e.target.value }));
                    if (editFormErrors.nameAr) setEditFormErrors((p) => ({ ...p, nameAr: undefined }));
                  }}
                  placeholder="مثال: قسم التصميم"
                  maxLength={100}
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ${editFormErrors.nameAr ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'}`}
                  aria-invalid={!!editFormErrors.nameAr}
                  aria-describedby={editFormErrors.nameAr ? 'edit-nameAr-error' : undefined}
                />
                {editFormErrors.nameAr && (
                  <p id="edit-nameAr-error" className="text-sm text-red-600 mt-1">{editFormErrors.nameAr}</p>
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
                  aria-invalid={!!editFormErrors.nameEn}
                  aria-describedby={editFormErrors.nameEn ? 'edit-nameEn-error' : undefined}
                />
                {editFormErrors.nameEn && (
                  <p id="edit-nameEn-error" className="text-sm text-red-600 mt-1">{editFormErrors.nameEn}</p>
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
                  aria-invalid={!!editFormErrors.managerId}
                  aria-describedby={editFormErrors.managerId ? 'edit-managerId-error' : undefined}
                >
                  <option value="">-- اختيار --</option>
                  {managers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name_ar}
                    </option>
                  ))}
                </select>
                {editFormErrors.managerId && (
                  <p id="edit-managerId-error" className="text-sm text-red-600 mt-1">{editFormErrors.managerId}</p>
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

      {deptToDelete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setDeptToDelete(null)}
          onKeyDown={handleModalKeyDown}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-dept-title"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-dept-title" className="text-gray-800 mb-2">حذف القسم</h2>
            <p className="text-gray-600 text-sm mb-4">
              هل أنت متأكد من حذف قسم &quot;{deptToDelete.name_ar}&quot;؟
              {deptToDelete.employee_count > 0
                ? ` هذا القسم فيه ${deptToDelete.employee_count} موظف. سيُزال انتماؤهم لهذا القسم فقط ولن يُحذفوا.`
                : ' الموظفون التابعون له سيُزال انتماؤهم لهذا القسم ولن يُحذفوا.'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeptToDelete(null)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteDept}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl"
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

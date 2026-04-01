import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addUserSchema, updateProfileSchema, type AddUserFormData, type UpdateProfileFormData } from '@/lib/validations';
import { toast } from 'sonner';
import * as profilesService from '@/lib/services/profiles.service';
import * as departmentsService from '@/lib/services/departments.service';
import * as policyService from '@/lib/services/policy.service';
import { getAddUserErrorMessage, getProfileUpdateErrorMessage } from '@/lib/errorMessages';
import type { Profile } from '@/lib/services/profiles.service';
import type { Department } from '@/lib/services/departments.service';
import { useBodyScrollLock } from '@/app/hooks/useBodyScrollLock';
import { Pagination, usePagination } from '../../components/Pagination';
import { UsersPageSkeleton } from '../../components/skeletons';
import {
  Plus,
  Search,
  Edit2,
  X,
  Shield,
  Users as UsersIcon,
  User as UserIcon,
  Building2,
} from 'lucide-react';

type UserRole = Profile['role'];
const PAGE_SIZE = 15;

export function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [orgPolicy, setOrgPolicy] = useState<Awaited<ReturnType<typeof policyService.getPolicy>>>(null);
  const navigate = useNavigate();
  useBodyScrollLock(showForm || !!editingUser);

  const addUserForm = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { name: '', email: '', password: '', department_id: '' },
  });

  const editUserForm = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name_ar: '',
      email: '',
      role: 'employee',
      department_id: '',
      work_days: undefined,
      work_start_time: '',
      work_end_time: '',
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [profs, depts, policy] = await Promise.all([
        profilesService.listUsers(),
        departmentsService.listDepartments(),
        policyService.getPolicy(),
      ]);
      setProfiles(profs);
      setDepartments(depts);
      setOrgPolicy(policy);
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

  const isITDepartment = (d: Department) => {
    const nameAr = (d.name_ar ?? '').toLowerCase();
    const nameEn = (d.name ?? '').toLowerCase();
    return nameAr.includes('تقني') || nameEn.includes('technical');
  };

  const departmentsForAdd = useMemo(
    () => departments.filter((d) => !isITDepartment(d)),
    [departments]
  );

  const filteredUsers = profiles.filter((u) => {
    const matchesSearch =
      u.name_ar.includes(searchQuery) ||
      u.employee_id.includes(searchQuery);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const { paginatedItems, currentPage, totalItems, pageSize, setCurrentPage } =
    usePagination(filteredUsers, PAGE_SIZE);

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowForm(false);
      addUserForm.reset();
      setEditingUser(null);
      editUserForm.reset();
    }
  }, [addUserForm, editUserForm]);

  const roleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'مدير عام';
      case 'manager': return 'مدير قسم';
      case 'employee': return 'موظف';
      default: return role;
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'manager': return 'bg-emerald-100 text-emerald-700';
      case 'employee': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'manager': return <UsersIcon className="w-4 h-4" />;
      default: return <UserIcon className="w-4 h-4" />;
    }
  };

  const getDisplayEmail = (email: string | null) => {
    const value = email?.trim();
    return value && value.length > 0 ? value : '—';
  };

  if (loading) {
    return <UsersPageSkeleton />;
  }

  const onAddUser = async (data: AddUserFormData) => {
    setSubmitting(true);
    try {
      await profilesService.inviteUser({
        email: data.email.trim(),
        name: data.name.trim(),
        password: data.password,
        role: 'employee',
        department_id: data.department_id?.trim() || undefined,
      });
      toast.success('تم إنشاء المستخدم بنجاح');
      setShowForm(false);
      addUserForm.reset();
      await loadData();
    } catch (err) {
      const msg = getAddUserErrorMessage(
        err,
        (err as { response?: { error?: string; code?: string } })?.response
      );
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (user: Profile) => {
    const fallbackWorkDays = orgPolicy?.weekly_off_days
      ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !orgPolicy.weekly_off_days.includes(d))
      : undefined;
    setEditingUser(user);
    editUserForm.reset({
      name_ar: user.name_ar,
      email: user.email ?? '',
      role: user.role,
      department_id: user.department_id ?? '',
      work_days: user.work_days ?? fallbackWorkDays,
      work_start_time: user.work_start_time ?? orgPolicy?.work_start_time ?? '',
      work_end_time: user.work_end_time ?? orgPolicy?.work_end_time ?? '',
    });
  };

  const onEditUser = async (data: UpdateProfileFormData) => {
    if (!editingUser) return;
    const oldEmail = (editingUser.email ?? '').trim().toLowerCase();
    const rawNextEmail = data.email?.trim();
    const nextEmail = (rawNextEmail && rawNextEmail.length > 0 ? rawNextEmail : (editingUser.email ?? '')).trim().toLowerCase();
    const emailChanged = nextEmail !== oldEmail;
    if (emailChanged) {
      const confirmed = window.confirm(
        'تغيير البريد الإلكتروني إجراء حساس وقد يؤثر على تسجيل الدخول لهذا المستخدم. هل تريد المتابعة؟'
      );
      if (!confirmed) return;
    }
    setEditSubmitting(true);
    try {
      const hasWorkDays = data.work_days && data.work_days.length > 0;
      const workStart = data.work_start_time?.trim();
      const workEnd = data.work_end_time?.trim();
      await profilesService.updateUser(editingUser.id, {
        name_ar: data.name_ar.trim(),
        // Preserve existing email when form does not provide one.
        email: rawNextEmail && rawNextEmail.length > 0 ? rawNextEmail : (editingUser.email ?? null),
        role: data.role,
        department_id: data.department_id,
        work_days: hasWorkDays && workStart && workEnd ? data.work_days! : null,
        work_start_time: hasWorkDays && workStart && workEnd ? workStart : null,
        work_end_time: hasWorkDays && workStart && workEnd ? workEnd : null,
      });
      toast.success('تم تحديث المستخدم');
      setEditingUser(null);
      editUserForm.reset();
      await loadData();
    } catch (err) {
      toast.error(getProfileUpdateErrorMessage(err, 'فشل تحديث المستخدم'));
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-gray-800">إدارة المستخدمين</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          إضافة
        </button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          placeholder="بحث بالاسم أو الرقم الوظيفي..."
          className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'employee', 'manager', 'admin'] as const).map((role) => (
          <button
            key={role}
            onClick={() => { setRoleFilter(role); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              roleFilter === role
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {role === 'all' ? 'الكل' : roleLabel(role)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
          <p className="text-xl text-blue-700">
            {profiles.filter((u) => u.role === 'employee').length}
          </p>
          <p className="text-xs text-gray-500">موظفون</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
          <p className="text-xl text-emerald-700">
            {profiles.filter((u) => u.role === 'manager').length}
          </p>
          <p className="text-xs text-gray-500">مديرون</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
          <p className="text-xl text-purple-700">
            {profiles.filter((u) => u.role === 'admin').length}
          </p>
          <p className="text-xs text-gray-500">إداريون</p>
        </div>
      </div>

      <div className="space-y-2">
        {paginatedItems.map((user) => {
          const dept = deptsMap.get(user.department_id ?? '');
          return (
            <div key={user.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div
                onClick={() => navigate(`/user-details/${user.id}`)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') navigate(`/user-details/${user.id}`);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center ${
                        user.role === 'admin'
                          ? 'bg-purple-100'
                          : user.role === 'manager'
                            ? 'bg-emerald-100'
                            : 'bg-blue-100'
                      }`}
                    >
                      <span
                        className={`text-sm ${
                          user.role === 'admin'
                            ? 'text-purple-600'
                            : user.role === 'manager'
                              ? 'text-emerald-600'
                              : 'text-blue-600'
                        }`}
                      >
                        {user.name_ar.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-800">{user.name_ar}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate" dir="ltr">
                        {getDisplayEmail(user.email)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${roleColor(user.role)}`}
                        >
                          {roleIcon(user.role)}
                          {roleLabel(user.role)}
                        </span>
                        {dept && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Building2 className="w-3 h-3" />
                            {dept.name_ar}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openEditModal(user)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                      aria-label="تعديل"
                    >
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400">{user.employee_id}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => { setShowForm(false); addUserForm.reset(); }}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
        >
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl bg-white p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="add-user-title" className="text-gray-800">إضافة مستخدم جديد</h2>
              <button
                type="button"
                onClick={() => { setShowForm(false); addUserForm.reset(); }}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={addUserForm.handleSubmit(onAddUser)}>
              <div>
                <label className="block mb-1.5 text-gray-700">الاسم الكامل</label>
                <input
                  type="text"
                  {...addUserForm.register('name')}
                  placeholder="أدخل الاسم الكامل"
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    addUserForm.formState.errors.name ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                {addUserForm.formState.errors.name && (
                  <p className="text-red-500 text-sm mt-1">{addUserForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">بريد تسجيل الدخول</label>
                <input
                  type="email"
                  {...addUserForm.register('email')}
                  placeholder="example@alssaa.tv"
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    addUserForm.formState.errors.email ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                {addUserForm.formState.errors.email && (
                  <p className="text-red-500 text-sm mt-1">{addUserForm.formState.errors.email.message}</p>
                )}
                <p className="text-amber-700 text-xs mt-1">
                  سيتم استخدام هذا البريد لتسجيل الدخول، يرجى التأكد من كتابته بشكل صحيح.
                </p>
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">كلمة المرور</label>
                <input
                  type="password"
                  {...addUserForm.register('password')}
                  placeholder="أدخل كلمة مرور قوية"
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    addUserForm.formState.errors.password ? 'border-red-400' : 'border-gray-200'
                  }`}
                  dir="ltr"
                />
                {addUserForm.formState.errors.password && (
                  <p className="text-red-500 text-sm mt-1">{addUserForm.formState.errors.password.message}</p>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-gray-700">القسم</label>
                <select
                  {...addUserForm.register('department_id')}
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    addUserForm.formState.errors.department_id ? 'border-red-400' : 'border-gray-200'
                  }`}
                >
                  <option value="">بدون قسم</option>
                  {departmentsForAdd.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name_ar}
                    </option>
                  ))}
                </select>
                {addUserForm.formState.errors.department_id && (
                  <p className="text-red-500 text-sm mt-1">{addUserForm.formState.errors.department_id.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {submitting ? 'جاري الإضافة...' : 'إضافة المستخدم'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => { setEditingUser(null); editUserForm.reset(); }}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
        >
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl bg-white p-6"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="edit-user-title" className="text-gray-800">تعديل الملف الشخصي</h2>
              <button
                type="button"
                onClick={() => { setEditingUser(null); editUserForm.reset(); }}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={editUserForm.handleSubmit(onEditUser)}>
              <div>
                <label className="block mb-1.5 text-gray-700">الاسم الكامل</label>
                <input
                  type="text"
                  {...editUserForm.register('name_ar')}
                  placeholder="أدخل الاسم الكامل"
                  className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                    editUserForm.formState.errors.name_ar ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                {editUserForm.formState.errors.name_ar && (
                  <p className="text-red-500 text-sm mt-1">{editUserForm.formState.errors.name_ar.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1.5 text-gray-700">الدور</label>
                  <select
                    {...editUserForm.register('role')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value={editingUser.role}>
                      {roleLabel(editingUser.role)}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5 text-gray-700">القسم</label>
                  <select
                    {...editUserForm.register('department_id')}
                    className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      editUserForm.formState.errors.department_id ? 'border-red-400' : 'border-gray-200'
                    }`}
                  >
                    <option value="">اختر القسم</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name_ar}
                      </option>
                    ))}
                  </select>
                  {editUserForm.formState.errors.department_id && (
                    <p className="text-red-500 text-sm mt-1">{editUserForm.formState.errors.department_id.message}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">جدول العمل</h3>
                <p className="text-xs text-gray-500 mb-3">اختر أيام العمل ووقت البداية والنهاية (نفس التوقيت لجميع الأيام). إن لم تختر أي أيام تُستخدم إعدادات المنظمة.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    { d: 0, label: 'الأحد' },
                    { d: 1, label: 'الإثنين' },
                    { d: 2, label: 'الثلاثاء' },
                    { d: 3, label: 'الأربعاء' },
                    { d: 4, label: 'الخميس' },
                    { d: 5, label: 'الجمعة' },
                    { d: 6, label: 'السبت' },
                  ].map(({ d, label }) => {
                    const workDays = editUserForm.watch('work_days') ?? [];
                    const checked = workDays.includes(d);
                    return (
                      <label
                        key={d}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                          checked ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const prev = editUserForm.getValues('work_days') ?? [];
                            const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b);
                            editUserForm.setValue('work_days', next);
                          }}
                          className="rounded border-gray-300"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">وقت البداية</label>
                    <input
                      type="time"
                      {...editUserForm.register('work_start_time')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">وقت النهاية</label>
                    <input
                      type="time"
                      {...editUserForm.register('work_end_time')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      dir="ltr"
                    />
                  </div>
                </div>
                {editUserForm.formState.errors.work_end_time && (
                  <p className="text-red-500 text-sm mt-1">{editUserForm.formState.errors.work_end_time.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={editSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {editSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

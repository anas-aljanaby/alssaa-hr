import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addUserSchema, updateProfileSchema, type AddUserFormData, type UpdateProfileFormData } from '@/lib/validations';
import { toast } from 'sonner';
import { useAppTopBar } from '../../contexts/AppTopBarContext';
import * as profilesService from '@/lib/services/profiles.service';
import * as departmentsService from '@/lib/services/departments.service';
import { getAddUserErrorMessage, getProfileUpdateErrorMessage } from '@/lib/errorMessages';
import type { Profile } from '@/lib/services/profiles.service';
import type { Department } from '@/lib/services/departments.service';
import { useBodyScrollLock } from '@/app/hooks/useBodyScrollLock';
import { Pagination, usePagination } from '../../components/Pagination';
import { generateStrongPassword } from '@/lib/generatePassword';
import { copyTextToClipboard } from '@/lib/ui-helpers';
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
  Eye,
  EyeOff,
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
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);
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
      work_schedule: {},
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [profs, depts] = await Promise.all([
        profilesService.listUsers(),
        departmentsService.listDepartments(),
      ]);
      setProfiles(profs);
      setDepartments(depts);
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
      (u.email ?? '').includes(searchQuery);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const { paginatedItems, currentPage, totalItems, pageSize, setCurrentPage } =
    usePagination(filteredUsers, PAGE_SIZE);

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowForm(false);
      addUserForm.reset();
      setShowAddUserPassword(false);
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

  const topBarAction = useMemo(
    () => (
      <button
        type="button"
        onClick={() => {
          setShowForm(true);
          setShowAddUserPassword(false);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700"
        aria-label="إضافة مستخدم"
      >
        <Plus className="h-4 w-4" />
      </button>
    ),
    []
  );

  const addUserPasswordValue = addUserForm.watch('password') ?? '';
  const addUserPasswordHasValue = addUserPasswordValue.trim().length > 0;

  useAppTopBar({
    title: 'إدارة المستخدمين',
    meta: `${filteredUsers.length} مستخدم`,
    action: topBarAction,
  });

  const handleGeneratePassword = () => {
    const pw = generateStrongPassword();
    addUserForm.setValue('password', pw, { shouldValidate: true });
    setShowAddUserPassword(true);
  };

  const handleCopyPassword = async () => {
    const value = addUserPasswordValue.trim();
    if (!value) { toast.message('لا يوجد نص لنسخه'); return; }
    try {
      await copyTextToClipboard(value);
      toast.success('تم نسخ كلمة المرور');
    } catch {
      toast.error('تعذر النسخ');
    }
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
      setShowAddUserPassword(false);
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
    setEditingUser(user);
    editUserForm.reset({
      name_ar: user.name_ar,
      email: user.email ?? '',
      role: user.role,
      department_id: user.department_id ?? '',
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
      await profilesService.updateUser(editingUser.id, {
        name_ar: data.name_ar.trim(),
        // Preserve existing email when form does not provide one.
        email: rawNextEmail && rawNextEmail.length > 0 ? rawNextEmail : (editingUser.email ?? null),
        role: editingUser.role,
        department_id: editingUser.department_id,
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
    <div className="mx-auto max-w-lg space-y-3 px-4 pb-24 pt-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          placeholder="بحث بالاسم أو البريد الإلكتروني..."
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
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${
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
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{user.name_ar}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate" dir="ltr">
                          {getDisplayEmail(user.email)}
                        </p>
                      </div>
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs inline-flex items-center gap-1 ${roleColor(user.role)}`}
                      >
                        {roleIcon(user.role)}
                        {roleLabel(user.role)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-1.5 text-xs text-gray-600 min-w-0">
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-hidden />
                  <span className="truncate">{dept?.name_ar ?? 'بدون قسم'}</span>
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
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 sm:z-50 sm:px-4"
          onClick={() => {
            setShowForm(false);
            addUserForm.reset();
            setShowAddUserPassword(false);
          }}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
        >
          <div
            className="relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-h-[calc(100dvh-8rem)] sm:mx-auto sm:max-h-[calc(100svh-4rem)] sm:max-w-sm"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
              <h2 id="add-user-title" className="px-12 text-center text-base text-gray-800">
                إضافة مستخدم جديد
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  addUserForm.reset();
                  setShowAddUserPassword(false);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2 hover:bg-gray-100 sm:left-4"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              <form className="space-y-2.5" onSubmit={addUserForm.handleSubmit(onAddUser)}>
                <div>
                  <label className="block mb-1 text-sm text-gray-700">الاسم الكامل</label>
                  <input
                    type="text"
                    {...addUserForm.register('name')}
                    placeholder="أدخل الاسم الكامل"
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      addUserForm.formState.errors.name ? 'border-red-400' : 'border-gray-200'
                    }`}
                  />
                  {addUserForm.formState.errors.name && (
                    <p className="text-red-500 text-xs mt-1">{addUserForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block mb-1 text-sm text-gray-700">بريد تسجيل الدخول</label>
                  <input
                    type="email"
                    {...addUserForm.register('email')}
                    placeholder="example@alssaa.tv"
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      addUserForm.formState.errors.email ? 'border-red-400' : 'border-gray-200'
                    } text-left`}
                    dir="ltr"
                  />
                  {addUserForm.formState.errors.email && (
                    <p className="text-red-500 text-xs mt-1">{addUserForm.formState.errors.email.message}</p>
                  )}
                  <p className="text-amber-700 text-xs mt-1">
                    سيتم استخدام هذا البريد لتسجيل الدخول، يرجى التأكد من كتابته بشكل صحيح.
                  </p>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm text-gray-700">كلمة المرور</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 active:bg-blue-100 active:text-blue-800 transition-colors"
                      >
                        توليد
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyPassword}
                        disabled={!addUserPasswordHasValue}
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 active:bg-blue-100 active:text-blue-800 disabled:pointer-events-none disabled:text-gray-400 disabled:hover:bg-transparent disabled:active:bg-transparent transition-colors"
                      >
                        نسخ
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showAddUserPassword ? 'text' : 'password'}
                      {...addUserForm.register('password')}
                      placeholder="أدخل كلمة مرور قوية"
                      className={`w-full pr-10 pl-3 py-2 text-sm border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                        addUserForm.formState.errors.password ? 'border-red-400' : 'border-gray-200'
                      } ${addUserPasswordHasValue ? 'text-left' : 'text-right'}`}
                      dir={addUserPasswordHasValue ? 'ltr' : 'rtl'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddUserPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                      aria-label={showAddUserPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showAddUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {addUserForm.formState.errors.password && (
                    <p className="text-red-500 text-xs mt-1">{addUserForm.formState.errors.password.message}</p>
                  )}
                </div>
                <div>
                  <label className="block mb-1 text-sm text-gray-700">القسم</label>
                  <select
                    {...addUserForm.register('department_id')}
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
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
                    <p className="text-red-500 text-xs mt-1">{addUserForm.formState.errors.department_id.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
                >
                  {submitting ? 'جاري الإضافة...' : 'إضافة المستخدم'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 sm:z-50 sm:px-4"
          onClick={() => { setEditingUser(null); editUserForm.reset(); }}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
        >
          <div
            className="relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-h-[calc(100dvh-8rem)] sm:mx-auto sm:max-h-[calc(100svh-4rem)] sm:max-w-sm"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
              <h2 id="edit-user-title" className="px-12 text-center text-base text-gray-800">
                تعديل الملف الشخصي
              </h2>
              <button
                type="button"
                onClick={() => { setEditingUser(null); editUserForm.reset(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2 hover:bg-gray-100"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <form className="space-y-2.5" onSubmit={editUserForm.handleSubmit(onEditUser)}>
                <div>
                  <label className="block mb-1 text-sm text-gray-700">الاسم الكامل</label>
                  <input
                    type="text"
                    {...editUserForm.register('name_ar')}
                    placeholder="أدخل الاسم الكامل"
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      editUserForm.formState.errors.name_ar ? 'border-red-400' : 'border-gray-200'
                    }`}
                  />
                  {editUserForm.formState.errors.name_ar && (
                    <p className="text-red-500 text-xs mt-1">{editUserForm.formState.errors.name_ar.message}</p>
                  )}
                </div>
                <p className="text-gray-500 text-xs -mt-1">
                  الدور والقسم يُعدّلان من صفحة الأقسام.
                </p>
                <div>
                  <label className="block mb-1 text-sm text-gray-700">اسم المستخدم</label>
                  <input
                    type="email"
                    {...editUserForm.register('email')}
                    placeholder="example@alssaa.tv"
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                      editUserForm.formState.errors.email ? 'border-red-400' : 'border-gray-200'
                    }`}
                    dir="ltr"
                  />
                  {editUserForm.formState.errors.email && (
                    <p className="text-red-500 text-xs mt-1">{editUserForm.formState.errors.email.message}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">
                    يُستخدم هذا البريد كاسم المستخدم لتسجيل الدخول.
                  </p>
                </div>
                <input type="hidden" {...editUserForm.register('role')} />
                <input type="hidden" {...editUserForm.register('department_id')} />

                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="w-full py-2.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
                >
                  {editSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

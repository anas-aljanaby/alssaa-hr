import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordFormData } from '@/lib/validations';
import { useAuth } from '../../contexts/AuthContext';
import * as authService from '@/lib/services/auth.service';
import { PasswordChecklist } from '../../components/PasswordChecklist';
import { PasswordGenerateCopyRow } from '@/app/components/PasswordGenerateCopyRow';
import { PageLayout } from '../../components/layout/PageLayout';
import { toast } from 'sonner';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';

export function SecurityPrivacyPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    const result = await authService.updatePassword(data.currentPassword, data.newPassword);
    if (result.ok) {
      toast.success('تم تغيير كلمة المرور بنجاح');
      reset();
    } else {
      toast.error(result.error ?? 'فشل تغيير كلمة المرور');
    }
  };

  if (!currentUser) return null;

  return (
    <PageLayout title="الأمان والخصوصية" backPath="/more">
      <div className="space-y-6 pb-20">

      {/* تغيير كلمة المرور */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs text-gray-500">تغيير كلمة المرور</span>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block mb-1.5 text-sm text-gray-700">كلمة المرور الحالية</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                {...register('currentPassword')}
                placeholder="••••••••"
                className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                  errors.currentPassword ? 'border-red-400' : 'border-gray-200'
                }`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="mt-1 text-xs text-red-500">{errors.currentPassword.message}</p>
            )}
          </div>
          <div>
            <label className="block mb-1.5 text-sm text-gray-700">كلمة المرور الجديدة</label>
            <input
              type={showNewPassword ? 'text' : 'password'}
              {...register('newPassword')}
              placeholder="••••••••"
              className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                errors.newPassword ? 'border-red-400' : 'border-gray-200'
              }`}
              autoComplete="new-password"
            />
            <PasswordGenerateCopyRow
              className="mt-2"
              onGenerated={(pw) => {
                setValue('newPassword', pw, { shouldValidate: true });
                setValue('confirmPassword', pw, { shouldValidate: true });
                setShowNewPassword(true);
                setShowConfirmPassword(true);
              }}
              valueToCopy={watch('newPassword') ?? ''}
              passwordVisible={showNewPassword}
              onTogglePasswordVisible={() => setShowNewPassword((v) => !v)}
            />
            {errors.newPassword && (
              <p className="mt-1 text-xs text-red-500">{errors.newPassword.message}</p>
            )}
            <PasswordChecklist password={watch('newPassword') ?? ''} />
          </div>
          <div>
            <label className="block mb-1.5 text-sm text-gray-700">تأكيد كلمة المرور الجديدة</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                {...register('confirmPassword')}
                placeholder="••••••••"
                className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                  errors.confirmPassword ? 'border-red-400' : 'border-gray-200'
                }`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <Lock className="w-4 h-4" />
            {isSubmitting ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
          </button>
        </form>
      </div>

      {/* الخصوصية وحماية البيانات */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          <span className="text-xs text-gray-500">الخصوصية وحماية البيانات</span>
        </div>
        <div className="p-4 space-y-3 text-sm text-gray-600">
          <p>
            نحمي بيانات الحساب والملف الوظيفي وسجلات الحضور والطلبات والمرفقات والإشعارات ضمن
            ضوابط تقنية وتنظيمية معقولة، بما في ذلك تشفير الاتصال (HTTPS) وإدارة الجلسات الآمنة.
          </p>
          <p>
            تُستخدم هذه البيانات لتشغيل النظام وإدارة الحضور والانصراف والطلبات وسير الموافقات
            والإشعارات والإجراءات الإدارية المرتبطة بها داخل المنظمة، ولا يتم الإفصاح عنها إلا ضمن
            الصلاحيات المعتمدة أو المتطلبات النظامية والقانونية الواجبة.
          </p>
          <p className="text-gray-500 text-xs">
            للاستفسار عن هذه الممارسات أو طلب مراجعة حقوقك المتعلقة بالبيانات، تواصل مع مدير
            النظام أو قسم تقنية المعلومات.
          </p>
          <p className="text-gray-500 text-xs">
            لقراءة الإطار التنظيمي الكامل لاستخدام النظام، راجع صفحة{' '}
            <button
              type="button"
              onClick={() => navigate('/terms-conditions')}
              className="text-emerald-600 underline hover:text-emerald-700"
            >
              الشروط والأحكام
            </button>
            .
          </p>
        </div>
      </div>
      </div>
    </PageLayout>
  );
}

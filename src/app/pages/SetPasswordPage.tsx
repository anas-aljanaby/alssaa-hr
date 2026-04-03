import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { setPasswordSchema, type SetPasswordFormData } from '@/lib/validations';
import { PasswordGenerateCopyRow } from '@/app/components/PasswordGenerateCopyRow';

export function SetPasswordPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState('');
  const [serverSuccess, setServerSuccess] = useState('');

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: SetPasswordFormData) => {
    setServerError('');
    setServerSuccess('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setServerError('انتهت الجلسة. يرجى تسجيل الدخول من جديد.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setServerError(error.message);
      return;
    }

    setServerSuccess('تم تعيين كلمة المرور بنجاح. يمكنك الآن استخدام البريد وكلمة المرور لتسجيل الدخول.');
    setTimeout(() => navigate('/', { replace: true }), 800);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md mx-auto shrink-0 bg-white rounded-2xl shadow-2xl p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-50 text-blue-600 mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-gray-800 mb-1">تعيين كلمة المرور</h1>
          <p className="text-gray-500 text-sm">
            الرجاء تعيين كلمة مرور جديدة لاستخدامها في تسجيل الدخول لاحقاً.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block mb-1.5 text-gray-700">كلمة المرور الجديدة</label>
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder="••••••••"
              className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
                errors.password ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            <PasswordGenerateCopyRow
              className="mt-2"
              onGenerated={(pw) => {
                setValue('password', pw, { shouldValidate: true });
                setValue('confirmPassword', pw, { shouldValidate: true });
                setShowPassword(true);
                setShowConfirm(true);
              }}
              valueToCopy={watch('password') ?? ''}
              passwordVisible={showPassword}
              onTogglePasswordVisible={() => setShowPassword((v) => !v)}
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block mb-1.5 text-gray-700">تأكيد كلمة المرور</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                {...register('confirmPassword')}
                placeholder="••••••••"
                className={`w-full px-4 py-3 pe-12 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  errors.confirmPassword ? 'border-red-400' : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showConfirm ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          {serverError && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-center">{serverError}</div>}
          {serverSuccess && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-center">{serverSuccess}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
          </button>
        </form>
      </div>
    </div>
  );
}

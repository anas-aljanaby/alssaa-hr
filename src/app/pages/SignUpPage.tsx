import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, type SignUpFormData } from '@/lib/validations';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Building2, UserPlus } from 'lucide-react';

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (data: SignUpFormData) => {
    setServerError('');
    setSuccessMessage('');
    const result = await signUp(data.email, data.password, data.name);
    if (result.ok && result.message) {
      setSuccessMessage(result.message);
    } else if (result.ok) {
      navigate('/');
    } else {
      setServerError(result.error || 'فشل إنشاء الحساب');
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md mx-auto shrink-0">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-4 border border-white/20">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-white mb-1">شبكة الساعة</h1>
          <p className="text-blue-200">نظام إدارة الحضور والإجازات</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-center mb-6 text-gray-800">إنشاء حساب جديد</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block mb-1.5 text-gray-700">الاسم</label>
              <input
                type="text"
                {...register('name')}
                placeholder="أدخل اسمك"
                className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  errors.name ? 'border-red-400' : 'border-gray-200'
                }`}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block mb-1.5 text-gray-700">البريد الإلكتروني</label>
              <input
                type="email"
                {...register('email')}
                placeholder="example@alssaa.tv"
                className={`w-full px-4 py-3 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  errors.email ? 'border-red-400' : 'border-gray-200'
                }`}
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block mb-1.5 text-gray-700">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="••••••••"
                  className={`w-full px-4 py-3 pe-12 border rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
                    errors.password ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              ) : (
                <p className="text-gray-500 text-sm mt-1">6 أحرف على الأقل</p>
              )}
            </div>

            {serverError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-center text-sm">
                {serverError}
              </div>
            )}

            {successMessage && (
              <div className="bg-green-50 text-green-700 p-3 rounded-xl text-center text-sm">
                {successMessage}
              </div>
            )}

            {!successMessage && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5 shrink-0" />
                {isSubmitting ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
              </button>
            )}
          </form>

          <p className="text-center text-gray-600 mt-4">
            لديك حساب؟{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </div>

        <p className="text-center text-blue-300/60 text-sm">
          &copy; 2026 شبكة الساعة - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}

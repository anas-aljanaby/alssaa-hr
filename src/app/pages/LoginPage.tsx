import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/lib/validations';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../data/mockData';
import {
  Shield,
  Users,
  User,
  Eye,
  EyeOff,
  Fingerprint,
  Building2,
} from 'lucide-react';

const DEMO_ROLE_CARDS: { role: UserRole; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
  { role: 'employee', label: 'موظف', icon: <User className="w-6 h-6" />, color: 'text-blue-600', bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200' },
  { role: 'manager', label: 'مدير قسم', icon: <Users className="w-6 h-6" />, color: 'text-emerald-600', bgColor: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
  { role: 'admin', label: 'المدير العام', icon: <Shield className="w-6 h-6" />, color: 'text-purple-600', bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200' },
];

export function LoginPage() {
  const { login, loginAs } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError('');
    const result = await login(data.email, data.password);
    if (result.ok) {
      navigate('/');
    } else {
      setServerError(result.error ?? 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
  };

  const handleQuickLogin = (role: UserRole) => {
    loginAs?.(role);
    navigate('/');
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
          <h1 className="text-white mb-1">شبكة الساعة الإعلامية</h1>
          <p className="text-blue-200">نظام إدارة الحضور والإجازات</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-center mb-6 text-gray-800">تسجيل الدخول</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-center">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>

            <div className="pt-1">
              <button
                type="button"
                className="w-full py-3 border-2 border-gray-200 rounded-xl flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Fingerprint className="w-5 h-5 shrink-0" />
                <span>الدخول بالبصمة</span>
              </button>
            </div>

            <p className="text-center text-gray-600 pt-2">
              لا تملك حساباً؟{' '}
              <Link to="/signup" className="text-blue-600 font-medium hover:underline">
                إنشاء حساب جديد
              </Link>
            </p>
          </form>
        </div>

        {loginAs && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
            <p className="text-center text-blue-200 mb-4">دخول سريع (للعرض التجريبي)</p>
            <div className="grid grid-cols-3 gap-3">
              {DEMO_ROLE_CARDS.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => handleQuickLogin(item.role)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${item.bgColor}`}
                >
                  <span className={item.color}>{item.icon}</span>
                  <span className={`text-sm font-medium ${item.color}`}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-blue-300/60 mt-6 text-sm">
          &copy; 2026 شبكة الساعة الإعلامية - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}

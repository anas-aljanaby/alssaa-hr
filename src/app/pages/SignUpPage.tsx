import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Building2, UserPlus } from 'lucide-react';

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const result = await signUp(email, password, name);
    if (result.ok) {
      navigate('/');
    } else {
      setError(result.error || 'فشل إنشاء الحساب');
    }
    setIsLoading(false);
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
          <h2 className="text-center mb-6 text-gray-800">إنشاء حساب جديد</h2>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block mb-1.5 text-gray-700">الاسم</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أدخل اسمك"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-gray-700">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@alssaa.tv"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-gray-700">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pe-12 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
              <p className="text-gray-500 text-sm mt-1">6 أحرف على الأقل</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-center text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5 shrink-0" />
              {isLoading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
            </button>
          </form>

          <p className="text-center text-gray-600 mt-4">
            لديك حساب؟{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </div>

        <p className="text-center text-blue-300/60 text-sm">
          &copy; 2026 شبكة الساعة الإعلامية - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}

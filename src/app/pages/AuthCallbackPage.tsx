import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@/lib/supabase';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Handles the redirect from Supabase email confirmation (PKCE flow).
 * Exchanges the `code` query-param for a session, then redirects to home.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const tokenHash = params.get('token_hash');
    const type = params.get('type') as EmailOtpType | null;
    const next = params.get('next');
    const safeNext = next && next.startsWith('/') ? next : '/';

    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(() => navigate(safeNext, { replace: true }))
        .catch(() => navigate('/login', { replace: true }));
      return;
    }

    if (tokenHash && type) {
      supabase.auth.verifyOtp({ type, token_hash: tokenHash })
        .then(({ error }) => {
          if (error) {
            navigate('/login', { replace: true });
            return;
          }
          navigate(safeNext, { replace: true });
        })
        .catch(() => navigate('/login', { replace: true }));
      return;
    }

    navigate(safeNext, { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" dir="rtl">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-600">جاري تأكيد الحساب...</p>
      </div>
    </div>
  );
}

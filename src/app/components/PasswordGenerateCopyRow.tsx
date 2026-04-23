import React from 'react';
import { Sparkles, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { generateStrongPassword } from '@/lib/generatePassword';

export type PasswordGenerateCopyRowProps = {
  onGenerated: (password: string) => void;
  valueToCopy: string;
  className?: string;
  variant?: 'default' | 'inline';
  /** When set with `onTogglePasswordVisible`, shows إظهار / إخفاء next to other actions. */
  passwordVisible?: boolean;
  onTogglePasswordVisible?: () => void;
};

export function PasswordGenerateCopyRow({
  onGenerated,
  valueToCopy,
  className = '',
  variant = 'default',
  passwordVisible = false,
  onTogglePasswordVisible,
}: PasswordGenerateCopyRowProps) {
  const handleGenerate = () => {
    const password = generateStrongPassword();
    onGenerated(password);
  };

  const handleCopy = async () => {
    const value = valueToCopy.trim();
    if (!value) {
      toast.message('لا يوجد نص لنسخه');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success('تم نسخ كلمة المرور');
    } catch {
      toast.error('تعذر النسخ');
    }
  };

  const isInline = variant === 'inline';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleGenerate}
        className={
          isInline
            ? 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100/80 transition-colors'
        }
      >
        {!isInline && <Sparkles className="w-4 h-4 shrink-0" aria-hidden />}
        توليد
      </button>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!valueToCopy.trim()}
        className={
          isInline
            ? 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-teal-700 hover:bg-teal-50 disabled:pointer-events-none disabled:opacity-40 transition-colors'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 transition-colors'
        }
      >
        {!isInline && <Copy className="w-4 h-4 shrink-0" aria-hidden />}
        نسخ
      </button>
      {onTogglePasswordVisible && (
        <button
          type="button"
          onClick={onTogglePasswordVisible}
          className={
            isInline
              ? 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 transition-colors'
              : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors'
          }
          aria-pressed={passwordVisible}
          aria-label={passwordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        >
          {passwordVisible ? <EyeOff className="w-4 h-4 shrink-0" aria-hidden /> : <Eye className="w-4 h-4 shrink-0" aria-hidden />}
          {passwordVisible ? 'إخفاء' : 'إظهار'}
        </button>
      )}
    </div>
  );
}

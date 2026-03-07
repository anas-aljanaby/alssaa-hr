import React from 'react';
import { Check, Circle } from 'lucide-react';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  const hasMin = password.length >= PASSWORD_MIN;
  const overMax = password.length > PASSWORD_MAX;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);

  const requirements: PasswordRequirement[] = [
    { id: 'min', label: `8 أحرف على الأقل`, met: hasMin },
    { id: 'upper', label: 'حرف كبير واحد على الأقل (A–Z)', met: hasUpper },
    { id: 'lower', label: 'حرف صغير واحد على الأقل (a–z)', met: hasLower },
    { id: 'digit', label: 'رقم واحد على الأقل', met: hasDigit },
  ];

  if (overMax) {
    requirements.push({
      id: 'max',
      label: `لا تتجاوز ${PASSWORD_MAX} حرفاً`,
      met: false,
    });
  }

  return requirements;
}

interface PasswordChecklistProps {
  password: string;
  className?: string;
}

export function PasswordChecklist({ password, className = '' }: PasswordChecklistProps) {
  const requirements = getPasswordRequirements(password);

  return (
    <ul
      className={`mt-2 space-y-1.5 text-sm ${className}`}
      role="list"
      aria-label="متطلبات كلمة المرور"
    >
      {requirements.map(({ id, label, met }) => (
        <li key={id} className="flex items-center gap-2 text-gray-600">
          {met ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
          ) : (
            <Circle className="h-3.5 w-3.5 shrink-0 text-gray-300" aria-hidden />
          )}
          <span className={met ? 'text-emerald-700' : ''}>{label}</span>
        </li>
      ))}
    </ul>
  );
}

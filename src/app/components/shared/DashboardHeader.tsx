import React from 'react';

interface DashboardHeaderProps {
  gradientClassName: string;
  title: string;
  subtitle?: string;
  /**
   * Right-side circle or icon content.
   */
  avatar: React.ReactNode;
  /**
   * Optional footer content inside the header card (e.g. small stat row).
   */
  footer?: React.ReactNode;
  helperText?: string;
}

export function DashboardHeader({
  gradientClassName,
  title,
  subtitle,
  avatar,
  footer,
  helperText,
}: DashboardHeaderProps) {
  return (
    <div className={`rounded-2xl p-5 text-white ${gradientClassName}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          {helperText && <p className="text-sm opacity-80 mb-0.5">{helperText}</p>}
          <h2 className="text-white">{title}</h2>
          {subtitle && <p className="text-sm opacity-80">{subtitle}</p>}
        </div>
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
          {avatar}
        </div>
      </div>
      {footer && <div className="bg-white/10 rounded-xl p-3">{footer}</div>}
    </div>
  );
}


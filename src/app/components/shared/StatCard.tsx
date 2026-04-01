import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  /**
   * Tailwind classes for background/text/border colors, e.g.
   * "bg-emerald-50 border-emerald-100".
   */
  color: string;
  /**
   * Optional warning state (e.g. to show an alert icon).
   */
  warningIcon?: React.ReactNode;
  onClick?: () => void;
}

export function StatCard({ icon, label, value, color, warningIcon, onClick }: StatCardProps) {
  const isInteractive = typeof onClick === 'function';
  const commonClassName = `rounded-2xl p-4 border ${color} relative ${isInteractive ? 'cursor-pointer hover:opacity-95 active:opacity-90 transition-opacity' : ''}`;

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={commonClassName}
      >
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-sm text-gray-600">{label}</span>
        </div>
        <p className="text-2xl text-gray-800">{value}</p>
        {warningIcon && <div className="absolute top-2 left-2">{warningIcon}</div>}
      </button>
    );
  }

  return (
    <div className={commonClassName}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="text-2xl text-gray-800">{value}</p>
      {warningIcon && <div className="absolute top-2 left-2">{warningIcon}</div>}
    </div>
  );
}


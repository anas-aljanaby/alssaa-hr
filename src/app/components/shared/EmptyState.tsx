import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="text-center py-12 text-gray-400">
      {icon && <div className="w-12 h-12 mx-auto mb-2 opacity-50">{icon}</div>}
      <p>{title}</p>
      {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

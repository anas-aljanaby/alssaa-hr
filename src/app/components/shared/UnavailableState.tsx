import React from 'react';
import { CloudOff } from 'lucide-react';

type UnavailableStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function UnavailableState({
  title,
  description,
  actionLabel,
  onAction,
}: UnavailableStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
        <CloudOff className="w-6 h-6" />
      </div>
      <h2 className="text-base text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
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


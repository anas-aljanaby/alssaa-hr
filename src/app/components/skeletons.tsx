import React from 'react';

function S({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-200 animate-pulse rounded-xl ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <S className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <S key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <S className="h-32 rounded-2xl" />
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <S className="h-28 rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <S key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <S className="h-52 rounded-2xl" />
      <S className="h-52 rounded-2xl" />
    </div>
  );
}

export function ListPageSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <S className="h-8 w-32" />
        <S className="h-10 w-24" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <S key={i} className="h-10 w-20 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <S key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export function UsersPageSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <S className="h-8 w-40" />
        <S className="h-10 w-20" />
      </div>
      <S className="h-12" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <S key={i} className="h-10 w-16 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <S key={i} className="h-16" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <S key={i} className="h-28" />
      ))}
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <S className="h-8 w-48" />
      <S className="h-12" />
      <S className="h-52 rounded-2xl" />
      <S className="h-64 rounded-2xl" />
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">جاري التحميل...</p>
      </div>
    </div>
  );
}

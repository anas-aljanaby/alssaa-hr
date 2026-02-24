import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '@/app/contexts/AuthContext';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();

  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

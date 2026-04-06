import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '@/app/contexts/AuthContext';

export function RequireManagerOrAdmin({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { EmployeeDashboard } from './employee/EmployeeDashboard';
import { ManagerDashboard } from './manager/ManagerDashboard';
import { AdminDashboard } from './admin/AdminDashboard';

export function DashboardRouter() {
  const { currentUser, isAuthenticated, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  switch (currentUser.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'manager':
      return <ManagerDashboard />;
    case 'employee':
    default:
      return <EmployeeDashboard />;
  }
}

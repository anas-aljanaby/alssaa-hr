import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { EmployeeDashboard } from './employee/EmployeeDashboard';
import { ManagerDashboard } from './manager/ManagerDashboard';
import { AdminDashboard } from './admin/AdminDashboard';

export function DashboardRouter() {
  const { currentUser, isAuthenticated } = useAuth();

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

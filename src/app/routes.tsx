import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { RootLayout } from './components/layout/RootLayout';
import { MobileLayout } from './components/layout/MobileLayout';
import { LoginPage } from './pages/LoginPage';
import { AttendancePage } from './pages/employee/AttendancePage';
import { RequestsPage } from './pages/employee/RequestsPage';
import { NotificationsPage } from './pages/employee/NotificationsPage';
import { MorePage } from './pages/employee/MorePage';
import { ApprovalsPage } from './pages/manager/ApprovalsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { DepartmentsPage } from './pages/admin/DepartmentsPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { UserDetailsPage } from './pages/admin/UserDetailsPage';
import { DashboardRouter } from './pages/DashboardRouter';

function NotFoundRedirect() {
  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      {
        path: 'login',
        Component: LoginPage,
      },
      {
        // Pathless layout route for MobileLayout
        Component: MobileLayout,
        children: [
          { index: true, Component: DashboardRouter },
          { path: 'attendance', Component: AttendancePage },
          { path: 'requests', Component: RequestsPage },
          { path: 'notifications', Component: NotificationsPage },
          { path: 'more', Component: MorePage },
          { path: 'approvals', Component: ApprovalsPage },
          { path: 'users', Component: UsersPage },
          { path: 'departments', Component: DepartmentsPage },
          { path: 'reports', Component: ReportsPage },
          { path: 'user-details/:userId', Component: UserDetailsPage },
        ],
      },
      { path: '*', Component: NotFoundRedirect },
    ],
  },
]);
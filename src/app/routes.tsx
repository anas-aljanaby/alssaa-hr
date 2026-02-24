import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { RootLayout } from './components/layout/RootLayout';
import { MobileLayout } from './components/layout/MobileLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FullPageSpinner } from './components/skeletons';
import { RequireAdmin } from './components/RequireAdmin';

const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignUpPage = React.lazy(() => import('./pages/SignUpPage').then(m => ({ default: m.SignUpPage })));
const AuthCallbackPage = React.lazy(() => import('./pages/AuthCallbackPage').then(m => ({ default: m.AuthCallbackPage })));
const DashboardRouter = React.lazy(() => import('./pages/DashboardRouter').then(m => ({ default: m.DashboardRouter })));
const AttendancePage = React.lazy(() => import('./pages/employee/AttendancePage').then(m => ({ default: m.AttendancePage })));
const RequestsPage = React.lazy(() => import('./pages/employee/RequestsPage').then(m => ({ default: m.RequestsPage })));
const NotificationsPage = React.lazy(() => import('./pages/employee/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const MorePage = React.lazy(() => import('./pages/employee/MorePage').then(m => ({ default: m.MorePage })));
const ApprovalsPage = React.lazy(() => import('./pages/manager/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
const UsersPage = React.lazy(() => import('./pages/admin/UsersPage').then(m => ({ default: m.UsersPage })));
const DepartmentsPage = React.lazy(() => import('./pages/admin/DepartmentsPage').then(m => ({ default: m.DepartmentsPage })));
const DepartmentDetailsPage = React.lazy(() => import('./pages/admin/DepartmentDetailsPage').then(m => ({ default: m.DepartmentDetailsPage })));
const ReportsPage = React.lazy(() => import('./pages/admin/ReportsPage').then(m => ({ default: m.ReportsPage })));
const UserDetailsPage = React.lazy(() => import('./pages/admin/UserDetailsPage').then(m => ({ default: m.UserDetailsPage })));

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<FullPageSpinner />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

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
        element: <Lazy><LoginPage /></Lazy>,
      },
      {
        path: 'signup',
        element: <Lazy><SignUpPage /></Lazy>,
      },
      {
        path: 'auth/callback',
        element: <Lazy><AuthCallbackPage /></Lazy>,
      },
      {
        Component: MobileLayout,
        children: [
          { index: true, element: <Lazy><DashboardRouter /></Lazy> },
          { path: 'attendance', element: <Lazy><AttendancePage /></Lazy> },
          { path: 'requests', element: <Lazy><RequestsPage /></Lazy> },
          { path: 'notifications', element: <Lazy><NotificationsPage /></Lazy> },
          { path: 'more', element: <Lazy><MorePage /></Lazy> },
          { path: 'approvals', element: <Lazy><ApprovalsPage /></Lazy> },
          { path: 'users', element: <Lazy><UsersPage /></Lazy> },
          { path: 'departments', element: <Lazy><RequireAdmin><DepartmentsPage /></RequireAdmin></Lazy> },
          { path: 'departments/:deptId', element: <Lazy><RequireAdmin><DepartmentDetailsPage /></RequireAdmin></Lazy> },
          { path: 'reports', element: <Lazy><ReportsPage /></Lazy> },
          { path: 'user-details/:userId', element: <Lazy><UserDetailsPage /></Lazy> },
        ],
      },
      { path: '*', Component: NotFoundRedirect },
    ],
  },
]);

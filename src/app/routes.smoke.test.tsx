import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Role = 'employee' | 'manager' | 'admin';

type MockUser = {
  uid: string;
  role: Role;
  departmentId?: string;
};

let authState: { currentUser: MockUser | null; authReady: boolean } = {
  currentUser: null,
  authReady: true,
};

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    currentUser: authState.currentUser,
    authReady: authState.authReady,
    isAuthenticated: !!authState.currentUser,
    login: vi.fn(),
    loginAs: null,
    logout: vi.fn(),
  }),
}));

vi.mock('./contexts/AppContext', () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./contexts/DevTimeContext', () => ({
  DevTimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/layout/RootLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./components/layout/RootLayout')>();
  const { Outlet } = await import('react-router');
  return {
    ...actual,
    RootLayout: () => <Outlet />,
  };
});

vi.mock('./components/layout/MobileLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./components/layout/MobileLayout')>();
  const { Outlet, Navigate } = await import('react-router');
  return {
    ...actual,
    MobileLayout: () => {
      if (!authState.authReady) return <div data-testid="auth-loading">loading</div>;
      if (!authState.currentUser) return <Navigate to="/login" replace />;
      return <Outlet />;
    },
  };
});

vi.mock('./pages/LoginPage', () => ({ LoginPage: () => <div data-testid="page-login">login</div> }));
vi.mock('./pages/AuthCallbackPage', () => ({ AuthCallbackPage: () => <div data-testid="page-auth-callback">auth-callback</div> }));
vi.mock('./pages/SetPasswordPage', () => ({ SetPasswordPage: () => <div data-testid="page-set-password">set-password</div> }));
vi.mock('./pages/DashboardRouter', () => ({ DashboardRouter: () => <div data-testid="page-dashboard-router">dashboard-router</div> }));
vi.mock('./pages/employee/AttendancePage', () => ({ AttendancePage: () => <div data-testid="page-attendance">attendance</div> }));
vi.mock('./pages/team/TeamAttendancePage', () => ({ TeamAttendancePage: () => <div data-testid="page-team-attendance">team-attendance</div> }));
vi.mock('./pages/employee/RequestsPage', () => ({ RequestsPage: () => <div data-testid="page-requests">requests</div> }));
vi.mock('./pages/employee/NotificationsPage', () => ({ NotificationsPage: () => <div data-testid="page-notifications">notifications</div> }));
vi.mock('./pages/employee/MorePage', () => ({ MorePage: () => <div data-testid="page-more">more</div> }));
vi.mock('./pages/manager/ApprovalsPage', () => ({ ApprovalsPage: () => <div data-testid="page-approvals">approvals</div> }));
vi.mock('./pages/admin/UsersPage', () => ({ UsersPage: () => <div data-testid="page-users">users</div> }));
vi.mock('./pages/admin/DepartmentsPage', () => ({ DepartmentsPage: () => <div data-testid="page-departments">departments</div> }));
vi.mock('./pages/admin/DepartmentDetailsPage', () => ({ DepartmentDetailsPage: () => <div data-testid="page-department-details">department-details</div> }));
vi.mock('./pages/admin/ReportsPage', () => ({ ReportsPage: () => <div data-testid="page-reports">reports</div> }));
vi.mock('./pages/admin/TransferGeneralManagerPage', () => ({ TransferGeneralManagerPage: () => <div data-testid="page-transfer-general-manager">transfer-general-manager</div> }));
vi.mock('./pages/admin/UserDetailsPage', () => ({ UserDetailsPage: () => <div data-testid="page-user-details">user-details</div> }));
vi.mock('./pages/employee/SecurityPrivacyPage', () => ({ SecurityPrivacyPage: () => <div data-testid="page-security-privacy">security-privacy</div> }));
vi.mock('./pages/employee/TermsPage', () => ({ TermsPage: () => <div data-testid="page-terms-conditions">terms-conditions</div> }));
vi.mock('./pages/employee/AttendancePolicyPage', () => ({ AttendancePolicyPage: () => <div data-testid="page-attendance-policy">attendance-policy</div> }));

function setAuth(role: Role | null) {
  authState = {
    authReady: true,
    currentUser: role
      ? { uid: `${role}-user-1`, role, departmentId: role === 'manager' ? 'dept-1' : undefined }
      : null,
  };
}

async function renderPath(path: string, role: Role | null, expectedTestId: string) {
  setAuth(role);
  const { router } = await import('./routes');
  render(<RouterProvider router={router} />);
  await router.navigate(path);

  await waitFor(() => {
    expect(screen.getByTestId(expectedTestId)).toBeInTheDocument();
  });
}

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('route rendering smoke tests', () => {
  const cases: Array<{ path: string; role: Role | null; expectedTestId: string }> = [
    { path: '/login', role: null, expectedTestId: 'page-login' },
    { path: '/signup', role: null, expectedTestId: 'page-login' },
    { path: '/auth/callback', role: null, expectedTestId: 'page-auth-callback' },
    { path: '/set-password', role: null, expectedTestId: 'page-set-password' },

    { path: '/', role: 'employee', expectedTestId: 'page-dashboard-router' },
    { path: '/attendance', role: 'employee', expectedTestId: 'page-attendance' },
    { path: '/team-attendance', role: 'employee', expectedTestId: 'page-team-attendance' },
    { path: '/requests', role: 'employee', expectedTestId: 'page-requests' },
    { path: '/departments', role: 'employee', expectedTestId: 'page-dashboard-router' },
    { path: '/more', role: 'employee', expectedTestId: 'page-more' },
    { path: '/attendance-policy', role: 'employee', expectedTestId: 'page-attendance-policy' },
    { path: '/security-privacy', role: 'employee', expectedTestId: 'page-security-privacy' },
    { path: '/terms-conditions', role: 'employee', expectedTestId: 'page-terms-conditions' },

    { path: '/approvals', role: 'manager', expectedTestId: 'page-approvals' },
    { path: '/team-attendance', role: 'manager', expectedTestId: 'page-team-attendance' },
    { path: '/departments', role: 'manager', expectedTestId: 'page-departments' },

    { path: '/users', role: 'admin', expectedTestId: 'page-users' },
    { path: '/team-attendance', role: 'admin', expectedTestId: 'page-team-attendance' },
    { path: '/departments', role: 'admin', expectedTestId: 'page-departments' },
    { path: '/departments/test-dept', role: 'admin', expectedTestId: 'page-department-details' },
    { path: '/reports', role: 'admin', expectedTestId: 'page-reports' },
    { path: '/transfer-general-manager', role: 'admin', expectedTestId: 'page-transfer-general-manager' },
    { path: '/user-details/test-user', role: 'admin', expectedTestId: 'page-user-details' },
  ];

  it.each(cases)('renders $path for role=$role', async ({ path, role, expectedTestId }) => {
    await renderPath(path, role, expectedTestId);
  });
});

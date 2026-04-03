import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DepartmentsPage } from './DepartmentsPage';

let mockUser: { uid: string; role: 'admin' | 'manager' | 'employee'; departmentId?: string } | null = {
  uid: 'admin-1',
  role: 'admin',
};

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: mockUser }),
}));

vi.mock('@/app/hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

vi.mock('@/app/components/Pagination', () => ({
  Pagination: () => null,
  usePagination: (items: unknown[]) => ({
    paginatedItems: items,
    currentPage: 1,
    totalItems: items.length,
    pageSize: 20,
    setCurrentPage: vi.fn(),
  }),
}));

vi.mock('@/app/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/services/departments.service', () => ({
  getDepartmentWithEmployeeCount: vi.fn().mockResolvedValue([
    {
      id: 'dept-1',
      name_ar: 'قسم الاختبار',
      name: 'Test Department',
      manager_uid: 'manager-1',
      employee_count: 2,
    },
  ]),
}));

vi.mock('@/lib/services/profiles.service', () => ({
  listUsers: vi.fn().mockResolvedValue([
    {
      id: 'manager-1',
      name_ar: 'مدير القسم',
      role: 'manager',
      employee_id: 'M-1',
      department_id: 'dept-1',
    },
  ]),
  getDepartmentEmployees: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/services/audit.service', () => ({
  createAuditLog: vi.fn(),
}));

describe('DepartmentsPage role permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows admin full controls', async () => {
    mockUser = { uid: 'admin-1', role: 'admin' };
    render(
      <MemoryRouter>
        <DepartmentsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('قسم جديد')).toBeInTheDocument();
    });
  });

  it('manager is read-only: no create, no delete', async () => {
    mockUser = { uid: 'manager-1', role: 'manager', departmentId: 'dept-1' };
    render(
      <MemoryRouter>
        <DepartmentsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('قسم الاختبار')).toBeInTheDocument();
      expect(screen.queryByText('قسم جديد')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('حذف القسم')).not.toBeInTheDocument();
    });
  });

  it('employee is read-only: no create', async () => {
    mockUser = { uid: 'employee-1', role: 'employee', departmentId: 'dept-1' };
    render(
      <MemoryRouter>
        <DepartmentsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('قسم الاختبار')).toBeInTheDocument();
      expect(screen.queryByText('قسم جديد')).not.toBeInTheDocument();
    });
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    {
      id: 'dept-2',
      name_ar: 'قسم آخر',
      name: 'Another Department',
      manager_uid: 'manager-2',
      employee_count: 1,
    },
  ]),
  listAttachableDepartmentEmployees: vi.fn().mockResolvedValue([
    {
      id: 'employee-1',
      name_ar: 'موظف اختبار طويل الاسم جدا',
      role: 'employee',
      employee_id: 'EMP-1234',
      email: 'employee.long.name@example.com',
      department_id: null,
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
      email: 'manager@example.com',
      department_id: 'dept-1',
    },
    {
      id: 'employee-1',
      name_ar: 'موظف اختبار طويل الاسم جدا',
      role: 'employee',
      employee_id: 'EMP-1234',
      email: 'employee.long.name@example.com',
      department_id: null,
    },
    {
      id: 'employee-2',
      name_ar: 'موظف مرتبط',
      role: 'employee',
      employee_id: 'EMP-9999',
      email: 'assigned@example.com',
      department_id: 'dept-2',
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

  it('shows attach-user options with readable name and email instead of employee id', async () => {
    mockUser = { uid: 'admin-1', role: 'admin' };
    render(
      <MemoryRouter>
        <DepartmentsPage />
      </MemoryRouter>
    );

    const expandButtons = await screen.findAllByLabelText('توسيع القسم');
    fireEvent.click(expandButtons[0]);
    const attachButton = await screen.findByLabelText('اضافة موظف للقسمقسم الاختبار');
    fireEvent.click(attachButton);

    await waitFor(() => {
      expect(screen.getByText('موظف اختبار طويل الاس... - employee.long.name@exampl...')).toBeInTheDocument();
    });

    const optionLabels = screen.getAllByRole('option').map((option) => option.textContent ?? '');
    expect(optionLabels).toContain('موظف اختبار طويل الاس... - employee.long.name@exampl...');
    expect(optionLabels.some((label) => label.includes('EMP-1234'))).toBe(false);
    expect(optionLabels.some((label) => label.includes('موظف مرتبط'))).toBe(false);
  });

  it('does not show manager selection in create department modal', async () => {
    mockUser = { uid: 'admin-1', role: 'admin' };
    render(
      <MemoryRouter>
        <DepartmentsPage />
      </MemoryRouter>
    );

    const createButton = await screen.findByText('قسم جديد');
    fireEvent.click(createButton);

    expect(screen.queryAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByText('سيتم إنشاء القسم بدون مدير. بعد إضافة أعضاء للقسم يمكنك اختيار مدير من شاشة التعديل.')).toBeInTheDocument();
  });

  it('manager can manage members only for own department', async () => {
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
      expect(screen.queryByLabelText('تعديل القسم')).not.toBeInTheDocument();
    });

    const expandButtons = screen.getAllByLabelText('توسيع القسم');
    fireEvent.click(expandButtons[0]);
    fireEvent.click(expandButtons[1]);

    await waitFor(() => {
      expect(screen.getByLabelText('اضافة موظف للقسمقسم الاختبار')).toBeInTheDocument();
      expect(screen.queryByLabelText('اضافة موظف للقسمقسم آخر')).not.toBeInTheDocument();
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

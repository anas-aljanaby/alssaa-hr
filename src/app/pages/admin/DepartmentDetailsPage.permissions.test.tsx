import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DepartmentDetailsPage } from './DepartmentDetailsPage';

let mockUser: { uid: string; role: 'admin' | 'manager' | 'employee'; departmentId?: string } | null = {
  uid: 'manager-1',
  role: 'manager',
  departmentId: 'dept-1',
};

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: mockUser }),
}));

vi.mock('@/app/hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

vi.mock('@/lib/services/departments.service', () => ({
  getDepartmentById: vi.fn().mockResolvedValue({
    id: 'dept-1',
    name_ar: 'قسم الاختبار',
    name: 'Test Department',
    manager_uid: 'manager-1',
  }),
  getDepartmentWithEmployeeCount: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/services/profiles.service', () => ({
  getDepartmentEmployees: vi.fn().mockResolvedValue([
    {
      id: 'manager-1',
      name_ar: 'مدير القسم',
      role: 'manager',
      employee_id: 'M-1',
    },
  ]),
  listUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/services/audit.service', () => ({
  createAuditLog: vi.fn(),
}));

describe('DepartmentDetailsPage permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('manager cannot edit or delete department', async () => {
    mockUser = { uid: 'manager-1', role: 'manager', departmentId: 'dept-1' };

    render(
      <MemoryRouter initialEntries={['/departments/dept-1']}>
        <Routes>
          <Route path="/departments/:deptId" element={<DepartmentDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('قسم الاختبار')).toBeInTheDocument();
      expect(screen.queryByLabelText('حذف القسم')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('تعديل القسم')).not.toBeInTheDocument();
    });
  });
});

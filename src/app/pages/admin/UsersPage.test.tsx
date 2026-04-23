import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersPage } from './UsersPage';

let capturedTopBarConfig: {
  action?: React.ReactNode;
} | null = null;

vi.mock('../../contexts/AppTopBarContext', () => ({
  useAppTopBar: vi.fn((config) => {
    capturedTopBarConfig = config;
  }),
}));

vi.mock('@/app/hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

vi.mock('@/lib/services/profiles.service', () => ({
  listUsers: vi.fn(),
  inviteUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/lib/services/departments.service', () => ({
  listDepartments: vi.fn(),
}));

vi.mock('@/lib/generatePassword', () => ({
  generateStrongPassword: vi.fn(() => 'StrongPass123'),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
}));

const profilesService = await import('@/lib/services/profiles.service');
const departmentsService = await import('@/lib/services/departments.service');

describe('UsersPage', () => {
  beforeEach(() => {
    capturedTopBarConfig = null;
    vi.clearAllMocks();

    vi.mocked(profilesService.listUsers).mockResolvedValue([
      {
        id: 'user-1',
        org_id: 'org-1',
        employee_id: 'EMP-001',
        name: 'Ali',
        name_ar: 'علي',
        email: 'ali@example.com',
        role: 'employee',
        department_id: 'dept-1',
        avatar_url: null,
        join_date: '2024-01-01',
        work_schedule: null,
      },
    ] as any);

    vi.mocked(departmentsService.listDepartments).mockResolvedValue([
      {
        id: 'dept-1',
        org_id: 'org-1',
        name: 'News',
        name_ar: 'الأخبار',
        manager_uid: 'mgr-1',
        created_at: '2024-01-01T00:00:00Z',
      },
    ] as any);
  });

  it('keeps the add-user form aligned on mobile', async () => {
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    );

    await screen.findByText('علي');

    const addUserAction = capturedTopBarConfig?.action as React.ReactElement<{ onClick?: () => void }>;

    act(() => {
      addUserAction.props.onClick?.();
    });

    const addUserTitle = await screen.findByText('إضافة مستخدم جديد');
    expect(addUserTitle).toHaveClass('text-center');

    const passwordFieldHeader = screen.getByText('كلمة المرور').parentElement;
    expect(passwordFieldHeader).toHaveClass('flex-col');
    expect(passwordFieldHeader).toHaveClass('sm:flex-row');

    const emailInput = screen.getByPlaceholderText('example@alssaa.tv');
    expect(emailInput).toHaveAttribute('dir', 'ltr');
    expect(emailInput).toHaveClass('text-left');

    const passwordInput = screen.getByPlaceholderText('أدخل كلمة مرور قوية');
    expect(passwordInput).toHaveAttribute('dir', 'rtl');
    expect(passwordInput).toHaveClass('text-right');

    fireEvent.click(screen.getByRole('button', { name: 'توليد' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('StrongPass123')).toHaveAttribute('dir', 'ltr');
    });

    expect(screen.getByDisplayValue('StrongPass123')).toHaveClass('text-left');
  });
});

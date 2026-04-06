import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from './AdminDashboard';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/useRealtimeSubscription', () => ({
  useRealtimeSubscription: vi.fn(),
}));

vi.mock('@/lib/services/profiles.service', () => ({
  listUsers: vi.fn(),
}));

vi.mock('@/lib/services/departments.service', () => ({
  listDepartments: vi.fn(),
}));

vi.mock('@/lib/services/attendance.service', () => ({
  getAllLogsForDate: vi.fn(),
  getMonthlyLogs: vi.fn(),
  subscribeToAttendanceLogs: vi.fn(() => () => {}),
}));

vi.mock('@/lib/services/requests.service', () => ({
  getAllPendingRequests: vi.fn(),
  subscribeToAllRequests: vi.fn(() => () => {}),
}));

const profilesService = await import('@/lib/services/profiles.service');
const departmentsService = await import('@/lib/services/departments.service');
const attendanceService = await import('@/lib/services/attendance.service');
const requestsService = await import('@/lib/services/requests.service');

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(profilesService.listUsers).mockResolvedValue([
      {
        id: 'emp-1',
        org_id: 'org-1',
        employee_id: 'EMP-001',
        name: 'Ali',
        name_ar: 'علي',
        email: 'ali@example.com',
        role: 'employee',
        department_id: 'dept-1',
        avatar_url: null,
        join_date: '2024-01-01',
        work_days: null,
        work_start_time: null,
        work_end_time: null,
      },
      {
        id: 'emp-2',
        org_id: 'org-1',
        employee_id: 'EMP-002',
        name: 'Mona',
        name_ar: 'منى',
        email: 'mona@example.com',
        role: 'employee',
        department_id: 'dept-1',
        avatar_url: null,
        join_date: '2024-01-01',
        work_days: null,
        work_start_time: null,
        work_end_time: null,
      },
      {
        id: 'emp-3',
        org_id: 'org-1',
        employee_id: 'EMP-003',
        name: 'Omar',
        name_ar: 'عمر',
        email: 'omar@example.com',
        role: 'employee',
        department_id: 'dept-1',
        avatar_url: null,
        join_date: '2024-01-01',
        work_days: null,
        work_start_time: null,
        work_end_time: null,
      },
    ] as any);

    vi.mocked(departmentsService.listDepartments).mockResolvedValue([
      {
        id: 'dept-1',
        org_id: 'org-1',
        name: 'News',
        name_ar: 'الأخبار',
        manager_uid: 'mgr-1',
        created_at: '2024-01-01T00:00:00',
      },
    ] as any);

    vi.mocked(attendanceService.getAllLogsForDate).mockResolvedValue([
      {
        id: 'log-1',
        org_id: 'org-1',
        user_id: 'emp-1',
        date: '2026-04-04',
        check_in_time: '08:05',
        check_out_time: null,
        status: 'present',
        auto_punch_out: false,
      },
      {
        id: 'log-2',
        org_id: 'org-1',
        user_id: 'emp-2',
        date: '2026-04-04',
        check_in_time: '08:40',
        check_out_time: null,
        status: 'late',
        auto_punch_out: false,
      },
    ] as any);

    vi.mocked(attendanceService.getMonthlyLogs).mockResolvedValue([]);
    vi.mocked(requestsService.getAllPendingRequests).mockResolvedValue([]);
  });

  // TODO: Re-enable after summary cards/drilldown UX rework stabilizes.
  it.skip('shows a filtered today drilldown when a summary card is clicked', async () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    await screen.findByText('ملخص اليوم');

    fireEvent.click(screen.getByRole('button', { name: /غائبون/i }));

    await waitFor(() => {
      expect(screen.getByText('تفاصيل غائب اليوم')).toBeInTheDocument();
      expect(screen.getByText('عمر')).toBeInTheDocument();
    });

    expect(screen.queryByText('علي')).not.toBeInTheDocument();
    expect(screen.queryByText('منى')).not.toBeInTheDocument();
  });
});

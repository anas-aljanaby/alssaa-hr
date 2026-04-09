import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
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

vi.mock('@/lib/time', () => ({
  now: () => new Date('2026-04-04T09:00:00.000Z'),
}));

vi.mock('@/lib/services/profiles.service', () => ({
  listUsers: vi.fn(),
}));

vi.mock('@/lib/services/departments.service', () => ({
  listDepartments: vi.fn(),
}));

vi.mock('@/lib/services/attendance.service', () => ({
  getTeamAttendanceDay: vi.fn(),
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

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{`${location.pathname}${location.search}`}</div>;
}

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

    vi.mocked(attendanceService.getTeamAttendanceDay).mockResolvedValue([
      {
        userId: 'emp-1',
        nameAr: 'علي',
        employeeId: 'EMP-001',
        role: 'employee',
        avatarUrl: null,
        departmentId: 'dept-1',
        departmentNameAr: 'الأخبار',
        date: '2026-04-04',
        effectiveStatus: 'present',
        displayStatus: 'present',
        firstCheckIn: '08:05',
        lastCheckOut: null,
        totalWorkMinutes: 60,
        totalOvertimeMinutes: 0,
        hasOvertime: false,
        sessionCount: 1,
        isCheckedInNow: true,
        hasAutoPunchOut: false,
        needsReview: false,
        isShortDay: false,
      },
      {
        userId: 'emp-2',
        nameAr: 'منى',
        employeeId: 'EMP-002',
        role: 'employee',
        avatarUrl: null,
        departmentId: 'dept-1',
        departmentNameAr: 'الأخبار',
        date: '2026-04-04',
        effectiveStatus: 'late',
        displayStatus: 'late',
        firstCheckIn: '08:40',
        lastCheckOut: null,
        totalWorkMinutes: 60,
        totalOvertimeMinutes: 0,
        hasOvertime: false,
        sessionCount: 1,
        isCheckedInNow: true,
        hasAutoPunchOut: false,
        needsReview: false,
        isShortDay: false,
      },
      {
        userId: 'emp-3',
        nameAr: 'عمر',
        employeeId: 'EMP-003',
        role: 'employee',
        avatarUrl: null,
        departmentId: 'dept-1',
        departmentNameAr: 'الأخبار',
        date: '2026-04-04',
        effectiveStatus: 'overtime_only',
        displayStatus: 'overtime_only',
        firstCheckIn: '18:00',
        lastCheckOut: '20:00',
        totalWorkMinutes: 120,
        totalOvertimeMinutes: 120,
        hasOvertime: true,
        sessionCount: 1,
        isCheckedInNow: false,
        hasAutoPunchOut: false,
        needsReview: false,
        isShortDay: false,
      },
    ] as any);
    vi.mocked(requestsService.getAllPendingRequests).mockResolvedValue([]);
  });

  it('navigates to team attendance with the matching live filter when a summary card is clicked', async () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
        <LocationDisplay />
      </MemoryRouter>
    );

    await screen.findByText('ملخص اليوم');
    expect(screen.getByRole('button', { name: /غائبون/i })).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: /غائبون/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/team-attendance?mode=live&date=2026-04-04&filter=absent'
      );
    });
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-04-04T09:00:00.000Z'));
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
      {
        id: 'emp-4',
        org_id: 'org-1',
        employee_id: 'EMP-004',
        name: 'Sara',
        name_ar: 'سارة',
        email: 'sara@example.com',
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
        teamLiveState: 'available_now',
        teamDateState: 'fulfilled_shift',
        firstCheckIn: '08:05',
        lastCheckOut: null,
        totalWorkMinutes: 60,
        totalOvertimeMinutes: 0,
        hasOvertime: false,
        sessionCount: 1,
        isCheckedInNow: true,
        hasAutoPunchOut: false,
        needsReview: false,
        isIncompleteShift: false,
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
        teamLiveState: 'late',
        teamDateState: 'late',
        firstCheckIn: '08:40',
        lastCheckOut: null,
        totalWorkMinutes: 60,
        totalOvertimeMinutes: 0,
        hasOvertime: false,
        sessionCount: 1,
        isCheckedInNow: true,
        hasAutoPunchOut: false,
        needsReview: false,
        isIncompleteShift: false,
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
        effectiveStatus: 'absent',
        displayStatus: 'absent',
        teamLiveState: 'absent',
        teamDateState: 'absent',
        firstCheckIn: null,
        lastCheckOut: null,
        totalWorkMinutes: 0,
        totalOvertimeMinutes: 0,
        hasOvertime: false,
        sessionCount: 0,
        isCheckedInNow: false,
        hasAutoPunchOut: false,
        needsReview: false,
        isIncompleteShift: false,
      },
      {
        userId: 'emp-4',
        nameAr: 'سارة',
        employeeId: 'EMP-004',
        role: 'employee',
        avatarUrl: null,
        departmentId: 'dept-1',
        departmentNameAr: 'الأخبار',
        date: '2026-04-04',
        effectiveStatus: null,
        displayStatus: null,
        teamLiveState: 'not_entered_yet',
        teamDateState: 'incomplete_shift',
        firstCheckIn: null,
        lastCheckOut: null,
        totalWorkMinutes: 180,
        totalOvertimeMinutes: 0,
        hasOvertime: false,
        sessionCount: 1,
        isCheckedInNow: false,
        hasAutoPunchOut: false,
        needsReview: false,
        isIncompleteShift: true,
      },
    ] as any);
    vi.mocked(requestsService.getAllPendingRequests).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates to team attendance with the matching live filter when a summary card is clicked', async () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
        <LocationDisplay />
      </MemoryRouter>
    );

    await screen.findByText('ملخص اليوم');
    expect(screen.getByRole('button', { name: /موجودون الآن/i })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /لم يسجلوا بعد/i })).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: /غائب/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/team-attendance?mode=live&date=2026-04-04&filter=absent'
      );
    });
  });

  it('switches to date mode cards and navigates with the matching date filter', async () => {
    render(
      <MemoryRouter>
        <AdminDashboard />
        <LocationDisplay />
      </MemoryRouter>
    );

    await screen.findByText('ملخص اليوم');
    fireEvent.click(screen.getByRole('button', { name: 'اليوم/التاريخ' }));

    expect(screen.getByRole('button', { name: /أكملوا الدوام/i })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /دوام غير مكتمل/i })).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: /دوام غير مكتمل/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/team-attendance?mode=date&date=2026-04-04&filter=incomplete_shift'
      );
    });
  });
});

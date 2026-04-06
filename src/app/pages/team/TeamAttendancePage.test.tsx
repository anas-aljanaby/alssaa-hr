import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamAttendancePage } from './TeamAttendancePage';

let mockUser: { uid: string; role: 'employee' | 'manager' | 'admin'; departmentId?: string } | null = {
  uid: 'employee-1',
  role: 'employee',
  departmentId: 'dept-news',
};

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: mockUser }),
}));

vi.mock('@/lib/time', () => ({
  now: () => new Date('2026-04-06T09:00:00.000Z'),
}));

vi.mock('@/app/components/attendance/DayDetailsSheet', () => ({
  DayDetailsSheet: ({ userId, date }: { userId: string; date: string | null }) =>
    date ? <div data-testid="day-details-sheet">{`${userId}:${date}`}</div> : null,
}));

vi.mock('@/lib/services/departments.service', () => ({
  listDepartments: vi.fn(),
  getDepartmentByManagerUid: vi.fn(),
}));

vi.mock('@/lib/services/attendance.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/attendance.service')>();
  return {
    ...actual,
    getTeamAttendanceDay: vi.fn(),
    getRedactedDepartmentAvailability: vi.fn(),
  };
});

const departmentsService = await import('@/lib/services/departments.service');
const attendanceService = await import('@/lib/services/attendance.service');

describe('TeamAttendancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(departmentsService.listDepartments).mockResolvedValue([
      {
        id: 'dept-news',
        org_id: 'org-1',
        name: 'News',
        name_ar: 'الأخبار',
        manager_uid: 'manager-1',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'dept-editing',
        org_id: 'org-1',
        name: 'Editing',
        name_ar: 'التحرير',
        manager_uid: 'manager-2',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ] as any);
    vi.mocked(departmentsService.getDepartmentByManagerUid).mockResolvedValue(null);

    vi.mocked(attendanceService.getRedactedDepartmentAvailability).mockResolvedValue([
      {
        userId: 'editor-1',
        nameAr: 'سارة',
        employeeId: 'EMP-10',
        role: 'employee',
        avatarUrl: null,
        departmentId: 'dept-editing',
        departmentNameAr: 'التحرير',
        availabilityState: 'available_now',
      },
    ]);

    vi.mocked(attendanceService.getTeamAttendanceDay).mockResolvedValue([
      {
        userId: 'reporter-1',
        nameAr: 'علي',
        employeeId: 'EMP-1',
        role: 'employee',
        avatarUrl: null,
        departmentId: 'dept-news',
        departmentNameAr: 'الأخبار',
        date: '2026-04-06',
        effectiveStatus: 'late',
        displayStatus: 'late',
        firstCheckIn: '08:10',
        lastCheckOut: null,
        totalWorkMinutes: 120,
        totalOvertimeMinutes: 0,
        sessionCount: 1,
        isCheckedInNow: true,
        hasAutoPunchOut: false,
        needsReview: false,
        isShortDay: false,
      },
    ]);
  });

  it('shows redacted availability for employees and filters by department', async () => {
    mockUser = {
      uid: 'employee-1',
      role: 'employee',
      departmentId: 'dept-news',
    };

    render(
      <MemoryRouter>
        <TeamAttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('سارة')).toBeInTheDocument();
    });

    expect(screen.queryByText('اليوم المعروض')).not.toBeInTheDocument();
    expect(screen.getAllByText('متاح الآن').length).toBeGreaterThan(0);
    expect(screen.queryByText('08:10')).not.toBeInTheDocument();
    expect(attendanceService.getRedactedDepartmentAvailability).toHaveBeenCalledWith({
      departmentId: null,
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'dept-editing' },
    });

    await waitFor(() => {
      expect(attendanceService.getRedactedDepartmentAvailability).toHaveBeenLastCalledWith({
        departmentId: 'dept-editing',
      });
    });
  });

  it('shows detailed mode for manager own department, opens day details, then switches to redacted mode for other departments', async () => {
    mockUser = {
      uid: 'manager-1',
      role: 'manager',
      departmentId: 'dept-news',
    };

    render(
      <MemoryRouter>
        <TeamAttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('08:10')).toBeInTheDocument();
    });

    expect(screen.getByText('اليوم المعروض')).toBeInTheDocument();
    expect(attendanceService.getTeamAttendanceDay).toHaveBeenCalledWith({
      date: '2026-04-06',
      departmentId: 'dept-news',
    });

    fireEvent.click(screen.getByRole('button', { name: /علي/i }));

    await waitFor(() => {
      expect(screen.getByTestId('day-details-sheet')).toHaveTextContent('reporter-1:2026-04-06');
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'dept-editing' },
    });

    await waitFor(() => {
      expect(screen.getByText('سارة')).toBeInTheDocument();
    });

    expect(screen.queryByText('اليوم المعروض')).not.toBeInTheDocument();
    expect(screen.queryByText('08:10')).not.toBeInTheDocument();
    expect(attendanceService.getRedactedDepartmentAvailability).toHaveBeenLastCalledWith({
      departmentId: 'dept-editing',
    });
  });
});

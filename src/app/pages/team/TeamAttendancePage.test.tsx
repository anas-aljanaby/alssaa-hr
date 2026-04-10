import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamAttendancePage } from './TeamAttendancePage';

let mockUser: { uid: string; role: 'employee' | 'manager' | 'admin'; departmentId?: string } | null = {
  uid: 'employee-1',
  role: 'employee',
  departmentId: 'dept-news',
};

const liveAvailabilityRows = [
  {
    userId: 'reporter-1',
    nameAr: 'علي',
    employeeId: 'EMP-1',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-news',
    departmentNameAr: 'الأخبار',
    teamLiveState: 'available_now' as const,
    hasOvertime: false,
  },
  {
    userId: 'producer-1',
    nameAr: 'ريم',
    employeeId: 'EMP-2',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-news',
    departmentNameAr: 'الأخبار',
    teamLiveState: 'absent' as const,
    hasOvertime: false,
  },
  {
    userId: 'editor-1',
    nameAr: 'سارة',
    employeeId: 'EMP-10',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-editing',
    departmentNameAr: 'التحرير',
    teamLiveState: 'available_now' as const,
    hasOvertime: false,
  },
];

const dayAvailabilityRows = [
  {
    userId: 'reporter-1',
    nameAr: 'علي',
    employeeId: 'EMP-1',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-news',
    departmentNameAr: 'الأخبار',
    date: '2026-04-06',
    teamDateState: 'fulfilled_shift' as const,
    hasOvertime: false,
  },
  {
    userId: 'producer-1',
    nameAr: 'ريم',
    employeeId: 'EMP-2',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-news',
    departmentNameAr: 'الأخبار',
    date: '2026-04-06',
    teamDateState: 'absent' as const,
    hasOvertime: false,
  },
  {
    userId: 'editor-1',
    nameAr: 'سارة',
    employeeId: 'EMP-10',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-editing',
    departmentNameAr: 'التحرير',
    date: '2026-04-06',
    teamDateState: 'fulfilled_shift' as const,
    hasOvertime: false,
  },
];

const detailedRows = [
  {
    userId: 'reporter-1',
    nameAr: 'علي',
    employeeId: 'EMP-1',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-news',
    departmentNameAr: 'الأخبار',
    date: '2026-04-06',
    effectiveStatus: 'late' as const,
    displayStatus: 'late' as const,
    teamLiveState: 'late' as const,
    teamDateState: 'late' as const,
    firstCheckIn: '08:10',
    lastCheckOut: null,
    totalWorkMinutes: 120,
    totalOvertimeMinutes: 0,
    hasOvertime: false,
    sessionCount: 1,
    isCheckedInNow: true,
    hasAutoPunchOut: false,
    needsReview: false,
    isShortDay: false,
  },
  {
    userId: 'producer-1',
    nameAr: 'ريم',
    employeeId: 'EMP-2',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-news',
    departmentNameAr: 'الأخبار',
    date: '2026-04-06',
    effectiveStatus: 'overtime_only' as const,
    displayStatus: 'overtime_only' as const,
    teamLiveState: 'neutral' as const,
    teamDateState: 'absent' as const,
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
  {
    userId: 'designer-1',
    nameAr: 'هدى',
    employeeId: 'EMP-7',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-editing',
    departmentNameAr: 'التحرير',
    date: '2026-04-06',
    effectiveStatus: 'present' as const,
    displayStatus: 'present' as const,
    teamLiveState: 'fulfilled_shift' as const,
    teamDateState: 'fulfilled_shift' as const,
    firstCheckIn: '08:00',
    lastCheckOut: '17:12',
    totalWorkMinutes: 510,
    totalOvertimeMinutes: 0,
    hasOvertime: false,
    sessionCount: 1,
    isCheckedInNow: false,
    hasAutoPunchOut: false,
    needsReview: false,
    isShortDay: false,
  },
  {
    userId: 'vacation-1',
    nameAr: 'مها',
    employeeId: 'EMP-8',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-editing',
    departmentNameAr: 'التحرير',
    date: '2026-04-06',
    effectiveStatus: 'on_leave' as const,
    displayStatus: 'on_leave' as const,
    teamLiveState: 'on_leave' as const,
    teamDateState: 'on_leave' as const,
    firstCheckIn: null,
    lastCheckOut: null,
    totalWorkMinutes: 0,
    totalOvertimeMinutes: 0,
    hasOvertime: false,
    sessionCount: 0,
    isCheckedInNow: false,
    hasAutoPunchOut: false,
    needsReview: false,
    isShortDay: false,
  },
  {
    userId: 'pending-1',
    nameAr: 'نور',
    employeeId: 'EMP-9',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-editing',
    departmentNameAr: 'التحرير',
    date: '2026-04-06',
    effectiveStatus: 'absent' as const,
    displayStatus: 'absent' as const,
    teamLiveState: 'not_entered_yet' as const,
    teamDateState: 'absent' as const,
    firstCheckIn: null,
    lastCheckOut: null,
    totalWorkMinutes: 0,
    totalOvertimeMinutes: 0,
    hasOvertime: false,
    sessionCount: 0,
    isCheckedInNow: false,
    hasAutoPunchOut: false,
    needsReview: false,
    isShortDay: false,
  },
  {
    userId: 'incomplete-1',
    nameAr: 'خالد',
    employeeId: 'EMP-11',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-news',
    departmentNameAr: 'الأخبار',
    date: '2026-04-06',
    effectiveStatus: 'present' as const,
    displayStatus: 'present' as const,
    teamLiveState: 'neutral' as const,
    teamDateState: 'incomplete_shift' as const,
    firstCheckIn: '09:00',
    lastCheckOut: '11:30',
    totalWorkMinutes: 150,
    totalOvertimeMinutes: 0,
    hasOvertime: false,
    sessionCount: 1,
    isCheckedInNow: false,
    hasAutoPunchOut: false,
    needsReview: false,
    isShortDay: true,
  },
  {
    userId: 'absent-1',
    nameAr: 'سالم',
    employeeId: 'EMP-12',
    role: 'employee',
    avatarUrl: null,
    departmentId: 'dept-editing',
    departmentNameAr: 'التحرير',
    date: '2026-04-06',
    effectiveStatus: 'absent' as const,
    displayStatus: 'absent' as const,
    teamLiveState: 'absent' as const,
    teamDateState: 'absent' as const,
    firstCheckIn: null,
    lastCheckOut: null,
    totalWorkMinutes: 0,
    totalOvertimeMinutes: 0,
    hasOvertime: false,
    sessionCount: 0,
    isCheckedInNow: false,
    hasAutoPunchOut: false,
    needsReview: false,
    isShortDay: false,
  },
];

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
  DayDetailsSheet: ({
    userId,
    date,
    summary,
  }: {
    userId: string;
    date: string | null;
    summary?: { employeeName?: string; statusLabel?: string } | null;
  }) =>
    date ? (
      <div data-testid="day-details-sheet">{`${userId}:${date}:${summary?.employeeName ?? ''}:${summary?.statusLabel ?? ''}`}</div>
    ) : null,
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
    getRedactedTeamAttendanceDay: vi.fn(),
  };
});

const departmentsService = await import('@/lib/services/departments.service');
const attendanceService = await import('@/lib/services/attendance.service');

function filterByDepartment<T extends { departmentId: string | null }>(
  rows: T[],
  departmentId?: string | null
) {
  if (departmentId == null) return rows;
  return rows.filter((row) => row.departmentId === departmentId);
}

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

    vi.mocked(attendanceService.getRedactedDepartmentAvailability).mockImplementation(
      async ({ departmentId }) => filterByDepartment(liveAvailabilityRows, departmentId)
    );

    vi.mocked(attendanceService.getRedactedTeamAttendanceDay).mockImplementation(
      async ({ departmentId }) => filterByDepartment(dayAvailabilityRows, departmentId)
    );

    vi.mocked(attendanceService.getTeamAttendanceDay).mockImplementation(
      async ({ departmentId }) => filterByDepartment(detailedRows, departmentId)
    );
  });

  it('defaults employees to a live grouped board with generic visibility only', async () => {
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

    const stickyFilters = screen.getByTestId('team-attendance-sticky-filters');
    expect(within(stickyFilters).getByRole('button', { name: /الكل/i })).toBeInTheDocument();
    expect(within(stickyFilters).getByRole('button', { name: /^موجودون الآن/ })).toBeInTheDocument();
    expect(within(stickyFilters).queryByRole('button', { name: /^متأخر/ })).not.toBeInTheDocument();
    expect(within(stickyFilters).queryByRole('button', { name: /^غائب/ })).not.toBeInTheDocument();
    expect(within(stickyFilters).queryByRole('button', { name: /^إجازة/ })).not.toBeInTheDocument();
    expect(within(stickyFilters).queryByRole('button', { name: /^عمل إضافي/ })).not.toBeInTheDocument();
    expect(within(stickyFilters).queryByRole('button', { name: /^غير موجودين الآن/ })).not.toBeInTheDocument();

    expect(attendanceService.getRedactedDepartmentAvailability).toHaveBeenCalledWith({
      departmentId: null,
    });
    expect(screen.getAllByText('الأخبار').length).toBeGreaterThan(0);
    expect(screen.getAllByText('التحرير').length).toBeGreaterThan(0);
    expect(screen.getAllByText('موجود الآن').length).toBeGreaterThan(0);
    expect(screen.getAllByText('غائب').length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue('2026-04-06')).not.toBeInTheDocument();
    expect(screen.queryByText('08:10')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('سارة'));
    expect(screen.queryByTestId('day-details-sheet')).not.toBeInTheDocument();
  });

  it('shows managers a mixed all-departments live board with details only for their own department', async () => {
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
      expect(screen.getByText('علي')).toBeInTheDocument();
    });

    expect(attendanceService.getRedactedDepartmentAvailability).toHaveBeenCalledWith({
      departmentId: null,
    });
    expect(attendanceService.getTeamAttendanceDay).toHaveBeenCalledWith({
      date: '2026-04-06',
      departmentId: 'dept-news',
      includeAllProfiles: true,
    });
    const filterBar = screen.getByTestId('team-attendance-sticky-filters');
    expect(within(filterBar).getByRole('button', { name: /^متأخر/ })).toBeInTheDocument();
    expect(within(filterBar).getByRole('button', { name: /^لم يسجلوا بعد/ })).toBeInTheDocument();
    expect(within(filterBar).getByRole('button', { name: /^غائب/ })).toBeInTheDocument();
    expect(within(filterBar).getByRole('button', { name: /^إجازة/ })).toBeInTheDocument();
    expect(within(filterBar).getByRole('button', { name: /^عمل إضافي/ })).toBeInTheDocument();
    expect(within(filterBar).queryByRole('button', { name: /^غير موجودين الآن/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /علي/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /سارة/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /علي/i }));

    await waitFor(() => {
      expect(screen.getByTestId('day-details-sheet')).toHaveTextContent(
        'reporter-1:2026-04-06:علي:متأخر'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'اليوم/التاريخ' }));

    await waitFor(() => {
      expect(attendanceService.getRedactedTeamAttendanceDay).toHaveBeenCalledWith({
        date: '2026-04-06',
        departmentId: null,
      });
    });

    const stickyFilters = screen.getByTestId('team-attendance-sticky-filters');
    const datePicker = screen.getByTestId('team-attendance-date-picker');
    const departmentSelect = screen.getByRole('combobox');

    expect(stickyFilters).toHaveClass('sticky');
    expect(stickyFilters).toHaveStyle({ top: 'var(--mobile-top-bar-offset, 3.5rem)' });
    expect(stickyFilters).not.toContainElement(datePicker);
    expect(stickyFilters).not.toContainElement(departmentSelect);
    expect(screen.getByDisplayValue('2026-04-06')).toBeInTheDocument();
    expect(screen.getAllByText(/غير حاضر/).length).toBeGreaterThan(0);
    expect(within(stickyFilters).getByRole('button', { name: /^أكملوا الدوام/ })).toBeInTheDocument();
    expect(within(stickyFilters).getByRole('button', { name: /^دوام غير مكتمل/ })).toBeInTheDocument();
  });

  it('gives admins full live visibility across departments and keeps department filtering intact', async () => {
    mockUser = {
      uid: 'admin-1',
      role: 'admin',
    };

    render(
      <MemoryRouter>
        <TeamAttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('علي')).toBeInTheDocument();
    });

    const overtimeAbsentRow = screen.getByRole('button', { name: /ريم/i });
    expect(overtimeAbsentRow).not.toHaveTextContent('غائب');
    expect(overtimeAbsentRow).toHaveTextContent('عمل إضافي');
    expect(overtimeAbsentRow).not.toHaveTextContent('أكمل الدوام');

    expect(attendanceService.getTeamAttendanceDay).toHaveBeenCalledWith({
      date: '2026-04-06',
      departmentId: null,
      includeAllProfiles: true,
    });
    expect(screen.getAllByText('متأخر').length).toBeGreaterThan(0);
    expect(screen.getAllByText('غائب').length).toBeGreaterThan(0);
    expect(screen.getAllByText('إجازة').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'dept-editing' },
    });

    await waitFor(() => {
      expect(attendanceService.getTeamAttendanceDay).toHaveBeenLastCalledWith({
        date: '2026-04-06',
        departmentId: 'dept-editing',
        includeAllProfiles: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('هدى')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /هدى/i }));

    await waitFor(() => {
      expect(screen.getByTestId('day-details-sheet')).toHaveTextContent(
        'designer-1:2026-04-06:هدى:أكمل الدوام'
      );
    });
  });

  it('applies the mode, date, and filter from the URL query when opening the page', async () => {
    mockUser = {
      uid: 'admin-1',
      role: 'admin',
    };

    render(
      <MemoryRouter initialEntries={['/team-attendance?mode=date&date=2026-04-05&filter=on_leave']}>
        <TeamAttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(attendanceService.getTeamAttendanceDay).toHaveBeenCalledWith({
        date: '2026-04-05',
        departmentId: null,
        includeAllProfiles: true,
      });
    });

    expect(screen.getByDisplayValue('2026-04-05')).toBeInTheDocument();
    expect(screen.getByText('مها')).toBeInTheDocument();
    expect(screen.queryByText('علي')).not.toBeInTheDocument();
    expect(screen.queryByText('ريم')).not.toBeInTheDocument();
    expect(screen.queryByText('هدى')).not.toBeInTheDocument();
  });
});

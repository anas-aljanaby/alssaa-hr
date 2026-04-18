import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserDetailsPage } from './UserDetailsPage';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn());
const mockUseNavigate = vi.hoisted(() => vi.fn());
const mockUseSearchParams = vi.hoisted(() => vi.fn());

const mockGetUserById = vi.hoisted(() => vi.fn());
const mockGetDepartmentById = vi.hoisted(() => vi.fn());
const mockListDepartments = vi.hoisted(() => vi.fn());
const mockGetAttendanceToday = vi.hoisted(() => vi.fn());
const mockGetAttendanceHistoryAllTime = vi.hoisted(() => vi.fn());
const mockGetAttendanceHistoryRange = vi.hoisted(() => vi.fn());
const mockCalculateAttendanceHistoryStats = vi.hoisted(() => vi.fn());
const mockGetUserBalance = vi.hoisted(() => vi.fn());
const mockGetUserRequests = vi.hoisted(() => vi.fn());
const mockGetAuditLogsForTarget = vi.hoisted(() => vi.fn());
const mockGetPolicy = vi.hoisted(() => vi.fn());

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useParams: () => mockUseParams(),
    useNavigate: () => mockUseNavigate(),
    useSearchParams: () => mockUseSearchParams(),
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/services/profiles.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/profiles.service')>();
  return {
    ...actual,
    getUserById: (...args: unknown[]) => mockGetUserById(...args),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  };
});

vi.mock('@/lib/services/departments.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/departments.service')>();
  return {
    ...actual,
    getDepartmentById: (...args: unknown[]) => mockGetDepartmentById(...args),
    listDepartments: (...args: unknown[]) => mockListDepartments(...args),
  };
});

vi.mock('@/lib/services/attendance.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/attendance.service')>();
  return {
    ...actual,
    getAttendanceToday: (...args: unknown[]) => mockGetAttendanceToday(...args),
    getAttendanceHistoryAllTime: (...args: unknown[]) => mockGetAttendanceHistoryAllTime(...args),
    getAttendanceHistoryRange: (...args: unknown[]) => mockGetAttendanceHistoryRange(...args),
    calculateAttendanceHistoryStats: (...args: unknown[]) => mockCalculateAttendanceHistoryStats(...args),
  };
});

vi.mock('@/lib/services/leave-balance.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/leave-balance.service')>();
  return {
    ...actual,
    getUserBalance: (...args: unknown[]) => mockGetUserBalance(...args),
    updateBalance: vi.fn(),
  };
});

vi.mock('@/lib/services/requests.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/requests.service')>();
  return {
    ...actual,
    getUserRequests: (...args: unknown[]) => mockGetUserRequests(...args),
  };
});

vi.mock('@/lib/services/audit.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/audit.service')>();
  return {
    ...actual,
    getAuditLogsForTarget: (...args: unknown[]) => mockGetAuditLogsForTarget(...args),
  };
});

vi.mock('@/lib/services/policy.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/policy.service')>();
  return {
    ...actual,
    getPolicy: (...args: unknown[]) => mockGetPolicy(...args),
  };
});

function setupSuccessfulDataLoad() {
  mockGetUserById.mockResolvedValue({
    id: 'user-2',
    org_id: 'org-1',
    employee_id: 'EMP-0002',
    name_ar: 'سارة أحمد',
    email: 'sara@example.com',
    role: 'employee',
    department_id: 'dept-1',
    work_days: [0, 1, 2, 3, 4],
    work_start_time: '08:00',
    work_end_time: '16:00',
    manager_id: null,
    created_at: '2026-03-01T00:00:00.000Z',
  });
  mockGetDepartmentById.mockResolvedValue({
    id: 'dept-1',
    org_id: 'org-1',
    name_ar: 'الموارد البشرية',
    code: 'HR',
    manager_id: null,
    created_at: '2026-03-01T00:00:00.000Z',
  });
  mockListDepartments.mockResolvedValue([]);
  mockGetAttendanceToday.mockResolvedValue({
    punches: [],
    shift: {
      workStartTime: '08:00',
      workEndTime: '16:00',
      gracePeriodMinutes: 15,
      bufferMinutesAfterShift: 5,
      minimumOvertimeMinutes: 30,
      weeklyOffDays: [5, 6],
      minimumRequiredMinutes: null,
    },
    sessions: [
      {
        id: 'session-1',
        org_id: 'org-1',
        user_id: 'user-2',
        date: '2026-03-20',
        check_in_time: '08:45',
        check_out_time: '16:05',
        status: 'present',
        is_overtime: false,
        is_auto_punch_out: false,
        is_early_departure: false,
        needs_review: false,
        duration_minutes: 440,
        last_action_at: '2026-03-20T16:05:00.000Z',
        is_dev: false,
        created_at: '2026-03-20T08:45:00.000Z',
        updated_at: '2026-03-20T16:05:00.000Z',
      },
    ],
    summary: {
      id: 'summary-1',
      org_id: 'org-1',
      user_id: 'user-2',
      date: '2026-03-20',
      effective_status: 'present',
      first_check_in: '08:45',
      last_check_out: '16:05',
      total_work_minutes: 440,
      total_overtime_minutes: 0,
      session_count: 1,
      has_auto_punch_out: false,
      has_overtime: false,
      is_incomplete_shift: false,
      is_off_day: false,
      is_holiday: false,
      leave_request_id: null,
      notes: null,
      created_at: '2026-03-20T08:45:00.000Z',
      updated_at: '2026-03-20T16:05:00.000Z',
    },
  });
  mockGetUserBalance.mockResolvedValue({
    id: 'bal-1',
    user_id: 'user-2',
    total_annual: 20,
    used_annual: 5,
    remaining_annual: 15,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
  });
  mockGetUserRequests.mockResolvedValue([
    {
      id: 'req-1',
      user_id: 'user-2',
      type: 'annual_leave',
      from_date_time: '2026-03-10T00:00:00.000Z',
      to_date_time: '2026-03-11T00:00:00.000Z',
      status: 'approved',
      created_at: '2026-03-01T00:00:00.000Z',
      note: 'مراجعة',
      decision_note: null,
    },
  ]);
  mockGetAuditLogsForTarget.mockResolvedValue([]);
  mockGetAttendanceHistoryAllTime.mockResolvedValue([
    {
      date: '2026-03-20',
      primaryState: 'fulfilled_shift',
      firstCheckIn: '08:45',
      lastCheckOut: '16:05',
      totalRegularMinutes: 435,
      totalOvertimeMinutes: 0,
      totalWorkedMinutes: 435,
      sessionCount: 1,
      hasOvertime: false,
      hasAutoPunchOut: false,
      needsReview: false,
      sessions: [],
    },
    {
      date: '2026-03-19',
      primaryState: 'absent',
      firstCheckIn: null,
      lastCheckOut: null,
      totalRegularMinutes: 0,
      totalOvertimeMinutes: 0,
      totalWorkedMinutes: 0,
      sessionCount: 0,
      hasOvertime: false,
      hasAutoPunchOut: false,
      needsReview: false,
      sessions: [],
    },
  ]);
  mockGetAttendanceHistoryRange.mockResolvedValue([
    {
      date: '2026-03-20',
      primaryState: 'fulfilled_shift',
      firstCheckIn: '08:45',
      lastCheckOut: '16:05',
      totalRegularMinutes: 435,
      totalOvertimeMinutes: 0,
      totalWorkedMinutes: 435,
      sessionCount: 1,
      hasOvertime: false,
      hasAutoPunchOut: false,
      needsReview: false,
      sessions: [],
    },
  ]);
  mockCalculateAttendanceHistoryStats.mockReturnValue({
    fulfilledShiftDays: 1,
    incompleteShiftDays: 0,
    lateDays: 0,
    absentDays: 1,
    leaveDays: 0,
    overtimeDays: 0,
    totalWorkingDays: 2,
  });
  mockGetPolicy.mockResolvedValue(null);
}

function renderPage() {
  return render(<UserDetailsPage />);
}

describe('UserDetailsPage', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ userId: 'user-2' });
    mockUseNavigate.mockReturnValue(vi.fn());
    mockUseSearchParams.mockReturnValue([new URLSearchParams('')]);
    mockUseAuth.mockReturnValue({
      currentUser: { uid: 'admin-1', role: 'admin' },
    });
    setupSuccessfulDataLoad();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('shows unauthorized state when employee opens another profile', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { uid: 'employee-1', role: 'employee' },
    });

    renderPage();

    expect(screen.getByText('غير مصرح')).toBeInTheDocument();
    expect(screen.getByText('ليس لديك صلاحية لعرض تفاصيل هذا الموظف')).toBeInTheDocument();
  });

  it('loads and shows profile information for admin', async () => {
    renderPage();

    await waitFor(() => {
    expect(screen.getByText('سارة أحمد')).toBeInTheDocument();
    });

    expect(screen.getByText('الموارد البشرية')).toBeInTheDocument();
    expect(screen.getByText('حالة اليوم')).toBeInTheDocument();
    expect(screen.getByText('دوام مكتمل')).toBeInTheDocument();
  });

  it('opens requests tab from request URL param', async () => {
    mockUseSearchParams.mockReturnValue([new URLSearchParams('request=req-1')]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('الطلبات')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('إجازة')).toBeInTheDocument();
    });
  });

  it('navigates to attendance filtered view from overview stat card', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('دوام مكتمل')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('دوام مكتمل'));

    expect(await screen.findByText('جدول العمل')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'أكمل الدوام' })).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { AttendancePage } from './AttendancePage';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseDevTime = vi.hoisted(() => vi.fn());
const mockGetAttendanceSessions = vi.hoisted(() => vi.fn());
const mockGetAttendanceMonthly = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../contexts/DevTimeContext', () => ({
  useDevTime: () => mockUseDevTime(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/services/attendance.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/attendance.service')>();
  return {
    ...actual,
    getAttendanceSessions: (...args: unknown[]) => mockGetAttendanceSessions(...args),
    getAttendanceMonthly: (...args: unknown[]) => mockGetAttendanceMonthly(...args),
  };
});

vi.mock('../../components/attendance/TodayPunchLog', () => ({
  TodayPunchLog: ({ items }: { items: Array<{ kind: string }> }) => (
    <div data-testid="today-punch-log">items:{items.map((i) => i.kind).join(',')}</div>
  ),
}));

vi.mock('../../components/attendance/MonthCalendarHeatmap', () => ({
  MonthCalendarHeatmap: () => <div data-testid="month-calendar" />,
}));

vi.mock('../../components/attendance/DayDetailsSheet', () => ({
  DayDetailsSheet: () => null,
}));

describe('AttendancePage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ currentUser: { uid: 'u1' } });
    mockUseDevTime.mockReturnValue({ override: null });
    mockGetAttendanceSessions.mockResolvedValue([
      {
        id: 's1',
        org_id: 'o1',
        user_id: 'u1',
        date: '2026-03-01',
        check_in_time: '08:30',
        check_out_time: '16:30',
        status: 'present',
        is_overtime: false,
        is_auto_punch_out: false,
        is_early_departure: false,
        needs_review: false,
        duration_minutes: 480,
        last_action_at: '',
        is_dev: false,
        created_at: '',
        updated_at: '',
      },
    ]);
    mockGetAttendanceMonthly.mockResolvedValue([
      { date: '2026-03-01', status: 'present', totalMinutesWorked: 480 },
      { date: '2026-03-03', status: 'absent', totalMinutesWorked: 0 },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders calendar and list container', async () => {
    render(
      <MemoryRouter initialEntries={['/attendance']}>
        <AttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('month-calendar')).toBeInTheDocument());
    expect(screen.getByTestId('today-punch-log')).toBeInTheDocument();
  });

  it('shows absent synthetic rows when filtering by absent from URL', async () => {
    render(
      <MemoryRouter initialEntries={['/attendance?month=2026-03&status=absent']}>
        <AttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/items:absent_day/)).toBeInTheDocument();
    });
  });
});

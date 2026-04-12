import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import { AttendancePage } from './AttendancePage';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockGetAttendanceMonthly = vi.hoisted(() => vi.fn());
const mockGetAttendanceHistoryMonth = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
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
    getAttendanceMonthly: (...args: unknown[]) => mockGetAttendanceMonthly(...args),
    getAttendanceHistoryMonth: (...args: unknown[]) => mockGetAttendanceHistoryMonth(...args),
  };
});

vi.mock('../../components/attendance/AttendanceHistoryList', () => ({
  AttendanceHistoryList: ({ days }: { days: Array<{ date: string; primaryState: string }> }) => (
    <div data-testid="attendance-history-list">
      {days.map((day) => `${day.date}:${day.primaryState}`).join(',')}
    </div>
  ),
}));

vi.mock('../../components/attendance/MonthCalendarHeatmap', () => ({
  MonthCalendarHeatmap: () => <div data-testid="month-calendar" />,
}));

describe('AttendancePage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ currentUser: { uid: 'u1' } });
    mockGetAttendanceMonthly.mockResolvedValue([
      { date: '2026-03-01', status: 'present', totalMinutesWorked: 480 },
      { date: '2026-03-03', status: 'absent', totalMinutesWorked: 0 },
    ]);
    mockGetAttendanceHistoryMonth.mockResolvedValue([
      {
        date: '2026-03-01',
        primaryState: 'fulfilled_shift',
        firstCheckIn: '08:30',
        lastCheckOut: '16:30',
        totalRegularMinutes: 480,
        totalOvertimeMinutes: 0,
        totalWorkedMinutes: 480,
        sessionCount: 1,
        hasOvertime: false,
        hasAutoPunchOut: false,
        needsReview: false,
        sessions: [],
      },
      {
        date: '2026-03-03',
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
    expect(screen.getByTestId('attendance-history-list')).toBeInTheDocument();
  });

  it('shows absent synthetic rows when filtering by absent from URL', async () => {
    render(
      <MemoryRouter initialEntries={['/attendance?month=2026-03&status=absent']}>
        <AttendancePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/2026-03-03:absent/)).toBeInTheDocument();
    });
  });
});

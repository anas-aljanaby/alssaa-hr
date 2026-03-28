import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AttendancePage } from './AttendancePage';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseApp = vi.hoisted(() => vi.fn());
const mockUseDevTime = vi.hoisted(() => vi.fn());
const mockGetAttendanceToday = vi.hoisted(() => vi.fn());
const mockGetAttendanceMonthly = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

vi.mock('../../contexts/DevTimeContext', () => ({
  useDevTime: () => mockUseDevTime(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/services/attendance.service', () => ({
  getAttendanceToday: (...args: unknown[]) => mockGetAttendanceToday(...args),
  getAttendanceMonthly: (...args: unknown[]) => mockGetAttendanceMonthly(...args),
}));

vi.mock('../../components/attendance/TodayStatusCard', () => ({
  TodayStatusCard: (props: any) => (
    <div data-testid="today-status-card">
      <div data-testid="today-state">
        {props.today?.log?.check_in_time && !props.today?.log?.check_out_time
          ? 'checked-in'
          : props.today?.log?.check_out_time
            ? 'completed'
            : 'idle'}
      </div>
      <button onClick={props.onCheckIn}>
        {props.actionLoading ? 'جاري التسجيل...' : 'تسجيل الحضور'}
      </button>
    </div>
  ),
}));

vi.mock('../../components/attendance/TodayPunchLog', () => ({
  TodayPunchLog: () => <div data-testid="today-punch-log" />,
}));

vi.mock('../../components/attendance/MonthCalendarHeatmap', () => ({
  MonthCalendarHeatmap: () => <div data-testid="month-calendar" />,
}));

vi.mock('../../components/attendance/DayDetailsSheet', () => ({
  DayDetailsSheet: () => null,
}));

const user = { uid: 'u1' };
const openLog = {
  id: 'log-open',
  org_id: 'o1',
  user_id: 'u1',
  date: '2025-06-10',
  check_in_time: '13:17',
  check_out_time: null,
  check_in_lat: null,
  check_in_lng: null,
  check_out_lat: null,
  check_out_lng: null,
  status: 'late' as const,
  is_dev: false,
  auto_punch_out: false,
};

describe('AttendancePage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ currentUser: user });
    mockUseDevTime.mockReturnValue({ override: null });
    mockGetAttendanceMonthly.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows check-in loading then checked-in state after check-in resolves', async () => {
    let releaseCheckIn: (value: { log: typeof openLog }) => void;
    const checkIn = vi.fn(
      () =>
        new Promise<{ log: typeof openLog }>((resolve) => {
          releaseCheckIn = resolve;
        })
    );
    const checkOut = vi.fn();
    mockUseApp.mockReturnValue({ checkIn, checkOut });
    mockGetAttendanceToday
      .mockResolvedValueOnce({ log: null, punches: [], shift: null })
      .mockResolvedValueOnce({ log: openLog, punches: [], shift: null });

    render(<AttendancePage />);

    await waitFor(() => expect(screen.getByText('تسجيل الحضور')).toBeInTheDocument());
    fireEvent.click(screen.getByText('تسجيل الحضور'));

    await waitFor(() => expect(screen.getByText('جاري التسجيل...')).toBeInTheDocument());

    releaseCheckIn!({ log: openLog });

    await waitFor(() => expect(screen.queryByText('جاري التسجيل...')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('today-state')).toHaveTextContent('checked-in'));
    expect(checkIn).toHaveBeenCalledWith('u1');
  });

  it('keeps checked-in state when refreshed today record has an open session', async () => {
    const checkIn = vi.fn().mockResolvedValue({ log: openLog });
    const checkOut = vi.fn();
    mockUseApp.mockReturnValue({ checkIn, checkOut });
    mockGetAttendanceToday
      .mockResolvedValueOnce({ log: null, punches: [], shift: null })
      .mockResolvedValueOnce({ log: openLog, punches: [], shift: null });

    render(<AttendancePage />);

    await waitFor(() => expect(screen.getByText('تسجيل الحضور')).toBeInTheDocument());
    fireEvent.click(screen.getByText('تسجيل الحضور'));

    await waitFor(() => expect(checkIn).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(screen.getByTestId('today-state')).toHaveTextContent('checked-in'));
  });
});

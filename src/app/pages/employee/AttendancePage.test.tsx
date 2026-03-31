import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AttendancePage } from './AttendancePage';

const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseDevTime = vi.hoisted(() => vi.fn());
const mockGetAttendanceToday = vi.hoisted(() => vi.fn());
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
    getAttendanceToday: (...args: unknown[]) => mockGetAttendanceToday(...args),
    getAttendanceMonthly: (...args: unknown[]) => mockGetAttendanceMonthly(...args),
  };
});

vi.mock('../../components/attendance/TodayPunchLog', () => ({
  TodayPunchLog: () => <div data-testid="today-punch-log" />,
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
    mockGetAttendanceToday.mockResolvedValue({ log: null, punches: [], shift: null });
    mockGetAttendanceMonthly.mockResolvedValue([
      { date: '2026-03-01', status: 'present', totalMinutesWorked: 480 },
      { date: '2026-03-02', status: 'late', totalMinutesWorked: 430 },
      { date: '2026-03-03', status: 'absent', totalMinutesWorked: 0 },
      { date: '2026-03-04', status: 'on_leave', totalMinutesWorked: 0 },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders monthly stats, then calendar, then daily log, without punch buttons', async () => {
    render(<AttendancePage />);

    await waitFor(() => expect(screen.getByText('إحصائيات الشهر')).toBeInTheDocument());

    expect(screen.getByText('أيام الحضور')).toBeInTheDocument();
    expect(screen.getByText('أيام التأخر')).toBeInTheDocument();
    expect(screen.getByText('أيام الغياب')).toBeInTheDocument();
    expect(screen.getByText('أيام الإجازة')).toBeInTheDocument();

    const statsTitle = screen.getByText('إحصائيات الشهر');
    const calendar = screen.getByTestId('month-calendar');
    const dailyLog = screen.getByTestId('today-punch-log');

    expect(statsTitle.compareDocumentPosition(calendar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(calendar.compareDocumentPosition(dailyLog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.queryByRole('button', { name: 'تسجيل الحضور' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تسجيل الانصراف' })).not.toBeInTheDocument();
  });
});

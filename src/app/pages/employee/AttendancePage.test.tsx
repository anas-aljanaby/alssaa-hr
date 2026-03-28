import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AttendancePage } from './AttendancePage';
import { todayRecord24_1 } from '@/lib/services/__fixtures__/todayMultiSession';

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

vi.mock('@/lib/services/attendance.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/attendance.service')>();
  return {
    ...actual,
    getAttendanceToday: (...args: unknown[]) => mockGetAttendanceToday(...args),
    getAttendanceMonthly: (...args: unknown[]) => mockGetAttendanceMonthly(...args),
  };
});

vi.mock('../../components/attendance/TodayStatusCard', async () => {
  const { isCheckedInToday } = await import('@/lib/services/attendance.service');
  return {
    /** Mirrors production: session-aware checked-in (same as TodayStatusCard / TodayPunchLog). */
    TodayStatusCard: (props: any) => {
      const log = props.today?.log;
      const isCheckedIn = isCheckedInToday(props.today);
      const stateLabel = isCheckedIn ? 'checked-in' : log?.check_out_time ? 'completed' : 'idle';
      return (
        <div data-testid="today-status-card">
          <div data-testid="today-state">{stateLabel}</div>
          {props.actionLoading ? (
            <button type="button" disabled>
              جاري التسجيل...
            </button>
          ) : isCheckedIn ? (
            <button type="button" onClick={() => props.onCheckOut()}>
              تسجيل الانصراف
            </button>
          ) : (
            <button type="button" onClick={props.onCheckIn}>
              تسجيل الحضور
            </button>
          )}
        </div>
      );
    },
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

const user = { uid: 'u1' };

const defaultShift = {
  workStartTime: '09:00',
  workEndTime: '18:00',
  gracePeriodMinutes: 15,
  bufferMinutesAfterShift: 30,
  weeklyOffDays: [5, 6] as number[],
  minimumRequiredMinutes: null as number | null,
};

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

const sessionsThreeWithOpenThird = todayRecord24_1().sessions!;

/** Third session open; aggregate `log` matches API row for current session (spec). */
const todayWithOpenThirdSession = {
  log: {
    id: 's3',
    org_id: 'o1',
    user_id: 'u1',
    date: '2025-06-10',
    check_in_time: '14:30',
    check_out_time: null,
    check_in_lat: null,
    check_in_lng: null,
    check_out_lat: null,
    check_out_lng: null,
    status: 'present' as const,
    is_dev: false,
    auto_punch_out: false,
  },
  punches: [
    { id: 'a', timestamp: '08:30', type: 'clock_in' as const, isOvertime: false },
    { id: 'b', timestamp: '12:00', type: 'clock_out' as const, isOvertime: false },
    { id: 'c', timestamp: '13:00', type: 'clock_in' as const, isOvertime: false },
    { id: 'd', timestamp: '14:00', type: 'clock_out' as const, isOvertime: false },
    { id: 'e', timestamp: '14:30', type: 'clock_in' as const, isOvertime: false },
  ],
  shift: defaultShift,
  sessions: sessionsThreeWithOpenThird,
};

/** Same punches + sessions but pseudo `log` carries last closed checkout (refresh regression shape). */
const todayWithBuggyAggregateLog = {
  ...todayWithOpenThirdSession,
  log: {
    ...todayWithOpenThirdSession.log,
    id: 'pseudo',
    check_in_time: '08:30',
    check_out_time: '14:00',
  },
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

  /**
   * Doc §24.4: After two breaks + third check-in, a refresh that returns `getAttendanceToday`-style
   * pseudo `log` (non-null `check_out_time` from last closed session) must not flip UX to punch-in.
   * Fails while `isCheckedIn` ignores an open latest session / full punch list.
   */
  it('24.4 visibility refresh keeps checked-in when third session is open and punches are complete', async () => {
    const checkIn = vi.fn();
    const checkOut = vi.fn();
    mockUseApp.mockReturnValue({ checkIn, checkOut });
    mockGetAttendanceToday
      .mockResolvedValueOnce(todayWithOpenThirdSession)
      .mockResolvedValueOnce(todayWithBuggyAggregateLog);

    render(<AttendancePage />);

    await waitFor(() => expect(screen.getByTestId('today-state')).toHaveTextContent('checked-in'));
    expect(screen.getByRole('button', { name: 'تسجيل الانصراف' })).toBeInTheDocument();

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        writable: true,
        value: 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(mockGetAttendanceToday).toHaveBeenCalledTimes(2));

    expect(screen.getByTestId('today-state')).toHaveTextContent('checked-in');
    expect(screen.getByRole('button', { name: 'تسجيل الانصراف' })).toBeInTheDocument();
  });

  /**
   * Doc §24.5: Through two breaks + third check-in, when API returns consistent `log` rows,
   * the primary action must alternate checkout / check-in correctly (happy path).
   */
  it('24.5 multi-step punch cycle: CTA matches each session boundary', async () => {
    const baseLog = {
      org_id: 'o1',
      user_id: 'u1',
      date: '2025-06-10',
      check_in_lat: null,
      check_in_lng: null,
      check_out_lat: null,
      check_out_lng: null,
      status: 'present' as const,
      is_dev: false,
      auto_punch_out: false,
    };
    const open1 = { ...baseLog, id: 's1', check_in_time: '08:30', check_out_time: null };
    const closed1 = { ...baseLog, id: 's1', check_in_time: '08:30', check_out_time: '12:00' };
    const open2 = { ...baseLog, id: 's2', check_in_time: '13:00', check_out_time: null };
    const closed2 = { ...baseLog, id: 's2', check_in_time: '13:00', check_out_time: '14:00' };
    const open3 = { ...baseLog, id: 's3', check_in_time: '14:30', check_out_time: null };

    const p1 = [{ id: 'a', timestamp: '08:30', type: 'clock_in' as const, isOvertime: false }];
    const p2 = [
      ...p1,
      { id: 'b', timestamp: '12:00', type: 'clock_out' as const, isOvertime: false },
    ];
    const p3 = [
      ...p2,
      { id: 'c', timestamp: '13:00', type: 'clock_in' as const, isOvertime: false },
    ];
    const p4 = [
      ...p3,
      { id: 'd', timestamp: '14:00', type: 'clock_out' as const, isOvertime: false },
    ];
    const p5 = [
      ...p4,
      { id: 'e', timestamp: '14:30', type: 'clock_in' as const, isOvertime: false },
    ];

    const queue = [
      { log: null, punches: [], shift: defaultShift },
      { log: open1, punches: p1, shift: defaultShift },
      { log: closed1, punches: p2, shift: defaultShift },
      { log: open2, punches: p3, shift: defaultShift },
      { log: closed2, punches: p4, shift: defaultShift },
      { log: open3, punches: p5, shift: defaultShift },
    ];

    let gi = 0;
    mockGetAttendanceToday.mockImplementation(() => Promise.resolve(queue[gi++]));

    const checkInLogs = [open1, open2, open3];
    const checkOutLogs = [closed1, closed2];
    const checkIn = vi.fn(async () => ({ log: checkInLogs.shift() }));
    const checkOut = vi.fn(async () => checkOutLogs.shift());
    mockUseApp.mockReturnValue({ checkIn, checkOut });

    render(<AttendancePage />);

    await waitFor(() => expect(screen.getByTestId('today-state')).toHaveTextContent('idle'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'تسجيل الحضور' }));
    });
    await waitFor(() => expect(screen.getByTestId('today-state')).toHaveTextContent('checked-in'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'تسجيل الانصراف' }));
    });
    await waitFor(() => expect(screen.getByTestId('today-state')).toHaveTextContent('completed'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'تسجيل الحضور' }));
    });
    await waitFor(() => expect(screen.getByTestId('today-state')).toHaveTextContent('checked-in'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'تسجيل الانصراف' }));
    });
    await waitFor(() => expect(screen.getByTestId('today-state')).toHaveTextContent('completed'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'تسجيل الحضور' }));
    });
    await waitFor(() => expect(screen.getByTestId('today-state')).toHaveTextContent('checked-in'));
    expect(screen.getByRole('button', { name: 'تسجيل الانصراف' })).toBeInTheDocument();
    expect(checkIn).toHaveBeenCalledTimes(3);
    expect(checkOut).toHaveBeenCalledTimes(2);
  });
});

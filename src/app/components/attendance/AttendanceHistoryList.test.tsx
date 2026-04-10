import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttendanceHistoryList } from './AttendanceHistoryList';

const multiSessionDay = {
  date: '2026-04-01',
  primaryState: 'late' as const,
  firstCheckIn: '09:10',
  lastCheckOut: '18:00',
  totalRegularMinutes: 420,
  totalOvertimeMinutes: 0,
  totalWorkedMinutes: 420,
  sessionCount: 3,
  hasOvertime: false,
  hasAutoPunchOut: false,
  needsReview: false,
  sessions: [
    {
      id: 'session-1',
      checkInTime: '09:10',
      checkOutTime: '11:00',
      durationMinutes: 110,
      classification: 'late' as const,
      isEarlyDeparture: false,
      isAutoPunchOut: false,
      needsReview: false,
    },
    {
      id: 'session-2',
      checkInTime: '11:30',
      checkOutTime: '14:00',
      durationMinutes: 150,
      classification: 'regular' as const,
      isEarlyDeparture: false,
      isAutoPunchOut: false,
      needsReview: false,
    },
    {
      id: 'session-3',
      checkInTime: '15:00',
      checkOutTime: '18:00',
      durationMinutes: 180,
      classification: 'regular' as const,
      isEarlyDeparture: false,
      isAutoPunchOut: false,
      needsReview: false,
    },
  ],
};

describe('AttendanceHistoryList', () => {
  it('renders one day card that expands into multiple session cards', () => {
    render(<AttendanceHistoryList days={[multiSessionDay]} emptyMessage="فارغ" />);

    expect(screen.getByTestId('day-card-2026-04-01')).toBeInTheDocument();
    expect(screen.queryByTestId('session-card-session-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('day-card-2026-04-01').querySelector('button')!);

    expect(screen.getByTestId('session-card-session-1')).toBeInTheDocument();
    expect(screen.getByTestId('session-card-session-2')).toBeInTheDocument();
    expect(screen.getByTestId('session-card-session-3')).toBeInTheDocument();
  });

  it('keeps absent as the day status when the only session is overtime', () => {
    render(
      <AttendanceHistoryList
        days={[
          {
            date: '2026-04-02',
            primaryState: 'absent',
            firstCheckIn: '19:00',
            lastCheckOut: '21:00',
            totalRegularMinutes: 0,
            totalOvertimeMinutes: 120,
            totalWorkedMinutes: 120,
            sessionCount: 1,
            hasOvertime: true,
            hasAutoPunchOut: false,
            needsReview: false,
            sessions: [
              {
                id: 'ot-1',
                checkInTime: '19:00',
                checkOutTime: '21:00',
                durationMinutes: 120,
                classification: 'overtime',
                isEarlyDeparture: false,
                isAutoPunchOut: false,
                needsReview: false,
              },
            ],
          },
        ]}
        emptyMessage="فارغ"
      />
    );

    expect(screen.getByText('غائب')).toBeInTheDocument();
    expect(screen.getByText('عمل إضافي')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('day-card-2026-04-02').querySelector('button')!);

    expect(screen.getAllByText('إضافي').length).toBeGreaterThan(0);
    expect(screen.getAllByText('19:00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('21:00').length).toBeGreaterThan(0);
  });

  it('shows early checkout on the session without rewriting a fulfilled day', () => {
    render(
      <AttendanceHistoryList
        days={[
          {
            date: '2026-04-03',
            primaryState: 'fulfilled_shift',
            firstCheckIn: '08:00',
            lastCheckOut: '17:30',
            totalRegularMinutes: 480,
            totalOvertimeMinutes: 0,
            totalWorkedMinutes: 480,
            sessionCount: 2,
            hasOvertime: false,
            hasAutoPunchOut: false,
            needsReview: false,
            sessions: [
              {
                id: 'regular-1',
                checkInTime: '08:00',
                checkOutTime: '12:00',
                durationMinutes: 240,
                classification: 'regular',
                isEarlyDeparture: true,
                isAutoPunchOut: false,
                needsReview: false,
              },
              {
                id: 'regular-2',
                checkInTime: '13:30',
                checkOutTime: '17:30',
                durationMinutes: 240,
                classification: 'regular',
                isEarlyDeparture: false,
                isAutoPunchOut: false,
                needsReview: false,
              },
            ],
          },
        ]}
        emptyMessage="فارغ"
      />
    );

    expect(screen.getByText('أكمل الدوام')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('day-card-2026-04-03').querySelector('button')!);

    expect(screen.getByText('خروج مبكر')).toBeInTheDocument();
    expect(screen.getByTestId('session-card-regular-1')).toBeInTheDocument();
  });
});

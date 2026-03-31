import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TodayPunchLog } from './TodayPunchLog';
import type { AttendanceSession } from '@/lib/services/attendance.service';

function sessionsThreeSegments(): AttendanceSession[] {
  return [
    {
      id: 's1',
      org_id: 'o1',
      user_id: 'u1',
      date: '2026-03-05',
      check_in_time: '08:30',
      check_out_time: '12:00',
      status: 'present',
      is_overtime: false,
      is_auto_punch_out: false,
      is_early_departure: false,
      needs_review: false,
      duration_minutes: 210,
      last_action_at: '',
      is_dev: false,
      created_at: '',
      updated_at: '',
    },
    {
      id: 's2',
      org_id: 'o1',
      user_id: 'u1',
      date: '2026-03-06',
      check_in_time: '09:12',
      check_out_time: null,
      status: 'late',
      is_overtime: false,
      is_auto_punch_out: false,
      is_early_departure: false,
      needs_review: false,
      duration_minutes: 0,
      last_action_at: '',
      is_dev: false,
      created_at: '',
      updated_at: '',
    },
  ];
}

describe('TodayPunchLog', () => {
  it('renders session cards with check-in and check-out times', () => {
    render(<TodayPunchLog sessions={sessionsThreeSegments()} selectedDate={null} />);

    expect(screen.getByText('سجل الجلسات')).toBeInTheDocument();
    expect(screen.getByText('08:30')).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('09:12')).toBeInTheDocument();
    expect(screen.getByText('مباشر')).toBeInTheDocument();
  });

  it('renders filtered-day empty state message', () => {
    render(<TodayPunchLog sessions={[]} selectedDate="2026-03-06" />);
    expect(screen.getByText('لا توجد جلسات في هذا اليوم')).toBeInTheDocument();
  });
});

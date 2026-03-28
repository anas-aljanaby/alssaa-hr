import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TodayPunchLog } from './TodayPunchLog';
import type { PunchEntry } from '@/lib/services/attendance.service';

function punchesThreeClosedSegments(): PunchEntry[] {
  return [
    { id: 's1-in', timestamp: '08:30', type: 'clock_in', isOvertime: false },
    { id: 's1-out', timestamp: '12:00', type: 'clock_out', isOvertime: false },
    { id: 's2-in', timestamp: '13:00', type: 'clock_in', isOvertime: false },
    { id: 's2-out', timestamp: '14:00', type: 'clock_out', isOvertime: false },
    { id: 's3-in', timestamp: '14:30', type: 'clock_in', isOvertime: false },
    { id: 's3-out', timestamp: '18:00', type: 'clock_out', isOvertime: false },
  ];
}

describe('TodayPunchLog', () => {
  /**
   * Doc §24.2: With two breaks, the timeline must list every check-in and check-out in order.
   */
  it('24.2 renders six punch rows alternating حضور / انصراف for three closed sessions', () => {
    render(<TodayPunchLog punches={punchesThreeClosedSegments()} isCheckedIn={false} />);

    expect(screen.getByText('سجل اليوم')).toBeInTheDocument();

    const ins = screen.getAllByText('← تسجيل حضور');
    const outs = screen.getAllByText('→ تسجيل انصراف');
    expect(ins).toHaveLength(3);
    expect(outs).toHaveLength(3);

    const times = screen.getAllByText(/\d{2}:\d{2}/);
    const timeTexts = times.map((el) => el.textContent);
    expect(timeTexts.slice(0, 6)).toEqual(['08:30', '12:00', '13:00', '14:00', '14:30', '18:00']);
  });

  /**
   * Doc §24.3: Open third segment — last row is check-in; prior check-outs must still appear.
   */
  it('24.3 renders five punches with third segment open and isCheckedIn true', () => {
    const punches = punchesThreeClosedSegments().slice(0, 5);
    render(<TodayPunchLog punches={punches} isCheckedIn />);

    expect(screen.getAllByText('← تسجيل حضور')).toHaveLength(3);
    expect(screen.getAllByText('→ تسجيل انصراف')).toHaveLength(2);

    const root = screen.getByText('سجل اليوم').closest('div')?.parentElement;
    expect(root).toBeTruthy();
    const block = root as HTMLElement;
    const timeLabels = within(block).getAllByText(/\d{2}:\d{2}/);
    expect(timeLabels.map((el) => el.textContent)).toEqual(['08:30', '12:00', '13:00', '14:00', '14:30']);
  });
});

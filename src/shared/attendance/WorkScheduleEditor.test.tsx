import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkScheduleEditor } from './WorkScheduleEditor';
import type { WorkSchedule } from './workSchedule';

function Harness({ initialValue }: { initialValue: WorkSchedule }) {
  const [value, setValue] = useState<WorkSchedule>(initialValue);
  return <WorkScheduleEditor value={value} onChange={setValue} />;
}

describe('WorkScheduleEditor', () => {
  it('keeps apply-all disabled until a day is edited, then uses the edited day', () => {
    render(
      <Harness
        initialValue={{
          '0': { start: '08:00', end: '16:00' },
          '1': { start: '09:00', end: '17:00' },
          '2': { start: '10:00', end: '18:00' },
        }}
      />
    );

    const applyButton = screen.getByRole('button', { name: 'تطبيق هذا الوقت على جميع الايام' });
    expect(applyButton).toBeDisabled();

    fireEvent.click(screen.getByTestId('schedule-row-2'));
    expect(screen.getByTestId('schedule-row-2')).toHaveAttribute('data-selected', 'true');
    expect(applyButton).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText('الاثنين وقت النهاية'), {
      target: { value: '18:30' },
    });

    expect(screen.getByTestId('schedule-row-1')).toHaveAttribute('data-selected', 'true');
    expect(applyButton).not.toBeDisabled();

    fireEvent.click(applyButton);

    expect(screen.getByLabelText('الأحد وقت البداية')).toHaveValue('09:00');
    expect(screen.getByLabelText('الأحد وقت النهاية')).toHaveValue('18:30');
    expect(screen.getByLabelText('الثلاثاء وقت البداية')).toHaveValue('09:00');
    expect(screen.getByLabelText('الثلاثاء وقت النهاية')).toHaveValue('18:30');
  });
});

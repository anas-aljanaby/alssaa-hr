import { describe, it, expect, beforeEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

const policyRow = {
  id: 'pol-1',
  org_id: 'org-1',
  work_schedule: {
    '0': { start: '08:00', end: '16:00' },
    '1': { start: '08:00', end: '16:00' },
    '2': { start: '08:00', end: '16:00' },
    '3': { start: '08:00', end: '16:00' },
    '4': { start: '08:00', end: '16:00' },
  },
  grace_period_minutes: 10,
  auto_punch_out_buffer_minutes: 5,
  max_late_days_before_warning: 3,
  absent_cutoff_time: '12:00',
  annual_leave_per_year: 21,
  minimum_overtime_minutes: 30,
};

describe('policy.service', () => {
  beforeEach(() => {
    sb.clearQueue();
  });

  it('getPolicy returns row', async () => {
    sb.queueResult({ data: policyRow, error: null });
    const { getPolicy } = await import('./policy.service');
    const p = await getPolicy();
    expect(p?.id).toBe('pol-1');
  });

  it('getPolicy returns null when no row', async () => {
    sb.queueResult({ data: null, error: null });
    const { getPolicy } = await import('./policy.service');
    expect(await getPolicy()).toBeNull();
  });

  it('updatePolicy updates when policy exists', async () => {
    sb.queueResult({ data: policyRow, error: null });
    sb.queueResult({ data: { ...policyRow, grace_period_minutes: 20 }, error: null });
    const { updatePolicy } = await import('./policy.service');
    const updated = await updatePolicy({ grace_period_minutes: 20 });
    expect(updated.grace_period_minutes).toBe(20);
  });

  it('updatePolicy inserts when no existing policy', async () => {
    sb.queueResult({ data: null, error: null });
    sb.queueResult({ data: policyRow, error: null });
    const { updatePolicy } = await import('./policy.service');
    const created = await updatePolicy({ grace_period_minutes: 12 });
    expect(created.id).toBe('pol-1');
  });

  it('updatePolicy accepts short work schedules before saving', async () => {
    sb.queueResult({ data: null, error: null });
    sb.queueResult({
      data: {
        ...policyRow,
        work_schedule: {
          '0': { start: '13:00', end: '15:00' },
        },
      },
      error: null,
    });
    const { updatePolicy } = await import('./policy.service');
    const updated = await updatePolicy({
      work_schedule: {
        '0': { start: '13:00', end: '15:00' },
      },
    });
    expect(updated.work_schedule).toEqual({
      '0': { start: '13:00', end: '15:00' },
    });
  });
});

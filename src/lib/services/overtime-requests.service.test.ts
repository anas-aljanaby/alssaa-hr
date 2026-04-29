import { describe, it, expect, vi, beforeEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

const baseOt = {
  id: 'ot1',
  org_id: 'o1',
  user_id: 'u1',
  session_id: 's1',
  status: 'pending' as const,
  reviewed_by: null as string | null,
  note: null as string | null,
  created_at: '2025-06-11T10:00:00Z',
  updated_at: '2025-06-11T10:00:00Z',
};

const sessionRow = {
  id: 's1',
  org_id: 'o1',
  user_id: 'u1',
  date: '2025-06-11',
  check_in_time: '18:00',
  check_out_time: '19:00',
  status: 'present' as const,
  is_overtime: true,
  duration_minutes: 60,
  is_auto_punch_out: false,
  is_early_departure: false,
  needs_review: false,
  last_action_at: '2025-06-11T19:00:00Z',
  is_dev: false,
  created_at: '2025-06-11T18:00:00Z',
  updated_at: '2025-06-11T19:00:00Z',
};

const openSessionRow = {
  ...sessionRow,
  id: 's-open',
  check_out_time: null,
  duration_minutes: 0,
};

describe('overtime-requests.service', () => {
  beforeEach(() => {
    sb.clearQueue();
    sb.clearChannelInstances();
  });

  it('getOvertimeRequestsForUser returns rows with session join', async () => {
    sb.queueResult({
      data: [{ ...baseOt, attendance_sessions: sessionRow }],
      error: null,
    });
    const { getOvertimeRequestsForUser } = await import('./overtime-requests.service');
    const rows = await getOvertimeRequestsForUser('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0].attendance_sessions?.check_in_time).toBe('18:00');
  });

  it('getDepartmentOvertimeRequests returns empty when no employees', async () => {
    sb.queueResult({ data: [], error: null });
    const { getDepartmentOvertimeRequests } = await import('./overtime-requests.service');
    expect(await getDepartmentOvertimeRequests('d1')).toEqual([]);
  });

  it('getDepartmentOvertimeRequests loads for department user ids', async () => {
    sb.queueResult({ data: [{ id: 'e1' }], error: null });
    sb.queueResult({
      data: [{ ...baseOt, attendance_sessions: sessionRow }],
      error: null,
    });
    const { getDepartmentOvertimeRequests } = await import('./overtime-requests.service');
    const rows = await getDepartmentOvertimeRequests('d1');
    expect(rows).toHaveLength(1);
  });

  it('getDepartmentOvertimeRequests hides open overtime and excludes the current manager', async () => {
    sb.queueResult({ data: [{ id: 'e1' }, { id: 'mgr1' }], error: null });
    sb.queueResult({
      data: [
        { ...baseOt, id: 'ot-closed', user_id: 'e1', attendance_sessions: sessionRow },
        { ...baseOt, id: 'ot-open', user_id: 'e1', attendance_sessions: openSessionRow },
        { ...baseOt, id: 'ot-manager', user_id: 'mgr1', attendance_sessions: sessionRow },
      ],
      error: null,
    });
    const { getDepartmentOvertimeRequests } = await import('./overtime-requests.service');
    const rows = await getDepartmentOvertimeRequests('d1', { excludeUserId: 'mgr1' });
    expect(rows.map((row) => row.id)).toEqual(['ot-closed']);
  });

  it('getAllOvertimeRequests hides open overtime from approver queues', async () => {
    sb.queueResult({
      data: [
        { ...baseOt, id: 'ot-closed', attendance_sessions: sessionRow },
        { ...baseOt, id: 'ot-open', attendance_sessions: openSessionRow },
      ],
      error: null,
    });
    const { getAllOvertimeRequests } = await import('./overtime-requests.service');
    const rows = await getAllOvertimeRequests();
    expect(rows.map((row) => row.id)).toEqual(['ot-closed']);
  });

  it('updateOvertimeRequestStatus updates pending row', async () => {
    sb.queueResult({
      data: [{ ...baseOt, status: 'approved' as const, reviewed_by: 'mgr1', note: 'ok' }],
      error: null,
    });
    const { updateOvertimeRequestStatus } = await import('./overtime-requests.service');
    const row = await updateOvertimeRequestStatus('ot1', 'approved', 'mgr1', 'ok');
    expect(row.status).toBe('approved');
  });

  it('countPendingOvertimeRequests with department', async () => {
    sb.queueResult({ data: [{ id: 'e1' }], error: null });
    sb.queueResult({
      data: [
        { ...baseOt, id: 'ot-closed', attendance_sessions: sessionRow },
        { ...baseOt, id: 'ot-open', attendance_sessions: openSessionRow },
      ],
      error: null,
    });
    const { countPendingOvertimeRequests } = await import('./overtime-requests.service');
    expect(await countPendingOvertimeRequests('d1')).toBe(1);
  });
});

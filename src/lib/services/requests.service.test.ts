import { describe, it, expect, vi, beforeEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

const baseReq = {
  id: 'r1',
  org_id: 'o1',
  user_id: 'u1',
  type: 'annual_leave' as const,
  from_date_time: '2025-01-01T08:00:00',
  to_date_time: '2025-01-02T16:00:00',
  note: 'n',
  status: 'pending' as const,
  approver_id: null as string | null,
  decision_note: null as string | null,
  attachment_url: null as string | null,
  created_at: '2025-01-01T00:00:00Z',
  decided_at: null as string | null,
};

describe('requests.service', () => {
  beforeEach(() => {
    sb.clearQueue();
    sb.clearChannelInstances();
  });

  it('submitRequest inserts and returns row', async () => {
    sb.queueResult({ data: baseReq, error: null });
    const { submitRequest } = await import('./requests.service');
    const row = await submitRequest({
      user_id: 'u1',
      org_id: 'o1',
      type: 'annual_leave',
      from_date_time: '2025-01-01T08:00:00',
      to_date_time: '2025-01-02T16:00:00',
      note: 'n',
    });
    expect(row.id).toBe('r1');
  });

  it('getUserRequests without approver skips profile fetch', async () => {
    sb.queueResult({ data: [{ ...baseReq, approver_id: null }], error: null });
    const { getUserRequests } = await import('./requests.service');
    const rows = await getUserRequests('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0].approver_profile).toBeNull();
  });

  it('getUserRequests loads approver profiles', async () => {
    const withApprover = { ...baseReq, approver_id: 'mgr1' };
    sb.queueResult({ data: [withApprover], error: null });
    sb.queueResult({
      data: [{ id: 'mgr1', name_ar: 'مدير', employee_id: 'M1' }],
      error: null,
    });
    const { getUserRequests } = await import('./requests.service');
    const rows = await getUserRequests('u1');
    expect(rows[0].approver_profile?.name_ar).toBe('مدير');
  });

  it('getUserRequestsByStatus filters status', async () => {
    sb.queueResult({ data: [], error: null });
    const { getUserRequestsByStatus } = await import('./requests.service');
    await getUserRequestsByStatus('u1', 'pending');
  });

  it('getDepartmentRequests returns empty when no employees', async () => {
    sb.queueResult({ data: [], error: null });
    const { getDepartmentRequests } = await import('./requests.service');
    expect(await getDepartmentRequests('d1')).toEqual([]);
  });

  it('getDepartmentRequests loads requests for department users', async () => {
    sb.queueResult({ data: [{ id: 'e1' }], error: null });
    sb.queueResult({ data: [baseReq], error: null });
    const { getDepartmentRequests } = await import('./requests.service');
    const rows = await getDepartmentRequests('d1');
    expect(rows).toHaveLength(1);
  });

  it('updateRequestStatus updates and inserts approval log', async () => {
    const updated = {
      ...baseReq,
      status: 'approved' as const,
      approver_id: 'mgr1',
      decision_note: 'ok',
    };
    sb.queueResult({ data: updated, error: null });
    sb.queueResult({ data: null, error: null });
    sb.queueResult({ data: [], error: null });
    const { updateRequestStatus } = await import('./requests.service');
    const row = await updateRequestStatus('r1', 'approved', 'mgr1', 'ok');
    expect(row.status).toBe('approved');
  });

  it('getRequestById returns null when missing', async () => {
    sb.queueResult({ data: null, error: null });
    const { getRequestById } = await import('./requests.service');
    expect(await getRequestById('x')).toBeNull();
  });

  it('countPendingRequests without department', async () => {
    sb.queueResult({ data: null, error: null, count: 4 });
    const { countPendingRequests } = await import('./requests.service');
    expect(await countPendingRequests()).toBe(4);
  });

  it('countPendingRequests with department', async () => {
    sb.queueResult({ data: [{ id: 'e1' }], error: null });
    sb.queueResult({ data: null, error: null, count: 2 });
    const { countPendingRequests } = await import('./requests.service');
    expect(await countPendingRequests('d1')).toBe(2);
  });

  it('subscribeToUserRequests cleans up with subscribe return', async () => {
    const { subscribeToUserRequests } = await import('./requests.service');
    const unsub = subscribeToUserRequests('u1', vi.fn());
    expect(sb.channelInstances.at(-1)?.name).toBe('leave_requests:user:u1');
    unsub();
    expect(sb.removeChannel).toHaveBeenCalledWith('SUBSCRIBED');
  });

  it('subscribeToAllRequests registers channel', async () => {
    const { subscribeToAllRequests } = await import('./requests.service');
    subscribeToAllRequests(vi.fn());
    expect(sb.channelInstances.at(-1)?.name).toBe('leave_requests:all');
  });
});

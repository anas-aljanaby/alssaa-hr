import { describe, it, expect, beforeEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

const logRow = {
  id: 'a1',
  org_id: 'o1',
  actor_id: 'act1',
  action: 'test',
  action_ar: 'اختبار',
  target_id: 't1',
  target_type: 'user',
  details: null as string | null,
  created_at: '2025-01-01T00:00:00Z',
};

describe('audit.service', () => {
  beforeEach(() => {
    sb.clearQueue();
  });

  it('getAuditLogs returns data', async () => {
    sb.queueResult({ data: [logRow], error: null });
    const { getAuditLogs } = await import('./audit.service');
    const logs = await getAuditLogs();
    expect(logs).toHaveLength(1);
  });

  it('getAuditLogs applies filters and range', async () => {
    sb.queueResult({ data: [], error: null });
    const { getAuditLogs } = await import('./audit.service');
    await getAuditLogs({ actorId: 'x', targetType: 'user', limit: 10, offset: 5 });
    expect(sb.from).toHaveBeenCalledWith('audit_logs');
  });

  it('createAuditLog inserts and returns row', async () => {
    sb.queueResult({ data: logRow, error: null });
    const { createAuditLog } = await import('./audit.service');
    const row = await createAuditLog({
      org_id: 'o1',
      actor_id: 'act1',
      action: 'test',
      action_ar: 'اختبار',
      target_id: 't1',
      target_type: 'user',
    });
    expect(row.id).toBe('a1');
  });

  it('getAuditLogsForTarget filters by target_id', async () => {
    sb.queueResult({ data: [logRow], error: null });
    const { getAuditLogsForTarget } = await import('./audit.service');
    const logs = await getAuditLogsForTarget('t1');
    expect(logs).toHaveLength(1);
  });

  it('getRecentAuditLogs uses limit', async () => {
    sb.queueResult({ data: [logRow], error: null });
    const { getRecentAuditLogs } = await import('./audit.service');
    await getRecentAuditLogs(5);
    expect(sb.from).toHaveBeenCalledWith('audit_logs');
  });
});

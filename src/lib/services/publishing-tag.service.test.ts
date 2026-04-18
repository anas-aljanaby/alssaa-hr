import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

const mockCreateAuditLog = vi.hoisted(() => vi.fn());

vi.mock('../supabase');
vi.mock('./audit.service', () => ({
  createAuditLog: mockCreateAuditLog,
}));

const baseRow = {
  id: 'tag-1',
  org_id: 'org-1',
  user_id: 'user-1',
  claimed_at: '2026-04-17T08:00:00.000Z',
  released_at: null as string | null,
  force_released_by: null as string | null,
  force_released_at: null as string | null,
};

describe('publishing-tag.service', () => {
  beforeEach(() => {
    sb.clearQueue();
    sb.clearChannelInstances();
    mockCreateAuditLog.mockReset();
  });

  it('getPublishingTagHolder attaches the holder profile and claim status', async () => {
    sb.queueResult({ data: baseRow, error: null });
    sb.queueResult({
      data: [
        {
          id: 'user-1',
          name_ar: 'سارة',
          employee_id: 'EMP-001',
          avatar_url: null,
        },
      ],
      error: null,
    });

    const { getPublishingTagHolder } = await import('./publishing-tag.service');
    const holder = await getPublishingTagHolder('org-1');

    expect(holder?.claim_status).toBe('claimed');
    expect(holder?.holder_profile?.name_ar).toBe('سارة');
  });

  it('claimPublishingTag inserts a new claim when no row exists yet', async () => {
    sb.queueResult({ data: null, error: null });
    sb.queueResult({ data: null, error: null });

    const { claimPublishingTag } = await import('./publishing-tag.service');
    await expect(claimPublishingTag('org-1', 'user-1')).resolves.toBeUndefined();
  });

  it('claimPublishingTag rejects when another user wins the race on an existing unclaimed row', async () => {
    sb.queueResult({ data: { ...baseRow, user_id: null }, error: null });
    sb.queueResult({ data: null, error: null });
    sb.queueResult({ data: { ...baseRow, user_id: 'user-2' }, error: null });

    const { claimPublishingTag } = await import('./publishing-tag.service');
    await expect(claimPublishingTag('org-1', 'user-1')).rejects.toThrow(
      'وسم الناشر محجوز حالياً'
    );
  });

  it('releasePublishingTag rejects when another user holds the tag', async () => {
    sb.queueResult({ data: { ...baseRow, user_id: 'user-2' }, error: null });

    const { releasePublishingTag } = await import('./publishing-tag.service');
    await expect(releasePublishingTag('org-1', 'user-1')).rejects.toThrow(
      'لا يمكنك التنازل عن وسم لا تملكه'
    );
  });

  it('forceReleasePublishingTag updates the row and writes an audit log', async () => {
    sb.queueResult({ data: baseRow, error: null });
    sb.queueResult({
      data: [
        {
          id: 'user-1',
          name_ar: 'سارة',
          employee_id: 'EMP-001',
          avatar_url: null,
        },
        {
          id: 'admin-1',
          name_ar: 'أحمد',
          employee_id: 'ADM-001',
          avatar_url: null,
        },
      ],
      error: null,
    });
    sb.queueResult({ data: null, error: null });
    mockCreateAuditLog.mockResolvedValue({
      id: 'audit-1',
      org_id: 'org-1',
      actor_id: 'admin-1',
      action: 'publishing_tag_force_released',
      action_ar: 'إلغاء وسم الناشر',
      target_id: 'user-1',
      target_type: 'user',
      details: 'تم إلغاء وسم الناشر',
      created_at: '2026-04-17T08:05:00.000Z',
    });

    const { forceReleasePublishingTag } = await import('./publishing-tag.service');
    await forceReleasePublishingTag('org-1', 'admin-1');

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 'admin-1',
        target_id: 'user-1',
        action: 'publishing_tag_force_released',
        details: expect.stringContaining('أحمد'),
      })
    );
  });

  it('subscribeToPublishingTag registers and cleans up the org channel', async () => {
    const { subscribeToPublishingTag } = await import('./publishing-tag.service');
    const unsubscribe = subscribeToPublishingTag('org-1', vi.fn());

    expect(sb.channelInstances.at(-1)?.name).toBe('publishing_tag_holders:org:org-1');

    unsubscribe();

    expect(sb.removeChannel).toHaveBeenCalledWith('SUBSCRIBED');
  });
});

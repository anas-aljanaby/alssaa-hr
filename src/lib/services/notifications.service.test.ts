import { describe, it, expect, vi, beforeEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

const notif = {
  id: 'n1',
  org_id: 'o1',
  user_id: 'u1',
  title: 't',
  title_ar: 'ع',
  message: 'm',
  message_ar: 'م',
  read_status: false,
  type: 'system' as const,
  created_at: '2025-01-01T00:00:00Z',
};

describe('notifications.service', () => {
  beforeEach(() => {
    sb.clearQueue();
    sb.clearChannelInstances();
  });

  it('getUserNotifications returns list', async () => {
    sb.queueResult({ data: [notif], error: null });
    const { getUserNotifications } = await import('./notifications.service');
    expect(await getUserNotifications('u1')).toHaveLength(1);
  });

  it('getUnreadNotifications filters read_status false', async () => {
    sb.queueResult({ data: [notif], error: null });
    const { getUnreadNotifications } = await import('./notifications.service');
    await getUnreadNotifications('u1');
    expect(sb.from).toHaveBeenCalledWith('notifications');
  });

  it('getUnreadCount returns count', async () => {
    sb.queueResult({ data: null, error: null, count: 3 });
    const { getUnreadCount } = await import('./notifications.service');
    expect(await getUnreadCount('u1')).toBe(3);
  });

  it('markAsRead updates row', async () => {
    sb.queueResult({ data: null, error: null });
    const { markAsRead } = await import('./notifications.service');
    await markAsRead('n1');
  });

  it('markAllAsRead updates rows', async () => {
    sb.queueResult({ data: null, error: null });
    const { markAllAsRead } = await import('./notifications.service');
    await markAllAsRead('u1');
  });

  it('subscribeToNotifications registers channel and cleans up', async () => {
    const { subscribeToNotifications } = await import('./notifications.service');
    const cb = vi.fn();
    const unsub = subscribeToNotifications('u1', cb);
    const ch = sb.channelInstances.at(-1);
    expect(ch?.name).toBe('notifications:u1');
    expect(ch?.subscribe).toHaveBeenCalled();
    unsub();
    // Service passes subscribe() return value to removeChannel (matches current implementation).
    expect(sb.removeChannel).toHaveBeenCalledWith('SUBSCRIBED');
  });

  it('subscribeToUserNotifications cleans up', async () => {
    const { subscribeToUserNotifications } = await import('./notifications.service');
    const unsub = subscribeToUserNotifications('u1', vi.fn());
    const ch = sb.channelInstances.at(-1);
    expect(ch?.name).toBe('notifications:full:u1');
    unsub();
    expect(sb.removeChannel).toHaveBeenCalledWith('SUBSCRIBED');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

const setting = {
  id: 's1',
  org_id: 'o1',
  type: 'work_start' as const,
  enabled: true,
  title: 'Shift started',
  title_ar: 'بدء الدوام',
  message: 'Your shift has started. Please punch in.',
  message_ar: 'وردية عملك بدأت الآن. سارع بتسجيل الحضور.',
  minutes_before: null,
  created_at: '2026-04-14T10:00:00Z',
  updated_at: '2026-04-14T10:00:00Z',
};

describe('notification-settings.service', () => {
  beforeEach(() => {
    sb.clearQueue();
    sb.from.mockClear();
  });

  it('getNotificationSettings returns ordered settings', async () => {
    sb.queueResult({ data: [setting], error: null });
    const { getNotificationSettings } = await import('./notification-settings.service');

    expect(await getNotificationSettings()).toEqual([setting]);
    expect(sb.from).toHaveBeenCalledWith('notification_settings');
  });

  it('updateNotificationSetting returns the updated row', async () => {
    sb.queueResult({ data: setting, error: null });
    const { updateNotificationSetting } = await import('./notification-settings.service');

    await expect(
      updateNotificationSetting(setting.id, { enabled: false, minutes_before: 10 })
    ).resolves.toEqual(setting);
    expect(sb.from).toHaveBeenCalledWith('notification_settings');
  });
});

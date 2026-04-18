import { describe, it, expect, beforeEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

const balanceRow = {
  id: 'lb-1',
  user_id: 'u1',
  org_id: 'o1',
  total_annual: 21,
  used_annual: 2,
  remaining_annual: 19,
};

describe('leave-balance.service', () => {
  beforeEach(() => {
    sb.clearQueue();
  });

  it('getUserBalance returns row', async () => {
    sb.queueResult({ data: balanceRow, error: null });
    const { getUserBalance } = await import('./leave-balance.service');
    const b = await getUserBalance('u1');
    expect(b?.user_id).toBe('u1');
  });

  it('updateBalance returns updated row', async () => {
    sb.queueResult({ data: { ...balanceRow, used_annual: 3 }, error: null });
    const { updateBalance } = await import('./leave-balance.service');
    const b = await updateBalance('u1', { used_annual: 3 });
    expect(b.used_annual).toBe(3);
  });

  it('getAllBalances returns list', async () => {
    sb.queueResult({ data: [balanceRow], error: null });
    const { getAllBalances } = await import('./leave-balance.service');
    const list = await getAllBalances();
    expect(list).toHaveLength(1);
  });

  it('resetAllBalances completes without error', async () => {
    sb.queueResult({ data: null, error: null });
    const { resetAllBalances } = await import('./leave-balance.service');
    await expect(resetAllBalances(21)).resolves.toBeUndefined();
  });
});

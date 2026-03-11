import { describe, it, expect, vi, beforeEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

describe('organizations.service', () => {
  beforeEach(() => {
    sb.clearQueue();
  });

  it('getMyOrganization returns data', async () => {
    sb.queueResult({ data: { id: 'org-1', general_manager_id: 'gm-1' }, error: null });
    const { getMyOrganization } = await import('./organizations.service');
    const org = await getMyOrganization();
    expect(org).toEqual({ id: 'org-1', general_manager_id: 'gm-1' });
  });

  it('getMyOrganization throws on error', async () => {
    sb.queueResult({ data: null, error: { message: 'db' } });
    const { getMyOrganization } = await import('./organizations.service');
    await expect(getMyOrganization()).rejects.toEqual({ message: 'db' });
  });

  it('transferGeneralManager throws NO_ORG when org missing', async () => {
    sb.queueResult({ data: null, error: null });
    const { transferGeneralManager } = await import('./organizations.service');
    await expect(transferGeneralManager('u1')).rejects.toThrow('NO_ORG');
  });

  it('transferGeneralManager calls rpc with ids', async () => {
    sb.queueResult({ data: { id: 'org-1', general_manager_id: null }, error: null });
    sb.rpc.mockResolvedValue({ data: null, error: null });
    const { transferGeneralManager } = await import('./organizations.service');
    await transferGeneralManager('new-gm');
    expect(sb.rpc).toHaveBeenCalledWith('transfer_general_manager', {
      p_org_id: 'org-1',
      p_new_gm_id: 'new-gm',
    });
  });

  it('transferGeneralManager propagates rpc error', async () => {
    sb.queueResult({ data: { id: 'org-1', general_manager_id: null }, error: null });
    sb.rpc.mockResolvedValue({ data: null, error: { message: 'rpc fail' } });
    const { transferGeneralManager } = await import('./organizations.service');
    await expect(transferGeneralManager('x')).rejects.toEqual({ message: 'rpc fail' });
  });
});

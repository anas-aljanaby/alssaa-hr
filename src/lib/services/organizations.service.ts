import { supabase } from '../supabase';
import type { Tables } from '../database.types';

export type Organization = Tables<'organizations'>;

export async function getMyOrganization(): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id,general_manager_id')
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function transferGeneralManager(pNewGmId: string): Promise<void> {
  const org = await getMyOrganization();
  if (!org?.id) {
    throw new Error('NO_ORG');
  }

  const { error } = await supabase.rpc('transfer_general_manager', {
    p_org_id: org.id,
    p_new_gm_id: pNewGmId,
  });

  if (error) throw error;
}


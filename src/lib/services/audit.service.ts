import { supabase } from '../supabase';
import type { Tables, InsertTables } from '../database.types';

export type AuditLog = Tables<'audit_logs'>;
export type AuditLogInsert = InsertTables<'audit_logs'>;

export async function getAuditLogs(options?: {
  limit?: number;
  offset?: number;
  actorId?: string;
  targetType?: string;
}): Promise<AuditLog[]> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.actorId) {
    query = query.eq('actor_id', options.actorId);
  }
  if (options?.targetType) {
    query = query.eq('target_type', options.targetType);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

export async function createAuditLog(
  entry: Omit<AuditLogInsert, 'id' | 'created_at'>
): Promise<AuditLog> {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAuditLogsForTarget(
  targetId: string
): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('target_id', targetId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getRecentAuditLogs(limit: number = 20): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

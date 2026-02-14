import { supabase } from '../supabase';
import type { Tables, UpdateTables } from '../database.types';

export type LeaveBalance = Tables<'leave_balances'>;
export type LeaveBalanceUpdate = UpdateTables<'leave_balances'>;

export async function getUserBalance(userId: string): Promise<LeaveBalance | null> {
  const { data, error } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateBalance(
  userId: string,
  updates: LeaveBalanceUpdate
): Promise<LeaveBalance> {
  const { data, error } = await supabase
    .from('leave_balances')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAllBalances(): Promise<LeaveBalance[]> {
  const { data, error } = await supabase
    .from('leave_balances')
    .select('*')
    .order('user_id');

  if (error) throw error;
  return data ?? [];
}

export async function resetAllBalances(
  totalAnnual: number,
  totalSick: number
): Promise<void> {
  const { error } = await supabase
    .from('leave_balances')
    .update({
      total_annual: totalAnnual,
      used_annual: 0,
      remaining_annual: totalAnnual,
      total_sick: totalSick,
      used_sick: 0,
      remaining_sick: totalSick,
    })
    .neq('user_id', '00000000-0000-0000-0000-000000000000');

  if (error) throw error;
}

import { supabase } from '../supabase';
import type { Tables, UpdateTables } from '../database.types';

export type AttendancePolicy = Tables<'attendance_policy'>;
export type AttendancePolicyUpdate = UpdateTables<'attendance_policy'>;

export async function getPolicy(): Promise<AttendancePolicy | null> {
  const { data, error } = await supabase
    .from('attendance_policy')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updatePolicy(
  updates: AttendancePolicyUpdate
): Promise<AttendancePolicy> {
  const existing = await getPolicy();

  if (!existing) {
    const { data, error } = await supabase
      .from('attendance_policy')
      .insert({
        work_start_time: updates.work_start_time ?? '08:00',
        work_end_time: updates.work_end_time ?? '16:00',
        grace_period_minutes: updates.grace_period_minutes ?? 15,
        weekly_off_days: updates.weekly_off_days ?? [5, 6],
        max_late_days_before_warning: updates.max_late_days_before_warning ?? 3,
        absent_cutoff_time: updates.absent_cutoff_time ?? '12:00',
        annual_leave_per_year: updates.annual_leave_per_year ?? 21,
        sick_leave_per_year: updates.sick_leave_per_year ?? 10,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('attendance_policy')
    .update(updates)
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

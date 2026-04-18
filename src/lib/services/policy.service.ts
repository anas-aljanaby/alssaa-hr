import {
  DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES,
  DEFAULT_MINIMUM_OVERTIME_MINUTES,
} from '@/shared/attendance/constants';
import { supabase } from '../supabase';
import type { Tables, UpdateTables } from '../database.types';

export type AttendancePolicy = Omit<Tables<'attendance_policy'>, 'auto_punch_out_rules'> & {
  auto_punch_out_rules: AutoPunchOutRule[];
};

export type AttendancePolicyUpdate = Omit<UpdateTables<'attendance_policy'>, 'auto_punch_out_rules'> & {
  auto_punch_out_rules?: AutoPunchOutRule[];
};

export interface AutoPunchOutRule {
  id: string;
  title: string;
  time: string;
  sessionType: 'all' | 'overtime' | 'regular';
  enabled: boolean;
}

const DEFAULT_AUTO_PUNCH_OUT_RULES: AutoPunchOutRule[] = [
  {
    id: 'default-3am-overtime',
    title: 'انصراف تلقائي 3 صباحاً (عمل إضافي)',
    time: '03:00',
    sessionType: 'overtime',
    enabled: false,
  },
];

function parseRules(raw: unknown): AutoPunchOutRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is AutoPunchOutRule =>
      r !== null &&
      typeof r === 'object' &&
      typeof r.id === 'string' &&
      typeof r.title === 'string' &&
      typeof r.time === 'string' &&
      (r.sessionType === 'all' || r.sessionType === 'overtime' || r.sessionType === 'regular') &&
      typeof r.enabled === 'boolean'
  );
}

function toPolicy(row: Tables<'attendance_policy'>): AttendancePolicy {
  return {
    ...row,
    auto_punch_out_rules: parseRules(row.auto_punch_out_rules),
  };
}

export async function getPolicy(): Promise<AttendancePolicy | null> {
  const { data, error } = await supabase
    .from('attendance_policy')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toPolicy(data) : null;
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
        auto_punch_out_buffer_minutes:
          updates.auto_punch_out_buffer_minutes ?? DEFAULT_AUTO_PUNCH_OUT_BUFFER_MINUTES,
        weekly_off_days: updates.weekly_off_days ?? [5, 6],
        max_late_days_before_warning: updates.max_late_days_before_warning ?? 3,
        absent_cutoff_time: updates.absent_cutoff_time ?? '12:00',
        annual_leave_per_year: updates.annual_leave_per_year ?? 21,
        sick_leave_per_year: updates.sick_leave_per_year ?? 10,
        minimum_overtime_minutes:
          updates.minimum_overtime_minutes ?? DEFAULT_MINIMUM_OVERTIME_MINUTES,
        auto_punch_out_rules: (updates.auto_punch_out_rules ?? DEFAULT_AUTO_PUNCH_OUT_RULES) as never,
      })
      .select()
      .single();

    if (error) throw error;
    return toPolicy(data);
  }

  const { data, error } = await supabase
    .from('attendance_policy')
    .update({
      ...updates,
      auto_punch_out_rules: updates.auto_punch_out_rules as never,
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw error;
  return toPolicy(data);
}

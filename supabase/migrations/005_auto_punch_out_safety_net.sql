-- Manual punch-out required; auto punch-out is a safety net after shift_end + buffer.
-- This migration adds the flag and config.

-- attendance_logs: flag when punch-out was applied by system (safety net), not by employee
alter table public.attendance_logs
  add column if not exists auto_punch_out boolean not null default false;

comment on column public.attendance_logs.auto_punch_out is
  'True when check_out_time was set by the auto punch-out job (safety net), not by the employee.';

-- attendance_policy: configurable buffer (minutes) after shift end before auto punch-out runs
alter table public.attendance_policy
  add column if not exists auto_punch_out_buffer_minutes int not null default 30;

comment on column public.attendance_policy.auto_punch_out_buffer_minutes is
  'Minutes after work_end_time after which the auto punch-out safety net runs (e.g. 30).';
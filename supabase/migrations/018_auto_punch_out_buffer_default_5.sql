-- Tighten auto punch-out grace: 5 minutes after shift end (was 30).

alter table public.attendance_policy
  alter column auto_punch_out_buffer_minutes set default 5;

comment on column public.attendance_policy.auto_punch_out_buffer_minutes is
  'Minutes after work_end_time after which the auto punch-out safety net runs (e.g. 5).';

-- Migrate rows that still match the old default so behavior matches new installs.
update public.attendance_policy
set auto_punch_out_buffer_minutes = 5
where auto_punch_out_buffer_minutes = 30;

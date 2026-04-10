alter table public.attendance_policy
  add column if not exists minimum_overtime_minutes int not null default 30;

comment on column public.attendance_policy.minimum_overtime_minutes is
  'Minimum overtime session length, in minutes, that must be met before overtime is stored or requested.';

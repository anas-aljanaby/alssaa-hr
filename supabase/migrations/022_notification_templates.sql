alter table public.attendance_policy
  add column if not exists check_in_notification_message text,
  add column if not exists check_out_notification_message text;

comment on column public.attendance_policy.check_in_notification_message is
  'Custom Arabic notification message sent to employees when they check in. Supports {time} placeholder.';

comment on column public.attendance_policy.check_out_notification_message is
  'Custom Arabic notification message sent to employees when they are auto-punched out. Supports {time} placeholder.';

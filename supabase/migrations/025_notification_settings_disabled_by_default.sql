-- ============================================================
-- Notification settings disabled by default
-- ============================================================

alter table public.notification_settings
  alter column enabled set default false;

create or replace function public.seed_default_notification_settings(
  p_org_id uuid,
  p_enabled boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_settings
    (org_id, type, enabled, title, title_ar, message, message_ar, minutes_before)
  values
    (
      p_org_id,
      'pre_shift_reminder',
      p_enabled,
      'Shift starts soon',
      'تذكير ببداية الدوام',
      'Your shift starts in 30 minutes. Get ready!',
      'وردية عملك تبدأ خلال 30 دقيقة. استعد!',
      30
    ),
    (
      p_org_id,
      'work_start',
      p_enabled,
      'Shift started',
      'بدء الدوام',
      'Your shift has started. Please punch in.',
      'وردية عملك بدأت الآن. سارع بتسجيل الحضور.',
      null
    ),
    (
      p_org_id,
      'punch_out_reminder',
      p_enabled,
      'Shift ending soon',
      'تذكير بنهاية الدوام',
      'Your shift ends in 15 minutes. Don''t forget to punch out.',
      'وردية عملك تنتهي خلال 15 دقيقة. لا تنسَ تسجيل الانصراف.',
      15
    ),
    (
      p_org_id,
      'auto_punch_out_alert',
      p_enabled,
      'Forgot to punch out',
      'نسيت تسجيل الانصراف',
      'The system recorded your departure automatically. If this is incorrect, submit a correction request.',
      'تم تسجيل انصرافك تلقائياً. إن كان ذلك غير صحيح، قدم طلب تصحيح.',
      null
    )
  on conflict (org_id, type) do nothing;
end;
$$;

create or replace function public.handle_new_organization_notification_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_notification_settings(new.id, false);
  return new;
end;
$$;

drop trigger if exists seed_notification_settings_after_org_insert on public.organizations;

create trigger seed_notification_settings_after_org_insert
  after insert on public.organizations
  for each row
  execute function public.handle_new_organization_notification_settings();

do $$
declare
  _org record;
begin
  for _org in
    select id from public.organizations
  loop
    perform public.seed_default_notification_settings(_org.id, false);
  end loop;
end;
$$;

update public.notification_settings
set enabled = false,
    updated_at = now()
where enabled is distinct from false;

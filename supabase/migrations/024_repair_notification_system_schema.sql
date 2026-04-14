-- ============================================================
-- Repair notification system schema after migration 022 was rewritten
-- ============================================================
--
-- Older environments already applied the original 022 migration, which only
-- added attendance_policy notification-template columns. When 022 was later
-- replaced in-place with the new notification tables, those environments kept
-- migration version 022 marked as applied, so Supabase skipped the rewritten
-- SQL and never created the new tables.
--
-- Newer environments that started after the rewrite got the new tables but
-- missed the original attendance_policy columns.
--
-- This forward-only migration heals both states safely.

alter table public.attendance_policy
  add column if not exists check_in_notification_message text,
  add column if not exists check_out_notification_message text;

comment on column public.attendance_policy.check_in_notification_message is
  'Custom Arabic notification message sent to employees when they check in. Supports {time} placeholder.';

comment on column public.attendance_policy.check_out_notification_message is
  'Custom Arabic notification message sent to employees when they are auto-punched out. Supports {time} placeholder.';

create table if not exists public.notification_settings (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  type           text not null check (type in (
                   'pre_shift_reminder',
                   'work_start',
                   'punch_out_reminder',
                   'auto_punch_out_alert'
                 )),
  enabled        boolean not null default true,
  title          text not null,
  title_ar       text not null,
  message        text not null,
  message_ar     text not null,
  minutes_before int,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists notification_settings_org_id_type_key
  on public.notification_settings (org_id, type);

comment on column public.notification_settings.minutes_before is
  'How many minutes before the event to fire the notification (pre_shift_reminder / punch_out_reminder only).';

create table if not exists public.sent_scheduled_notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  org_id            uuid not null references public.organizations(id) on delete cascade,
  date              date not null,
  notification_type text not null,
  sent_at           timestamptz not null default now()
);

create unique index if not exists sent_scheduled_notifications_user_id_date_notification_type_key
  on public.sent_scheduled_notifications (user_id, date, notification_type);

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  endpoint     text not null,
  subscription jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);

create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions (user_id);

alter table public.notification_settings enable row level security;
alter table public.sent_scheduled_notifications enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_settings'
      and policyname = 'notification_settings_select'
  ) then
    create policy "notification_settings_select"
      on public.notification_settings for select
      to authenticated
      using (org_id = public.current_user_org_id());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_settings'
      and policyname = 'notification_settings_update'
  ) then
    create policy "notification_settings_update"
      on public.notification_settings for update
      to authenticated
      using (
        org_id = public.current_user_org_id()
        and public.current_user_role() = 'admin'
      )
      with check (
        org_id = public.current_user_org_id()
        and public.current_user_role() = 'admin'
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'push_subscriptions_select_own'
  ) then
    create policy "push_subscriptions_select_own"
      on public.push_subscriptions for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'push_subscriptions_insert_own'
  ) then
    create policy "push_subscriptions_insert_own"
      on public.push_subscriptions for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'push_subscriptions_update_own'
  ) then
    create policy "push_subscriptions_update_own"
      on public.push_subscriptions for update
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'push_subscriptions_delete_own'
  ) then
    create policy "push_subscriptions_delete_own"
      on public.push_subscriptions for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

insert into public.notification_settings
  (org_id, type, enabled, title, title_ar, message, message_ar, minutes_before)
select
  id,
  'pre_shift_reminder',
  true,
  'Shift starts soon',
  'تذكير ببداية الدوام',
  'Your shift starts in 30 minutes. Get ready!',
  'وردية عملك تبدأ خلال 30 دقيقة. استعد!',
  30
from public.organizations
on conflict (org_id, type) do nothing;

insert into public.notification_settings
  (org_id, type, enabled, title, title_ar, message, message_ar, minutes_before)
select
  id,
  'work_start',
  true,
  'Shift started',
  'بدء الدوام',
  'Your shift has started. Please punch in.',
  'وردية عملك بدأت الآن. سارع بتسجيل الحضور.',
  null
from public.organizations
on conflict (org_id, type) do nothing;

insert into public.notification_settings
  (org_id, type, enabled, title, title_ar, message, message_ar, minutes_before)
select
  id,
  'punch_out_reminder',
  true,
  'Shift ending soon',
  'تذكير بنهاية الدوام',
  'Your shift ends in 15 minutes. Don''t forget to punch out.',
  'وردية عملك تنتهي خلال 15 دقيقة. لا تنسَ تسجيل الانصراف.',
  15
from public.organizations
on conflict (org_id, type) do nothing;

insert into public.notification_settings
  (org_id, type, enabled, title, title_ar, message, message_ar, minutes_before)
select
  id,
  'auto_punch_out_alert',
  true,
  'Forgot to punch out',
  'نسيت تسجيل الانصراف',
  'The system recorded your departure automatically. If this is incorrect, submit a correction request.',
  'تم تسجيل انصرافك تلقائياً. إن كان ذلك غير صحيح، قدم طلب تصحيح.',
  null
from public.organizations
on conflict (org_id, type) do nothing;

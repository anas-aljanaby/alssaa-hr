-- ============================================================
-- Notification settings, deduplication log, and push subscriptions
-- ============================================================

-- Per-org configuration for each automated notification type
create table public.notification_settings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  type          text not null check (type in (
                  'pre_shift_reminder',
                  'work_start',
                  'punch_out_reminder',
                  'auto_punch_out_alert'
                )),
  enabled       boolean not null default true,
  title         text not null,
  title_ar      text not null,
  message       text not null,
  message_ar    text not null,
  minutes_before int,   -- for pre_shift_reminder and punch_out_reminder only
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(org_id, type)
);

comment on column public.notification_settings.minutes_before is
  'How many minutes before the event to fire the notification (pre_shift_reminder / punch_out_reminder only).';

-- Deduplication: one record per user per day per notification type.
-- Inserted by the scheduled-notifications edge function before sending;
-- ON CONFLICT → skip means the notification was already sent today.
create table public.sent_scheduled_notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  org_id            uuid not null references public.organizations(id) on delete cascade,
  date              date not null,
  notification_type text not null,
  sent_at           timestamptz not null default now(),
  unique(user_id, date, notification_type)
);

-- Browser push subscriptions (one row per endpoint/device per user).
-- Populated by the frontend after the user grants notification permission.
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  endpoint     text not null unique,
  subscription jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.notification_settings enable row level security;
alter table public.sent_scheduled_notifications enable row level security;
alter table public.push_subscriptions enable row level security;

-- notification_settings: any org member can read; only admins can update
create policy "notification_settings_select"
  on public.notification_settings for select
  to authenticated
  using (org_id = public.current_user_org_id());

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

-- sent_scheduled_notifications: service_role only (no authenticated policies needed)

-- push_subscriptions: each user manages their own rows
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  to authenticated
  using (user_id = auth.uid());

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- Default settings for every existing org
-- ============================================================

insert into public.notification_settings
  (org_id, type, enabled, title, title_ar, message, message_ar, minutes_before)
select id,
       'pre_shift_reminder', true,
       'Shift starts soon', 'تذكير ببداية الدوام',
       'Your shift starts in 30 minutes. Get ready!',
       'وردية عملك تبدأ خلال 30 دقيقة. استعد!',
       30
from public.organizations
on conflict (org_id, type) do nothing;

insert into public.notification_settings
  (org_id, type, enabled, title, title_ar, message, message_ar, minutes_before)
select id,
       'work_start', true,
       'Shift started', 'بدء الدوام',
       'Your shift has started. Please punch in.',
       'وردية عملك بدأت الآن. سارع بتسجيل الحضور.',
       null
from public.organizations
on conflict (org_id, type) do nothing;

insert into public.notification_settings
  (org_id, type, enabled, title, title_ar, message, message_ar, minutes_before)
select id,
       'punch_out_reminder', true,
       'Shift ending soon', 'تذكير بنهاية الدوام',
       'Your shift ends in 15 minutes. Don''t forget to punch out.',
       'وردية عملك تنتهي خلال 15 دقيقة. لا تنسَ تسجيل الانصراف.',
       15
from public.organizations
on conflict (org_id, type) do nothing;

insert into public.notification_settings
  (org_id, type, enabled, title, title_ar, message, message_ar, minutes_before)
select id,
       'auto_punch_out_alert', true,
       'Forgot to punch out', 'نسيت تسجيل الانصراف',
       'The system recorded your departure automatically. If this is incorrect, submit a correction request.',
       'تم تسجيل انصرافك تلقائياً. إن كان ذلك غير صحيح، قدم طلب تصحيح.',
       null
from public.organizations
on conflict (org_id, type) do nothing;

create table if not exists notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  leave_requests_team boolean not null default true,
  overtime_requests_team boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table notification_preferences enable row level security;

drop policy if exists "users read own prefs" on notification_preferences;
create policy "users read own prefs" on notification_preferences
  for select using (user_id = auth.uid());

drop policy if exists "users update own prefs" on notification_preferences;
create policy "users update own prefs" on notification_preferences
  for update using (user_id = auth.uid());

drop policy if exists "users insert own prefs" on notification_preferences;
create policy "users insert own prefs" on notification_preferences
  for insert with check (user_id = auth.uid());

alter table notifications add column if not exists link_url text;

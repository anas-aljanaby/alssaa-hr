-- ============================================================
-- Attendance v2: sessions + daily summary
-- ============================================================

alter table public.attendance_policy
  add column if not exists early_login_minutes int not null default 60,
  add column if not exists minimum_required_minutes int;

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  check_in_time time not null,
  check_out_time time,
  status text not null check (status in ('present', 'late')),
  is_overtime boolean not null default false,
  is_auto_punch_out boolean not null default false,
  is_early_departure boolean not null default false,
  needs_review boolean not null default false,
  duration_minutes int not null default 0 check (duration_minutes >= 0),
  is_dev boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_daily_summary (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  first_check_in time,
  last_check_out time,
  total_work_minutes int not null default 0 check (total_work_minutes >= 0),
  total_overtime_minutes int not null default 0 check (total_overtime_minutes >= 0),
  effective_status text
    check (effective_status in ('present', 'late', 'overtime_only', 'absent', 'on_leave')),
  is_short_day boolean not null default false,
  session_count int not null default 0 check (session_count >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id)
);

create index if not exists idx_attendance_sessions_org on public.attendance_sessions (org_id);
create index if not exists idx_attendance_sessions_user_date on public.attendance_sessions (user_id, date desc);
create index if not exists idx_attendance_sessions_open on public.attendance_sessions (user_id, date) where check_out_time is null;
create index if not exists idx_attendance_daily_summary_user_date on public.attendance_daily_summary (user_id, date desc);
create index if not exists idx_overtime_requests_user_created on public.overtime_requests (user_id, created_at desc);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_daily_summary enable row level security;
alter table public.overtime_requests enable row level security;

create policy "Users can read own attendance sessions"
  on public.attendance_sessions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Managers can read department attendance sessions"
  on public.attendance_sessions for select
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and user_id in (
      select id from public.profiles
      where department_id = public.current_user_department()
        and org_id = public.current_user_org_id()
    )
  );

create policy "Admins can read all org attendance sessions"
  on public.attendance_sessions for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Users can insert own attendance sessions"
  on public.attendance_sessions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own attendance sessions"
  on public.attendance_sessions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins can insert any org attendance sessions"
  on public.attendance_sessions for insert
  to authenticated
  with check (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Admins can update any org attendance sessions"
  on public.attendance_sessions for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  )
  with check (org_id = public.current_user_org_id());

create policy "Users can read own attendance summaries"
  on public.attendance_daily_summary for select
  to authenticated
  using (user_id = auth.uid());

create policy "Managers can read department attendance summaries"
  on public.attendance_daily_summary for select
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and user_id in (
      select id from public.profiles
      where department_id = public.current_user_department()
        and org_id = public.current_user_org_id()
    )
  );

create policy "Admins can read all org attendance summaries"
  on public.attendance_daily_summary for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Users can read own overtime requests"
  on public.overtime_requests for select
  to authenticated
  using (user_id = auth.uid());

create policy "Managers can read department overtime requests"
  on public.overtime_requests for select
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and user_id in (
      select id from public.profiles
      where department_id = public.current_user_department()
        and org_id = public.current_user_org_id()
    )
  );

create policy "Admins can read all org overtime requests"
  on public.overtime_requests for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Users can insert own overtime requests"
  on public.overtime_requests for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Managers can update department overtime requests"
  on public.overtime_requests for update
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and user_id in (
      select id from public.profiles
      where department_id = public.current_user_department()
        and org_id = public.current_user_org_id()
    )
  );

create policy "Admins can update any org overtime requests"
  on public.overtime_requests for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  )
  with check (org_id = public.current_user_org_id());

create trigger enforce_org_attendance_sessions
  before insert on public.attendance_sessions
  for each row execute function public.enforce_org_id_from_user();

create trigger enforce_org_attendance_daily_summary
  before insert on public.attendance_daily_summary
  for each row execute function public.enforce_org_id_from_user();

create trigger enforce_org_overtime_requests
  before insert on public.overtime_requests
  for each row execute function public.enforce_org_id_from_user();

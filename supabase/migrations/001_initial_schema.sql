-- ============================================================
-- ALSSAA HR — Initial Schema Migration
-- Multi-tenant org-based architecture
-- organizations + 8 HR tables, constraints, indexes, RLS, triggers
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 0. ORGANIZATIONS
-- ============================================================
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name, is_demo) values
  ('11111111-1111-1111-1111-111111111111', 'Alssaa Media Network', false),
  ('22222222-2222-2222-2222-222222222222', 'Demo Organization', true);

-- ============================================================
-- 1. DEPARTMENTS
-- ============================================================
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  name_ar     text not null,
  manager_uid uuid,                       -- FK added after profiles exists
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2. PROFILES  (extends auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  org_id        uuid not null references public.organizations (id) on delete cascade,
  employee_id   text not null unique,
  name          text not null,
  name_ar       text not null,
  phone         text not null default '',
  role          text not null default 'employee'
                  check (role in ('employee', 'manager', 'admin')),
  department_id uuid references public.departments (id) on delete set null,
  avatar_url    text,
  join_date     date not null default current_date,
  work_days       int[] default null,
  work_start_time time default null,
  work_end_time   time default null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.profiles.work_days is 'Days the user works: 0=Sun .. 6=Sat. Null/empty = use org policy.';
comment on column public.profiles.work_start_time is 'Start of work (same for all work days). Null = use org policy.';
comment on column public.profiles.work_end_time is 'End of work (same for all work days). Null = use org policy.';

alter table public.departments
  add constraint departments_manager_uid_fkey
  foreign key (manager_uid) references public.profiles (id) on delete set null;

-- Unique department names per org: prevent duplicate name_ar or name within the same organization.
alter table public.departments
  add constraint departments_org_name_ar_unique unique (org_id, name_ar);
alter table public.departments
  add constraint departments_org_name_unique unique (org_id, name);

-- One general manager per organization: the account created for the org. No other account can become GM.
alter table public.organizations
  add column general_manager_id uuid references public.profiles (id) on delete set null;

-- ============================================================
-- 3. ATTENDANCE LOGS
-- ============================================================
create table public.attendance_logs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  date            date not null,
  check_in_time   time,
  check_out_time  time,
  check_in_lat    float8,
  check_in_lng    float8,
  check_out_lat   float8,
  check_out_lng   float8,
  status          text not null default 'present'
                    check (status in ('present', 'late', 'absent', 'on_leave')),
  is_dev          boolean not null default false,
  auto_punch_out  boolean not null default false,
  unique (user_id, date)
);

comment on column public.attendance_logs.auto_punch_out is
  'True when check_out_time was set by the auto punch-out job (safety net), not by the employee.';

-- ============================================================
-- 4. LEAVE REQUESTS
-- ============================================================
create table public.leave_requests (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            text not null
                    check (type in ('annual_leave', 'hourly_permission', 'time_adjustment', 'overtime')),
  from_date_time  timestamptz not null,
  to_date_time    timestamptz not null,
  note            text not null default '',
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  approver_id     uuid references public.profiles (id) on delete set null,
  decision_note   text,
  decided_at      timestamptz,
  attachment_url  text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 5. APPROVAL LOGS
-- ============================================================
create table public.approval_logs (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  request_id uuid not null references public.leave_requests (id) on delete cascade,
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  action     text not null check (action in ('approved', 'rejected')),
  comment    text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6. LEAVE BALANCES
-- ============================================================
create table public.leave_balances (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null unique references public.profiles (id) on delete cascade,
  total_annual     int not null default 21,
  used_annual      int not null default 0,
  remaining_annual int not null default 21
);

-- ============================================================
-- 7. NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  title_ar    text not null,
  message     text not null,
  message_ar  text not null,
  read_status boolean not null default false,
  type        text not null
                check (type in ('request_update', 'attendance', 'system', 'approval')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 8. AUDIT LOGS
-- ============================================================
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  actor_id    uuid not null references public.profiles (id) on delete cascade,
  action      text not null,
  action_ar   text not null,
  target_id   uuid not null,
  target_type text not null,
  details     text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 9. ATTENDANCE POLICY  (one row per org)
-- ============================================================
create table public.attendance_policy (
  id                           uuid primary key default gen_random_uuid(),
  org_id                       uuid not null references public.organizations (id) on delete cascade,
  work_start_time              time not null default '08:00',
  work_end_time                time not null default '16:00',
  grace_period_minutes         int  not null default 15,
  weekly_off_days              int[] not null default '{5,6}',
  max_late_days_before_warning int  not null default 3,
  absent_cutoff_time           time not null default '12:00',
  annual_leave_per_year        int  not null default 21,
  auto_punch_out_buffer_minutes int  not null default 5,
  constraint attendance_policy_org_unique unique (org_id)
);

comment on column public.attendance_policy.auto_punch_out_buffer_minutes is
  'Minutes after work_end_time after which the auto punch-out safety net runs (e.g. 5).';

-- Default policy for the real org
insert into public.attendance_policy (org_id)
values ('11111111-1111-1111-1111-111111111111');

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_departments_org        on public.departments    (org_id);

create index idx_profiles_org           on public.profiles       (org_id);
create index idx_profiles_department    on public.profiles       (department_id);
create index idx_profiles_role          on public.profiles       (role);

create index idx_attendance_org         on public.attendance_logs (org_id);
create index idx_attendance_user_date   on public.attendance_logs (user_id, date desc);
create index idx_attendance_date        on public.attendance_logs (date);
create index idx_attendance_status     on public.attendance_logs (status);
create index idx_attendance_logs_is_dev_user on public.attendance_logs (user_id, is_dev) where is_dev = true;

create index idx_leave_req_org          on public.leave_requests (org_id);
create index idx_leave_req_user         on public.leave_requests (user_id);
create index idx_leave_req_status       on public.leave_requests (status);
create index idx_leave_req_approver     on public.leave_requests (approver_id);
create index idx_leave_req_created      on public.leave_requests (created_at desc);
create index idx_approval_logs_org      on public.approval_logs  (org_id);
create index idx_approval_logs_request  on public.approval_logs  (request_id, created_at desc);
create index idx_approval_logs_actor    on public.approval_logs  (actor_id);

create index idx_leave_bal_org          on public.leave_balances (org_id);

create index idx_notifications_org      on public.notifications  (org_id);
create index idx_notifications_user     on public.notifications  (user_id, created_at desc);
create index idx_notifications_unread   on public.notifications  (user_id) where read_status = false;

create index idx_audit_org              on public.audit_logs     (org_id);
create index idx_audit_created          on public.audit_logs     (created_at desc);
create index idx_audit_actor            on public.audit_logs     (actor_id);
create index idx_audit_target           on public.audit_logs     (target_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create or replace function public.current_user_org_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_department()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- ---------- organizations ----------
alter table public.organizations enable row level security;

create policy "Users can read own org"
  on public.organizations for select
  to authenticated
  using (id = public.current_user_org_id());

-- ---------- departments ----------
alter table public.departments enable row level security;

create policy "Users can read own org departments"
  on public.departments for select
  to authenticated
  using (org_id = public.current_user_org_id());

create policy "Admins can insert departments"
  on public.departments for insert
  to authenticated
  with check (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Admins can update departments"
  on public.departments for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  )
  with check (org_id = public.current_user_org_id());

create policy "Admins can delete departments"
  on public.departments for delete
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

-- ---------- profiles ----------
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Managers can read department profiles"
  on public.profiles for select
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and department_id = public.current_user_department()
  );

create policy "Admins can read all org profiles"
  on public.profiles for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can update org profiles"
  on public.profiles for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  )
  with check (org_id = public.current_user_org_id());

-- ---------- attendance_logs ----------
alter table public.attendance_logs enable row level security;

create policy "Users can read own attendance"
  on public.attendance_logs for select
  to authenticated
  using (user_id = auth.uid());

create policy "Managers can read department attendance"
  on public.attendance_logs for select
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

create policy "Admins can read all org attendance"
  on public.attendance_logs for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Users can insert own attendance"
  on public.attendance_logs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own attendance"
  on public.attendance_logs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins can insert any org attendance"
  on public.attendance_logs for insert
  to authenticated
  with check (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Admins can update any org attendance"
  on public.attendance_logs for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  )
  with check (org_id = public.current_user_org_id());

-- ---------- leave_requests ----------
alter table public.leave_requests enable row level security;

create policy "Users can read own requests"
  on public.leave_requests for select
  to authenticated
  using (user_id = auth.uid());

create policy "Managers can read department requests"
  on public.leave_requests for select
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

create policy "Admins can read all org requests"
  on public.leave_requests for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Users can insert own requests"
  on public.leave_requests for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Managers can update department requests"
  on public.leave_requests for update
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

create policy "Admins can update any org request"
  on public.leave_requests for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  )
  with check (org_id = public.current_user_org_id());

-- ---------- approval_logs ----------
alter table public.approval_logs enable row level security;

create policy "Users can read own request approval logs"
  on public.approval_logs for select
  to authenticated
  using (
    request_id in (
      select lr.id
      from public.leave_requests lr
      where lr.user_id = auth.uid()
    )
  );

create policy "Managers can read department approval logs"
  on public.approval_logs for select
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and request_id in (
      select lr.id
      from public.leave_requests lr
      join public.profiles p on p.id = lr.user_id
      where p.department_id = public.current_user_department()
        and p.org_id = public.current_user_org_id()
    )
  );

create policy "Admins can read org approval logs"
  on public.approval_logs for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Managers can insert department approval logs"
  on public.approval_logs for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and request_id in (
      select lr.id
      from public.leave_requests lr
      join public.profiles p on p.id = lr.user_id
      where p.department_id = public.current_user_department()
        and p.org_id = public.current_user_org_id()
    )
  );

create policy "Admins can insert org approval logs"
  on public.approval_logs for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

-- ---------- leave_balances ----------
alter table public.leave_balances enable row level security;

create policy "Users can read own balance"
  on public.leave_balances for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can read all org balances"
  on public.leave_balances for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Admins can insert org balances"
  on public.leave_balances for insert
  to authenticated
  with check (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Admins can update org balances"
  on public.leave_balances for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  )
  with check (org_id = public.current_user_org_id());

-- ---------- notifications ----------
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- audit_logs ----------
alter table public.audit_logs enable row level security;

create policy "Admins can read org audit logs"
  on public.audit_logs for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Authenticated can insert own audit log"
  on public.audit_logs for insert
  to authenticated
  with check (actor_id = auth.uid());

-- ---------- attendance_policy ----------
alter table public.attendance_policy enable row level security;

create policy "Users can read own org policy"
  on public.attendance_policy for select
  to authenticated
  using (org_id = public.current_user_org_id());

create policy "Admins can insert org policy"
  on public.attendance_policy for insert
  to authenticated
  with check (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Admins can update org policy"
  on public.attendance_policy for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  )
  with check (org_id = public.current_user_org_id());

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- ---------------------------------------------------------
-- T1: Auto-create profile + leave_balance on auth.users insert
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  _name    text;
  _name_ar text;
  _phone   text;
  _role    text;
  _emp_id  text;
  _org_id  uuid;
  _dept_id uuid;
  _policy  record;
begin
  _name    := coalesce(new.raw_user_meta_data ->> 'name', '');
  _name_ar := coalesce(new.raw_user_meta_data ->> 'name_ar', _name);
  _phone   := coalesce(new.raw_user_meta_data ->> 'phone', '');
  _role    := coalesce(new.raw_user_meta_data ->> 'role', 'employee');
  _emp_id  := coalesce(
    new.raw_user_meta_data ->> 'employee_id',
    'EMP-' || substr(new.id::text, 1, 8)
  );
  _org_id  := coalesce(
    (new.raw_user_meta_data ->> 'org_id')::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid
  );
  _dept_id := (new.raw_user_meta_data ->> 'department_id')::uuid;

  insert into public.profiles (id, org_id, employee_id, name, name_ar, phone, role, department_id)
  values (new.id, _org_id, _emp_id, _name, _name_ar, _phone, _role, _dept_id);

  select annual_leave_per_year
    into _policy
    from public.attendance_policy
    where org_id = _org_id
    limit 1;

  insert into public.leave_balances (
    user_id, org_id,
    total_annual, used_annual, remaining_annual
  ) values (
    new.id, _org_id,
    coalesce(_policy.annual_leave_per_year, 21), 0, coalesce(_policy.annual_leave_per_year, 21)
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------
-- T2: Validate organizations.general_manager_id integrity
-- ---------------------------------------------------------
create or replace function public.validate_general_manager_on_org_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _gm_org_id uuid;
  _gm_role   text;
begin
  if new.general_manager_id is null then
    return new;
  end if;

  select p.org_id, p.role
    into _gm_org_id, _gm_role
  from public.profiles p
  where p.id = new.general_manager_id;

  if _gm_org_id is null then
    raise exception 'GENERAL_MANAGER_PROFILE_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if _gm_org_id <> new.id then
    raise exception 'GENERAL_MANAGER_PROFILE_NOT_IN_ORG'
      using errcode = 'P0002';
  end if;

  if _gm_role <> 'admin' then
    raise exception 'GENERAL_MANAGER_PROFILE_MUST_BE_ADMIN'
      using errcode = 'P0003';
  end if;

  return new;
end;
$$;

create trigger validate_general_manager_on_org_change
  before insert or update of general_manager_id on public.organizations
  for each row
  execute function public.validate_general_manager_on_org_change();

-- ---------------------------------------------------------
-- T3: Transfer General Manager between profiles
-- ---------------------------------------------------------
create or replace function public.transfer_general_manager(
  p_org_id uuid,
  p_new_gm_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller_role text;
  _caller_org_id uuid;
  _old_gm_id uuid;
  _old_gm_manages_any boolean;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED'
      using errcode = 'P0004';
  end if;

  select pr.role, pr.org_id
    into _caller_role, _caller_org_id
  from public.profiles pr
  where pr.id = auth.uid();

  if _caller_role is null then
    raise exception 'NO_PROFILE'
      using errcode = 'P0005';
  end if;

  if _caller_role <> 'admin' then
    raise exception 'NOT_AUTHORIZED'
      using errcode = 'P0006';
  end if;

  if _caller_org_id <> p_org_id then
    raise exception 'ORG_MISMATCH'
      using errcode = 'P0007';
  end if;

  if not exists (
    select 1 from public.profiles pr
    where pr.id = p_new_gm_id
      and pr.org_id = p_org_id
  ) then
    raise exception 'GENERAL_MANAGER_CANDIDATE_INVALID'
      using errcode = 'P0008';
  end if;

  if exists (
    select 1 from public.organizations o
    where o.id = p_org_id
      and o.general_manager_id = p_new_gm_id
  ) then
    return;
  end if;

  select o.general_manager_id into _old_gm_id
  from public.organizations o
  where o.id = p_org_id;

  update public.profiles
  set role = 'admin'
  where id = p_new_gm_id
    and org_id = p_org_id;

  update public.organizations
  set general_manager_id = p_new_gm_id
  where id = p_org_id;

  if _old_gm_id is not null and _old_gm_id <> p_new_gm_id then
    select exists (
      select 1
      from public.departments d
      where d.org_id = p_org_id
        and d.manager_uid = _old_gm_id
    ) into _old_gm_manages_any;

    if _old_gm_manages_any then
      update public.profiles
      set role = 'manager'
      where id = _old_gm_id
        and org_id = p_org_id;
    else
      update public.profiles
      set role = 'employee'
      where id = _old_gm_id
        and org_id = p_org_id;
    end if;
  end if;
end;
$$;

grant execute on function public.transfer_general_manager(uuid, uuid) to authenticated;

-- Backfill safety: if an org has no GM yet, use latest admin profile.
update public.organizations o
set general_manager_id = sub.admin_id
from (
  select distinct on (org_id)
    org_id,
    id as admin_id
  from public.profiles
  where role = 'admin'
  order by org_id, created_at desc
) sub
where o.id = sub.org_id
  and o.general_manager_id is null;

-- ---------------------------------------------------------
-- T4: Stamp decision time on status transitions
-- ---------------------------------------------------------
create or replace function public.set_request_decided_at()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status <> new.status then
    if new.status in ('approved', 'rejected') then
      new.decided_at := coalesce(new.decided_at, now());
    else
      new.decided_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_request_set_decided_at
  before update of status on public.leave_requests
  for each row
  when (old.status is distinct from new.status)
  execute function public.set_request_decided_at();

-- ---------------------------------------------------------
-- T5: Notify requester + write approval logs on decision
-- ---------------------------------------------------------
create or replace function public.handle_request_status_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    if new.approver_id is not null then
      insert into public.approval_logs (org_id, request_id, actor_id, action, comment, created_at)
      values (new.org_id, new.id, new.approver_id, new.status, new.decision_note, coalesce(new.decided_at, now()));
    end if;

    insert into public.notifications (
      user_id, org_id, title, title_ar, message, message_ar, type
    ) values (
      new.user_id,
      new.org_id,
      'Request ' || new.status,
      case new.status
        when 'approved' then 'تم قبول الطلب'
        when 'rejected' then 'تم رفض الطلب'
      end,
      'Your ' || replace(new.type, '_', ' ') || ' request has been ' || new.status || '.',
      case new.status
        when 'approved' then 'تمت الموافقة على طلب ' || replace(new.type, '_', ' ')
        when 'rejected' then 'تم رفض طلب ' || replace(new.type, '_', ' ')
      end,
      'request_update'
    );
  end if;

  return new;
end;
$$;

create trigger on_request_status_change
  after update of status on public.leave_requests
  for each row
  when (old.status is distinct from new.status)
  execute function public.handle_request_status_change();

-- ---------------------------------------------------------
-- T6: Auto-update leave_balances when request is approved
-- ---------------------------------------------------------
create or replace function public.handle_request_approved()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  _days int;
begin
  if old.status = 'pending' and new.status = 'approved' then
    _days := greatest(1, (new.to_date_time::date - new.from_date_time::date));

    if new.type = 'annual_leave' then
      update public.leave_balances
         set used_annual      = used_annual + _days,
             remaining_annual = remaining_annual - _days
       where user_id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_request_approved
  after update of status on public.leave_requests
  for each row
  when (old.status is distinct from new.status)
  execute function public.handle_request_approved();

-- ---------------------------------------------------------
-- T4: Notify employee when they check in late
-- ---------------------------------------------------------
create or replace function public.handle_late_checkin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'late' and new.check_in_time is not null then
    insert into public.notifications (
      user_id, org_id, title, title_ar, message, message_ar, type
    ) values (
      new.user_id,
      new.org_id,
      'Late Check-in',
      'تسجيل حضور متأخر',
      'You checked in late at ' || new.check_in_time::text || '.',
      'تم تسجيل حضورك متأخراً الساعة ' || new.check_in_time::text || '.',
      'attendance'
    );
  end if;

  return new;
end;
$$;

create trigger on_late_checkin
  after insert on public.attendance_logs
  for each row
  when (new.status = 'late')
  execute function public.handle_late_checkin();

-- ---------------------------------------------------------
-- T5: Enforce org_id consistency on user-owned tables.
--     Auto-sets org_id from the owning user's profile;
--     rejects mismatched values from the client.
-- ---------------------------------------------------------
create or replace function public.enforce_org_id_from_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  _user_org uuid;
begin
  select org_id into _user_org
    from public.profiles
    where id = new.user_id;

  if _user_org is null then
    if auth.uid() is null then
      return new;  -- service role with explicit org_id
    end if;
    raise exception 'No profile found for user_id %', new.user_id;
  end if;

  if new.org_id is null then
    new.org_id := _user_org;
  elsif new.org_id <> _user_org then
    raise exception 'org_id mismatch: provided % but user belongs to %', new.org_id, _user_org;
  end if;

  return new;
end;
$$;

create trigger enforce_org_attendance
  before insert on public.attendance_logs
  for each row execute function public.enforce_org_id_from_user();

create trigger enforce_org_leave_requests
  before insert on public.leave_requests
  for each row execute function public.enforce_org_id_from_user();

create trigger enforce_org_leave_balances
  before insert on public.leave_balances
  for each row execute function public.enforce_org_id_from_user();

create trigger enforce_org_notifications
  before insert on public.notifications
  for each row execute function public.enforce_org_id_from_user();

-- Audit logs use actor_id instead of user_id
create or replace function public.enforce_org_id_from_actor()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  _actor_org uuid;
begin
  select org_id into _actor_org
    from public.profiles
    where id = new.actor_id;

  if _actor_org is null then
    if auth.uid() is null then
      return new;
    end if;
    raise exception 'No profile found for actor_id %', new.actor_id;
  end if;

  if new.org_id is null then
    new.org_id := _actor_org;
  elsif new.org_id <> _actor_org then
    raise exception 'org_id mismatch: provided % but actor belongs to %', new.org_id, _actor_org;
  end if;

  return new;
end;
$$;

create trigger enforce_org_audit_logs
  before insert on public.audit_logs
  for each row execute function public.enforce_org_id_from_actor();

create trigger enforce_org_approval_logs
  before insert on public.approval_logs
  for each row execute function public.enforce_org_id_from_actor();

-- Auto-set org_id for org-owned tables (departments, attendance_policy)
-- that have no user_id column. Derives org from the authenticated user.
create or replace function public.enforce_org_id_from_current_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  _user_org uuid;
begin
  if auth.uid() is null then
    if new.org_id is null then
      raise exception 'org_id required when no auth context';
    end if;
    return new;
  end if;

  _user_org := (select org_id from public.profiles where id = auth.uid());

  if _user_org is null then
    raise exception 'No profile found for current user';
  end if;

  if new.org_id is null then
    new.org_id := _user_org;
  elsif new.org_id <> _user_org then
    raise exception 'org_id mismatch';
  end if;

  return new;
end;
$$;

create trigger enforce_org_departments
  before insert on public.departments
  for each row execute function public.enforce_org_id_from_current_user();

create trigger enforce_org_attendance_policy
  before insert on public.attendance_policy
  for each row execute function public.enforce_org_id_from_current_user();

-- ---------------------------------------------------------
-- T6: Prevent org_id changes and non-admin role changes
-- ---------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  _caller_role text;
begin
  if auth.uid() is null then
    return new;  -- service role bypass
  end if;

  if new.org_id is distinct from old.org_id then
    raise exception 'Cannot change org_id';
  end if;

  _caller_role := (select role from public.profiles where id = auth.uid());

  if _caller_role <> 'admin' and new.role is distinct from old.role then
    raise exception 'Only admins can change user roles';
  end if;

  return new;
end;
$$;

 create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------
-- T7: Keep manager roles in sync with department assignments
-- ---------------------------------------------------------
create or replace function public.sync_department_manager_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_old_manager_uid uuid;
  v_new_manager_uid uuid;
begin
  v_org_id := coalesce(new.org_id, old.org_id);

  if tg_op = 'INSERT' then
    v_old_manager_uid := null;
    v_new_manager_uid := new.manager_uid;
  elsif tg_op = 'UPDATE' then
    v_old_manager_uid := old.manager_uid;
    v_new_manager_uid := new.manager_uid;
  elsif tg_op = 'DELETE' then
    v_old_manager_uid := old.manager_uid;
    v_new_manager_uid := null;
  else
    return null;
  end if;

  if v_new_manager_uid is not null then
    update public.profiles
    set role = 'manager'
    where id = v_new_manager_uid
      and org_id = v_org_id
      and role = 'employee';
  end if;

  if v_old_manager_uid is not null and v_old_manager_uid <> v_new_manager_uid then
    if not exists (
      select 1
      from public.departments d
      where d.org_id = v_org_id
        and d.manager_uid = v_old_manager_uid
    ) then
      update public.profiles
      set role = 'employee'
      where id = v_old_manager_uid
        and org_id = v_org_id
        and role = 'manager';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger sync_department_manager_roles_insert
  after insert
  on public.departments
  for each row
  execute function public.sync_department_manager_roles();

create trigger sync_department_manager_roles_update
  after update of manager_uid
  on public.departments
  for each row
  execute function public.sync_department_manager_roles();

create trigger sync_department_manager_roles_delete
  after delete
  on public.departments
  for each row
  execute function public.sync_department_manager_roles();

-- ---------------------------------------------------------
-- PUNCH: check-in / check-out via SQL RPC with overtime support
-- ---------------------------------------------------------
-- Call via supabase.rpc('punch', { p_action, p_dev_override_time? }).
-- Uses auth.uid() for the caller and allows re-check-in after checkout
-- for overtime (e.g. returning from a break).

create or replace function public.punch(
  p_action text,
  p_dev_override_time timestamptz default null
)
returns public.attendance_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _org_id uuid;
  _today date;
  _time_str text;
  _existing public.attendance_logs;
  _status text := 'present';
  _start_minutes int;
  _now_minutes int;
  _policy_start time;
  _policy_grace int;
  _is_dev boolean;
begin
  _uid := auth.uid();
  if _uid is null then
    raise exception 'UNAUTHORIZED: انتهت الجلسة أو لا تملك الصلاحية';
  end if;

  if p_action is null or p_action not in ('check_in', 'check_out') then
    raise exception 'INVALID_ACTION: action must be check_in or check_out';
  end if;

  _is_dev := (p_dev_override_time is not null);

  -- Effective timestamp: optional override for dev, else now
  _today := (coalesce(p_dev_override_time, current_timestamp))::date;
  _time_str := to_char(coalesce(p_dev_override_time, current_timestamp), 'HH24:MI');

  select org_id into _org_id from public.profiles where id = _uid;
  if _org_id is null then
    raise exception 'NO_PROFILE: لم يتم العثور على الملف الشخصي';
  end if;

  select * into _existing
  from public.attendance_logs
  where user_id = _uid and date = _today;

  if p_action = 'check_in' then
    -- Only block if currently checked in without checkout (active session)
    if _existing.id is not null and _existing.check_in_time is not null and _existing.check_out_time is null then
      raise exception 'ALREADY_CHECKED_IN: Already checked in today';
    end if;

    -- Late vs present from policy
    select work_start_time, grace_period_minutes into _policy_start, _policy_grace
    from public.attendance_policy
    where org_id = _org_id
    limit 1;

    if found then
      _start_minutes := extract(hour from _policy_start)::int * 60
                         + extract(minute from _policy_start)::int
                         + coalesce(_policy_grace, 0);
      _now_minutes := (split_part(_time_str, ':', 1)::int * 60)
                      + split_part(_time_str, ':', 2)::int;
      if _now_minutes > _start_minutes then
        _status := 'late';
      end if;
    end if;

    if _existing.id is not null then
      update public.attendance_logs
      set
        check_in_time = _time_str::time,
        check_out_time = null,
        status = _status,
        is_dev = _is_dev
      where id = _existing.id
      returning * into _existing;
      return _existing;
    end if;

    insert into public.attendance_logs (
      org_id, user_id, date, check_in_time, status, is_dev
    )
    values (
      _org_id, _uid, _today, _time_str::time, _status, _is_dev
    )
    returning * into _existing;
    return _existing;
  end if;

  -- check_out
  if _existing.id is null or _existing.check_in_time is null then
    raise exception 'NO_CHECK_IN: Must check in before checking out';
  end if;
  if _existing.check_out_time is not null then
    raise exception 'ALREADY_CHECKED_OUT: Already checked out today';
  end if;

  update public.attendance_logs
  set
    check_out_time = _time_str::time,
    is_dev = _is_dev
  where id = _existing.id
  returning * into _existing;
  return _existing;
end;
$$;

comment on function public.punch(text, timestamptz) is
  'Check-in or check-out for the authenticated user. Allows re-check-in after checkout for overtime. Optional dev_override_time for testing.';

grant execute on function public.punch(text, timestamptz) to authenticated;
grant execute on function public.punch(text, timestamptz) to service_role;

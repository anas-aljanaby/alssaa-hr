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
  status        text not null default 'active'
                  check (status in ('active', 'inactive')),
  avatar_url    text,
  join_date     date not null default current_date
);

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
  unique (user_id, date)
);

-- ============================================================
-- 4. LEAVE REQUESTS
-- ============================================================
create table public.leave_requests (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            text not null
                    check (type in ('annual_leave', 'sick_leave', 'hourly_permission', 'time_adjustment')),
  from_date_time  timestamptz not null,
  to_date_time    timestamptz not null,
  note            text not null default '',
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  approver_id     uuid references public.profiles (id) on delete set null,
  decision_note   text,
  attachment_url  text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 5. LEAVE BALANCES
-- ============================================================
create table public.leave_balances (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null unique references public.profiles (id) on delete cascade,
  total_annual     int not null default 21,
  used_annual      int not null default 0,
  remaining_annual int not null default 21,
  total_sick       int not null default 10,
  used_sick        int not null default 0,
  remaining_sick   int not null default 10
);

-- ============================================================
-- 6. NOTIFICATIONS
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
-- 7. AUDIT LOGS
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
-- 8. ATTENDANCE POLICY  (one row per org)
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
  sick_leave_per_year          int  not null default 10,
  constraint attendance_policy_org_unique unique (org_id)
);

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
create index idx_profiles_status        on public.profiles       (status);

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

  select annual_leave_per_year, sick_leave_per_year
    into _policy
    from public.attendance_policy
    where org_id = _org_id
    limit 1;

  insert into public.leave_balances (
    user_id, org_id,
    total_annual, used_annual, remaining_annual,
    total_sick,   used_sick,   remaining_sick
  ) values (
    new.id, _org_id,
    coalesce(_policy.annual_leave_per_year, 21), 0, coalesce(_policy.annual_leave_per_year, 21),
    coalesce(_policy.sick_leave_per_year, 10),   0, coalesce(_policy.sick_leave_per_year, 10)
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------
-- T2: Notify requester when leave_request status changes
-- ---------------------------------------------------------
create or replace function public.handle_request_status_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
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
-- T3: Auto-update leave_balances when request is approved
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
    elsif new.type = 'sick_leave' then
      update public.leave_balances
         set used_sick      = used_sick + _days,
             remaining_sick = remaining_sick - _days
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

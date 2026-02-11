-- ============================================================
-- ALSSAA HR — Initial Schema Migration
-- 8 tables, constraints, indexes, RLS policies, triggers
-- ============================================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. DEPARTMENTS
-- ============================================================
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
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

-- Now add the deferred FK from departments -> profiles
alter table public.departments
  add constraint departments_manager_uid_fkey
  foreign key (manager_uid) references public.profiles (id) on delete set null;

-- ============================================================
-- 3. ATTENDANCE LOGS
-- ============================================================
create table public.attendance_logs (
  id              uuid primary key default gen_random_uuid(),
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
  unique (user_id, date)
);

-- ============================================================
-- 4. LEAVE REQUESTS
-- ============================================================
create table public.leave_requests (
  id              uuid primary key default gen_random_uuid(),
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
  actor_id    uuid not null references public.profiles (id) on delete cascade,
  action      text not null,
  action_ar   text not null,
  target_id   uuid not null,
  target_type text not null,
  details     text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 8. ATTENDANCE POLICY  (single-row configuration)
-- ============================================================
create table public.attendance_policy (
  id                           uuid primary key default gen_random_uuid(),
  work_start_time              time not null default '08:00',
  work_end_time                time not null default '16:00',
  grace_period_minutes         int  not null default 15,
  weekly_off_days              int[] not null default '{5,6}',
  max_late_days_before_warning int  not null default 3,
  absent_cutoff_time           time not null default '12:00',
  annual_leave_per_year        int  not null default 21,
  sick_leave_per_year          int  not null default 10
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_profiles_department   on public.profiles       (department_id);
create index idx_profiles_role         on public.profiles       (role);
create index idx_profiles_status       on public.profiles       (status);

create index idx_attendance_user_date  on public.attendance_logs (user_id, date desc);
create index idx_attendance_date       on public.attendance_logs (date);
create index idx_attendance_status     on public.attendance_logs (status);

create index idx_leave_req_user        on public.leave_requests (user_id);
create index idx_leave_req_status      on public.leave_requests (status);
create index idx_leave_req_approver    on public.leave_requests (approver_id);
create index idx_leave_req_created     on public.leave_requests (created_at desc);

create index idx_notifications_user    on public.notifications  (user_id, created_at desc);
create index idx_notifications_unread  on public.notifications  (user_id) where read_status = false;

create index idx_audit_created         on public.audit_logs     (created_at desc);
create index idx_audit_actor           on public.audit_logs     (actor_id);
create index idx_audit_target          on public.audit_logs     (target_id);

-- ============================================================
-- HELPER: get the role of the current JWT user
-- ============================================================
create or replace function public.current_user_role()
returns text
language sql stable security definer
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- HELPER: get the department_id of the current JWT user
create or replace function public.current_user_department()
returns uuid
language sql stable security definer
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- ---------- departments ----------
alter table public.departments enable row level security;

create policy "Authenticated users can read departments"
  on public.departments for select
  to authenticated
  using (true);

create policy "Admins can insert departments"
  on public.departments for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

create policy "Admins can update departments"
  on public.departments for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "Admins can delete departments"
  on public.departments for delete
  to authenticated
  using (public.current_user_role() = 'admin');

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
    and department_id = public.current_user_department()
  );

create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.current_user_role() = 'admin');

create policy "Admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

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
    and user_id in (
      select id from public.profiles
      where department_id = public.current_user_department()
    )
  );

create policy "Admins can read all attendance"
  on public.attendance_logs for select
  to authenticated
  using (public.current_user_role() = 'admin');

create policy "Users can insert own attendance"
  on public.attendance_logs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own attendance"
  on public.attendance_logs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins can insert any attendance"
  on public.attendance_logs for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

create policy "Admins can update any attendance"
  on public.attendance_logs for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

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
    and user_id in (
      select id from public.profiles
      where department_id = public.current_user_department()
    )
  );

create policy "Admins can read all requests"
  on public.leave_requests for select
  to authenticated
  using (public.current_user_role() = 'admin');

create policy "Users can insert own requests"
  on public.leave_requests for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Managers can update department requests"
  on public.leave_requests for update
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and user_id in (
      select id from public.profiles
      where department_id = public.current_user_department()
    )
  );

create policy "Admins can update any request"
  on public.leave_requests for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ---------- leave_balances ----------
alter table public.leave_balances enable row level security;

create policy "Users can read own balance"
  on public.leave_balances for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can read all balances"
  on public.leave_balances for select
  to authenticated
  using (public.current_user_role() = 'admin');

create policy "Admins can insert balances"
  on public.leave_balances for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

create policy "Admins can update balances"
  on public.leave_balances for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

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

-- Notifications are inserted by triggers / service role, not directly by users.
-- Allow inserts only from service role (no authenticated insert policy).

-- ---------- audit_logs ----------
alter table public.audit_logs enable row level security;

create policy "Admins can read all audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.current_user_role() = 'admin');

-- Audit logs are inserted by triggers / service role.
-- No direct insert policy for authenticated users.

-- ---------- attendance_policy ----------
alter table public.attendance_policy enable row level security;

create policy "Authenticated users can read policy"
  on public.attendance_policy for select
  to authenticated
  using (true);

create policy "Admins can insert policy"
  on public.attendance_policy for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

create policy "Admins can update policy"
  on public.attendance_policy for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

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

  insert into public.profiles (id, employee_id, name, name_ar, phone, role)
  values (new.id, _emp_id, _name, _name_ar, _phone, _role);

  select annual_leave_per_year, sick_leave_per_year
    into _policy
    from public.attendance_policy
    limit 1;

  insert into public.leave_balances (
    user_id,
    total_annual, used_annual, remaining_annual,
    total_sick,   used_sick,   remaining_sick
  ) values (
    new.id,
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
      user_id, title, title_ar, message, message_ar, type
    ) values (
      new.user_id,
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
      user_id, title, title_ar, message, message_ar, type
    ) values (
      new.user_id,
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

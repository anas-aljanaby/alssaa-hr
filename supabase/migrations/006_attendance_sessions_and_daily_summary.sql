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
  last_action_at timestamptz not null default now(),
  is_dev boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.attendance_sessions
  add column if not exists last_action_at timestamptz not null default now();

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

create or replace function public.recalculate_attendance_daily_summary(
  p_user_id uuid,
  p_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _org_id uuid;
  _work_days int[];
  _profile_start time;
  _profile_end time;
  _policy_start time;
  _policy_end time;
  _weekly_off int[];
  _min_required int;
  _has_custom_schedule boolean;
  _has_shift boolean;
  _is_working_day boolean;
  _has_leave boolean;
  _first_check_in time;
  _last_check_out time;
  _total_work int;
  _total_overtime int;
  _session_count int;
  _has_non_ot_present boolean;
  _has_non_ot_late boolean;
  _effective_status text;
  _is_short_day boolean;
begin
  _org_id := (
    select s.org_id
    from public.attendance_sessions s
    where s.user_id = p_user_id and s.date = p_date
    order by s.created_at asc
    limit 1
  );

  if _org_id is null then
    _org_id := (select p.org_id from public.profiles p where p.id = p_user_id);
  end if;

  select
    p.work_days,
    p.work_start_time,
    p.work_end_time
  into
    _work_days,
    _profile_start,
    _profile_end
  from public.profiles p
  where p.id = p_user_id;

  select
    ap.work_start_time,
    ap.work_end_time,
    ap.weekly_off_days,
    ap.minimum_required_minutes
  into
    _policy_start,
    _policy_end,
    _weekly_off,
    _min_required
  from public.attendance_policy ap
  where ap.org_id = _org_id
  limit 1;

  _has_custom_schedule :=
    _work_days is not null
    and cardinality(_work_days) > 0
    and _profile_start is not null
    and _profile_end is not null;

  _has_shift := (
    (_has_custom_schedule and _profile_start is not null and _profile_end is not null)
    or
    (not _has_custom_schedule and _policy_start is not null and _policy_end is not null)
  );

  if not _has_shift then
    _is_working_day := true;
  elsif _has_custom_schedule then
    _is_working_day := extract(dow from p_date)::int = any(_work_days);
  else
    _is_working_day := not (extract(dow from p_date)::int = any(coalesce(_weekly_off, '{5,6}'::int[])));
  end if;

  _has_leave := exists (
    select 1
    from public.leave_requests lr
    where lr.user_id = p_user_id
      and lr.status = 'approved'
      and lr.type <> 'overtime'
      and lr.from_date_time <= (p_date::text || 'T23:59:59')::timestamptz
      and lr.to_date_time >= (p_date::text || 'T00:00:00')::timestamptz
  );

  select
    min(s.check_in_time),
    max(s.check_out_time),
    coalesce(sum(s.duration_minutes), 0),
    coalesce(sum(case when s.is_overtime then s.duration_minutes else 0 end), 0),
    count(*)
  into
    _first_check_in,
    _last_check_out,
    _total_work,
    _total_overtime,
    _session_count
  from public.attendance_sessions s
  where s.user_id = p_user_id
    and s.date = p_date;

  _has_non_ot_present := exists (
    select 1 from public.attendance_sessions s
    where s.user_id = p_user_id
      and s.date = p_date
      and s.is_overtime = false
      and s.status = 'present'
  );

  _has_non_ot_late := exists (
    select 1 from public.attendance_sessions s
    where s.user_id = p_user_id
      and s.date = p_date
      and s.is_overtime = false
      and s.status = 'late'
  );

  if _has_leave then
    _effective_status := 'on_leave';
  elsif not _is_working_day then
    _effective_status := null;
  elsif _session_count = 0 then
    _effective_status := 'absent';
  elsif _has_non_ot_late and not _has_non_ot_present then
    _effective_status := 'late';
  elsif _has_non_ot_present then
    _effective_status := 'present';
  elsif exists (
    select 1
    from public.attendance_sessions s
    where s.user_id = p_user_id
      and s.date = p_date
      and s.is_overtime = true
  ) then
    _effective_status := 'overtime_only';
  else
    _effective_status := null;
  end if;

  _is_short_day := (
    _min_required is not null
    and _total_work < _min_required
  );

  insert into public.attendance_daily_summary (
    org_id,
    user_id,
    date,
    first_check_in,
    last_check_out,
    total_work_minutes,
    total_overtime_minutes,
    effective_status,
    is_short_day,
    session_count,
    updated_at
  ) values (
    _org_id,
    p_user_id,
    p_date,
    _first_check_in,
    _last_check_out,
    _total_work,
    _total_overtime,
    _effective_status,
    _is_short_day,
    _session_count,
    now()
  )
  on conflict (user_id, date)
  do update set
    org_id = excluded.org_id,
    first_check_in = excluded.first_check_in,
    last_check_out = excluded.last_check_out,
    total_work_minutes = excluded.total_work_minutes,
    total_overtime_minutes = excluded.total_overtime_minutes,
    effective_status = excluded.effective_status,
    is_short_day = excluded.is_short_day,
    session_count = excluded.session_count,
    updated_at = now();
end;
$$;

grant execute on function public.recalculate_attendance_daily_summary(uuid, date) to authenticated;
grant execute on function public.recalculate_attendance_daily_summary(uuid, date) to service_role;

create or replace function public.trigger_recalculate_attendance_daily_summary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _user_id uuid;
  _date date;
begin
  _user_id := coalesce(new.user_id, old.user_id);
  _date := coalesce(new.date, old.date);
  perform public.recalculate_attendance_daily_summary(_user_id, _date);
  return coalesce(new, old);
end;
$$;

create trigger on_attendance_sessions_recalculate_daily_summary
  after insert or update or delete
  on public.attendance_sessions
  for each row
  execute function public.trigger_recalculate_attendance_daily_summary();

create table if not exists public.attendance_audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid references public.attendance_sessions (id) on delete set null,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('check_in', 'check_out', 'auto_punch_out', 'correction_approved', 'manual_edit', 'session_deleted')),
  performed_by uuid references public.profiles (id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_attendance_audit_employee_created on public.attendance_audit_log (employee_id, created_at desc);
create index if not exists idx_attendance_audit_session on public.attendance_audit_log (session_id);

alter table public.attendance_audit_log enable row level security;

create policy "Users can read own attendance audit logs"
  on public.attendance_audit_log for select
  to authenticated
  using (employee_id = auth.uid());

create policy "Managers can read department attendance audit logs"
  on public.attendance_audit_log for select
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and employee_id in (
      select id from public.profiles
      where department_id = public.current_user_department()
        and org_id = public.current_user_org_id()
    )
  );

create policy "Admins can read all org attendance audit logs"
  on public.attendance_audit_log for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Service role can insert attendance audit logs"
  on public.attendance_audit_log for insert
  to authenticated
  with check (org_id = public.current_user_org_id() or auth.uid() is null);

create or replace function public.prevent_attendance_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'attendance_audit_log is append-only';
end;
$$;

create trigger protect_attendance_audit_log_update
  before update on public.attendance_audit_log
  for each row
  execute function public.prevent_attendance_audit_log_mutation();

create trigger protect_attendance_audit_log_delete
  before delete on public.attendance_audit_log
  for each row
  execute function public.prevent_attendance_audit_log_mutation();

create or replace function public.audit_attendance_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _action text;
  _performed_by uuid;
  _reason text;
  _old_values jsonb;
  _new_values jsonb;
  _org_id uuid;
  _employee_id uuid;
  _session_id uuid;
begin
  _performed_by := auth.uid();
  _reason := nullif(current_setting('app.attendance_audit_reason', true), '');

  if tg_op = 'INSERT' then
    _action := coalesce(nullif(current_setting('app.attendance_audit_action', true), ''), 'check_in');
    _old_values := null;
    _new_values := to_jsonb(new);
    _org_id := new.org_id;
    _employee_id := new.user_id;
    _session_id := new.id;
  elsif tg_op = 'DELETE' then
    _action := coalesce(nullif(current_setting('app.attendance_audit_action', true), ''), 'session_deleted');
    _old_values := to_jsonb(old);
    _new_values := null;
    _org_id := old.org_id;
    _employee_id := old.user_id;
    _session_id := old.id;
  else
    _action := nullif(current_setting('app.attendance_audit_action', true), '');
    if _action is null then
      if old.check_out_time is null and new.check_out_time is not null and new.is_auto_punch_out then
        _action := 'auto_punch_out';
      elsif old.check_out_time is null and new.check_out_time is not null then
        _action := 'check_out';
      else
        _action := 'manual_edit';
      end if;
    end if;
    _old_values := to_jsonb(old);
    _new_values := to_jsonb(new);
    _org_id := new.org_id;
    _employee_id := new.user_id;
    _session_id := new.id;
  end if;

  insert into public.attendance_audit_log (
    org_id,
    session_id,
    employee_id,
    action,
    performed_by,
    old_values,
    new_values,
    reason
  ) values (
    _org_id,
    _session_id,
    _employee_id,
    _action,
    _performed_by,
    _old_values,
    _new_values,
    _reason
  );

  return coalesce(new, old);
end;
$$;

create trigger on_attendance_sessions_audit
  after insert or update or delete
  on public.attendance_sessions
  for each row
  execute function public.audit_attendance_sessions();

create table if not exists public.attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.attendance_sessions (id) on delete set null,
  date date not null,
  proposed_check_in_time time,
  proposed_check_out_time time,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_attendance_correction_requests_employee on public.attendance_correction_requests (employee_id, created_at desc);
create index if not exists idx_attendance_correction_requests_status on public.attendance_correction_requests (status, created_at desc);

alter table public.attendance_correction_requests enable row level security;

create policy "Users can read own correction requests"
  on public.attendance_correction_requests for select
  to authenticated
  using (employee_id = auth.uid() or requested_by = auth.uid());

create policy "Users can insert own correction requests"
  on public.attendance_correction_requests for insert
  to authenticated
  with check (requested_by = auth.uid() and employee_id = auth.uid());

create policy "Managers can read department correction requests"
  on public.attendance_correction_requests for select
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and employee_id in (
      select id from public.profiles
      where department_id = public.current_user_department()
        and org_id = public.current_user_org_id()
    )
  );

create policy "Managers can review department correction requests"
  on public.attendance_correction_requests for update
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and employee_id in (
      select id from public.profiles
      where department_id = public.current_user_department()
        and org_id = public.current_user_org_id()
    )
  );

create policy "Admins can read all org correction requests"
  on public.attendance_correction_requests for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Admins can review all org correction requests"
  on public.attendance_correction_requests for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  )
  with check (org_id = public.current_user_org_id());

create or replace function public.enforce_org_id_from_employee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _employee_org uuid;
begin
  select org_id into _employee_org
  from public.profiles
  where id = new.employee_id;

  if _employee_org is null then
    raise exception 'No profile found for employee_id %', new.employee_id;
  end if;

  if new.org_id is null then
    new.org_id := _employee_org;
  elsif new.org_id <> _employee_org then
    raise exception 'org_id mismatch: provided % but employee belongs to %', new.org_id, _employee_org;
  end if;

  return new;
end;
$$;

create trigger enforce_org_attendance_correction_requests
  before insert on public.attendance_correction_requests
  for each row execute function public.enforce_org_id_from_employee();

create trigger enforce_org_attendance_audit_log
  before insert on public.attendance_audit_log
  for each row execute function public.enforce_org_id_from_employee();

create or replace function public.manual_edit_attendance_session(
  p_session_id uuid,
  p_check_in_time time default null,
  p_check_out_time time default null,
  p_reason text default null
)
returns public.attendance_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller uuid;
  _caller_role text;
  _caller_org uuid;
  _session public.attendance_sessions;
  _updated public.attendance_sessions;
  _new_check_in time;
  _new_check_out time;
  _duration int;
begin
  _caller := auth.uid();
  if _caller is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select role, org_id into _caller_role, _caller_org
  from public.profiles
  where id = _caller;

  if _caller_role not in ('manager', 'admin') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into _session
  from public.attendance_sessions
  where id = p_session_id;

  if _session.id is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if _session.org_id <> _caller_org then
    raise exception 'ORG_MISMATCH';
  end if;

  _new_check_in := coalesce(p_check_in_time, _session.check_in_time);
  _new_check_out := coalesce(p_check_out_time, _session.check_out_time);

  if _new_check_out is not null then
    _duration := greatest(0, extract(epoch from (_new_check_out - _new_check_in))::int / 60);
  else
    _duration := 0;
  end if;

  perform set_config('app.attendance_audit_action', 'manual_edit', true);
  perform set_config('app.attendance_audit_reason', coalesce(p_reason, ''), true);

  update public.attendance_sessions
  set
    check_in_time = _new_check_in,
    check_out_time = _new_check_out,
    duration_minutes = _duration,
    last_action_at = now(),
    updated_at = now()
  where id = p_session_id
  returning * into _updated;

  return _updated;
end;
$$;

grant execute on function public.manual_edit_attendance_session(uuid, time, time, text) to authenticated;

create or replace function public.approve_attendance_correction_from_leave_request(
  p_leave_request_id uuid,
  p_approver_id uuid default null
)
returns public.attendance_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  _req public.leave_requests;
  _actor uuid;
  _actor_role text;
  _actor_org uuid;
  _session public.attendance_sessions;
  _result public.attendance_sessions;
  _target_date date;
  _in_time time;
  _out_time time;
  _duration int;
begin
  select * into _req
  from public.leave_requests
  where id = p_leave_request_id;

  if _req.id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if _req.type <> 'time_adjustment' then
    raise exception 'INVALID_REQUEST_TYPE';
  end if;

  if _req.status <> 'approved' then
    raise exception 'REQUEST_NOT_APPROVED';
  end if;

  _actor := coalesce(p_approver_id, auth.uid());
  if _actor is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select role, org_id into _actor_role, _actor_org
  from public.profiles
  where id = _actor;

  if _actor_role not in ('manager', 'admin') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if _actor_org <> _req.org_id then
    raise exception 'ORG_MISMATCH';
  end if;

  _target_date := (_req.from_date_time at time zone 'UTC')::date;
  _in_time := (_req.from_date_time at time zone 'UTC')::time;
  _out_time := (_req.to_date_time at time zone 'UTC')::time;
  _duration := greatest(0, extract(epoch from (_out_time - _in_time))::int / 60);

  select * into _session
  from public.attendance_sessions
  where user_id = _req.user_id
    and date = _target_date
  order by check_in_time asc
  limit 1;

  perform set_config('app.attendance_audit_action', 'correction_approved', true);
  perform set_config('app.attendance_audit_reason', coalesce(_req.decision_note, _req.note, ''), true);

  if _session.id is null then
    insert into public.attendance_sessions (
      org_id,
      user_id,
      date,
      check_in_time,
      check_out_time,
      status,
      is_overtime,
      duration_minutes,
      is_auto_punch_out,
      is_early_departure,
      needs_review,
      last_action_at,
      is_dev
    ) values (
      _req.org_id,
      _req.user_id,
      _target_date,
      _in_time,
      _out_time,
      'present',
      false,
      _duration,
      false,
      false,
      false,
      now(),
      false
    ) returning * into _result;
  else
    update public.attendance_sessions
    set
      check_in_time = _in_time,
      check_out_time = _out_time,
      duration_minutes = _duration,
      is_auto_punch_out = false,
      needs_review = false,
      last_action_at = now(),
      updated_at = now()
    where id = _session.id
    returning * into _result;
  end if;

  return _result;
end;
$$;

grant execute on function public.approve_attendance_correction_from_leave_request(uuid, uuid) to authenticated;

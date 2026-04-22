-- ============================================================
-- Work schedule redesign: scalar columns -> work_schedule jsonb
-- ============================================================
--
-- Both profiles and attendance_policy now store a per-day work schedule
-- as jsonb, keyed by day-of-week (0=Sun..6=Sat, matching JS Date.getDay()
-- and Postgres EXTRACT(DOW FROM date)). Each value is { start, end } in
-- "HH:MM" 24h format. Missing keys mean the user does not work that day.
--
-- Resolution order for a given (user, date):
--   1) user's work_schedule[dow] if present
--   2) org's attendance_policy.work_schedule[dow] if present
--   3) null => off day
--
-- This migration drops the legacy scalar columns in a single step and
-- rewrites every dependent function to read from jsonb.

-- ------------------------------------------------------------
-- 1. Schema changes
-- ------------------------------------------------------------

alter table public.profiles
  add column if not exists work_schedule jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop column if exists work_days,
  drop column if exists work_start_time,
  drop column if exists work_end_time;

alter table public.attendance_policy
  add column if not exists work_schedule jsonb not null default '{
    "0": {"start": "08:00", "end": "16:00"},
    "1": {"start": "08:00", "end": "16:00"},
    "2": {"start": "08:00", "end": "16:00"},
    "3": {"start": "08:00", "end": "16:00"},
    "4": {"start": "08:00", "end": "16:00"}
  }'::jsonb;

-- If any attendance_policy rows still carry the default '{}'::jsonb (meaning
-- they were added before the DEFAULT was set on the column), seed them now.
update public.attendance_policy
set work_schedule = '{
  "0": {"start": "08:00", "end": "16:00"},
  "1": {"start": "08:00", "end": "16:00"},
  "2": {"start": "08:00", "end": "16:00"},
  "3": {"start": "08:00", "end": "16:00"},
  "4": {"start": "08:00", "end": "16:00"}
}'::jsonb
where work_schedule = '{}'::jsonb;

alter table public.attendance_policy
  drop column if exists work_start_time,
  drop column if exists work_end_time,
  drop column if exists weekly_off_days;

-- ------------------------------------------------------------
-- 2. Helper: get_effective_shift(user_id, date)
--    Returns (start_time, end_time, is_working_day) after applying the
--    user -> org -> null fallback chain.
-- ------------------------------------------------------------

create or replace function public.get_effective_shift(
  p_user_id uuid,
  p_date date
)
returns table (
  start_time time,
  end_time time,
  is_working_day boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _org_id uuid;
  _user_schedule jsonb;
  _org_schedule jsonb;
  _dow text := extract(dow from p_date)::int::text;
  _day jsonb;
begin
  select p.org_id, p.work_schedule
    into _org_id, _user_schedule
  from public.profiles p
  where p.id = p_user_id;

  select ap.work_schedule
    into _org_schedule
  from public.attendance_policy ap
  where ap.org_id = _org_id
  limit 1;

  -- Prefer user's per-day entry; fall back to org's per-day entry.
  if _user_schedule is not null and _user_schedule ? _dow then
    _day := _user_schedule -> _dow;
  elsif _org_schedule is not null and _org_schedule ? _dow then
    _day := _org_schedule -> _dow;
  else
    _day := null;
  end if;

  if _day is null
     or _day->>'start' is null
     or _day->>'end' is null
  then
    return query select null::time, null::time, false;
  else
    return query select
      (_day->>'start')::time,
      (_day->>'end')::time,
      true;
  end if;
end;
$$;

grant execute on function public.get_effective_shift(uuid, date) to authenticated;
grant execute on function public.get_effective_shift(uuid, date) to service_role;


-- ------------------------------------------------------------
-- 3. Rewrite: recalculate_attendance_daily_summary
-- ------------------------------------------------------------

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
  _shift_start time;
  _shift_end time;
  _is_working_day boolean;
  _has_shift boolean;
  _min_required int;
  _has_leave boolean;
  _first_check_in time;
  _last_check_out time;
  _total_work int;
  _total_overtime int;
  _session_count int;
  _has_non_ot_present boolean;
  _has_non_ot_late boolean;
  _has_overtime boolean;
  _effective_status text;
  _is_incomplete_shift boolean;
begin
  _org_id := (
    select s.org_id
    from public.attendance_sessions s
    where s.user_id = p_user_id
      and s.date = p_date
    order by s.created_at asc
    limit 1
  );

  if _org_id is null then
    _org_id := (
      select p.org_id
      from public.profiles p
      where p.id = p_user_id
    );
  end if;

  select es.start_time, es.end_time, es.is_working_day
    into _shift_start, _shift_end, _is_working_day
  from public.get_effective_shift(p_user_id, p_date) es;

  _has_shift := _is_working_day;

  select ap.minimum_required_minutes
    into _min_required
  from public.attendance_policy ap
  where ap.org_id = _org_id
  limit 1;

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
    count(*),
    bool_or(s.is_overtime)
  into
    _first_check_in,
    _last_check_out,
    _total_work,
    _total_overtime,
    _session_count,
    _has_overtime
  from public.attendance_sessions s
  where s.user_id = p_user_id
    and s.date = p_date;

  _has_overtime := coalesce(_has_overtime, false);

  _has_non_ot_present := exists (
    select 1
    from public.attendance_sessions s
    where s.user_id = p_user_id
      and s.date = p_date
      and s.is_overtime = false
      and s.status = 'present'
  );

  _has_non_ot_late := exists (
    select 1
    from public.attendance_sessions s
    where s.user_id = p_user_id
      and s.date = p_date
      and s.is_overtime = false
      and s.status = 'late'
  );

  if _has_leave then
    _effective_status := 'on_leave';
  elsif not _has_shift then
    _effective_status := null;
  elsif not _is_working_day then
    _effective_status := null;
  elsif _session_count = 0 then
    _effective_status := 'absent';
  elsif _has_non_ot_late and not _has_non_ot_present then
    _effective_status := 'late';
  elsif _has_non_ot_present then
    _effective_status := 'present';
  elsif _has_overtime then
    _effective_status := 'absent';
  else
    _effective_status := null;
  end if;

  _is_incomplete_shift := (
    _effective_status in ('present', 'late')
    and _min_required is not null
    and _total_work < _min_required
  );

  if _session_count = 0 and _effective_status is null then
    delete from public.attendance_daily_summary ds
    where ds.user_id = p_user_id
      and ds.date = p_date;

    return;
  end if;

  insert into public.attendance_daily_summary (
    org_id,
    user_id,
    date,
    first_check_in,
    last_check_out,
    total_work_minutes,
    total_overtime_minutes,
    effective_status,
    is_incomplete_shift,
    has_overtime,
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
    _is_incomplete_shift,
    _has_overtime,
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
    is_incomplete_shift = excluded.is_incomplete_shift,
    has_overtime = excluded.has_overtime,
    session_count = excluded.session_count,
    updated_at = now();
end;
$$;

grant execute on function public.recalculate_attendance_daily_summary(uuid, date) to authenticated;
grant execute on function public.recalculate_attendance_daily_summary(uuid, date) to service_role;


-- ------------------------------------------------------------
-- 4. Rewrite: count_leave_request_working_days
-- ------------------------------------------------------------

create or replace function public.count_leave_request_working_days(
  p_user_id uuid,
  p_org_id uuid,
  p_from_date date,
  p_to_date date
)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _user_schedule jsonb;
  _org_schedule jsonb;
  _days int;
begin
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then
    return 0;
  end if;

  select p.work_schedule
    into _user_schedule
  from public.profiles p
  where p.id = p_user_id;

  select ap.work_schedule
    into _org_schedule
  from public.attendance_policy ap
  where ap.org_id = p_org_id;

  select count(*)::int
    into _days
  from generate_series(p_from_date::timestamp, p_to_date::timestamp, interval '1 day') as gs(day)
  where
    case
      when _user_schedule is not null
        and _user_schedule ? (extract(dow from gs.day)::int::text)
        then true
      when _org_schedule is not null
        and _org_schedule ? (extract(dow from gs.day)::int::text)
        then true
      else false
    end;

  return coalesce(_days, 0);
end;
$$;


-- ------------------------------------------------------------
-- 5. Rewrite: get_team_attendance_day
--    Uses get_effective_shift per row instead of reading scalar columns.
-- ------------------------------------------------------------

drop function if exists public.get_team_attendance_day(date, uuid);
drop function if exists public.get_team_attendance_day(date, uuid, boolean);

create function public.get_team_attendance_day(
  p_date date,
  p_department_id uuid default null,
  p_include_all_profiles boolean default false
)
returns table (
  user_id uuid,
  name_ar text,
  employee_id text,
  role text,
  avatar_url text,
  department_id uuid,
  department_name_ar text,
  date date,
  effective_status text,
  display_status text,
  team_live_state text,
  team_date_state text,
  first_check_in time,
  last_check_out time,
  total_work_minutes int,
  total_overtime_minutes int,
  has_overtime boolean,
  session_count int,
  is_checked_in_now boolean,
  has_auto_punch_out boolean,
  needs_review boolean,
  is_incomplete_shift boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  _role text;
  _org_id uuid;
  _current_department uuid;
  _today date := ((now() at time zone 'UTC') + interval '3 hours')::date;
  _now_time time := (((now() at time zone 'UTC') + interval '3 hours')::time);
begin
  _role := public.current_user_role();
  _org_id := public.current_user_org_id();
  _current_department := public.current_user_department();

  if auth.uid() is null or _org_id is null or _role not in ('admin', 'manager') then
    raise exception 'Not authorized';
  end if;

  if _role = 'manager' then
    if _current_department is null then
      raise exception 'Manager department is not assigned';
    end if;

    if p_department_id is null then
      p_department_id := _current_department;
    elsif p_department_id <> _current_department then
      raise exception 'Not authorized';
    end if;
  elsif p_department_id is not null and not exists (
    select 1
    from public.departments d
    where d.id = p_department_id
      and d.org_id = _org_id
  ) then
    raise exception 'Department not found';
  end if;

  return query
  with scoped_profiles as (
    select
      p.id as user_id,
      p.name_ar,
      p.employee_id,
      p.role,
      p.avatar_url,
      p.department_id,
      d.name_ar as department_name_ar,
      p.join_date
    from public.profiles p
    left join public.departments d
      on d.id = p.department_id
    where p.org_id = _org_id
      and p.role <> 'admin'
      and p.join_date <= p_date
      and (p_department_id is null or p.department_id = p_department_id)
  ),
  shifts as (
    select
      sp.user_id,
      es.start_time as shift_start,
      es.end_time as shift_end,
      es.is_working_day
    from scoped_profiles sp
    cross join lateral public.get_effective_shift(sp.user_id, p_date) es
  ),
  session_stats as (
    select
      s.user_id,
      min(s.check_in_time) as first_check_in,
      max(s.check_out_time) as last_check_out,
      coalesce(sum(s.duration_minutes), 0)::int as total_work_minutes,
      coalesce(sum(case when s.is_overtime then s.duration_minutes else 0 end), 0)::int as total_overtime_minutes,
      count(*)::int as session_count,
      bool_or(s.check_out_time is null) as has_open_session,
      bool_or(s.is_auto_punch_out) as has_auto_punch_out,
      bool_or(s.needs_review) as needs_review,
      bool_or(not s.is_overtime) as has_non_ot_session,
      bool_or(not s.is_overtime and s.status = 'present') as has_non_ot_present,
      bool_or(not s.is_overtime and s.status = 'late') as has_non_ot_late,
      bool_or(s.is_overtime) as has_overtime
    from public.attendance_sessions s
    where s.org_id = _org_id
      and s.date = p_date
      and s.user_id in (select sp.user_id from scoped_profiles sp)
    group by s.user_id
  ),
  leave_stats as (
    select distinct lr.user_id
    from public.leave_requests lr
    where lr.org_id = _org_id
      and lr.status = 'approved'
      and lr.type <> 'overtime'
      and lr.from_date_time <= (p_date::text || 'T23:59:59')::timestamptz
      and lr.to_date_time >= (p_date::text || 'T00:00:00')::timestamptz
      and lr.user_id in (select sp.user_id from scoped_profiles sp)
  ),
  summary_rows as (
    select
      ds.user_id,
      ds.first_check_in,
      ds.last_check_out,
      ds.total_work_minutes,
      ds.total_overtime_minutes,
      ds.effective_status,
      ds.is_incomplete_shift,
      ds.has_overtime,
      ds.session_count
    from public.attendance_daily_summary ds
    where ds.org_id = _org_id
      and ds.date = p_date
      and ds.user_id in (select sp.user_id from scoped_profiles sp)
  ),
  normalized as (
    select
      sp.user_id,
      sp.name_ar,
      sp.employee_id,
      sp.role,
      sp.avatar_url,
      sp.department_id,
      sp.department_name_ar,
      p_date as date,
      sh.is_working_day as has_shift,
      sh.is_working_day,
      sh.shift_end as work_end_time,
      coalesce(sr.first_check_in, ss.first_check_in) as first_check_in,
      coalesce(sr.last_check_out, ss.last_check_out) as last_check_out,
      coalesce(sr.total_work_minutes, ss.total_work_minutes, 0)::int as total_work_minutes,
      coalesce(sr.total_overtime_minutes, ss.total_overtime_minutes, 0)::int as total_overtime_minutes,
      coalesce(sr.session_count, ss.session_count, 0)::int as session_count,
      coalesce(ss.has_open_session, false) and p_date = _today as is_checked_in_now,
      coalesce(ss.has_auto_punch_out, false) as has_auto_punch_out,
      coalesce(ss.needs_review, false) as needs_review,
      coalesce(sr.is_incomplete_shift, false) as is_incomplete_shift,
      sr.effective_status as stored_effective_status,
      (ls.user_id is not null) as has_leave,
      coalesce(ss.has_non_ot_session, false) as has_non_ot_session,
      coalesce(ss.has_non_ot_present, false) as has_non_ot_present,
      coalesce(ss.has_non_ot_late, false) as has_non_ot_late,
      coalesce(sr.has_overtime, ss.has_overtime, false) as has_overtime
    from scoped_profiles sp
    join shifts sh on sh.user_id = sp.user_id
    left join summary_rows sr on sr.user_id = sp.user_id
    left join session_stats ss on ss.user_id = sp.user_id
    left join leave_stats ls on ls.user_id = sp.user_id
  ),
  resolved as (
    select
      n.*,
      case
        when n.stored_effective_status is not null then n.stored_effective_status
        when n.has_leave then 'on_leave'
        when not n.has_shift then null
        when not n.is_working_day then null
        when n.session_count = 0 then 'absent'
        when n.has_non_ot_late and not n.has_non_ot_present then 'late'
        when n.has_non_ot_present then 'present'
        when n.has_overtime then 'absent'
        else null
      end as effective_status
    from normalized n
  ),
  date_states as (
    select
      r.*,
      public.resolve_team_attendance_date_state(
        r.effective_status,
        r.is_incomplete_shift,
        r.has_shift,
        r.is_working_day,
        r.has_leave
      ) as team_date_state
    from resolved r
  ),
  live_states as (
    select
      d.*,
      public.resolve_team_attendance_live_state(
        d.date,
        _today,
        _now_time,
        d.work_end_time,
        d.has_shift,
        d.is_working_day,
        d.has_leave,
        d.is_checked_in_now,
        d.session_count,
        d.has_non_ot_session,
        d.team_date_state,
        d.is_incomplete_shift
      ) as team_live_state
    from date_states d
  )
  select
    s.user_id,
    s.name_ar,
    s.employee_id,
    s.role,
    s.avatar_url,
    s.department_id,
    s.department_name_ar,
    s.date,
    s.effective_status,
    s.team_date_state as display_status,
    s.team_live_state,
    s.team_date_state,
    s.first_check_in,
    s.last_check_out,
    s.total_work_minutes,
    s.total_overtime_minutes,
    s.has_overtime,
    s.session_count,
    s.is_checked_in_now,
    s.has_auto_punch_out,
    s.needs_review,
    s.is_incomplete_shift
  from live_states s
  where
    s.session_count > 0
    or s.effective_status is not null
    or p_include_all_profiles
  order by
    case
      when s.team_live_state = 'late' then 0
      when s.team_live_state is null then 1
      when s.team_live_state = 'on_break' then 2
      when s.team_live_state = 'fulfilled_shift' then 3
      when s.team_live_state = 'incomplete_shift' then 4
      when s.team_live_state = 'not_entered_yet' then 5
      when s.team_live_state = 'absent' then 6
      when s.team_live_state = 'on_leave' then 7
      else 8
    end,
    s.department_name_ar nulls last,
    s.name_ar;
end;
$$;

grant execute on function public.get_team_attendance_day(date, uuid, boolean) to authenticated;
grant execute on function public.get_team_attendance_day(date, uuid, boolean) to service_role;


-- ------------------------------------------------------------
-- 6. Rewrite: get_redacted_team_attendance_day
-- ------------------------------------------------------------

drop function if exists public.get_redacted_team_attendance_day(date, uuid);

create function public.get_redacted_team_attendance_day(
  p_date date,
  p_department_id uuid default null
)
returns table (
  user_id uuid,
  name_ar text,
  employee_id text,
  role text,
  avatar_url text,
  department_id uuid,
  department_name_ar text,
  date date,
  attendance_state text,
  team_date_state text,
  has_overtime boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  _org_id uuid;
begin
  _org_id := public.current_user_org_id();

  if auth.uid() is null or _org_id is null then
    raise exception 'Not authorized';
  end if;

  if p_department_id is not null and not exists (
    select 1
    from public.departments d
    where d.id = p_department_id
      and d.org_id = _org_id
  ) then
    raise exception 'Department not found';
  end if;

  return query
  with scoped_profiles as (
    select
      p.id as user_id,
      p.name_ar,
      p.employee_id,
      p.role,
      p.avatar_url,
      p.department_id,
      d.name_ar as department_name_ar,
      p.join_date
    from public.profiles p
    left join public.departments d
      on d.id = p.department_id
    where p.org_id = _org_id
      and p.role <> 'admin'
      and p.join_date <= p_date
      and (p_department_id is null or p.department_id = p_department_id)
  ),
  shifts as (
    select
      sp.user_id,
      es.is_working_day
    from scoped_profiles sp
    cross join lateral public.get_effective_shift(sp.user_id, p_date) es
  ),
  session_stats as (
    select
      s.user_id,
      count(*)::int as session_count,
      bool_or(not s.is_overtime and s.status = 'present') as has_non_ot_present,
      bool_or(not s.is_overtime and s.status = 'late') as has_non_ot_late,
      bool_or(s.is_overtime) as has_overtime
    from public.attendance_sessions s
    where s.org_id = _org_id
      and s.date = p_date
      and s.user_id in (select sp.user_id from scoped_profiles sp)
    group by s.user_id
  ),
  leave_stats as (
    select distinct lr.user_id
    from public.leave_requests lr
    where lr.org_id = _org_id
      and lr.status = 'approved'
      and lr.type <> 'overtime'
      and lr.from_date_time <= (p_date::text || 'T23:59:59')::timestamptz
      and lr.to_date_time >= (p_date::text || 'T00:00:00')::timestamptz
      and lr.user_id in (select sp.user_id from scoped_profiles sp)
  ),
  summary_rows as (
    select
      ds.user_id,
      ds.effective_status,
      ds.is_incomplete_shift,
      ds.session_count,
      ds.has_overtime
    from public.attendance_daily_summary ds
    where ds.org_id = _org_id
      and ds.date = p_date
      and ds.user_id in (select sp.user_id from scoped_profiles sp)
  ),
  normalized as (
    select
      sp.user_id,
      sp.name_ar,
      sp.employee_id,
      sp.role,
      sp.avatar_url,
      sp.department_id,
      sp.department_name_ar,
      sh.is_working_day as has_shift,
      sh.is_working_day,
      coalesce(sr.is_incomplete_shift, false) as is_incomplete_shift,
      coalesce(sr.session_count, ss.session_count, 0)::int as session_count,
      sr.effective_status as stored_effective_status,
      (ls.user_id is not null) as has_leave,
      coalesce(ss.has_non_ot_present, false) as has_non_ot_present,
      coalesce(ss.has_non_ot_late, false) as has_non_ot_late,
      coalesce(sr.has_overtime, ss.has_overtime, false) as has_overtime
    from scoped_profiles sp
    join shifts sh on sh.user_id = sp.user_id
    left join summary_rows sr on sr.user_id = sp.user_id
    left join session_stats ss on ss.user_id = sp.user_id
    left join leave_stats ls on ls.user_id = sp.user_id
  ),
  resolved as (
    select
      n.*,
      case
        when n.stored_effective_status is not null then n.stored_effective_status
        when n.has_leave then 'on_leave'
        when not n.has_shift then null
        when not n.is_working_day then null
        when n.session_count = 0 then 'absent'
        when n.has_non_ot_late and not n.has_non_ot_present then 'late'
        when n.has_non_ot_present then 'present'
        when n.has_overtime then 'absent'
        else null
      end as effective_status
    from normalized n
  ),
  states as (
    select
      r.user_id,
      r.name_ar,
      r.employee_id,
      r.role,
      r.avatar_url,
      r.department_id,
      r.department_name_ar,
      public.resolve_team_attendance_date_state(
        r.effective_status,
        r.is_incomplete_shift,
        r.has_shift,
        r.is_working_day,
        r.has_leave
      ) as team_date_state,
      r.has_overtime
    from resolved r
  )
  select
    s.user_id,
    s.name_ar,
    s.employee_id,
    s.role,
    s.avatar_url,
    s.department_id,
    s.department_name_ar,
    p_date as date,
    case
      when s.team_date_state in ('fulfilled_shift', 'incomplete_shift', 'late') then 'present_on_date'
      else 'not_present_on_date'
    end as attendance_state,
    s.team_date_state,
    s.has_overtime
  from states s
  order by
    case
      when s.team_date_state in ('fulfilled_shift', 'incomplete_shift', 'late') then 0
      else 1
    end,
    s.department_name_ar nulls last,
    s.name_ar;
end;
$$;

grant execute on function public.get_redacted_team_attendance_day(date, uuid) to authenticated;
grant execute on function public.get_redacted_team_attendance_day(date, uuid) to service_role;


-- ------------------------------------------------------------
-- 7. Rewrite: get_redacted_department_availability
-- ------------------------------------------------------------

create or replace function public.get_redacted_department_availability(
  p_department_id uuid default null
)
returns table (
  user_id uuid,
  name_ar text,
  employee_id text,
  role text,
  avatar_url text,
  department_id uuid,
  department_name_ar text,
  availability_state text,
  team_live_state text,
  has_overtime boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  _org_id uuid;
  _today date := ((now() at time zone 'UTC') + interval '3 hours')::date;
  _now_time time := (((now() at time zone 'UTC') + interval '3 hours')::time);
begin
  _org_id := public.current_user_org_id();

  if auth.uid() is null or _org_id is null then
    raise exception 'Not authorized';
  end if;

  if p_department_id is not null and not exists (
    select 1
    from public.departments d
    where d.id = p_department_id
      and d.org_id = _org_id
  ) then
    raise exception 'Department not found';
  end if;

  return query
  with scoped_profiles as (
    select
      p.id as user_id,
      p.name_ar,
      p.employee_id,
      p.role,
      p.avatar_url,
      p.department_id,
      d.name_ar as department_name_ar,
      p.join_date
    from public.profiles p
    left join public.departments d
      on d.id = p.department_id
    where p.org_id = _org_id
      and p.role <> 'admin'
      and p.join_date <= _today
      and (p_department_id is null or p.department_id = p_department_id)
  ),
  shifts as (
    select
      sp.user_id,
      es.start_time as shift_start,
      es.end_time as shift_end,
      es.is_working_day
    from scoped_profiles sp
    cross join lateral public.get_effective_shift(sp.user_id, _today) es
  ),
  session_stats as (
    select
      s.user_id,
      count(*)::int as session_count,
      bool_or(s.check_out_time is null) as has_open_session,
      bool_or(not s.is_overtime) as has_non_ot_session,
      bool_or(not s.is_overtime and s.status = 'present') as has_non_ot_present,
      bool_or(not s.is_overtime and s.status = 'late') as has_non_ot_late,
      bool_or(s.is_overtime) as has_overtime
    from public.attendance_sessions s
    where s.org_id = _org_id
      and s.date = _today
      and s.user_id in (select sp.user_id from scoped_profiles sp)
    group by s.user_id
  ),
  leave_stats as (
    select distinct lr.user_id
    from public.leave_requests lr
    where lr.org_id = _org_id
      and lr.status = 'approved'
      and lr.type <> 'overtime'
      and lr.from_date_time <= (_today::text || 'T23:59:59')::timestamptz
      and lr.to_date_time >= (_today::text || 'T00:00:00')::timestamptz
      and lr.user_id in (select sp.user_id from scoped_profiles sp)
  ),
  summary_rows as (
    select
      ds.user_id,
      ds.effective_status,
      ds.is_incomplete_shift,
      ds.session_count,
      ds.has_overtime
    from public.attendance_daily_summary ds
    where ds.org_id = _org_id
      and ds.date = _today
      and ds.user_id in (select sp.user_id from scoped_profiles sp)
  ),
  normalized as (
    select
      sp.user_id,
      sp.name_ar,
      sp.employee_id,
      sp.role,
      sp.avatar_url,
      sp.department_id,
      sp.department_name_ar,
      sh.is_working_day as has_shift,
      sh.is_working_day,
      sh.shift_end as work_end_time,
      coalesce(sr.is_incomplete_shift, false) as is_incomplete_shift,
      coalesce(sr.session_count, ss.session_count, 0)::int as session_count,
      coalesce(ss.has_open_session, false) as is_checked_in_now,
      sr.effective_status as stored_effective_status,
      (ls.user_id is not null) as has_leave,
      coalesce(ss.has_non_ot_session, false) as has_non_ot_session,
      coalesce(ss.has_non_ot_present, false) as has_non_ot_present,
      coalesce(ss.has_non_ot_late, false) as has_non_ot_late,
      coalesce(sr.has_overtime, ss.has_overtime, false) as has_overtime
    from scoped_profiles sp
    join shifts sh on sh.user_id = sp.user_id
    left join summary_rows sr on sr.user_id = sp.user_id
    left join session_stats ss on ss.user_id = sp.user_id
    left join leave_stats ls on ls.user_id = sp.user_id
  ),
  resolved as (
    select
      n.*,
      case
        when n.stored_effective_status is not null then n.stored_effective_status
        when n.has_leave then 'on_leave'
        when not n.has_shift then null
        when not n.is_working_day then null
        when n.session_count = 0 then 'absent'
        when n.has_non_ot_late and not n.has_non_ot_present then 'late'
        when n.has_non_ot_present then 'present'
        when n.has_overtime then 'absent'
        else null
      end as effective_status
    from normalized n
  ),
  states as (
    select
      r.user_id,
      r.name_ar,
      r.employee_id,
      r.role,
      r.avatar_url,
      r.department_id,
      r.department_name_ar,
      r.is_checked_in_now,
      r.has_overtime,
      public.resolve_team_attendance_date_state(
        r.effective_status,
        r.is_incomplete_shift,
        r.has_shift,
        r.is_working_day,
        r.has_leave
      ) as team_date_state,
      public.resolve_team_attendance_live_state(
        _today,
        _today,
        _now_time,
        r.work_end_time,
        r.has_shift,
        r.is_working_day,
        r.has_leave,
        r.is_checked_in_now,
        r.session_count,
        r.has_non_ot_session,
        public.resolve_team_attendance_date_state(
          r.effective_status,
          r.is_incomplete_shift,
          r.has_shift,
          r.is_working_day,
          r.has_leave
        ),
        r.is_incomplete_shift
      ) as team_live_state
    from resolved r
  )
  select
    s.user_id,
    s.name_ar,
    s.employee_id,
    s.role,
    s.avatar_url,
    s.department_id,
    s.department_name_ar,
    case
      when s.is_checked_in_now then 'available_now'
      else 'unavailable_now'
    end as availability_state,
    s.team_live_state,
    s.has_overtime
  from states s
  order by
    case when s.is_checked_in_now then 0 else 1 end,
    s.department_name_ar nulls last,
    s.name_ar;
end;
$$;

grant execute on function public.get_redacted_department_availability(uuid) to authenticated;
grant execute on function public.get_redacted_department_availability(uuid) to service_role;


-- ------------------------------------------------------------
-- 8. Backfill summary rows so cached values pick up any affected users.
-- ------------------------------------------------------------

do $$
declare
  _row record;
begin
  for _row in
    select distinct s.user_id, s.date
    from public.attendance_sessions s
  loop
    perform public.recalculate_attendance_daily_summary(_row.user_id, _row.date);
  end loop;
end;
$$;

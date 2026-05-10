-- Migration: team attendance RPCs read from timestamp columns
--
-- Phase 3.9 of the attendance_sessions timestamp migration. The team-attendance
-- RPCs were aggregating sessions by `s.date` and `min/max` over the HH:MM
-- `check_in_time` / `check_out_time` columns. That breaks for cross-midnight
-- sessions: `max('02:00')` over a day with sessions ending 17:00 and 02:00 (the
-- overnight one) returns '17:00' instead of the true latest checkout.
--
-- Changes:
--   * `first_check_in` / `last_check_out` derived from min/max of check_in_at /
--     check_out_at, then converted to Asia/Baghdad time-of-day for the same
--     return shape as before.
--   * `has_open_session` checks `check_out_at IS NULL` (matches new writers).
--   * Day filter uses `(s.check_in_at AT TIME ZONE 'Asia/Baghdad')::date = p_date`,
--     consistent with the writers' day-of-belonging rule.
--
-- Function signatures (parameters, return columns, ordering) are unchanged.
-- Body is otherwise identical to migration 32. Re-baselined via DROP+CREATE so
-- a clean replace of the function body works regardless of any in-place tweaks.

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
      ((min(s.check_in_at) at time zone 'Asia/Baghdad')::time) as first_check_in,
      ((max(s.check_out_at) at time zone 'Asia/Baghdad')::time) as last_check_out,
      coalesce(sum(s.duration_minutes), 0)::int as total_work_minutes,
      coalesce(sum(case when s.is_overtime then s.duration_minutes else 0 end), 0)::int as total_overtime_minutes,
      count(*)::int as session_count,
      bool_or(s.check_out_at is null) as has_open_session,
      bool_or(s.is_auto_punch_out) as has_auto_punch_out,
      bool_or(s.needs_review) as needs_review,
      bool_or(not s.is_overtime) as has_non_ot_session,
      bool_or(not s.is_overtime and s.status = 'present') as has_non_ot_present,
      bool_or(not s.is_overtime and s.status = 'late') as has_non_ot_late,
      bool_or(s.is_overtime) as has_overtime
    from public.attendance_sessions s
    where s.org_id = _org_id
      and (s.check_in_at at time zone 'Asia/Baghdad')::date = p_date
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
-- get_redacted_team_attendance_day: switch the day filter to timestamp-derived.
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
      and (s.check_in_at at time zone 'Asia/Baghdad')::date = p_date
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
-- get_redacted_department_availability: same updates — has_open_session reads
-- check_out_at, day filter is timestamp-derived.
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
      bool_or(s.check_out_at is null) as has_open_session,
      bool_or(not s.is_overtime) as has_non_ot_session,
      bool_or(not s.is_overtime and s.status = 'present') as has_non_ot_present,
      bool_or(not s.is_overtime and s.status = 'late') as has_non_ot_late,
      bool_or(s.is_overtime) as has_overtime
    from public.attendance_sessions s
    where s.org_id = _org_id
      and (s.check_in_at at time zone 'Asia/Baghdad')::date = _today
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

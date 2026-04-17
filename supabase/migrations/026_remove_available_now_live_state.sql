-- Migration: Remove available_now as a live state value
--
-- The `available_now` live state encoded two facts under one name: on-time
-- punctuality + open session (presence). These are now separate dimensions.
-- Presence is expressed via `is_checked_in_now`. The baseline case (on time,
-- checked in, nothing notable) returns NULL from the live state resolver,
-- meaning no exception chip is warranted.
--
-- See docs/System Day and Session states plan.md for the full design.

-- 1. Recreate resolve_team_attendance_live_state
--    Only change: `else 'available_now'` → `else null`

drop function if exists public.resolve_team_attendance_live_state(date, date, time, time, boolean, boolean, boolean, boolean, int, boolean, text, boolean);

create or replace function public.resolve_team_attendance_live_state(
  p_date date,
  p_today date,
  p_now_time time,
  p_work_end_time time,
  p_has_shift boolean,
  p_is_working_day boolean,
  p_has_leave boolean,
  p_is_checked_in_now boolean,
  p_session_count int,
  p_has_regular_session boolean,
  p_team_date_state text,
  p_is_incomplete_shift boolean
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_has_leave or p_team_date_state = 'on_leave' then 'on_leave'
    when not coalesce(p_has_shift, false) or not coalesce(p_is_working_day, false) then 'neutral'
    when coalesce(p_is_checked_in_now, false) then
      case
        when p_team_date_state = 'late' then 'late'
        else null  -- baseline: on time, checked in, nothing notable — no chip
      end
    when not coalesce(p_has_regular_session, false) then
      case
        when p_date < p_today then 'absent'
        when p_work_end_time is not null and p_now_time >= p_work_end_time then 'absent'
        else 'not_entered_yet'
      end
    when p_date = p_today and p_work_end_time is not null and p_now_time < p_work_end_time then
      case
        when p_team_date_state = 'late' then 'late'
        else 'on_break'
      end
    else
      case
        when p_team_date_state = 'late' then 'late'
        when coalesce(p_is_incomplete_shift, false) then 'incomplete_shift'
        when p_team_date_state = 'fulfilled_shift' then 'fulfilled_shift'
        else 'neutral'
      end
  end;
$$;

grant execute on function public.resolve_team_attendance_live_state(date, date, time, time, boolean, boolean, boolean, boolean, int, boolean, text, boolean) to authenticated;
grant execute on function public.resolve_team_attendance_live_state(date, date, time, time, boolean, boolean, boolean, boolean, int, boolean, text, boolean) to service_role;


-- 2. Recreate get_team_attendance_day
--    Only change: ORDER BY now handles NULL (baseline case) at sort position 1,
--    immediately after 'late' (position 0).

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
  _policy_weekly_off int[];
  _policy_start time;
  _policy_end time;
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

  select
    ap.weekly_off_days,
    ap.work_start_time,
    ap.work_end_time
  into
    _policy_weekly_off,
    _policy_start,
    _policy_end
  from public.attendance_policy ap
  where ap.org_id = _org_id
  limit 1;

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
      p.join_date,
      p.work_days,
      p.work_start_time,
      p.work_end_time,
      (
        p.work_days is not null
        and cardinality(p.work_days) > 0
        and p.work_start_time is not null
        and p.work_end_time is not null
      ) as has_custom_schedule
    from public.profiles p
    left join public.departments d
      on d.id = p.department_id
    where p.org_id = _org_id
      and p.role <> 'admin'
      and p.join_date <= p_date
      and (p_department_id is null or p.department_id = p_department_id)
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
      (
        (sp.has_custom_schedule and sp.work_end_time is not null)
        or
        (not sp.has_custom_schedule and _policy_start is not null and _policy_end is not null)
      ) as has_shift,
      case
        when sp.has_custom_schedule then extract(dow from p_date)::int = any(sp.work_days)
        when _policy_start is not null and _policy_end is not null then
          not (extract(dow from p_date)::int = any(coalesce(_policy_weekly_off, '{5,6}'::int[])))
        else false
      end as is_working_day,
      case
        when sp.has_custom_schedule then sp.work_end_time
        else _policy_end
      end as work_end_time,
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
    left join summary_rows sr
      on sr.user_id = sp.user_id
    left join session_stats ss
      on ss.user_id = sp.user_id
    left join leave_stats ls
      on ls.user_id = sp.user_id
  ),
  resolved as (
    select
      n.user_id,
      n.name_ar,
      n.employee_id,
      n.role,
      n.avatar_url,
      n.department_id,
      n.department_name_ar,
      n.date,
      n.has_shift,
      n.is_working_day,
      n.work_end_time,
      n.first_check_in,
      n.last_check_out,
      n.total_work_minutes,
      n.total_overtime_minutes,
      n.session_count,
      n.is_checked_in_now,
      n.has_auto_punch_out,
      n.needs_review,
      n.is_incomplete_shift,
      n.has_leave,
      n.has_non_ot_session,
      n.has_overtime,
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
      when s.team_live_state is null then 1       -- baseline: on time, checked in (no chip)
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

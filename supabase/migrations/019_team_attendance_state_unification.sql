-- ============================================================
-- Team attendance: derived live/date state unification
-- ============================================================

create or replace function public.resolve_team_attendance_date_state(
  p_effective_status text,
  p_is_short_day boolean,
  p_has_shift boolean,
  p_is_working_day boolean,
  p_has_leave boolean
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_has_leave or p_effective_status = 'on_leave' then
    return 'on_leave';
  end if;

  if not coalesce(p_has_shift, false) then
    return 'neutral';
  end if;

  if not coalesce(p_is_working_day, false) then
    return 'neutral';
  end if;

  if p_effective_status = 'late' then
    return 'late';
  end if;

  if p_effective_status = 'present' then
    if coalesce(p_is_short_day, false) then
      return 'incomplete_shift';
    end if;
    return 'fulfilled_shift';
  end if;

  if p_effective_status in ('absent', 'overtime_only') then
    return 'absent';
  end if;

  return 'neutral';
end;
$$;

grant execute on function public.resolve_team_attendance_date_state(text, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.resolve_team_attendance_date_state(text, boolean, boolean, boolean, boolean) to service_role;

drop function if exists public.resolve_team_attendance_live_state(date, date, time, time, boolean, boolean, boolean, boolean, int, text);
drop function if exists public.resolve_team_attendance_live_state(date, date, time, time, boolean, boolean, boolean, boolean, int, boolean, text);

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
  p_team_date_state text
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_has_leave or p_team_date_state = 'on_leave' then
    return 'on_leave';
  end if;

  if coalesce(p_is_checked_in_now, false) then
    if p_team_date_state = 'late' then
      return 'late';
    end if;
    return 'available_now';
  end if;

  if not coalesce(p_has_shift, false) then
    return 'neutral';
  end if;

  if not coalesce(p_is_working_day, false) then
    return 'neutral';
  end if;

  if not coalesce(p_has_regular_session, false) then
    if p_date < p_today then
      return 'absent';
    end if;

    if p_work_end_time is not null and p_now_time >= p_work_end_time then
      return 'absent';
    end if;

    return 'not_entered_yet';
  end if;

  if p_team_date_state = 'fulfilled_shift' then
    return 'fulfilled_shift';
  end if;

  return 'neutral';
end;
$$;

grant execute on function public.resolve_team_attendance_live_state(date, date, time, time, boolean, boolean, boolean, boolean, int, boolean, text) to authenticated;
grant execute on function public.resolve_team_attendance_live_state(date, date, time, time, boolean, boolean, boolean, boolean, int, boolean, text) to service_role;

drop function if exists public.get_redacted_department_availability(uuid);

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
  _policy_weekly_off int[];
  _policy_start time;
  _policy_end time;
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
      and p.join_date <= _today
      and (p_department_id is null or p.department_id = p_department_id)
  ),
  session_stats as (
    select
      s.user_id,
      count(*)::int as session_count,
      bool_or(s.check_out_time is null) as has_open_session,
      coalesce(sum(case when s.is_overtime then s.duration_minutes else 0 end), 0)::int as total_overtime_minutes,
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
      ds.is_short_day,
      ds.session_count,
      ds.total_overtime_minutes
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
      (
        (sp.has_custom_schedule and sp.work_end_time is not null)
        or
        (not sp.has_custom_schedule and _policy_start is not null and _policy_end is not null)
      ) as has_shift,
      case
        when sp.has_custom_schedule then extract(dow from _today)::int = any(sp.work_days)
        when _policy_start is not null and _policy_end is not null then
          not (extract(dow from _today)::int = any(coalesce(_policy_weekly_off, '{5,6}'::int[])))
        else false
      end as is_working_day,
      case
        when sp.has_custom_schedule then sp.work_end_time
        else _policy_end
      end as work_end_time,
      coalesce(sr.is_short_day, false) as is_short_day,
      coalesce(sr.session_count, ss.session_count, 0)::int as session_count,
      coalesce(ss.has_open_session, false) as is_checked_in_now,
      coalesce(sr.total_overtime_minutes, ss.total_overtime_minutes, 0)::int as total_overtime_minutes,
      sr.effective_status as stored_effective_status,
      (ls.user_id is not null) as has_leave,
      coalesce(ss.has_non_ot_session, false) as has_non_ot_session,
      coalesce(ss.has_non_ot_present, false) as has_non_ot_present,
      coalesce(ss.has_non_ot_late, false) as has_non_ot_late,
      coalesce(ss.has_overtime, false) as has_overtime
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
      n.has_shift,
      n.is_working_day,
      n.work_end_time,
      n.session_count,
      n.is_checked_in_now,
      n.is_short_day,
      n.total_overtime_minutes,
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
        when n.has_overtime then 'overtime_only'
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
        r.is_short_day,
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
          r.is_short_day,
          r.has_shift,
          r.is_working_day,
          r.has_leave
        )
      ) as team_live_state,
      (r.has_overtime or r.total_overtime_minutes > 0) as has_overtime
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
      when s.team_live_state in ('available_now', 'late') then 'available_now'
      else 'unavailable_now'
    end as availability_state,
    s.team_live_state,
    s.has_overtime
  from states s
  order by
    case when s.team_live_state in ('available_now', 'late') then 0 else 1 end,
    s.department_name_ar nulls last,
    s.name_ar;
end;
$$;

grant execute on function public.get_redacted_department_availability(uuid) to authenticated;
grant execute on function public.get_redacted_department_availability(uuid) to service_role;

drop function if exists public.get_team_attendance_day(date, uuid);
drop function if exists public.get_team_attendance_day(date, uuid, boolean);

create or replace function public.get_team_attendance_day(
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
  is_short_day boolean
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
      ds.is_short_day,
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
      coalesce(sr.is_short_day, false) as is_short_day,
      sr.effective_status as stored_effective_status,
      (ls.user_id is not null) as has_leave,
      coalesce(ss.has_non_ot_session, false) as has_non_ot_session,
      coalesce(ss.has_non_ot_present, false) as has_non_ot_present,
      coalesce(ss.has_non_ot_late, false) as has_non_ot_late,
      coalesce(ss.has_overtime, false) as has_overtime
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
      n.is_short_day,
      n.has_leave,
      n.has_non_ot_session,
      n.has_overtime,
      case
        when n.stored_effective_status is not null then n.stored_effective_status
        when n.has_leave then 'on_leave'
        when not n.has_shift then null
        when not n.is_working_day and n.session_count > 0 then null
        when not n.is_working_day then null
        when n.session_count = 0 then 'absent'
        when n.has_non_ot_late and not n.has_non_ot_present then 'late'
        when n.has_non_ot_present then 'present'
        when n.has_overtime then 'overtime_only'
        else null
      end as effective_status,
      case
        when n.stored_effective_status is not null then n.stored_effective_status
        when n.has_leave then 'on_leave'
        when not n.is_working_day and n.session_count > 0 then 'overtime_offday'
        when not n.has_shift then null
        when not n.is_working_day then null
        when n.session_count = 0 then 'absent'
        when n.has_non_ot_late and not n.has_non_ot_present then 'late'
        when n.has_non_ot_present then 'present'
        when n.has_overtime then 'overtime_only'
        else null
      end as display_status
    from normalized n
  ),
  states as (
    select
      r.*,
      public.resolve_team_attendance_date_state(
        r.effective_status,
        r.is_short_day,
        r.has_shift,
        r.is_working_day,
        r.has_leave
      ) as team_date_state
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
    s.date,
    s.effective_status,
    s.display_status,
    public.resolve_team_attendance_live_state(
      s.date,
      _today,
      _now_time,
      s.work_end_time,
      s.has_shift,
      s.is_working_day,
      s.has_leave,
      s.is_checked_in_now,
      s.session_count,
      s.has_non_ot_session,
      s.team_date_state
    ) as team_live_state,
    s.team_date_state,
    s.first_check_in,
    s.last_check_out,
    s.total_work_minutes,
    s.total_overtime_minutes,
    (s.has_overtime or s.total_overtime_minutes > 0) as has_overtime,
    s.session_count,
    s.is_checked_in_now,
    s.has_auto_punch_out,
    s.needs_review,
    s.is_short_day
  from states s
  where
    s.session_count > 0
    or s.effective_status is not null
    or p_include_all_profiles
  order by
    case
      when public.resolve_team_attendance_live_state(
        s.date,
        _today,
        _now_time,
        s.work_end_time,
        s.has_shift,
        s.is_working_day,
        s.has_leave,
        s.is_checked_in_now,
        s.session_count,
        s.has_non_ot_session,
        s.team_date_state
      ) = 'late' then 0
      when public.resolve_team_attendance_live_state(
        s.date,
        _today,
        _now_time,
        s.work_end_time,
        s.has_shift,
        s.is_working_day,
        s.has_leave,
        s.is_checked_in_now,
        s.session_count,
        s.has_non_ot_session,
        s.team_date_state
      ) = 'available_now' then 1
      when public.resolve_team_attendance_live_state(
        s.date,
        _today,
        _now_time,
        s.work_end_time,
        s.has_shift,
        s.is_working_day,
        s.has_leave,
        s.is_checked_in_now,
        s.session_count,
        s.has_non_ot_session,
        s.team_date_state
      ) = 'fulfilled_shift' then 2
      when public.resolve_team_attendance_live_state(
        s.date,
        _today,
        _now_time,
        s.work_end_time,
        s.has_shift,
        s.is_working_day,
        s.has_leave,
        s.is_checked_in_now,
        s.session_count,
        s.has_non_ot_session,
        s.team_date_state
      ) = 'not_entered_yet' then 3
      when public.resolve_team_attendance_live_state(
        s.date,
        _today,
        _now_time,
        s.work_end_time,
        s.has_shift,
        s.is_working_day,
        s.has_leave,
        s.is_checked_in_now,
        s.session_count,
        s.has_non_ot_session,
        s.team_date_state
      ) = 'absent' then 4
      when public.resolve_team_attendance_live_state(
        s.date,
        _today,
        _now_time,
        s.work_end_time,
        s.has_shift,
        s.is_working_day,
        s.has_leave,
        s.is_checked_in_now,
        s.session_count,
        s.has_non_ot_session,
        s.team_date_state
      ) = 'on_leave' then 5
      else 6
    end,
    s.department_name_ar nulls last,
    s.name_ar;
end;
$$;

grant execute on function public.get_team_attendance_day(date, uuid, boolean) to authenticated;
grant execute on function public.get_team_attendance_day(date, uuid, boolean) to service_role;

drop function if exists public.get_redacted_team_attendance_day(date, uuid);

create or replace function public.get_redacted_team_attendance_day(
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
  _policy_weekly_off int[];
  _policy_start time;
  _policy_end time;
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
      count(*)::int as session_count,
      coalesce(sum(case when s.is_overtime then s.duration_minutes else 0 end), 0)::int as total_overtime_minutes,
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
      ds.is_short_day,
      ds.session_count,
      ds.total_overtime_minutes
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
      coalesce(sr.is_short_day, false) as is_short_day,
      coalesce(sr.session_count, ss.session_count, 0)::int as session_count,
      coalesce(sr.total_overtime_minutes, ss.total_overtime_minutes, 0)::int as total_overtime_minutes,
      sr.effective_status as stored_effective_status,
      (ls.user_id is not null) as has_leave,
      coalesce(ss.has_non_ot_present, false) as has_non_ot_present,
      coalesce(ss.has_non_ot_late, false) as has_non_ot_late,
      coalesce(ss.has_overtime, false) as has_overtime
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
      n.has_shift,
      n.is_working_day,
      n.is_short_day,
      n.session_count,
      n.total_overtime_minutes,
      n.has_leave,
      n.has_overtime,
      case
        when n.stored_effective_status is not null then n.stored_effective_status
        when n.has_leave then 'on_leave'
        when not n.has_shift then null
        when not n.is_working_day then null
        when n.session_count = 0 then 'absent'
        when n.has_non_ot_late and not n.has_non_ot_present then 'late'
        when n.has_non_ot_present then 'present'
        when n.has_overtime then 'overtime_only'
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
        r.is_short_day,
        r.has_shift,
        r.is_working_day,
        r.has_leave
      ) as team_date_state,
      (r.has_overtime or r.total_overtime_minutes > 0) as has_overtime
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

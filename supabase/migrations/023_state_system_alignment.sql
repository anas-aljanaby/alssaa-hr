-- ============================================================
-- Attendance state system alignment
-- ============================================================

alter table public.attendance_daily_summary
  add column if not exists has_overtime boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_daily_summary'
      and column_name = 'is_short_day'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_daily_summary'
      and column_name = 'is_incomplete_shift'
  ) then
    alter table public.attendance_daily_summary
      rename column is_short_day to is_incomplete_shift;
  end if;
end;
$$;

update public.attendance_daily_summary
set effective_status = 'absent',
    has_overtime = true
where effective_status = 'overtime_only';

update public.attendance_daily_summary ads
set has_overtime = ads.has_overtime or exists (
  select 1
  from public.attendance_sessions s
  where s.user_id = ads.user_id
    and s.date = ads.date
    and s.is_overtime = true
);

update public.attendance_daily_summary
set is_incomplete_shift = false
where effective_status not in ('present', 'late')
   or effective_status is null;

delete from public.attendance_daily_summary
where effective_status is null
  and session_count = 0
  and total_work_minutes = 0
  and total_overtime_minutes = 0
  and first_check_in is null
  and last_check_out is null;

alter table public.attendance_daily_summary
  drop constraint if exists attendance_daily_summary_effective_status_check;

alter table public.attendance_daily_summary
  add constraint attendance_daily_summary_effective_status_check
  check (effective_status in ('present', 'late', 'absent', 'on_leave'));

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
    _is_working_day := false;
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

create or replace function public.resolve_team_attendance_date_state(
  p_effective_status text,
  p_is_incomplete_shift boolean,
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
    if coalesce(p_is_incomplete_shift, false) then
      return 'incomplete_shift';
    end if;
    return 'fulfilled_shift';
  end if;

  if p_effective_status = 'absent' then
    return 'absent';
  end if;

  return 'neutral';
end;
$$;

grant execute on function public.resolve_team_attendance_date_state(text, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.resolve_team_attendance_date_state(text, boolean, boolean, boolean, boolean) to service_role;

drop function if exists public.resolve_team_attendance_live_state(date, date, time, time, boolean, boolean, boolean, boolean, int, text);
drop function if exists public.resolve_team_attendance_live_state(date, date, time, time, boolean, boolean, boolean, boolean, int, boolean, text);
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
        else 'available_now'
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
    case s.team_live_state
      when 'late' then 0
      when 'available_now' then 1
      when 'on_break' then 2
      when 'fulfilled_shift' then 3
      when 'incomplete_shift' then 4
      when 'not_entered_yet' then 5
      when 'absent' then 6
      when 'on_leave' then 7
      else 8
    end,
    s.department_name_ar nulls last,
    s.name_ar;
end;
$$;

grant execute on function public.get_team_attendance_day(date, uuid, boolean) to authenticated;
grant execute on function public.get_team_attendance_day(date, uuid, boolean) to service_role;

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
      coalesce(sr.is_incomplete_shift, false) as is_incomplete_shift,
      coalesce(sr.session_count, ss.session_count, 0)::int as session_count,
      sr.effective_status as stored_effective_status,
      (ls.user_id is not null) as has_leave,
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
      n.has_shift,
      n.is_working_day,
      n.is_incomplete_shift,
      n.session_count,
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

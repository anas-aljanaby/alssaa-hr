-- ============================================================
-- Team attendance: redacted live availability + detailed day rows
-- ============================================================

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
  availability_state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  _org_id uuid;
  _today date := ((now() at time zone 'UTC') + interval '3 hours')::date;
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
  with open_sessions as (
    select s.user_id
    from public.attendance_sessions s
    where s.org_id = _org_id
      and s.date = _today
      and s.check_out_time is null
    group by s.user_id
  )
  select
    p.id as user_id,
    p.name_ar,
    p.employee_id,
    p.role,
    p.avatar_url,
    p.department_id,
    d.name_ar as department_name_ar,
    case
      when os.user_id is not null then 'available_now'
      else 'unavailable_now'
    end as availability_state
  from public.profiles p
  left join public.departments d
    on d.id = p.department_id
  left join open_sessions os
    on os.user_id = p.id
  where p.org_id = _org_id
    and p.role <> 'admin'
    and p.join_date <= _today
    and (p_department_id is null or p.department_id = p_department_id)
  order by
    case when os.user_id is not null then 0 else 1 end,
    d.name_ar nulls last,
    p.name_ar;
end;
$$;

grant execute on function public.get_redacted_department_availability(uuid) to authenticated;
grant execute on function public.get_redacted_department_availability(uuid) to service_role;

create or replace function public.get_team_attendance_day(
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
  effective_status text,
  display_status text,
  first_check_in time,
  last_check_out time,
  total_work_minutes int,
  total_overtime_minutes int,
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
      case
        when sp.has_custom_schedule then extract(dow from p_date)::int = any(sp.work_days)
        when _policy_start is not null and _policy_end is not null then
          not (extract(dow from p_date)::int = any(coalesce(_policy_weekly_off, '{5,6}'::int[])))
        else true
      end as is_working_day,
      case
        when sr.first_check_in is not null or ss.first_check_in is not null then coalesce(sr.first_check_in, ss.first_check_in)
        else null
      end as first_check_in,
      case
        when sr.last_check_out is not null or ss.last_check_out is not null then coalesce(sr.last_check_out, ss.last_check_out)
        else null
      end as last_check_out,
      coalesce(sr.total_work_minutes, ss.total_work_minutes, 0)::int as total_work_minutes,
      coalesce(sr.total_overtime_minutes, ss.total_overtime_minutes, 0)::int as total_overtime_minutes,
      coalesce(sr.session_count, ss.session_count, 0)::int as session_count,
      coalesce(ss.has_open_session, false) and p_date = _today as is_checked_in_now,
      coalesce(ss.has_auto_punch_out, false) as has_auto_punch_out,
      coalesce(ss.needs_review, false) as needs_review,
      coalesce(sr.is_short_day, false) as is_short_day,
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
      n.date,
      case
        when n.stored_effective_status is not null then n.stored_effective_status
        when n.has_leave then 'on_leave'
        when not n.is_working_day then null
        when n.session_count = 0 and p_date < _today then 'absent'
        when n.has_non_ot_late and not n.has_non_ot_present then 'late'
        when n.has_non_ot_present then 'present'
        when n.has_overtime then 'overtime_only'
        else null
      end as effective_status,
      case
        when n.stored_effective_status is not null then n.stored_effective_status
        when n.has_leave then 'on_leave'
        when not n.is_working_day and n.session_count > 0 then 'overtime_offday'
        when not n.is_working_day then null
        when n.session_count = 0 and p_date < _today then 'absent'
        when n.has_non_ot_late and not n.has_non_ot_present then 'late'
        when n.has_non_ot_present then 'present'
        when n.has_overtime then 'overtime_only'
        else null
      end as display_status,
      n.first_check_in,
      n.last_check_out,
      n.total_work_minutes,
      n.total_overtime_minutes,
      n.session_count,
      n.is_checked_in_now,
      n.has_auto_punch_out,
      n.needs_review,
      n.is_short_day,
      n.is_working_day
    from normalized n
  )
  select
    r.user_id,
    r.name_ar,
    r.employee_id,
    r.role,
    r.avatar_url,
    r.department_id,
    r.department_name_ar,
    r.date,
    r.effective_status,
    r.display_status,
    r.first_check_in,
    r.last_check_out,
    r.total_work_minutes,
    r.total_overtime_minutes,
    r.session_count,
    r.is_checked_in_now,
    r.has_auto_punch_out,
    r.needs_review,
    r.is_short_day
  from resolved r
  where
    r.session_count > 0
    or r.effective_status is not null
    or (p_date = _today and r.is_working_day)
  order by
    case when r.is_checked_in_now then 0 else 1 end,
    case
      when r.display_status = 'late' then 0
      when r.display_status = 'present' then 1
      when r.display_status = 'on_leave' then 2
      when r.display_status = 'absent' then 3
      when r.display_status = 'overtime_offday' then 4
      when r.display_status = 'overtime_only' then 5
      else 6
    end,
    r.department_name_ar nulls last,
    r.name_ar;
end;
$$;

grant execute on function public.get_team_attendance_day(date, uuid) to authenticated;
grant execute on function public.get_team_attendance_day(date, uuid) to service_role;

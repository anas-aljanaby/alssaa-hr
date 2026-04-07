-- ============================================================
-- Team attendance: redacted date-based board rows
-- ============================================================

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
  attendance_state text
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
      coalesce(sr.session_count, ss.session_count, 0)::int as session_count,
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
      n.is_working_day,
      n.session_count,
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
      end as display_status
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
    case
      when r.display_status in ('present', 'late', 'overtime_only', 'overtime_offday') then 'present_on_date'
      else 'not_present_on_date'
    end as attendance_state
  from resolved r
  where
    r.session_count > 0
    or r.effective_status is not null
    or (p_date = _today and r.is_working_day)
  order by
    case
      when r.display_status in ('present', 'late', 'overtime_only', 'overtime_offday') then 0
      else 1
    end,
    r.department_name_ar nulls last,
    r.name_ar;
end;
$$;

grant execute on function public.get_redacted_team_attendance_day(date, uuid) to authenticated;
grant execute on function public.get_redacted_team_attendance_day(date, uuid) to service_role;

-- Punch via SQL RPC: check-in / check-out with optional dev override time.
-- Replaces the need for the punch Edge Function; call via supabase.rpc('punch', { ... }).
-- Uses auth.uid() for the caller. Optional p_dev_override_time (timestamptz) for dev/testing.

create or replace function public.punch(
  p_action text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_dev_override_time timestamptz default null
)
returns public.attendance_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _org_id uuid;
  _today date;
  _time_str text;
  _existing public.attendance_logs;
  _status text := 'present';
  _start_minutes int;
  _now_minutes int;
  _policy_start time;
  _policy_grace int;
  _is_dev boolean;
begin
  _uid := auth.uid();
  if _uid is null then
    raise exception 'UNAUTHORIZED: انتهت الجلسة أو لا تملك الصلاحية';
  end if;

  if p_action is null or p_action not in ('check_in', 'check_out') then
    raise exception 'INVALID_ACTION: action must be check_in or check_out';
  end if;

  _is_dev := (p_dev_override_time is not null);

  -- Effective timestamp: optional override for dev, else now
  _today := (coalesce(p_dev_override_time, current_timestamp))::date;
  _time_str := to_char(coalesce(p_dev_override_time, current_timestamp), 'HH24:MI');

  select org_id into _org_id from public.profiles where id = _uid;
  if _org_id is null then
    raise exception 'NO_PROFILE: لم يتم العثور على الملف الشخصي';
  end if;

  select * into _existing
  from public.attendance_logs
  where user_id = _uid and date = _today;

  if p_action = 'check_in' then
    if _existing.id is not null and _existing.check_in_time is not null then
      raise exception 'ALREADY_CHECKED_IN: Already checked in today';
    end if;

    -- Late vs present from policy
    select work_start_time, grace_period_minutes into _policy_start, _policy_grace
    from public.attendance_policy
    where org_id = _org_id
    limit 1;

    if found then
      _start_minutes := extract(hour from _policy_start)::int * 60 + extract(minute from _policy_start)::int + coalesce(_policy_grace, 0);
      _now_minutes := (split_part(_time_str, ':', 1)::int * 60) + split_part(_time_str, ':', 2)::int;
      if _now_minutes > _start_minutes then
        _status := 'late';
      end if;
    end if;

    if _existing.id is not null then
      update public.attendance_logs
      set
        check_in_time = _time_str::time,
        check_in_lat = p_lat,
        check_in_lng = p_lng,
        status = _status,
        is_dev = _is_dev
      where id = _existing.id
      returning * into _existing;
      return _existing;
    end if;

    insert into public.attendance_logs (
      org_id, user_id, date, check_in_time, check_in_lat, check_in_lng, status, is_dev
    )
    values (
      _org_id, _uid, _today, _time_str::time, p_lat, p_lng, _status, _is_dev
    )
    returning * into _existing;
    return _existing;
  end if;

  -- check_out
  if _existing.id is null or _existing.check_in_time is null then
    raise exception 'NO_CHECK_IN: Must check in before checking out';
  end if;
  if _existing.check_out_time is not null then
    raise exception 'ALREADY_CHECKED_OUT: Already checked out today';
  end if;

  update public.attendance_logs
  set
    check_out_time = _time_str::time,
    check_out_lat = p_lat,
    check_out_lng = p_lng,
    is_dev = _is_dev
  where id = _existing.id
  returning * into _existing;
  return _existing;
end;
$$;

comment on function public.punch(text, double precision, double precision, timestamptz) is
  'Check-in or check-out for the authenticated user. Optional lat/lng and dev_override_time for testing.';

grant execute on function public.punch(text, double precision, double precision, timestamptz) to authenticated;
grant execute on function public.punch(text, double precision, double precision, timestamptz) to service_role;

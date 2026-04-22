-- Fix: user work_schedule off-day fallback
--
-- Bug: when a user has a custom work_schedule that omits a day (their off day),
-- the old logic fell through to the org schedule for that day, incorrectly
-- marking it as a working day.
--
-- Fix: if the user has a non-empty work_schedule it is authoritative — a missing
-- day key means off day.  The org schedule is only consulted when the user has
-- no schedule at all (work_schedule = '{}').

-- ------------------------------------------------------------
-- 1. get_effective_shift
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

  -- User has a custom schedule: it is authoritative. A missing key is an off day.
  -- Only fall back to org when the user has no schedule at all (empty {}).
  if _user_schedule is not null and _user_schedule <> '{}'::jsonb then
    _day := _user_schedule -> _dow;
  elsif _org_schedule is not null then
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
-- 2. count_leave_request_working_days
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
      when _user_schedule is not null and _user_schedule <> '{}'::jsonb
        then _user_schedule ? (extract(dow from gs.day)::int::text)
      when _org_schedule is not null
        then _org_schedule ? (extract(dow from gs.day)::int::text)
      else false
    end;

  return coalesce(_days, 0);
end;
$$;

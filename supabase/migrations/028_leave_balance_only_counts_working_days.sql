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
  _work_days int[];
  _weekly_off_days int[];
  _days int;
begin
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then
    return 0;
  end if;

  select p.work_days
    into _work_days
  from public.profiles p
  where p.id = p_user_id;

  select ap.weekly_off_days
    into _weekly_off_days
  from public.attendance_policy ap
  where ap.org_id = p_org_id;

  if _work_days is null or cardinality(_work_days) = 0 then
    _work_days := array(
      select d
      from unnest(array[0, 1, 2, 3, 4, 5, 6]) as d
      where not (d = any(coalesce(_weekly_off_days, array[5, 6]::int[])))
    );
  end if;

  select count(*)::int
    into _days
  from generate_series(p_from_date::timestamp, p_to_date::timestamp, interval '1 day') as gs(day)
  where extract(dow from gs.day)::int = any(_work_days);

  return coalesce(_days, 0);
end;
$$;

create or replace function public.handle_request_approved()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  _days int;
begin
  if old.status = 'pending' and new.status = 'approved' then
    _days := public.count_leave_request_working_days(
      new.user_id,
      new.org_id,
      new.from_date_time::date,
      new.to_date_time::date
    );

    if new.type = 'annual_leave' then
      update public.leave_balances
         set used_annual = used_annual + _days,
             remaining_annual = greatest(remaining_annual - _days, 0)
       where org_id = new.org_id
         and user_id = new.user_id;
    elsif new.type = 'sick_leave' then
      update public.leave_balances
         set used_sick = used_sick + _days,
             remaining_sick = greatest(remaining_sick - _days, 0)
       where org_id = new.org_id
         and user_id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

with recalculated_usage as (
  select
    lb.id,
    coalesce((
      select sum(public.count_leave_request_working_days(
        lr.user_id,
        lr.org_id,
        lr.from_date_time::date,
        lr.to_date_time::date
      ))
      from public.leave_requests lr
      where lr.org_id = lb.org_id
        and lr.user_id = lb.user_id
        and lr.status = 'approved'
        and lr.type = 'annual_leave'
    ), 0) as used_annual,
    coalesce((
      select sum(public.count_leave_request_working_days(
        lr.user_id,
        lr.org_id,
        lr.from_date_time::date,
        lr.to_date_time::date
      ))
      from public.leave_requests lr
      where lr.org_id = lb.org_id
        and lr.user_id = lb.user_id
        and lr.status = 'approved'
        and lr.type = 'sick_leave'
    ), 0) as used_sick
  from public.leave_balances lb
)
update public.leave_balances lb
set used_annual = recalculated_usage.used_annual,
    used_sick = recalculated_usage.used_sick,
    remaining_annual = greatest(0, lb.total_annual - recalculated_usage.used_annual),
    remaining_sick = greatest(0, lb.total_sick - recalculated_usage.used_sick)
from recalculated_usage
where recalculated_usage.id = lb.id;

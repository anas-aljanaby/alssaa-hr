update public.leave_requests
set type = 'annual_leave'
where type not in ('annual_leave', 'hourly_permission', 'time_adjustment', 'overtime');

alter table public.leave_requests
  drop constraint if exists leave_requests_type_check;

alter table public.leave_requests
  add constraint leave_requests_type_check
  check (type in ('annual_leave', 'hourly_permission', 'time_adjustment', 'overtime'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _name    text;
  _name_ar text;
  _phone   text;
  _email   text;
  _role    text;
  _emp_id  text;
  _org_id  uuid;
  _dept_id uuid;
  _policy  record;
begin
  _name    := coalesce(new.raw_user_meta_data ->> 'name', '');
  _name_ar := coalesce(new.raw_user_meta_data ->> 'name_ar', _name);
  _phone   := coalesce(new.raw_user_meta_data ->> 'phone', '');
  _role    := coalesce(new.raw_user_meta_data ->> 'role', 'employee');
  _emp_id  := coalesce(
    new.raw_user_meta_data ->> 'employee_id',
    'EMP-' || substr(new.id::text, 1, 8)
  );
  _org_id  := coalesce(
    (new.raw_user_meta_data ->> 'org_id')::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid
  );
  _dept_id := (new.raw_user_meta_data ->> 'department_id')::uuid;
  _email   := nullif(btrim(new.email), '');

  insert into public.profiles (id, org_id, employee_id, name, name_ar, email, phone, role, department_id)
  values (new.id, _org_id, _emp_id, _name, _name_ar, _email, _phone, _role, _dept_id);

  select annual_leave_per_year
    into _policy
    from public.attendance_policy
    where org_id = _org_id
    limit 1;

  insert into public.leave_balances (
    user_id, org_id,
    total_annual, used_annual, remaining_annual
  ) values (
    new.id, _org_id,
    coalesce(_policy.annual_leave_per_year, 21), 0, coalesce(_policy.annual_leave_per_year, 21)
  );

  return new;
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
    ), 0) as used_annual
  from public.leave_balances lb
)
update public.leave_balances lb
set used_annual = recalculated_usage.used_annual,
    remaining_annual = greatest(0, lb.total_annual - recalculated_usage.used_annual)
from recalculated_usage
where recalculated_usage.id = lb.id;

alter table public.attendance_policy
  drop column if exists sick_leave_per_year;

alter table public.leave_balances
  drop column if exists total_sick,
  drop column if exists used_sick,
  drop column if exists remaining_sick;

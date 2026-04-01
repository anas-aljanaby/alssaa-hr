-- Keep profile email in sync with auth.users so admin pages can display login email.

alter table public.profiles
  add column if not exists email text;

-- Backfill existing profiles that are missing an email.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (
    p.email is null
    or btrim(p.email) = ''
  )
  and u.email is not null
  and btrim(u.email) <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  _name    text;
  _name_ar text;
  _phone   text;
  _role    text;
  _emp_id  text;
  _org_id  uuid;
  _dept_id uuid;
  _email   text;
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

  select annual_leave_per_year, sick_leave_per_year
    into _policy
    from public.attendance_policy
    where org_id = _org_id
    limit 1;

  insert into public.leave_balances (
    user_id, org_id,
    total_annual, used_annual, remaining_annual,
    total_sick,   used_sick,   remaining_sick
  ) values (
    new.id, _org_id,
    coalesce(_policy.annual_leave_per_year, 21), 0, coalesce(_policy.annual_leave_per_year, 21),
    coalesce(_policy.sick_leave_per_year, 10),   0, coalesce(_policy.sick_leave_per_year, 10)
  );

  return new;
end;
$$;

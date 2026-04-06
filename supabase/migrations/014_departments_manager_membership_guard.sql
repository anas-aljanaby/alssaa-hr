-- Ensure a department manager is a member of the same department and
-- cannot manage more than one department at a time.

create or replace function public.validate_department_manager_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_department_id uuid;
  v_member_role text;
begin
  if new.manager_uid is null then
    return new;
  end if;

  select p.department_id, p.role
  into v_member_department_id, v_member_role
  from public.profiles p
  where p.id = new.manager_uid
    and p.org_id = new.org_id;

  if not found then
    raise exception 'MANAGER_ROLE_INVALID';
  end if;

  if v_member_role not in ('employee', 'manager') then
    raise exception 'MANAGER_ROLE_INVALID';
  end if;

  if v_member_department_id is distinct from new.id then
    raise exception 'MANAGER_MUST_BE_DEPARTMENT_MEMBER';
  end if;

  if exists (
    select 1
    from public.departments d
    where d.org_id = new.org_id
      and d.manager_uid = new.manager_uid
      and d.id <> new.id
  ) then
    raise exception 'MANAGER_ALREADY_ASSIGNED_TO_DEPARTMENT';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_department_manager_assignment on public.departments;

create trigger validate_department_manager_assignment
  before insert or update of manager_uid
  on public.departments
  for each row
  execute function public.validate_department_manager_assignment();

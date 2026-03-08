-- ============================================================
-- Department manager -> profiles.role sync
-- ============================================================
-- Guarantees:
-- - When `departments.manager_uid` is set to a profile with role='employee',
--   that profile is promoted to role='manager'.
-- - When `departments.manager_uid` changes away (or becomes NULL),
--   the old manager is demoted to role='employee' only if they manage
--   no other departments in the same org.
-- - Admin/general-manager role='admin' is never overridden by this trigger.

create or replace function public.sync_department_manager_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_old_manager_uid uuid;
  v_new_manager_uid uuid;
begin
  v_org_id := coalesce(new.org_id, old.org_id);

  if tg_op = 'INSERT' then
    v_old_manager_uid := null;
    v_new_manager_uid := new.manager_uid;
  elsif tg_op = 'UPDATE' then
    v_old_manager_uid := old.manager_uid;
    v_new_manager_uid := new.manager_uid;
  elsif tg_op = 'DELETE' then
    v_old_manager_uid := old.manager_uid;
    v_new_manager_uid := null;
  else
    return null;
  end if;

  -- Promote newly assigned manager
  if v_new_manager_uid is not null then
    update public.profiles
    set role = 'manager'
    where id = v_new_manager_uid
      and org_id = v_org_id
      and role = 'employee';
  end if;

  -- Demote old manager if they no longer manage any departments
  if v_old_manager_uid is not null and v_old_manager_uid <> v_new_manager_uid then
    if not exists (
      select 1
      from public.departments d
      where d.org_id = v_org_id
        and d.manager_uid = v_old_manager_uid
    ) then
      update public.profiles
      set role = 'employee'
      where id = v_old_manager_uid
        and org_id = v_org_id
        and role = 'manager';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_department_manager_roles_insert on public.departments;
create trigger sync_department_manager_roles_insert
after insert
on public.departments
for each row
execute function public.sync_department_manager_roles();

drop trigger if exists sync_department_manager_roles_update on public.departments;
create trigger sync_department_manager_roles_update
after update of manager_uid
on public.departments
for each row
execute function public.sync_department_manager_roles();

drop trigger if exists sync_department_manager_roles_delete on public.departments;
create trigger sync_department_manager_roles_delete
after delete
on public.departments
for each row
execute function public.sync_department_manager_roles();


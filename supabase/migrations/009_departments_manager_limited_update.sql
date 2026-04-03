-- Allow managers to edit their own departments while blocking manager reassignment.

create policy "Managers can update own managed departments"
  on public.departments for update
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and manager_uid = auth.uid()
  )
  with check (
    org_id = public.current_user_org_id()
    and manager_uid = auth.uid()
  );

create or replace function public.prevent_non_admin_department_manager_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_role() <> 'admin'
     and new.manager_uid is distinct from old.manager_uid then
    raise exception 'Only admins can change department manager';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_non_admin_department_manager_change on public.departments;

create trigger prevent_non_admin_department_manager_change
  before update on public.departments
  for each row
  execute function public.prevent_non_admin_department_manager_change();

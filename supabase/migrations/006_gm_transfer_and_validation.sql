-- ============================================================
-- General Manager transfer + integrity validation
-- ============================================================

-- Guardrail: `organizations.general_manager_id` must always
-- reference a profile from the same org with role='admin'.
create or replace function public.validate_general_manager_on_org_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _gm_org_id uuid;
  _gm_role text;
begin
  if new.general_manager_id is null then
    return new;
  end if;

  select p.org_id, p.role
    into _gm_org_id, _gm_role
  from public.profiles p
  where p.id = new.general_manager_id;

  if _gm_org_id is null then
    raise exception 'GENERAL_MANAGER_PROFILE_NOT_FOUND'
      using ERRCODE = 'P0001';
  end if;

  if _gm_org_id <> new.id then
    raise exception 'GENERAL_MANAGER_PROFILE_NOT_IN_ORG'
      using ERRCODE = 'P0002';
  end if;

  if _gm_role <> 'admin' then
    raise exception 'GENERAL_MANAGER_PROFILE_MUST_BE_ADMIN'
      using ERRCODE = 'P0003';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_general_manager_on_org_change on public.organizations;
create trigger validate_general_manager_on_org_change
before insert or update of general_manager_id
on public.organizations
for each row
execute function public.validate_general_manager_on_org_change();

-- RPC: Transfer General Manager between profiles (same org).
-- Also swaps `profiles.role`:
-- - new GM becomes role='admin'
-- - old GM becomes 'manager' if it manages any department, otherwise 'employee'
create or replace function public.transfer_general_manager(
  p_org_id uuid,
  p_new_gm_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _caller_role text;
  _caller_org_id uuid;
  _old_gm_id uuid;
  _old_gm_manages_any boolean;
begin
  -- Auth check
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED'
      using ERRCODE = 'P0004';
  end if;

  -- Caller must be org admin
  select pr.role, pr.org_id
    into _caller_role, _caller_org_id
  from public.profiles pr
  where pr.id = auth.uid();

  if _caller_role is null then
    raise exception 'NO_PROFILE'
      using ERRCODE = 'P0005';
  end if;

  if _caller_role <> 'admin' then
    raise exception 'NOT_AUTHORIZED'
      using ERRCODE = 'P0006';
  end if;

  if _caller_org_id <> p_org_id then
    raise exception 'ORG_MISMATCH'
      using ERRCODE = 'P0007';
  end if;

  -- Validate candidate exists + belongs to org
  if not exists (
    select 1 from public.profiles pr
    where pr.id = p_new_gm_id
      and pr.org_id = p_org_id
  ) then
    raise exception 'GENERAL_MANAGER_CANDIDATE_INVALID'
      using ERRCODE = 'P0008';
  end if;

  if exists (
    select 1 from public.organizations o
    where o.id = p_org_id
      and o.general_manager_id = p_new_gm_id
  ) then
    return;
  end if;

  select o.general_manager_id into _old_gm_id
  from public.organizations o
  where o.id = p_org_id;

  -- Promote candidate to admin first (so org validation trigger passes)
  update public.profiles
  set role = 'admin'
  where id = p_new_gm_id
    and org_id = p_org_id;

  -- Swap the org's GM pointer
  update public.organizations
  set general_manager_id = p_new_gm_id
  where id = p_org_id;

  -- Demote previous GM (only if different)
  if _old_gm_id is not null and _old_gm_id <> p_new_gm_id then
    select exists (
      select 1
      from public.departments d
      where d.org_id = p_org_id
        and d.manager_uid = _old_gm_id
    ) into _old_gm_manages_any;

    if _old_gm_manages_any then
      update public.profiles
      set role = 'manager'
      where id = _old_gm_id
        and org_id = p_org_id;
    else
      update public.profiles
      set role = 'employee'
      where id = _old_gm_id
        and org_id = p_org_id;
    end if;
  end if;
end;
$$;

grant execute on function public.transfer_general_manager(uuid, uuid) to authenticated;


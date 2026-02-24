-- ============================================================
-- Audit log INSERT policy + organizations.general_manager_id
-- For DBs that already ran 001 without these changes.
-- ============================================================

-- Allow authenticated users to insert audit logs as themselves (actor_id = auth.uid()).
-- Trigger enforce_org_id_from_actor sets org_id from actor's profile.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_logs'
      and policyname = 'Authenticated can insert own audit log'
  ) then
    create policy "Authenticated can insert own audit log"
      on public.audit_logs for insert
      to authenticated
      with check (actor_id = auth.uid());
  end if;
end $$;

-- One general manager per organization (the account created for the org).
alter table public.organizations
  add column if not exists general_manager_id uuid references public.profiles (id) on delete set null;

-- Set demo org general manager if not already set
update public.organizations
set general_manager_id = (
  select id from public.profiles
  where org_id = '22222222-2222-2222-2222-222222222222' and role = 'admin'
  limit 1
)
where id = '22222222-2222-2222-2222-222222222222' and general_manager_id is null;

-- Allow all authenticated users to read profile rows in their own organization.
-- This is required so employees can view all departments, managers, and members.

drop policy if exists "Users can read all org profiles" on public.profiles;

create policy "Users can read all org profiles"
  on public.profiles for select
  to authenticated
  using (org_id = public.current_user_org_id());

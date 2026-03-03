-- ============================================================
-- ALSSAA HR — Reseed Demo Data (non-user reseed)
-- Deletes demo org data except auth.users so reseeding won't
-- create brand-new auth.users rows. Use this to refresh demo
-- data while preserving existing auth accounts (same IDs).
-- ============================================================

do $$
declare
  _demo_org uuid := '22222222-2222-2222-2222-222222222222';
begin
  -- Remove generated/demo data that should be re-created during seeding
  delete from public.attendance_logs   where org_id = _demo_org;
  delete from public.notifications    where org_id = _demo_org;
  delete from public.leave_requests   where org_id = _demo_org;
  delete from public.leave_balances   where org_id = _demo_org;

  -- Remove demo profiles and departments so seed can recreate/upsert them
  delete from public.profiles         where org_id = _demo_org;
  delete from public.departments      where org_id = _demo_org;

  -- Remove demo attendance policy and clear org GM reference
  delete from public.attendance_policy where org_id = _demo_org;
  update public.organizations set general_manager_id = null where id = _demo_org;

  raise notice 'Demo reseed (non-user) cleanup complete. Run 004_seed_demo.sql to re-populate.';
end;
$$;


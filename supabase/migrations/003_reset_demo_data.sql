-- ============================================================
-- ALSSAA HR — Reset Demo Data Only
-- Deletes all demo org data + demo auth users.
-- Real org data is untouched.
-- Run manually, then run 004_seed_demo.sql to re-populate.
-- ============================================================

do $$
declare
  _demo_org_id uuid := '22222222-2222-2222-2222-222222222222';
  _uid         uuid;
begin
  -- 1. Delete demo auth.users one-by-one.
  --    CASCADE propagates: auth.users -> profiles -> attendance_logs,
  --    leave_requests, leave_balances, notifications, audit_logs.
  --    Also sets departments.manager_uid = NULL (on delete set null).
  for _uid in select id from public.profiles where org_id = _demo_org_id
  loop
    delete from auth.users where id = _uid;
  end loop;

  -- 2. Delete demo departments (manager_uid already nulled by cascade)
  delete from public.departments where org_id = _demo_org_id;

  -- 3. Delete demo attendance policy
  delete from public.attendance_policy where org_id = _demo_org_id;

  raise notice 'Demo data reset complete. Run 004_seed_demo.sql to re-populate.';
end;
$$;

-- ============================================================
-- Backfill organizations.general_manager_id
-- ============================================================
-- For existing orgs that have no GM yet, pick an existing
-- admin profile in the same org as the GM.

update public.organizations o
set general_manager_id = sub.admin_id
from (
  select distinct on (org_id)
    org_id,
    id as admin_id
  from public.profiles
  where role = 'admin'
  order by org_id, created_at desc
) sub
where o.id = sub.org_id
  and o.general_manager_id is null;


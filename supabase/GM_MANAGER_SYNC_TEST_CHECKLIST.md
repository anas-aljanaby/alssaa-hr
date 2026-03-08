# GM / Department Manager Consistency Test Checklist

## Preconditions
- Apply migrations:
  - `006_gm_transfer_and_validation.sql`
  - `007_department_manager_role_sync.sql`
  - `008_gm_backfill.sql`
- Verify there is at least one `profiles` row per org with `role='admin'`.

## A) Backfill validation
1. Pick an org where `organizations.general_manager_id IS NULL`.
2. Run:
   - `select id, general_manager_id from public.organizations where general_manager_id is null;`
3. Confirm `general_manager_id` gets populated after running the migration.
4. For each updated org, confirm:
   - the referenced profile exists
   - `profiles.role = 'admin'`

## B) Department manager role sync (promotion)
1. Choose a department `D` and a user `U` in the same org where `U.role = 'employee'`.
2. Update `public.departments.manager_uid` for `D` to `U.id`.
3. Confirm:
   - `profiles(U.id).role` becomes `manager`.

## C) Department manager replacement (demotion when no other departments)
1. Have department `D` currently managed by `M1` (`M1.role = 'manager'`), and pick another manager/employee candidate `M2`.
2. Update `D.manager_uid` from `M1` to `M2`.
3. Ensure `M1` manages **zero** departments after the update.
4. Confirm:
   - `profiles(M1.id).role` becomes `employee`.

## D) Department manager replacement (no demotion if managing another department)
1. Assign `M1` as `manager_uid` for two departments: `D1` and `D2`.
2. Replace `D1.manager_uid` from `M1` to a different manager `M2`.
3. Confirm `M1` still manages `D2`.
4. Confirm:
   - `profiles(M1.id).role` remains `manager`.

## E) Clearing a department manager
1. Set `D.manager_uid = NULL` (or remove the manager selection in the UI).
2. Confirm `M1` manages no other departments.
3. Confirm:
   - `profiles(M1.id).role` becomes `employee`.

## F) GM transfer (role swapping + org pointer)
1. From the admin UI, choose a new GM candidate `G2` (any profile in the same org).
2. Click “تأكيد” to transfer GM.
3. Confirm:
   - `organizations.general_manager_id` updates to `G2.id`
   - `profiles(G2.id).role` becomes `admin`
4. Confirm old GM (`G1`) is demoted based on department assignments:
   - if `G1` manages any department -> `G1.role` becomes `manager`
   - otherwise -> `G1.role` becomes `employee`

## G) GM transfer rejection cases
1. Try transferring GM to a profile from a different org -> should fail.
2. Try transferring without being an authenticated org admin -> should fail.

## H) UI behavior checks
1. In `UsersPage` / `UserDetailsPage`, verify the “الدور” dropdown cannot be changed.
2. Verify selecting department managers in `DepartmentsPage` results in automatic role sync (promotion/demotion) without manual role edits.


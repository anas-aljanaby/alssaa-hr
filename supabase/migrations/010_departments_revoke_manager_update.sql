-- Departments are read-only for managers at the app layer; revoke manager UPDATE on departments.
-- Trigger prevent_non_admin_department_manager_change (from 009) remains for non-admin manager_uid changes.

drop policy if exists "Managers can update own managed departments" on public.departments;

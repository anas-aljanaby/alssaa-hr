-- ============================================================
-- ALSSAA HR — Full Nuclear Reset
-- Drops ALL tables, functions, triggers, and auth users.
-- Run manually, then re-run 001 + 002 to rebuild from scratch.
-- ============================================================

-- 1. Drop the trigger on auth.users first (lives outside public schema)
drop trigger if exists on_auth_user_created on auth.users;

-- 2. Drop all public tables (CASCADE removes their policies, triggers, indexes)
drop table if exists public.audit_logs        cascade;
drop table if exists public.push_subscriptions cascade;
drop table if exists public.sent_scheduled_notifications cascade;
drop table if exists public.notification_settings cascade;
drop table if exists public.notifications     cascade;
drop table if exists public.leave_balances    cascade;
drop table if exists public.approval_logs     cascade;
drop table if exists public.leave_requests    cascade;
drop table if exists public.attendance_logs   cascade;
drop table if exists public.attendance_policy cascade;
drop table if exists public.profiles          cascade;
drop table if exists public.departments       cascade;
drop table if exists public.organizations     cascade;

-- 3. Drop all public functions
drop function if exists public.current_user_org_id()              cascade;
drop function if exists public.current_user_role()                cascade;
drop function if exists public.current_user_department()          cascade;
drop function if exists public.handle_new_user()                  cascade;
drop function if exists public.validate_general_manager_on_org_change() cascade;
drop function if exists public.transfer_general_manager(uuid, uuid) cascade;
drop function if exists public.handle_request_status_change()     cascade;
drop function if exists public.set_request_decided_at()           cascade;
drop function if exists public.handle_request_approved()          cascade;
drop function if exists public.handle_late_checkin()              cascade;
drop function if exists public.sync_department_manager_roles()     cascade;
drop function if exists public.enforce_org_id_from_user()         cascade;
drop function if exists public.enforce_org_id_from_actor()        cascade;
drop function if exists public.enforce_org_id_from_current_user() cascade;
drop function if exists public.protect_profile_fields()           cascade;
drop function if exists public.punch(text, timestamptz)           cascade;
drop function if exists public.seed_default_notification_settings(uuid, boolean) cascade;
drop function if exists public.handle_new_organization_notification_settings() cascade;

-- 4. Delete ALL auth users (wipes every account)
delete from auth.users;

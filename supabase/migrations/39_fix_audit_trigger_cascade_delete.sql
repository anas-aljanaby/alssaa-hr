-- Fix DELETE user failing with "Database error deleting user":
--
-- When auth.admin.deleteUser() is called, the cascade chain is:
--   auth.users → profiles (ON DELETE CASCADE)
--               → attendance_sessions (ON DELETE CASCADE)
--                 → AFTER DELETE trigger fires, tries to INSERT into
--                   attendance_audit_log with employee_id = old.user_id
--   But the profile is already gone at this point, so the FK
--   attendance_audit_log.employee_id → profiles(id) rejects the insert.
--
-- Fix: skip the audit insert when the employee's profile no longer exists
-- (i.e. we are in a cascade-delete context, not a standalone session delete).

create or replace function public.audit_attendance_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _action text;
  _performed_by uuid;
  _reason text;
  _old_values jsonb;
  _new_values jsonb;
  _org_id uuid;
  _employee_id uuid;
  _session_id uuid;
begin
  _performed_by := auth.uid();
  _reason := nullif(current_setting('app.attendance_audit_reason', true), '');

  if tg_op = 'INSERT' then
    _action := coalesce(nullif(current_setting('app.attendance_audit_action', true), ''), 'check_in');
    _old_values := null;
    _new_values := to_jsonb(new);
    _org_id := new.org_id;
    _employee_id := new.user_id;
    _session_id := new.id;
  elsif tg_op = 'DELETE' then
    -- Skip audit when cascading from a profile/user delete — the profile FK would
    -- reject the insert anyway, and the deletion itself is the meaningful event.
    if not exists (select 1 from public.profiles where id = old.user_id) then
      return old;
    end if;

    _action := coalesce(nullif(current_setting('app.attendance_audit_action', true), ''), 'session_deleted');
    _old_values := to_jsonb(old);
    _new_values := null;
    _org_id := old.org_id;
    _employee_id := old.user_id;
    -- Cannot reference the deleted session via FK; session data is in old_values.
    _session_id := null;
  else
    _action := nullif(current_setting('app.attendance_audit_action', true), '');
    if _action is null then
      if old.check_out_time is null and new.check_out_time is not null and new.is_auto_punch_out then
        _action := 'auto_punch_out';
      elsif old.check_out_time is null and new.check_out_time is not null then
        _action := 'check_out';
      else
        _action := 'manual_edit';
      end if;
    end if;
    _old_values := to_jsonb(old);
    _new_values := to_jsonb(new);
    _org_id := new.org_id;
    _employee_id := new.user_id;
    _session_id := new.id;
  end if;

  insert into public.attendance_audit_log (
    org_id,
    session_id,
    employee_id,
    action,
    performed_by,
    old_values,
    new_values,
    reason
  ) values (
    _org_id,
    _session_id,
    _employee_id,
    _action,
    _performed_by,
    _old_values,
    _new_values,
    _reason
  );

  return coalesce(new, old);
end;
$$;

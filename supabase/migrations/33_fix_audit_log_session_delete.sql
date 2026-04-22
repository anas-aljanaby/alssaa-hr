-- Fix two intertwined issues that cause DELETE on attendance_sessions to fail:
--
-- 1. The FK cascade (on delete set null) on attendance_audit_log.session_id fires a
--    BEFORE UPDATE trigger which raises "attendance_audit_log is append-only".
--    Fix: allow the FK cascade SET NULL to pass through.
--
-- 2. The AFTER DELETE audit trigger on attendance_sessions tries to INSERT into
--    attendance_audit_log with session_id = old.id, but the session no longer exists,
--    so the FK constraint rejects it.
--    Fix: use session_id = NULL for DELETE audit entries (data is preserved in old_values).

create or replace function public.prevent_attendance_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Allow FK cascade that nullifies session_id when the referenced session is deleted.
  if tg_op = 'UPDATE' and new.session_id is null and old.session_id is not null then
    return new;
  end if;
  raise exception 'attendance_audit_log is append-only';
end;
$$;

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

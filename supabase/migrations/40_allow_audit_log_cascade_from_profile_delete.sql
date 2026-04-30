-- Fix DELETE user failing with "attendance_audit_log is append-only":
--
-- When auth.admin.deleteUser() runs, the cascade from profiles fires two
-- mutations on attendance_audit_log that the append-only guard blocks:
--   1. employee_id → profiles ON DELETE CASCADE  → DELETE rows
--   2. performed_by → profiles ON DELETE SET NULL → UPDATE performed_by = null
--
-- Migration 33 already whitelisted the session_id SET NULL update. Extend the
-- guard to also allow the two cascades above, detected by the parent profile
-- no longer existing (cascade-delete context) or by the SET NULL pattern.

create or replace function public.prevent_attendance_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- FK cascade SET NULL on session_id when the referenced session is deleted.
    if new.session_id is null and old.session_id is not null
       and new.employee_id is not distinct from old.employee_id
       and new.performed_by is not distinct from old.performed_by
       and new.org_id is not distinct from old.org_id
       and new.action is not distinct from old.action
       and new.old_values is not distinct from old.old_values
       and new.new_values is not distinct from old.new_values
       and new.reason is not distinct from old.reason then
      return new;
    end if;

    -- FK cascade SET NULL on performed_by when the actor profile is deleted.
    if new.performed_by is null and old.performed_by is not null
       and new.employee_id is not distinct from old.employee_id
       and new.session_id is not distinct from old.session_id
       and new.org_id is not distinct from old.org_id
       and new.action is not distinct from old.action
       and new.old_values is not distinct from old.old_values
       and new.new_values is not distinct from old.new_values
       and new.reason is not distinct from old.reason then
      return new;
    end if;
  end if;

  if tg_op = 'DELETE' then
    -- FK cascade DELETE when the employee's profile is being deleted in the
    -- same transaction. The append-only guard exists to stop user-initiated
    -- tampering, not to block a cascading account deletion.
    if not exists (select 1 from public.profiles where id = old.employee_id) then
      return old;
    end if;
  end if;

  raise exception 'attendance_audit_log is append-only';
end;
$$;

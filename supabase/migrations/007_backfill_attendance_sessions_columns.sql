-- ============================================================
-- Backfill missing attendance_sessions columns for punch v2
-- ============================================================

alter table public.attendance_sessions
  add column if not exists is_auto_punch_out boolean not null default false,
  add column if not exists is_early_departure boolean not null default false,
  add column if not exists needs_review boolean not null default false,
  add column if not exists duration_minutes int not null default 0 check (duration_minutes >= 0),
  add column if not exists last_action_at timestamptz not null default now(),
  add column if not exists is_dev boolean not null default false;

-- Ensure PostgREST/edge API sees new columns immediately.
notify pgrst, 'reload schema';

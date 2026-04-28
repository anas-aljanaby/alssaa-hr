-- ============================================================
-- Attendance sessions: timestamp migration (Phase 1, additive)
-- See docs/Implementation Plan - Attendance Sessions Timestamp Migration.md
--
-- Adds check_in_at / check_out_at as timestamptz alongside the
-- existing (date, check_in_time, check_out_time) columns and
-- backfills them under the Asia/Baghdad wall-clock convention.
-- The legacy columns remain authoritative until Phase 3 readers
-- migrate. This migration is purely additive.
-- ============================================================

-- 1.1 New timestamp columns, nullable for now.
alter table public.attendance_sessions
  add column if not exists check_in_at timestamptz,
  add column if not exists check_out_at timestamptz;

-- 1.2 Backfill check_in_at from (date, check_in_time) interpreted in Asia/Baghdad.
update public.attendance_sessions
set check_in_at = ((date::text || ' ' || check_in_time::text)::timestamp at time zone 'Asia/Baghdad')
where check_in_at is null;

-- 1.3 Backfill check_out_at for closed sessions.
--   - check_out_time is null              -> leave check_out_at null (still open).
--   - check_out_time >= check_in_time     -> same calendar date.
--   - check_out_time <  check_in_time     -> one midnight crossing, use date + 1.
--   - resulting span > 18h                -> data is suspect (multi-day bug class);
--                                            null out check_out_at and flag needs_review
--                                            so an admin can repair by hand.
with computed as (
  select
    s.id,
    s.check_in_at,
    case
      when s.check_out_time is null then null
      when s.check_out_time >= s.check_in_time
        then ((s.date::text || ' ' || s.check_out_time::text)::timestamp at time zone 'Asia/Baghdad')
      else
        (((s.date + 1)::text || ' ' || s.check_out_time::text)::timestamp at time zone 'Asia/Baghdad')
    end as candidate_out
  from public.attendance_sessions s
)
update public.attendance_sessions s
set
  check_out_at = case
    when c.candidate_out is null then null
    when c.candidate_out - s.check_in_at > interval '18 hours' then null
    else c.candidate_out
  end,
  needs_review = case
    when c.candidate_out is not null
         and c.candidate_out - s.check_in_at > interval '18 hours'
      then true
    else s.needs_review
  end
from computed c
where c.id = s.id
  and s.check_out_at is null
  and s.check_out_time is not null;

-- 1.4 Index for the new common access pattern (user timeline by check-in instant).
create index if not exists idx_attendance_sessions_user_check_in_at
  on public.attendance_sessions (user_id, check_in_at desc);

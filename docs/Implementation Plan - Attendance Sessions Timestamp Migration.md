# Implementation Plan: Attendance Sessions Timestamp Migration

This document tracks the migration of `attendance_sessions` from the current `(date, check_in_time, check_out_time)` model to a `(check_in_at, check_out_at)` `timestamptz` model. Delete this file once all phases are complete.

**Why:** The current schema stores time-of-day strings anchored to a single `date` column. `diffMinutes` assumes spans ≤ 24h with at most one midnight crossing. This silently breaks two real cases:
1. Sessions that span more than 24h (e.g., punched in at 02:00, forgot to punch out, kept working through the next day) — duration is calculated mod 1440 and the second day shows as absent.
2. Overnight shifts — every consumer needs ad-hoc `if (end < start) +1440` normalization, and corner cases (e.g., overtime that itself crosses midnight) keep slipping through.

Both problems share a single root cause: the schema cannot represent when checkout actually happened relative to check-in. Switching to full timestamps removes that ambiguity once and for all.

**Approach:** Additive, not destructive. Add new columns alongside the old ones, dual-write, migrate readers one at a time, then drop old columns. The site keeps working at every intermediate step.

**Timezone:** This migration hardcodes `Asia/Baghdad` (UTC+3) — matching the existing `toOrgLocalDate` behavior. Per-org timezone is a separate follow-up (see "Out of Scope" below).

---

## How to use this plan

- Each task is a checkbox: `- [ ]` is open, `- [x]` is done.
- Mark a task done as soon as the change is shipped (merged + deployed).
- Mark a phase done only when **every** task inside it is done.
- Phases are sequential — do not start phase N+1 until phase N is fully done. Inside a phase, tasks can be parallelized unless noted.
- If a task turns out to be unnecessary, strike it out: `- [x] ~~Task name~~` with a one-line note explaining why.

### Critical step protocol

Tasks marked `⚠️ Critical` touch production data, ship live writers, or are irreversible. Before executing one:
- The agent must announce **"this is a critical step"** and wait for explicit go-ahead.
- The user pauses to double-check the diff before approving.

Tasks with `✓ Verify` include a one-line sanity check to confirm the change landed correctly. Run it right after shipping the task — if it doesn't return what's described, stop and investigate.

---

## Out of Scope

These are intentionally not part of this plan. Track separately.

- **Per-org timezone.** Timezone stays hardcoded to `Asia/Baghdad` (UTC+3). A separate follow-up adds `timezone` to the `organizations` table and threads it through; until then every `timestamptz ↔ HH:MM` conversion uses `'Asia/Baghdad'`.
- **Retroactive repair of existing broken records.** Sessions already in the DB that span > 24h have lost data — the original checkout time isn't recoverable. Phase 1's backfill flags these for `needs_review`; admins repair them by hand.
- **Splitting cross-midnight sessions across two `attendance_daily_summary` rows.** Today a session contributes to exactly one date (its `check_in_at::date`). Whether to split contributions across days is a product decision; capture it during Phase 3 task 3.5 and decide.

---

## Summary of Changes

| Layer | Change |
|---|---|
| SQL | Add `check_in_at`, `check_out_at` columns; backfill; index; later drop old cols |
| `punch/handler.ts` | Dual-write, then read from timestamps; rewrite `diffMinutes` and split helpers |
| `auto-punch-out/handler.ts` | Dual-write, then read; rewrite cutoff/rule deadline math |
| `attendance.service.ts` | Migrate ~45 refs of date+time to timestamp ranges |
| `get_team_attendance_day` RPC | Rewrite SQL to derive date from `check_in_at::date` |
| React components | Mostly unchanged if service layer preserves return shape |
| Tests | Update fixtures and assertions throughout |

---

## Phase 1 — Additive Schema (Safe)

Goal: new columns exist and are populated, old columns untouched. Site behavior unchanged.

- [x] **1.1** Create migration `37_attendance_sessions_timestamps.sql`:
  - `ALTER TABLE attendance_sessions ADD COLUMN check_in_at timestamptz`
  - `ALTER TABLE attendance_sessions ADD COLUMN check_out_at timestamptz`
  - Both nullable for now.
- [x] **1.2** ⚠️ Critical — Backfill `check_in_at` from existing rows:
  - `check_in_at = ((date::text || ' ' || check_in_time)::timestamp AT TIME ZONE 'Asia/Baghdad')`
  - ✓ Verify: `SELECT count(*) FROM attendance_sessions WHERE check_in_at IS NULL` → 0.
- [x] **1.3** ⚠️ Critical — Backfill `check_out_at` for closed sessions:
  - If `check_out_time IS NULL` → leave `check_out_at` NULL.
  - If `check_out_time >= check_in_time` (same day) → `((date::text || ' ' || check_out_time)::timestamp AT TIME ZONE 'Asia/Baghdad')`.
  - If `check_out_time < check_in_time` (one midnight crossing) → same expression but `date + 1`.
  - Sessions where the resulting span exceeds a sanity threshold (e.g., 18h) → set `check_out_at = NULL` and `needs_review = true`. These are the multi-day-bug rows; admins fix them manually.
  - ✓ Verify: `SELECT count(*) FROM attendance_sessions WHERE check_out_time IS NOT NULL AND check_out_at IS NULL AND needs_review = false` → 0.
- [x] **1.4** Add index `CREATE INDEX idx_attendance_sessions_user_check_in_at ON attendance_sessions(user_id, check_in_at)`.
- [ ] **1.5** Verify backfill: ad-hoc query `SELECT count(*) FROM attendance_sessions WHERE check_in_at IS NULL` returns 0; `WHERE needs_review = true AND check_out_at IS NULL` returns the expected count of broken rows. *(Pending real DB/staging verification.)*
- [x] **1.6** Regenerate `database.types.ts`.

**Phase 1 complete:** ☐

---

## Phase 2 — Dual-Write at the Writers (Low Risk)

Goal: every new insert/update writes both old and new columns. Old columns remain authoritative; new columns are written but unread (except by tests).

> ⚠️ Critical — tasks 2.1–2.6 modify live writers. A bug here means new rows go to production with wrong/missing timestamp values. The agent should announce the critical step at the start of 2.1 and again before 2.5 (auto-punch-out is cron-driven, hits more rows). Verify with 2.7 + 2.8 before considering the phase done.

- [x] **2.1** `punch/handler.ts`: every `INSERT` into `attendance_sessions` also sets `check_in_at` (computed from current time as `timestamptz`).
- [x] **2.2** `punch/handler.ts`: every `UPDATE` that sets `check_out_time` also sets `check_out_at` (computed from the chosen checkout moment as `timestamptz`).
- [x] **2.3** `punch/handler.ts`: the late-stay split path (`shouldSplitOvertime`) sets `check_in_at`/`check_out_at` on both the regular update and the new OT insert.
- [x] **2.4** `punch/handler.ts`: the OT-spanning-shift split path (added in Phase 0 of the parent fix) sets timestamps on each segment insert.
- [x] **2.5** `auto-punch-out/handler.ts`: every `UPDATE` setting `check_out_time` also sets `check_out_at`.
- [x] **2.6** `auto-punch-out/handler.ts`: every OT segment INSERT (split path + late-stay split) sets `check_in_at`/`check_out_at`.
- [x] **2.7** Add a consistency test: insert a row, assert `check_in_at::time AT TIME ZONE 'Asia/Baghdad' == check_in_time` and `check_in_at::date AT TIME ZONE 'Asia/Baghdad' == date`.
- [ ] **2.8** Smoke deploy to staging; let cron run for ≥ 24h; query for any rows where the new and old columns disagree.
  - ✓ Verify: `SELECT count(*) FROM attendance_sessions WHERE created_at > now() - interval '24 hours' AND (check_in_at IS NULL OR (check_out_time IS NOT NULL AND check_out_at IS NULL))` → 0.

**Phase 2 complete:** ☐

---

## Phase 3 — Migrate Readers (The Long Phase)

Goal: every reader consults the new timestamp columns; old columns are still kept in sync but only as a fallback. Each task is its own PR — easy to ship, easy to revert.

Order matters: edge functions first (smallest blast radius, biggest correctness win), then service layer, then DB RPC, then UI.

- [ ] **3.1** ⚠️ Critical — Replace `diffMinutes` in `punch/handler.ts` with timestamp arithmetic:
  - New helper `diffMinutesFromTimestamps(checkInAt: Date, checkOutAt: Date): number`.
  - Replace every call site that has both timestamps available.
  - Keep the old `diffMinutes(string, string)` only for paths that still receive HH:MM (UI input boundaries) — annotate with `@deprecated` until phase 4.
  - ✓ Verify: punch in and out via the app; resulting `duration_minutes` matches the actual elapsed time (compare to a stopwatch or `last_action_at - check_in_at`).
- [ ] **3.2** Replace the buffer cutoff and rule deadline math in `auto-punch-out/handler.ts` with timestamp comparisons:
  - `computeRuleDeadline` reads `session.check_in_at` directly instead of reconstructing from `(date, check_in_time)`.
  - The buffer cutoff compares `effectiveNow` against `check_in_at + shift_remaining + buffer_minutes` computed in UTC ms.
- [ ] **3.3** Rewrite `resolveOvertimeSessionSplit` to operate on `Date` objects instead of HH:MM strings:
  - Accept `checkInAt`, `checkOutAt`, `shiftStartAt`, `shiftEndAt`.
  - The "overnight shift out of scope" and "session crosses midnight out of scope" guards both go away — timestamps handle them naturally.
  - Add tests for the cases previously skipped (overnight shifts, multi-day spans).
- [ ] **3.4** Rewrite `resolveCheckoutOvertimeHandling` similarly. The `overnight` normalization trick is no longer needed.
- [ ] **3.5** `recalculateDailySummary`: decide and document the rule for cross-midnight sessions (default: belongs to `check_in_at::date`). Update aggregations to derive date from timestamps.
- [ ] **3.6** ⚠️ Critical — Migrate `attendance.service.ts` queries (largest blast radius — 45 refs touch most attendance UI):
  - Replace `eq('date', ...)` filters with `gte('check_in_at', dayStart) AND lt('check_in_at', nextDayStart)` where appropriate.
  - Replace transforms that build a Date from `(date, check_in_time)` with direct reads of `check_in_at`.
  - Keep public return types stable so UI doesn't break in this PR.
  - ✓ Verify: open the today/calendar/team pages in the app; rows match what the DB shows for the same user (no missing days, no duplicated sessions, durations look right).
- [ ] **3.7** Update `attendance.service.test.ts` fixtures to populate the new columns.
- [ ] **3.8** Migrate `src/shared/attendance/todayRecord.ts` to read timestamps; update its tests.
- [ ] **3.9** ⚠️ Critical — Rewrite the `get_team_attendance_day` RPC ([013_team_attendance_functions.sql](../supabase/migrations/013_team_attendance_functions.sql)) — derive date from `check_in_at AT TIME ZONE 'Asia/Baghdad'`, durations from `EXTRACT(EPOCH FROM check_out_at - check_in_at) / 60`. Ship as a new migration that `CREATE OR REPLACE`s the function.
  - ✓ Verify: open the team attendance page for today; counts and per-user rows match what you see for the same users on the user details page.
- [ ] **3.10** Verify all React component renders against staging:
  - `TodayPunchLog.tsx`, `TodayStatusCard.tsx`, `DayDetailsSheet.tsx`, `UserDetailsPage.tsx`, `ManagerDashboard.tsx`, `OvertimeRequestCard.tsx`.
  - Most should require zero changes if 3.6 preserves the service return shape.
- [ ] **3.11** Verify the multi-day-span scenario end-to-end on staging: punch in at 02:00, leave open for ≥ 26h, manually punch out, confirm duration and day attribution are correct.
- [ ] **3.12** Verify the overnight-shift scenarios on staging: punch in pre-shift, mid-shift, post-shift; manual checkout and rule-triggered checkout each.

**Phase 3 complete:** ☐

---

## Phase 4 — Drop Old Columns (Cleanup)

Goal: remove the dead weight. Only run this when no reader anywhere consults the old columns.

- [ ] **4.1** Search the codebase for residual references — `grep -r "check_in_time\|check_out_time" src/ supabase/`. Resolve every hit (or document why it stays).
- [ ] **4.2** ⚠️ Critical — Migration `35_drop_attendance_sessions_legacy_time_columns.sql` (irreversible — column drops cannot be undone without a backup restore):
  - `ALTER TABLE attendance_sessions DROP COLUMN check_in_time, DROP COLUMN check_out_time;`
  - Decide on `date`: drop it, or keep it as a `GENERATED ALWAYS AS ((check_in_at AT TIME ZONE 'Asia/Baghdad')::date) STORED` for any external consumer we might have missed. Default: keep as generated for one release, then drop.
  - ✓ Verify: app loads, today/calendar/team pages render without errors, a fresh punch in/out cycle works end-to-end.
- [ ] **4.3** Remove dual-write code from `punch/handler.ts` and `auto-punch-out/handler.ts`.
- [ ] **4.4** Remove the `@deprecated` HH:MM-string `diffMinutes` overload.
- [ ] **4.5** Regenerate `database.types.ts`.
- [ ] **4.6** Delete this plan document.

**Phase 4 complete:** ☐

---

## Rollback Notes

Each phase is independently reversible:

- **Phase 1** — drop the new columns. Site is unaffected because nothing reads them yet.
- **Phase 2** — revert the dual-write commits. New columns stop getting populated for new rows; old columns continue to work; existing populated rows are harmless.
- **Phase 3** — revert per-task commits. Because the dual-write from Phase 2 keeps both columns valid, any reader can flip back to the old columns at any time.
- **Phase 4** — irreversible (drops data). Only run after a release cycle has confirmed Phase 3 is solid in production.

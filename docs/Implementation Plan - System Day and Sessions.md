# Implementation Plan: Attendance State System

**Source document:** `docs/System Day and Session states plan.md`
**Target audience:** GPT 5.4 (extra high) implementing the changes
**Date:** 2026-04-13

---

## How to Read This Plan

This plan is split into 7 phases. Each phase is self-contained and should be completed (and tested) before moving to the next. Within each phase, tasks are ordered by dependency. Every task includes the exact files to touch, what to change, and why.

**Critical rule:** The plan document (`docs/System Day and Session states plan.md`) is the source of truth. Where the legacy code disagrees with the plan, the plan wins. If something is ambiguous, flag it rather than guess.

---

## Progress Tracking (Multi-Run Protocol)

This project will likely span multiple runs. To ensure continuity, follow this protocol **strictly**:

### After completing each task:

1. **Update the Progress Log** at the bottom of this file (see "Progress Log" section) by appending a line:
   ```
   - [x] Task X.Y — <brief summary of what was done> — <date/run>
   ```

2. **If a task is partially complete**, mark it with `[~]` and describe what's left:
   ```
   - [~] Task 5.1 — Removed legacy types and renamed fields. Still TODO: remove normalizeSessions() and attendance_logs queries — Run 2
   ```

3. **Commit after every completed phase** (or after every 2-3 tasks if a phase is large) with a message like:
   ```
   chore(attendance): Phase 2 Tasks 2.1-2.3 — update SQL recalc and state resolvers
   ```

### At the start of each new run:

1. **Read this file first** — specifically the Progress Log at the bottom
2. **Pick up from the first unchecked `[ ]` or partially-complete `[~]` task**
3. **Do NOT redo completed tasks** — trust the progress log and verify via git log if unsure
4. **If a previously "completed" task looks wrong**, note it in the log and fix it as a new sub-task rather than unmarking the original

### If you encounter a blocking issue:

1. Add a `[BLOCKED]` entry to the log with a clear description:
   ```
   - [BLOCKED] Task 3.1 — Cannot update punch handler: DailySummaryRow type depends on database.types.ts which hasn't been regenerated yet. Need to run Phase 1 migration first or manually update the type.
   ```
2. Skip to the next unblocked task if possible
3. The human operator will resolve blockers between runs

### End-of-run protocol:

Before your run ends (whether you finished or hit limits), **always**:
1. Update the Progress Log with everything you completed or attempted
2. Add a `--- Run N ended ---` separator
3. Commit all changes (even partial work) so nothing is lost
4. Write a brief summary of what the next run should start with:
   ```
   ### Next run should start with:
   Task 4.3 (statusConfig.ts update). Phase 1-3 are complete. Phase 4 is in progress.
   ```

---

## Glossary

| Term | Meaning |
|------|---------|
| **Session** | A single punch-in/punch-out record in `attendance_sessions` |
| **Day (daily summary)** | The aggregated verdict for one employee on one date in `attendance_daily_summary` |
| **Sourced state** | A state that is written to the database (present, late, absent, on_leave) |
| **Derived state** | A state computed at read time, never stored (weekend, future, not_joined) |
| **Modifier** | An independent boolean flag on a day: `has_overtime`, `is_incomplete_shift` |
| **Chip** | The single status badge shown per employee on team boards |
| **Drill-down** | The detail view where all applicable tags are shown (not constrained to one chip) |

---

## Current State vs Target State (Summary of Gaps)

| # | Gap | Severity | Current | Target |
|---|-----|----------|---------|--------|
| 1 | `overtime_only` stored as DB status value | CRITICAL | `effective_status` check constraint includes `overtime_only`; punch handler and SQL functions produce it | Remove from storage entirely; represent as `absent` + `has_overtime=true` |
| 2 | `is_short_day` field name | CRITICAL | Column and all code uses `is_short_day` | Rename to `is_incomplete_shift` everywhere |
| 3 | `has_overtime` not a first-class column | HIGH | Derived at query time from `bool_or(s.is_overtime)` or `total_overtime_minutes > 0` | Add `has_overtime boolean` column to `attendance_daily_summary`, populated by recalc trigger |
| 4 | `on_break` live state missing | HIGH | Not in `TEAM_ATTENDANCE_LIVE_STATES` | Add as a live board state per plan definition |
| 5 | `incomplete_shift` missing from live states | HIGH | Not in `TEAM_ATTENDANCE_LIVE_STATES` | Add as a live board state (post-shift-window only) |
| 6 | `overtime_offday` used as a pseudo-status | HIGH | `dayState.ts`, `attendance.service.ts`, SQL functions all produce/consume it | Remove; represent as `weekend` + `has_overtime=true` |
| 7 | Legacy `attendance_logs` table still referenced | HIGH | `attendance.service.ts` imports types, `normalizeSessions()` converts old logs | Remove all references; the table stays in DB but code stops reading it |
| 8 | `mark-absent` only runs for today | MEDIUM | Edge function hardcodes today's date | Accept optional `date` or `from_date`/`to_date` parameters for backfill |
| 9 | Weekend rows stored with NULL effective_status | MEDIUM | Recalc writes a row with `effective_status=null` for off-days with sessions | Only write rows when there are sessions or a sourced status; weekend is derived |
| 10 | State enum proliferation | MEDIUM | `DayStatus`, `DisplayStatus`, `EffectiveStatus`, `CalendarStatus`, `OvertimeAwareAttendanceStatus`, etc. | Consolidate into: `DayStatus` (canonical), `TeamAttendanceLiveState`, `TeamAttendanceDateState`, `DisplayStatus` (individual views) |

---

## Phase 1: Database Schema Migration

**Goal:** Update the schema so the database enforces the plan's data model. All subsequent phases depend on this.

**Output:** A single new migration file `supabase/migrations/023_state_system_alignment.sql`

### Task 1.1: Add `has_overtime` column to `attendance_daily_summary`

```sql
ALTER TABLE attendance_daily_summary
  ADD COLUMN IF NOT EXISTS has_overtime boolean NOT NULL DEFAULT false;
```

**Why:** The plan defines `has_overtime` as a first-class day modifier. Currently it's derived at query time, which is fragile and duplicated across multiple SQL functions. Making it a stored column that the recalc trigger populates makes all downstream reads simpler.

### Task 1.2: Rename `is_short_day` to `is_incomplete_shift`

```sql
ALTER TABLE attendance_daily_summary
  RENAME COLUMN is_short_day TO is_incomplete_shift;
```

**Why:** Plan explicitly requires this rename (Open Concerns section). The semantics are identical; it's a naming alignment.

### Task 1.3: Remove `overtime_only` from `effective_status` check constraint

The current check constraint on `attendance_daily_summary.effective_status` is:
```sql
CHECK (effective_status IN ('present', 'late', 'overtime_only', 'absent', 'on_leave'))
```

Change to:
```sql
-- Drop old constraint and add new one
ALTER TABLE attendance_daily_summary
  DROP CONSTRAINT IF EXISTS attendance_daily_summary_effective_status_check;

ALTER TABLE attendance_daily_summary
  ADD CONSTRAINT attendance_daily_summary_effective_status_check
  CHECK (effective_status IN ('present', 'late', 'absent', 'on_leave'));
```

**Before dropping the constraint**, migrate existing rows:
```sql
UPDATE attendance_daily_summary
SET effective_status = 'absent',
    has_overtime = true
WHERE effective_status = 'overtime_only';
```

**Why:** Plan Decision #3 - overtime is a modifier, not a status. `overtime_only` rows become `absent` + `has_overtime=true`.

### Task 1.4: Update unique constraints and indexes

Verify the unique constraint `(user_id, date)` still applies (it should - no change needed). Optionally add an index on `has_overtime` if query patterns warrant it (not required now).

### Task 1.5: Handle the `overtime_offday` case

`overtime_offday` is NOT a value in the `effective_status` column (the DB never stores it). It's computed in SQL functions and TypeScript. The DB migration doesn't need to handle it, but note for later phases: `overtime_offday` in code maps to "off-day + has sessions" which the plan represents as derived `weekend` state + `has_overtime=true` modifier.

### Edge case: Existing rows with `effective_status = NULL` on off-days

Per the plan (Decision #4): "Stored rows are authoritative for past dates." Currently the recalc writes rows with `effective_status = NULL` for off-days where sessions exist. The plan says weekend is derived (no row needed), BUT if sessions exist on an off-day, we still need a daily summary row to aggregate them.

**Decision needed:** Keep writing rows for off-days that have sessions, but set `effective_status = NULL` (meaning "no verdict applicable - derived states handle display"). This is compatible with the plan because the row exists only to carry aggregated session data (work minutes, overtime minutes, has_overtime, session_count). The `weekend` status is still derived at read time by the resolver.

**Action:** No migration change for NULL rows. The recalc function will continue to write rows when sessions exist regardless of working day status.

---

## Phase 2: Backend SQL Functions

**Goal:** Update all PostgreSQL functions to match the plan's state model. This is the most critical phase.

**Output:** The same migration file `023_state_system_alignment.sql` (appended), or a separate `024_update_sql_functions.sql` if preferred for reviewability.

### Task 2.1: Update `recalculate_attendance_daily_summary()`

**File:** Defined in migration `020_repair_attendance_automation.sql` (latest version). Will be replaced by the new migration.

**Changes:**
1. Rename `_is_short_day` variable to `_is_incomplete_shift`
2. Populate `has_overtime` from session data
3. Stop producing `overtime_only` as an effective_status value
4. Write `is_incomplete_shift` instead of `is_short_day`

**New logic for effective_status resolution:**
```sql
-- After aggregating sessions...
_has_overtime := exists(
  SELECT 1 FROM attendance_sessions
  WHERE user_id = p_user_id AND date = p_date AND is_overtime = true
);

-- effective_status resolution:
IF _has_leave THEN
  _effective_status := 'on_leave';
ELSIF NOT _is_working_day THEN
  _effective_status := null;  -- off-day; display is derived
ELSIF _regular_session_count = 0 AND _total_session_count = 0 THEN
  _effective_status := 'absent';
ELSIF _regular_session_count = 0 AND _total_session_count > 0 THEN
  -- Only overtime sessions exist on a working day
  -- Plan: this is absent + has_overtime (NOT overtime_only)
  _effective_status := 'absent';
ELSIF _has_late AND NOT _has_present THEN
  _effective_status := 'late';
ELSIF _has_present THEN
  _effective_status := 'present';
ELSE
  _effective_status := null;
END IF;

-- is_incomplete_shift: only meaningful for present/late
_is_incomplete_shift := (
  _effective_status IN ('present', 'late')
  AND _min_required IS NOT NULL
  AND _total_work < _min_required
);
```

**UPSERT payload changes:**
```sql
-- Old:
is_short_day = _is_short_day
-- New:
is_incomplete_shift = _is_incomplete_shift,
has_overtime = _has_overtime
```

**Important:** The trigger function `trigger_recalculate_attendance_daily_summary()` that fires on `attendance_sessions` changes calls this function. It doesn't need changes itself (it just passes user_id and date through).

### Task 2.2: Update `resolve_team_attendance_date_state()`

**File:** Defined in migration `019_team_attendance_state_unification.sql`

**Current signature:**
```sql
resolve_team_attendance_date_state(
  p_effective_status text,
  p_is_short_day boolean,
  p_has_shift boolean,
  p_is_working_day boolean,
  p_has_leave boolean
)
```

**New signature:**
```sql
resolve_team_attendance_date_state(
  p_effective_status text,
  p_is_incomplete_shift boolean,  -- renamed
  p_has_shift boolean,
  p_is_working_day boolean,
  p_has_leave boolean
)
```

**Logic changes:** Rename internal references from `p_is_short_day` to `p_is_incomplete_shift`. The actual state machine logic stays the same:
- `on_leave` -> `'on_leave'`
- `late` -> `'late'`
- `present` + `is_incomplete_shift` -> `'incomplete_shift'`
- `present` -> `'fulfilled_shift'`
- `absent` (includes old `overtime_only` cases) -> `'absent'`
- no shift / not working day -> `'neutral'`

### Task 2.3: Update `resolve_team_attendance_live_state()`

**File:** Defined in migration `019_team_attendance_state_unification.sql`

**Current states returned:** `available_now`, `late`, `not_entered_yet`, `absent`, `on_leave`, `fulfilled_shift`, `neutral`

**Missing states per plan:** `on_break`, `incomplete_shift`

**New logic (complete rewrite of the function body):**

```sql
CREATE OR REPLACE FUNCTION resolve_team_attendance_live_state(
  p_date date,
  p_today date,
  p_now_time time,
  p_work_end_time time,
  p_has_shift boolean,
  p_is_working_day boolean,
  p_has_leave boolean,
  p_is_checked_in_now boolean,
  p_session_count int,
  p_has_regular_session boolean,
  p_team_date_state text,
  p_is_incomplete_shift boolean  -- NEW parameter
) RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
SELECT CASE
  -- Leave always wins
  WHEN p_has_leave THEN 'on_leave'

  -- Currently checked in
  WHEN p_is_checked_in_now THEN
    CASE
      WHEN p_team_date_state = 'late' THEN 'late'
      ELSE 'available_now'
    END

  -- Not checked in, no shift or off-day
  WHEN NOT p_has_shift OR NOT p_is_working_day THEN 'neutral'

  -- Not checked in, no regular sessions at all
  WHEN NOT p_has_regular_session THEN
    CASE
      WHEN p_date < p_today THEN 'absent'
      WHEN p_now_time >= p_work_end_time THEN 'absent'
      ELSE 'not_entered_yet'
    END

  -- Not checked in, HAS regular sessions (was here, now checked out)
  WHEN p_has_regular_session THEN
    CASE
      -- Shift window still open
      WHEN p_now_time < p_work_end_time AND p_date = p_today THEN
        CASE
          WHEN p_team_date_state = 'late' THEN 'late'  -- late persists through breaks
          ELSE 'on_break'  -- on time, checked out mid-shift
        END
      -- Shift window closed (or past date)
      ELSE
        CASE
          WHEN p_team_date_state = 'late' THEN 'late'
          WHEN p_is_incomplete_shift THEN 'incomplete_shift'
          WHEN p_team_date_state = 'fulfilled_shift' THEN 'fulfilled_shift'
          ELSE 'neutral'
        END
    END

  ELSE 'neutral'
END;
$$;
```

**Key additions:**
- **`on_break`**: Employee arrived on time, has sessions, not currently checked in, shift window still open. Per the plan: "Employee arrived on time and has at least one session today, but is not currently in an open session, has not yet met the shift minimum, and the shift window is still open."
- **`incomplete_shift`**: After shift window closes, employee was on time but didn't meet minimum hours. Per the plan: "Only appears after the shift window closes."
- **`late` persists through breaks**: A late employee on break still shows `late`, not `on_break`. Per the plan: "lateness is a fact about today that doesn't go away when the employee steps out."

**Chip priority for post-shift-window** (plan line 72):
`on_leave` -> `absent` -> `late` -> `incomplete_shift` -> `fulfilled_shift`

This priority is naturally enforced by the CASE ordering above.

### Task 2.4: Update `get_team_attendance_day()`

**File:** Defined in migration `019_team_attendance_state_unification.sql`

**Changes:**
1. All references to `is_short_day` -> `is_incomplete_shift` in SELECT lists and function calls
2. Remove any `overtime_only` display_status derivation; use `absent` + `has_overtime` instead
3. Pass `is_incomplete_shift` to the updated `resolve_team_attendance_live_state()`
4. The `has_overtime` column is now read directly from `attendance_daily_summary` instead of being computed from session joins (simpler)

**Specific changes in the SQL body:**

Where the function currently does:
```sql
bool_or(s.is_overtime) as has_overtime
```
Replace with reading from the summary table:
```sql
ads.has_overtime
```

Where it currently references `is_short_day`:
```sql
-- Old:
n.is_short_day
-- New:
n.is_incomplete_shift
```

Where it passes to `resolve_team_attendance_date_state`:
```sql
-- Old:
resolve_team_attendance_date_state(n.effective_status, n.is_short_day, ...)
-- New:
resolve_team_attendance_date_state(n.effective_status, n.is_incomplete_shift, ...)
```

Where it passes to `resolve_team_attendance_live_state`, add the new parameter:
```sql
resolve_team_attendance_live_state(
  ...,
  n.is_incomplete_shift  -- new parameter at the end
)
```

Where `display_status` is derived using CASE with `overtime_only` / `overtime_offday`:
```sql
-- Remove these cases entirely. display_status derivation should not produce
-- overtime_only or overtime_offday. The has_overtime flag is the separate
-- indicator. If the function returns display_status, it should use the
-- team_date_state instead.
```

### Task 2.5: Update `get_redacted_department_availability()`

**File:** Defined in migration `019_team_attendance_state_unification.sql`

Same pattern as Task 2.4:
- Rename `is_short_day` references
- Read `has_overtime` from summary instead of computing from sessions
- Pass `is_incomplete_shift` to live state resolver

### Task 2.6: Update `get_redacted_team_attendance_day()`

**File:** Defined in migration `015_team_attendance_redacted_day.sql`

Same changes:
- Remove `overtime_only` from display_status CASE
- Use `is_incomplete_shift` instead of `is_short_day`
- Use stored `has_overtime` instead of computed

### Task 2.7: Update leave recalc trigger

**File:** Defined in migration `011_leave_recalculate_daily_summary.sql`

The trigger function `trigger_recalc_summary_on_leave_change()` calls `recalculate_attendance_daily_summary()` which is being updated. The trigger itself doesn't need changes - it just passes user_id and date.

**No changes needed.** Just verify it still works after the recalc function is updated.

---

## Phase 3: Edge Functions (Deno/TypeScript)

**Goal:** Update the Supabase Edge Functions to stop producing `overtime_only` and use the new column names.

### Task 3.1: Update Punch Handler

**File:** `supabase/functions/punch/handler.ts`

**Changes:**

1. **`DailySummaryRow` type** (line 104-115): Update field names and remove `overtime_only`
```typescript
// Old:
effective_status: 'present' | 'late' | 'overtime_only' | 'absent' | 'on_leave' | null;
is_short_day: boolean;

// New:
effective_status: 'present' | 'late' | 'absent' | 'on_leave' | null;
is_incomplete_shift: boolean;
has_overtime: boolean;
```

2. **`resolveEffectiveStatus()` function** (line 328-349): Remove `overtime_only` return
```typescript
// Old (line 347):
if (sessions.every((s) => s.is_overtime)) return 'overtime_only';

// New:
if (sessions.every((s) => s.is_overtime)) return 'absent';
// has_overtime is computed separately
```

3. **`recalculateDailySummary()` function** (line 351-410): Add `has_overtime` computation
```typescript
// After line 370 (where sessions are loaded), add:
const hasOvertime = sessions.some((s) => s.is_overtime);

// In the payload object (line 387), change:
// Old:
is_short_day: isShortDay,
// New:
is_incomplete_shift: isShortDay,  // rename only, same logic
has_overtime: hasOvertime,
```

Also rename the local variable:
```typescript
// Old:
const isShortDay = ...
// New:
const isIncompleteShift = ...
```

### Task 3.2: Update Auto-Punch-Out Handler

**File:** `supabase/functions/auto-punch-out/handler.ts`

Read this file and check if it references `is_short_day` or `overtime_only`. If it calls `recalculateDailySummary` from the punch handler, it inherits the fix. If it has its own logic, apply the same changes.

**Likely changes:** Minimal - the auto-punch-out handler primarily updates session rows and triggers the SQL recalc via the trigger. Just verify no TypeScript types reference the old names.

### Task 3.3: Update Mark-Absent Handler

**File:** `supabase/functions/mark-absent/handler.ts`

**Changes:**

1. **Accept optional date range parameter** for backfill capability:
```typescript
// Parse optional body parameters
let body: { date?: string; from_date?: string; to_date?: string } = {};
try {
  body = await req.json();
} catch { /* no body = use today */ }

const dates: string[] = [];
if (body.from_date && body.to_date) {
  // Generate date range
  let current = new Date(body.from_date);
  const end = new Date(body.to_date);
  while (current <= end) {
    dates.push(toDateStr(current));
    current.setDate(current.getDate() + 1);
  }
} else {
  dates.push(body.date ?? toDateStr(effectiveNow));
}

// Then loop over dates instead of just today
for (const dateStr of dates) {
  // existing logic but using dateStr instead of today
}
```

2. **The SQL RPC call** (line 141-144): This calls `recalculate_attendance_daily_summary` which is the SQL function (not the TS one). The SQL function is updated in Phase 2. No change needed to the RPC call itself.

**Why:** Plan Open Concern (line 133): "mark-absent only runs for today: No way to backfill an arbitrary date range."

---

## Phase 4: Shared Frontend Types & Utilities

**Goal:** Update the shared type system and utility functions to match the plan.

### Task 4.1: Update `src/shared/attendance/teamState.ts`

**Add `on_break` and `incomplete_shift` to live states:**
```typescript
// Old:
export const TEAM_ATTENDANCE_LIVE_STATES = [
  'available_now',
  'late',
  'not_entered_yet',
  'absent',
  'on_leave',
  'fulfilled_shift',
  'neutral',
] as const;

// New:
export const TEAM_ATTENDANCE_LIVE_STATES = [
  'available_now',
  'late',
  'on_break',           // NEW
  'not_entered_yet',
  'absent',
  'on_leave',
  'incomplete_shift',   // NEW
  'fulfilled_shift',
  'neutral',
] as const;
```

**Add to `TEAM_ATTENDANCE_PRIMARY_STATES`:**
```typescript
// Add 'on_break' to the primary states array
export const TEAM_ATTENDANCE_PRIMARY_STATES = [
  'available_now',
  'fulfilled_shift',
  'incomplete_shift',
  'late',
  'on_break',           // NEW
  'not_entered_yet',
  'absent',
  'on_leave',
  'neutral',
] as const;
```

**Add state definitions:**
```typescript
// In TEAM_ATTENDANCE_STATE_DEFINITIONS, add:
on_break: {
  label: 'في استراحة',
  labelEn: 'On break',
  chipVisible: true,
  liveMeaning: 'Arrived on time, has sessions today, not currently checked in, shift window still open.',
},
```

**Update `TeamAttendanceChipKey`:**
```typescript
export type TeamAttendanceChipKey =
  | 'all'
  | 'available_now'
  | 'fulfilled_shift'
  | 'incomplete_shift'
  | 'late'
  | 'on_break'         // NEW
  | 'not_entered_yet'
  | 'absent'
  | 'on_leave'
  | 'overtime';
```

### Task 4.2: Update `src/shared/attendance/dayState.ts`

**Remove `overtime_only` and `overtime_offday` from the type and switch:**

```typescript
// Old:
export type OvertimeAwareAttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'on_leave'
  | 'overtime_only'
  | 'overtime_offday'
  | null
  | undefined;

// New:
export type OvertimeAwareAttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'on_leave'
  | null
  | undefined;
```

**Update `resolveAttendanceDayState()`:**

The function should now also accept `has_overtime` as a parameter since it can't derive it from the status value anymore:

```typescript
export function resolveAttendanceDayState(
  status: OvertimeAwareAttendanceStatus,
  hasOvertime: boolean = false  // NEW parameter
): AttendanceDayState {
  switch (status) {
    case 'late':
      return { dayStatus: 'late', hasOvertime };
    case 'absent':
      return { dayStatus: 'absent', hasOvertime };
    case 'on_leave':
      return { dayStatus: 'on_leave', hasOvertime: false };
    case 'present':
      return { dayStatus: 'present', hasOvertime };
    case null:
    case undefined:
    default:
      return { dayStatus: 'present', hasOvertime };
  }
}
```

**Why:** With `overtime_only` gone from the DB, the function can no longer infer `hasOvertime` from the status value. The caller must pass the `has_overtime` column value.

**Update all callers** of `resolveAttendanceDayState()` to pass the `has_overtime` field from the daily summary.

### Task 4.3: Update `src/shared/attendance/statusConfig.ts`

**Add display config for `on_break`:**
```typescript
// In TEAM_STATUS_DISPLAY, add:
on_break: {
  label: 'في استراحة',
  labelEn: 'On break',
  color: 'text-teal-700',
  bgColor: 'bg-teal-50',
  borderColor: 'border-teal-500',
  dotColor: 'bg-teal-500',
},
```

### Task 4.4: Update `src/shared/attendance/statusAdapters.ts`

This file has extensive `overtime_only` and `overtime_offday` references. All need updating:

1. Remove `overtime_only` and `overtime_offday` from type unions
2. Update `isOvertimeStatus()` - this function should now check the `has_overtime` field, not the status string
3. Update any mapping functions that convert between status types

**The general pattern:** Anywhere that checks `status === 'overtime_only'` or `status === 'overtime_offday'`, replace with checking the `has_overtime` boolean that accompanies the status.

### Task 4.5: Update `src/shared/attendance/todayRecord.ts`

Remove `overtime_only` check:
```typescript
// Old (line 64):
record.summary?.effective_status === 'overtime_only' ||

// New: check has_overtime field instead
record.summary?.has_overtime ||
```

### Task 4.6: Update `src/shared/attendance/types.ts`

**No changes needed.** The `DayStatus`, `LivePresence`, and `DisplayStatus` types are already correct per the plan. They don't include `overtime_only`.

### Task 4.7: Update `src/shared/attendance/resolveDisplayStatus.ts`

**No changes needed.** This function operates on `DayStatus` which never included `overtime_only`. It's already correct.

---

## Phase 5: Service Layer

**Goal:** Update the attendance service to use the new field names, remove legacy types, and stop using `attendance_logs`.

### Task 5.1: Update `src/lib/services/attendance.service.ts`

This is a large file with many changes. Group them:

**A. Remove legacy `attendance_logs` types and imports:**
```typescript
// Remove these lines (13-15):
export type AttendanceLog = Tables<'attendance_logs'>;
export type AttendanceLogInsert = InsertTables<'attendance_logs'>;
export type AttendanceStatus = AttendanceLog['status'];
```

Replace `AttendanceStatus` with an inline type where used:
```typescript
export type AttendanceStatus = 'present' | 'late';
```

**B. Update `CalendarStatus` type** (line 20):
```typescript
// Old:
export type CalendarStatus = AttendanceStatus | 'overtime_only' | 'overtime_offday' | 'weekend' | 'future' | null;

// New:
export type CalendarStatus = 'present' | 'late' | 'absent' | 'on_leave' | 'weekend' | 'future' | null;
```

**C. Update `TodayRecord` interface** (line 45-51):
Remove `log: AttendanceLog | null` field. Sessions and summary are the source of truth now.

**D. Update `DayRecord` interface** (line 53-60):
Same - remove `log` field.

**E. Remove `normalizeSessions()` function** (~line 533+):
This function converts old `attendance_logs` rows into session objects. It's legacy scaffolding. Remove entirely.

**F. Remove all `attendance_logs` queries:**
Search for `.from('attendance_logs')` and remove those code paths. All data should come from `attendance_sessions` and `attendance_daily_summary`.

**G. Update all `is_short_day` references to `is_incomplete_shift`:**
```typescript
// Old (line 488 area):
summary.is_short_day
// New:
summary.is_incomplete_shift
```

**H. Update `TeamAttendanceDisplayStatus` type** (line 108):
```typescript
// Old:
export type TeamAttendanceDisplayStatus = AttendanceEffectiveStatus | 'overtime_offday' | null;

// New:
export type TeamAttendanceDisplayStatus = AttendanceEffectiveStatus | null;
```

**I. Update all `overtime_only`/`overtime_offday` logic in calendar resolution:**
Lines 166-204 contain calendar status resolution that produces `overtime_only` and `overtime_offday`. Rewrite:

```typescript
// Old pattern:
if (summary?.effective_status === 'overtime_only') return 'overtime_only';
if (isOffDay && (summary?.session_count ?? 0) > 0) return 'overtime_offday';

// New pattern: effective_status is now just present/late/absent/on_leave/null
// Overtime is indicated by has_overtime on the summary, not by the status value.
// The CalendarStatus no longer includes overtime_only/overtime_offday.
// If it's an off-day, return 'weekend'.
// The has_overtime info is carried separately (not in CalendarStatus).
```

**J. Update `mapHistoryPrimaryState()`** (~line 448+):
```typescript
// Remove:
case 'overtime_only':
  ...
case 'overtime_offday':
  ...
// These cases no longer exist in effective_status
```

### Task 5.2: Update `src/lib/database.types.ts`

This file is auto-generated from Supabase. After applying the migration, regenerate it:
```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
```

If manual editing is needed before migration is applied:
```typescript
// In attendance_daily_summary Row type:
// Old:
effective_status: 'present' | 'late' | 'overtime_only' | 'absent' | 'on_leave' | null;
is_short_day: boolean;

// New:
effective_status: 'present' | 'late' | 'absent' | 'on_leave' | null;
is_incomplete_shift: boolean;
has_overtime: boolean;
```

### Task 5.3: Update `src/lib/ui-helpers.ts`

Remove `overtime_only` and `overtime_offday` cases:
```typescript
// Old (lines 11-12):
case 'overtime_only':
case 'overtime_offday':

// Remove these cases entirely
```

---

## Phase 6: Frontend Components

**Goal:** Update all UI components that consume attendance state.

### Task 6.1: Update `src/app/components/attendance/attendanceStatusTheme.ts`

Remove `overtime_only` and `overtime_offday` from the theme type and config:
```typescript
// Remove from StatusThemeKey:
| 'overtime_only'
| 'overtime_offday'

// Remove from STATUS_THEMES map:
overtime_only: makeTheme('عمل إضافي', STATUS_COLORS.overtime),
overtime_offday: makeTheme('عمل إضافي', STATUS_COLORS.overtime),

// Remove from CALENDAR_VISIBLE_STATUSES:
'overtime_only',

// Keep the 'overtime' key in ALIAS_MAP but map it differently
// (or remove if no longer needed for alias resolution)
```

### Task 6.2: Update `src/app/components/attendance/DayDetailsSheet.tsx`

Remove `overtime_offday` and `overtime_only` display status derivation:
```typescript
// Old (line 129):
? 'overtime_offday'
// Old (lines 138-139):
displayStatus === 'overtime_only' ||
displayStatus === 'overtime_offday'

// New: use has_overtime from the summary instead
```

### Task 6.3: Update `src/app/components/attendance/MonthCalendarHeatmap.tsx`

```typescript
// Old (line 95):
const isOvertimeOffday = summary?.status === 'overtime_offday';

// New: Check has_overtime from the summary data
const hasOvertime = summary?.hasOvertime ?? false;
```

### Task 6.4: Update `src/app/components/attendance/TodayStatusCard.tsx`

```typescript
// Old (line 70):
const overtimeColor = getStatusTheme('overtime_only').color;

// New: use a generic overtime color, e.g.:
const overtimeColor = STATUS_COLORS.overtime;  // or define directly
```

### Task 6.5: Update `src/app/pages/employee/AttendancePage.tsx`

```typescript
// Old (line 49):
if (raw === 'overtime' || raw === 'overtime_only' || raw === 'overtime_offday') return 'overtime';

// New:
if (raw === 'overtime') return 'overtime';
// overtime_only and overtime_offday no longer exist as status values
```

### Task 6.6: Update `src/app/pages/admin/UserDetailsPage.tsx`

```typescript
// Old (line 104):
todayRecord.summary?.effective_status === 'overtime_only' ||

// New:
todayRecord.summary?.has_overtime ||
```

### Task 6.7: Update Team Attendance Page for `on_break`

**File:** `src/app/pages/team/TeamAttendancePage.tsx`

The team attendance page needs to handle the new `on_break` and `incomplete_shift` live states. This likely involves:

1. Adding `on_break` to the chip filter options (if chips are shown)
2. Ensuring the "available now" / "not available now" sectioning treats `on_break` as "not available now" (per plan: sections are driven by whether the employee has an open session)
3. Displaying the `on_break` chip with the proper color from `statusConfig.ts`

**Sectioning rule (plan line 70):**
> The "available now" / "not available now" split on the Live Board is driven purely by whether the employee currently has an open session, independent of which chip they carry.

So `on_break` employees go in "not available now" section but carry the `on_break` chip.

### Task 6.8: Update tests

**Files:**
- `src/lib/services/attendance.service.test.ts`
- `src/app/pages/team/TeamAttendancePage.test.tsx`
- `src/app/pages/admin/UserDetailsPage.test.tsx`
- `supabase/functions/punch/handler.test.ts`

All test files that reference `overtime_only`, `overtime_offday`, or `is_short_day` need updating:
- Replace `effective_status: 'overtime_only'` with `effective_status: 'absent'` + `has_overtime: true`
- Replace `display_status: 'overtime_only'` with the new expected value
- Replace `is_short_day` with `is_incomplete_shift`
- Add new tests for `on_break` state
- Add new tests for `incomplete_shift` as a live state

---

## Phase 7: Legacy Cleanup & Consolidation

**Goal:** Remove dead code paths and tighten the type system.

### Task 7.1: Remove `attendance_logs` from database.types.ts

After regenerating types from the migration, the `attendance_logs` table types will still be present (the table still exists in DB). That's fine - just ensure no application code imports or uses them.

**Search for and remove any remaining imports of:**
- `AttendanceLog`
- `AttendanceLogInsert`
- `attendance_logs`

### Task 7.2: Consolidate status enums (assessment)

The plan notes too many overlapping enums. After the above changes, audit what's left:

| Enum | Still needed? | Purpose |
|------|---------------|---------|
| `DayStatus` | YES | Canonical day states (present, late, absent, on_leave, weekend, holiday, future, not_joined) |
| `DisplayStatus` | ASSESS | Used for individual employee views (today card, history). May be replaceable by `DayStatus` + `LivePresence` in all cases |
| `TeamAttendanceLiveState` | YES | Live board states |
| `TeamAttendanceDateState` | YES | Date board states |
| `CalendarStatus` | ASSESS | Used for calendar heatmap. May be replaceable by `DayStatus` |
| `OvertimeAwareAttendanceStatus` | REMOVE | Was a bridge type for `overtime_only`/`overtime_offday`. No longer needed after Phase 4 cleanup |
| `TeamAttendanceDisplayStatus` | ASSESS | Used in service layer. May collapse into `AttendanceEffectiveStatus` |

**Recommendation:** After all other changes are done, attempt to collapse `CalendarStatus` into `DayStatus` and remove `OvertimeAwareAttendanceStatus` entirely. `DisplayStatus` is more complex and can be deferred.

### Task 7.3: Verify `weekend` row handling

After Phase 2 changes, verify that:
1. The recalc function only writes rows when there are sessions or a sourced status
2. Off-days with no sessions do NOT get a row written
3. Off-days WITH sessions get a row with `effective_status = NULL`, `has_overtime = true`, and correct session aggregates
4. The team board functions correctly derive `weekend`/`neutral` for these cases

---

## Edge Cases & Decisions Log

### EC-1: Late employee on break

**Scenario:** Employee punches in late at 09:30 (shift start 08:00, grace 15min). Punches out at 12:00 for lunch. It's now 12:30, shift ends at 17:00.

**Expected live state:** `late` (NOT `on_break`)

**Why:** Plan says "lateness is a fact about today that doesn't go away when the employee steps out." The `late` chip persists through breaks. The employee appears in "not available now" section with `late` chip.

**Implementation:** In `resolve_team_attendance_live_state`, the `late` check comes before `on_break` in the CASE when `p_has_regular_session` and shift window is open.

### EC-2: On-time employee who checked out early, shift still open

**Scenario:** Employee punches in at 08:00, punches out at 10:00. Shift ends at 17:00. It's now 11:00.

**Expected live state:** `on_break`

**Why:** They arrived on time, have sessions, aren't currently checked in, and the shift window is still open. They might come back.

### EC-3: Employee with ONLY overtime sessions on a working day

**Scenario:** Employee didn't work their regular shift but came in at 20:00 (after shift hours) for overtime.

**Expected day state:** `absent` with `has_overtime = true`
**Expected live state (if shift ended):** `absent`
**Expected date state:** `absent`

**Why:** Plan says "`overtime_only` is not a day state - it's `absent` + `has_overtime=true`." They didn't fulfill any shift obligation.

### EC-4: Employee with sessions on a weekend/off-day

**Scenario:** Employee works on Saturday (their off-day). Has overtime sessions.

**Expected day state:** `weekend` (derived, since the schedule says it's an off-day)
**Modifiers:** `has_overtime = true`
**Daily summary row:** Written with `effective_status = NULL`, `has_overtime = true`, session data populated
**Live/date board:** `neutral` (off-day, no shift expected)

### EC-5: Late employee who also didn't meet shift minimum

**Scenario:** Employee arrives at 10:00 (late), works until 14:00, shift is 08:00-17:00, minimum 7 hours.

**Expected day state:** `late` with `is_incomplete_shift = true`
**Expected chip (single):** `late` (priority: late > incomplete_shift per plan)
**Expected drill-down:** Shows both `late` and `incomplete_shift` tags

### EC-6: mark-absent backfill for a range

**Scenario:** Server was down for 3 days. Admin triggers mark-absent with `from_date: '2026-04-10'`, `to_date: '2026-04-12'`.

**Expected:** Function iterates all 3 dates, calls `recalculate_attendance_daily_summary` for each user for each date. Users with no sessions get `absent` row. Users with existing summaries are skipped (idempotent).

### EC-7: `on_break` vs `incomplete_shift` timing boundary

**Scenario:** Employee checked in at 08:00, checked out at 12:00. Shift is 08:00-17:00, minimum 7 hours. It's now 17:01.

**Expected live state at 16:59:** `on_break` (shift window still open)
**Expected live state at 17:01:** `incomplete_shift` (shift window closed, minimum not met)

**Why:** Plan says `incomplete_shift` "Only appears after the shift window closes - during the shift window, an on-time employee who hasn't met the minimum yet shows as `available_now` or `on_break` instead."

---

## File Inventory (All Files Requiring Changes)

### Database / SQL
| File | Changes |
|------|---------|
| `supabase/migrations/023_state_system_alignment.sql` | **NEW FILE** - schema changes + function rewrites |

### Edge Functions (Deno)
| File | Changes |
|------|---------|
| `supabase/functions/punch/handler.ts` | Remove `overtime_only`, rename `is_short_day`, add `has_overtime` |
| `supabase/functions/punch/handler.test.ts` | Update test expectations |
| `supabase/functions/mark-absent/handler.ts` | Add date range parameter |
| `supabase/functions/auto-punch-out/handler.ts` | Verify/update types |

### Shared Attendance Module
| File | Changes |
|------|---------|
| `src/shared/attendance/types.ts` | No changes needed |
| `src/shared/attendance/teamState.ts` | Add `on_break`, `incomplete_shift` to live states |
| `src/shared/attendance/dayState.ts` | Remove `overtime_only`/`overtime_offday`, add `hasOvertime` param |
| `src/shared/attendance/statusConfig.ts` | Add `on_break` display config |
| `src/shared/attendance/statusAdapters.ts` | Remove `overtime_only`/`overtime_offday` refs |
| `src/shared/attendance/todayRecord.ts` | Use `has_overtime` field |
| `src/shared/attendance/resolveDisplayStatus.ts` | No changes needed |
| `src/shared/attendance/constants.ts` | No changes needed |

### Service Layer
| File | Changes |
|------|---------|
| `src/lib/services/attendance.service.ts` | Major: remove legacy types, rename fields, remove overtime_only logic |
| `src/lib/services/attendance.service.test.ts` | Update all tests |
| `src/lib/database.types.ts` | Regenerate from migration |
| `src/lib/ui-helpers.ts` | Remove overtime_only/overtime_offday cases |

### UI Components
| File | Changes |
|------|---------|
| `src/app/components/attendance/attendanceStatusTheme.ts` | Remove overtime_only/overtime_offday themes |
| `src/app/components/attendance/DayDetailsSheet.tsx` | Remove overtime_only/overtime_offday display logic |
| `src/app/components/attendance/MonthCalendarHeatmap.tsx` | Use has_overtime instead of status check |
| `src/app/components/attendance/TodayStatusCard.tsx` | Update overtime color reference |

### Pages
| File | Changes |
|------|---------|
| `src/app/pages/employee/AttendancePage.tsx` | Remove overtime_only/overtime_offday mapping |
| `src/app/pages/admin/UserDetailsPage.tsx` | Use has_overtime field |
| `src/app/pages/admin/UserDetailsPage.test.tsx` | Update tests |
| `src/app/pages/team/TeamAttendancePage.tsx` | Handle on_break state, update sectioning |
| `src/app/pages/team/TeamAttendancePage.test.tsx` | Update tests |

---

## Verification Checklist

After all phases are complete, verify:

- [ ] `overtime_only` does not appear anywhere in the codebase except historical migration files and this plan doc
- [ ] `overtime_offday` does not appear anywhere in the codebase except historical migration files
- [ ] `is_short_day` does not appear anywhere except historical migration files and `database.types.ts` (if table still has old column - should be renamed)
- [ ] `attendance_logs` is not queried by any application code (table can remain in DB)
- [ ] All TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] All existing tests pass after updates (`npm test`)
- [ ] New tests exist for `on_break` state transitions
- [ ] New tests exist for `incomplete_shift` as a live state
- [ ] The mark-absent function accepts and processes date ranges
- [ ] `has_overtime` column exists on `attendance_daily_summary` and is populated by the recalc trigger
- [ ] `is_incomplete_shift` column exists (renamed from `is_short_day`)
- [ ] Team live board shows `on_break` chip for on-time employees checked out mid-shift
- [ ] Team live board shows `late` chip persisting through breaks
- [ ] Chip priority order is: on_leave -> absent -> late -> incomplete_shift -> fulfilled_shift
- [ ] Drill-down views show both punctuality AND shift completion tags

---

## Interim Note: Holiday Handling

The plan defines `holiday` as a day state ("An official holiday. No shift was expected.") but defers full holiday support to future work. During this implementation:

- The `DayStatus` type already includes `'holiday'` - do NOT remove it
- `resolveDisplayStatus` already handles `holiday` -> `'holiday'` - no changes needed
- There is no `holidays` table or holiday detection logic in the DB yet
- When holiday support is added later, it will slot in as another sourced state (like `on_leave`) without schema changes
- Until then, official holidays that happen to fall on working days will show as `absent` unless the admin creates leave records for them. This is an accepted limitation.

**Action for implementer:** Do not add holiday detection logic. Just ensure the existing `holiday` type paths are not accidentally removed during refactoring.

---

## Out of Scope (Deferred per Plan)

These items are mentioned in the plan's Future Work / Open Concerns but are NOT part of this implementation:

1. **Splitting `neutral` into `off_day` + `unscheduled`** - deferred, adds frontend complexity without fixing a painful bug
2. **Historical schedule versioning** - recalc still reads current schedule for past dates; acknowledged limitation
3. **Holiday support** - will slot in later as another sourced state; see "Interim Note: Holiday Handling" above
4. **Removing `attendance_logs` table from DB** - code stops using it, but the table stays for data preservation

---

## Progress Log

Track completion of every task here. **This section is the single source of truth for multi-run continuity.**

### Phase 1: Database Schema Migration
- [x] Task 1.1 — Add `has_overtime` column to `attendance_daily_summary`
- [x] Task 1.2 — Rename `is_short_day` to `is_incomplete_shift`
- [x] Task 1.3 — Remove `overtime_only` from check constraint (migrate existing rows first)
- [x] Task 1.4 — Verify unique constraints and indexes
- [x] Task 1.5 — Verify off-day row handling decision

### Phase 2: Backend SQL Functions
- [x] Task 2.1 — Update `recalculate_attendance_daily_summary()`
- [x] Task 2.2 — Update `resolve_team_attendance_date_state()`
- [x] Task 2.3 — Update `resolve_team_attendance_live_state()` (add `on_break`, `incomplete_shift`)
- [x] Task 2.4 — Update `get_team_attendance_day()`
- [x] Task 2.5 — Update `get_redacted_department_availability()`
- [x] Task 2.6 — Update `get_redacted_team_attendance_day()`
- [x] Task 2.7 — Verify leave recalc trigger still works

### Phase 3: Edge Functions (Deno/TypeScript)
- [x] Task 3.1 — Update punch handler (remove `overtime_only`, rename fields, add `has_overtime`)
- [x] Task 3.2 — Update auto-punch-out handler (verify types)
- [x] Task 3.3 — Update mark-absent handler (add date range support)

### Phase 4: Shared Frontend Types & Utilities
- [x] Task 4.1 — Update `teamState.ts` (add `on_break`, `incomplete_shift` to live states)
- [x] Task 4.2 — Update `dayState.ts` (remove `overtime_only`/`overtime_offday`, add `hasOvertime` param)
- [x] Task 4.3 — Update `statusConfig.ts` (add `on_break` display config)
- [x] Task 4.4 — Update `statusAdapters.ts` (remove `overtime_only`/`overtime_offday` refs)
- [x] Task 4.5 — Update `todayRecord.ts` (use `has_overtime` field)
- [x] Task 4.6 — Verify `types.ts` needs no changes
- [x] Task 4.7 — Verify `resolveDisplayStatus.ts` needs no changes

### Phase 5: Service Layer
- [~] Task 5.1 — Update `attendance.service.ts` (all sub-tasks A through J)
- [x] Task 5.2 — Update `database.types.ts` (regenerate or manual edit)
- [x] Task 5.3 — Update `ui-helpers.ts`

### Phase 6: Frontend Components
- [x] Task 6.1 — Update `attendanceStatusTheme.ts`
- [x] Task 6.2 — Update `DayDetailsSheet.tsx`
- [x] Task 6.3 — Update `MonthCalendarHeatmap.tsx`
- [x] Task 6.4 — Update `TodayStatusCard.tsx`
- [x] Task 6.5 — Update `AttendancePage.tsx` (employee)
- [x] Task 6.6 — Update `UserDetailsPage.tsx` (admin)
- [x] Task 6.7 — Update `TeamAttendancePage.tsx` (on_break handling)
- [x] Task 6.8 — Update all test files

### Phase 7: Legacy Cleanup & Consolidation
- [x] Task 7.1 — Remove `attendance_logs` from application code
- [ ] Task 7.2 — Consolidate status enums (assessment + action)
- [ ] Task 7.3 — Verify weekend row handling end-to-end

### Final Verification
- [ ] Run `npx tsc --noEmit` — zero errors
- [x] Run `npm test` — all tests pass
- [x] Grep codebase for `overtime_only` — only in historical migrations
- [x] Grep codebase for `is_short_day` — only in historical migrations
- [x] Grep codebase for `attendance_logs` — no application code references

### Run 1 log
- [x] Task 1.1 — Added `attendance_daily_summary.has_overtime` in migration `023_state_system_alignment.sql` and backfilled historical overtime flags — 2026-04-13 / Run 1
- [x] Task 1.2 — Renamed `is_short_day` to `is_incomplete_shift` and normalized legacy non-present rows to clear the renamed flag — 2026-04-13 / Run 1
- [x] Task 1.3 — Migrated stored `overtime_only` rows to `absent + has_overtime=true` and replaced the summary status check constraint — 2026-04-13 / Run 1
- [x] Task 1.4 — Verified the existing `(user_id, date)` uniqueness/indexing still fits; no additional index change needed in Phase 1 — 2026-04-13 / Run 1
- [x] Task 1.5 — Implemented off-day cleanup by deleting empty neutral summary rows and making recalc skip persistence when there are no sessions and no sourced state — 2026-04-13 / Run 1
- [x] Task 2.1 — Rewrote `recalculate_attendance_daily_summary()` for `has_overtime`, `is_incomplete_shift`, and `absent` overtime-only handling — 2026-04-13 / Run 1
- [x] Task 2.2 — Updated `resolve_team_attendance_date_state()` to the renamed modifier while preserving the date-state priority rules — 2026-04-13 / Run 1
- [x] Task 2.3 — Replaced `resolve_team_attendance_live_state()` with `on_break` and post-window `incomplete_shift` handling; kept off-day/no-shift rows `neutral` per the source-of-truth plan — 2026-04-13 / Run 1
- [x] Task 2.4 — Updated `get_team_attendance_day()` to the new summary fields and live/date state resolvers — 2026-04-13 / Run 1
- [x] Task 2.5 — Updated `get_redacted_department_availability()` so chip state and availability sectioning are derived independently (`team_live_state` vs open-session availability) — 2026-04-13 / Run 1
- [x] Task 2.6 — Updated `get_redacted_team_attendance_day()` to use `is_incomplete_shift`, stored `has_overtime`, and the unified date-state resolver — 2026-04-13 / Run 1
- [x] Task 2.7 — Verified `trigger_recalc_summary_on_leave_change()` still calls the unchanged `recalculate_attendance_daily_summary(uuid, date)` signature, so no trigger edit was needed — 2026-04-13 / Run 1

--- Run 1 ended ---

---

### Run 2 log
- [x] Task 3.1 — Updated `supabase/functions/punch/handler.ts` and its Deno tests for `absent + has_overtime` plus `is_incomplete_shift` storage — 2026-04-13 / Run 2
- [x] Task 3.2 — Verified `supabase/functions/auto-punch-out/handler.ts` still matched the shared punch types; no logic change was required — 2026-04-13 / Run 2
- [x] Task 3.3 — Added `date` / `from_date` / `to_date` handling to `supabase/functions/mark-absent/handler.ts` and covered it with a new Deno test file — 2026-04-13 / Run 2
- [x] Task 4.1 — Added `on_break` and `incomplete_shift` support across the shared team-attendance state model and chip config — 2026-04-13 / Run 2
- [x] Task 4.2 — Removed `overtime_only` / `overtime_offday` from `dayState.ts` and made overtime an explicit modifier input — 2026-04-13 / Run 2
- [x] Task 4.3 — Rebuilt `statusConfig.ts` with `on_break` styling plus the missing hex/tone metadata used by downstream adapters — 2026-04-13 / Run 2
- [x] Task 4.4 — Reworked `statusAdapters.ts` so overtime visuals are driven by `hasOvertime` instead of pseudo-status strings — 2026-04-13 / Run 2
- [x] Task 4.5 — Updated `todayRecord.ts` to read `has_overtime` directly from the daily summary — 2026-04-13 / Run 2
- [x] Task 4.6 — Verified `src/shared/attendance/types.ts` still matched the target state model without edits — 2026-04-13 / Run 2
- [x] Task 4.7 — Verified `src/shared/attendance/resolveDisplayStatus.ts` needed no logic change after the day-state cleanup — 2026-04-13 / Run 2
- [~] Task 5.1 — Refactored `attendance.service.ts` off `attendance_logs`, removed `normalizeSessions()`, renamed `is_incomplete_shift`, and switched overtime handling to `has_overtime`. Still TODO: decide whether to remove the compatibility `log` field from `TodayRecord` / `DayRecord` or keep it as an intentional adapter layer — 2026-04-13 / Run 2
- [x] Task 5.2 — Manually updated `src/lib/database.types.ts` for `has_overtime`, `is_incomplete_shift`, and the updated RPC return shapes — 2026-04-13 / Run 2
- [x] Task 5.3 — Removed overtime pseudo-status cases from `src/lib/ui-helpers.ts` — 2026-04-13 / Run 2
- [x] Task 6.1 — Replaced overtime pseudo-status themes with a standalone overtime modifier theme in `attendanceStatusTheme.ts` — 2026-04-13 / Run 2
- [x] Task 6.2 — Updated `DayDetailsSheet.tsx` to derive overtime display from `has_overtime` instead of pseudo-statuses — 2026-04-13 / Run 2
- [x] Task 6.3 — Updated `MonthCalendarHeatmap.tsx` to mark overtime via `MonthDaySummary.hasOvertime` — 2026-04-13 / Run 2
- [x] Task 6.4 — Updated `TodayStatusCard.tsx` to use the standalone overtime theme — 2026-04-13 / Run 2
- [x] Task 6.5 — Removed legacy overtime status URL mapping from `AttendancePage.tsx` — 2026-04-13 / Run 2
- [x] Task 6.6 — Updated `UserDetailsPage.tsx` to use `has_overtime` with the shared day-state resolver — 2026-04-13 / Run 2
- [x] Task 6.7 — Updated `TeamAttendancePage.tsx` for `on_break` plus availability-driven live grouping from `availability_state` / `isCheckedInNow` — 2026-04-13 / Run 2
- [x] Task 6.8 — Updated the affected Vitest suites and Deno tests to the new state model; `npm test` and `npm run test:edge` now pass — 2026-04-13 / Run 2
- [x] Task 7.1 — Removed `attendance_logs` usage from application code and realtime subscriptions; remaining references are limited to generated DB table types — 2026-04-13 / Run 2
- [~] Final verification — `npm test`, `npm run test:edge`, and `npm run build` all pass. `npx tsc --noEmit` could not be executed because `typescript` is not installed as a project dependency — 2026-04-13 / Run 2

--- Run 2 ended ---

---

### Next run should start with:
Task 5.1 follow-up / Task 7.2. The state-model migration is implemented through backend, service, UI, and tests; the main open decision is whether to remove the compatibility `log` field from `TodayRecord` / `DayRecord` or formalize it as a long-term adapter while consolidating the remaining overlapping enums.

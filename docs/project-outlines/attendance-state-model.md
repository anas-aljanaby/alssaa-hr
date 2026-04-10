# Attendance State Model

This document defines the attendance states currently used in the system, what each one means, and how each state is evaluated.

It separates the model into three layers:

1. Session-level attendance facts
2. Stored daily summary outcomes
3. Team Attendance page derived states

The goal is to keep the database schema stable while making the Team Attendance page use one consistent backend-derived state model.

## Source Of Truth By Layer

### 1) Session-level facts

Primary source:
- [handler.ts](/Users/anas/Workspace/github/alssaa-hr/supabase/functions/punch/handler.ts)
- [006_attendance_sessions_and_daily_summary.sql](/Users/anas/Workspace/github/alssaa-hr/supabase/migrations/006_attendance_sessions_and_daily_summary.sql)

Stored on each row in `attendance_sessions`:
- `status`: `present` or `late`
- `is_overtime`: `true` or `false`

### 2) Stored daily summary

Primary source:
- [006_attendance_sessions_and_daily_summary.sql](/Users/anas/Workspace/github/alssaa-hr/supabase/migrations/006_attendance_sessions_and_daily_summary.sql)
- [handler.ts](/Users/anas/Workspace/github/alssaa-hr/supabase/functions/punch/handler.ts)

Stored in `attendance_daily_summary`:
- `effective_status`
- `is_short_day`
- `total_work_minutes`
- `total_overtime_minutes`
- `session_count`

### 3) Team Attendance page states

Primary source:
- [019_team_attendance_state_unification.sql](/Users/anas/Workspace/github/alssaa-hr/supabase/migrations/019_team_attendance_state_unification.sql)
- [teamState.ts](/Users/anas/Workspace/github/alssaa-hr/src/shared/attendance/teamState.ts)

Returned by team-attendance RPCs:
- `team_live_state`
- `team_date_state`
- `has_overtime`

## Layer 1: Session-Level States

`attendance_sessions.status` only has two values:

### `present`

Meaning:
- The check-in is not late for the regular shift, or the session is overtime but not late in the stored session vocabulary.

How it is evaluated at check-in:
- If the employee has no shift, check-in is `present` and not overtime.
- If today is an off-day, check-in is `present` and overtime.
- If check-in happens outside the allowed regular-shift window, it is `present` and overtime.
- If check-in happens within the regular-shift window and before the late cutoff, it is `present` and not overtime.

### `late`

Meaning:
- The employee checked in for a regular shift after the grace period.

How it is evaluated at check-in:
- The employee must have a working shift for that day.
- The check-in must be inside the regular shift window.
- The check-in time must be after `work_start_time + grace_period_minutes`.

### `is_overtime = true`

Meaning:
- The session is overtime, not regular shift attendance.

How it is evaluated at check-in:
- The day is an off-day, or
- the check-in is before the early-login window, or
- the check-in is after scheduled shift end.

Important note:
- Overtime is not a separate `attendance_sessions.status`.
- Overtime is a flag that overlaps with `status = present`.
- Stored overtime sessions must also satisfy `attendance_policy.minimum_overtime_minutes`; shorter finished overtime sessions are discarded.

## Layer 2: Stored Daily Summary States

`attendance_daily_summary.effective_status` is the canonical stored day outcome.

Allowed database values:
- `present`
- `late`
- `absent`
- `on_leave`
- `overtime_only`
- `null`

### `present`

Meaning:
- The employee had at least one non-overtime session with `status = present`.

How it is evaluated:
- There is at least one regular, non-overtime session.
- At least one of those regular sessions is `present`.
- This can still be marked `is_short_day = true` if minimum minutes were not met.

### `late`

Meaning:
- The employee had regular attendance, but all regular attendance for the day was late.

How it is evaluated:
- There is at least one non-overtime session with `status = late`.
- There are no non-overtime sessions with `status = present`.

### `absent`

Meaning:
- It is a working day and there are no attendance sessions for the day.

How it is evaluated:
- The day is a working day.
- The employee does not have approved leave.
- `session_count = 0`.

Note:
- This is a stored canonical outcome, not the Team Attendance live “absent right now” rule.

### `on_leave`

Meaning:
- The employee has approved non-overtime leave covering that day.

How it is evaluated:
- An approved leave request overlaps the day.
- Leave takes priority over other stored outcomes.

### `overtime_only`

Meaning:
- The employee worked only overtime sessions and never had a regular non-overtime session that day.

How it is evaluated:
- There is at least one session.
- Every session for that day is `is_overtime = true`.

### `null`

Meaning:
- The day is outside the canonical attendance outcome set.

When it happens:
- Off-day / weekly off
- No shift logic available in a way that should not become absent
- Future day in punch recalculation before attendance should be decided

### `is_short_day`

Meaning:
- The employee worked fewer than the required minimum minutes for that day.

How it is evaluated:
- If `attendance_policy.minimum_required_minutes` is set, `is_short_day = total_work_minutes < minimum_required_minutes`.
- If `minimum_required_minutes` is `null`, the current stored implementation leaves `is_short_day = false`.

Important note:
- `is_short_day` does not change `effective_status`.
- A row can be `effective_status = present` and also `is_short_day = true`.

## Layer 3: Team Attendance Derived States

These states are derived in backend RPCs for the Team Attendance page.

They do not add new database enum/check values.

### Shared overlap flag: `has_overtime`

Meaning:
- The employee has overtime activity for the selected day.

How it is evaluated:
- There is any overtime session, or
- `total_overtime_minutes > 0`.

Important note:
- `has_overtime` overlaps with other states.
- A user can be both:
  - `available_now` and `has_overtime`
  - `not_entered_yet` and `has_overtime`
  - `absent` and `has_overtime`
  - `fulfilled_shift` and `has_overtime`
  - `incomplete_shift` and `has_overtime`

## Team Attendance Date States

Used when the page is in date mode.

### `fulfilled_shift`

Label:
- Arabic: `أكمل الدوام`
- English: `Fulfilled shift`

Meaning:
- The employee had a regular shift, was not late, and satisfied the shift requirement.

How it is evaluated:
- `effective_status = present`
- `is_short_day = false`
- the employee has a shift
- the selected date is a working day
- the employee is not on leave

Important note:
- Overtime is ignored when deciding `fulfilled_shift`.

### `incomplete_shift`

Label:
- Arabic: `دوام غير مكتمل`
- English: `Incomplete shift`

Meaning:
- The employee worked a regular shift session but did not satisfy the minimum required work.

How it is evaluated:
- `effective_status = present`
- `is_short_day = true`
- the employee has a shift
- the selected date is a working day
- the employee is not on leave

### `late`

Label:
- Arabic: `متأخر`
- English: `Late`

Meaning:
- The employee attended late, and this does not overlap with `fulfilled_shift`.

How it is evaluated:
- `effective_status = late`
- the employee has a shift
- the selected date is a working day
- the employee is not on leave

### `absent`

Label:
- Arabic: `غائب`
- English: `Absent`

Meaning:
- The employee had no qualifying regular-shift attendance for the selected day.

How it is evaluated:
- `effective_status = absent`, or
- `effective_status = overtime_only`

Important note:
- In date mode, overtime-only work still maps to `absent` as the primary state and overlaps with `has_overtime`.

### `on_leave`

Label:
- Arabic: `في إجازة`
- English: `On leave`

Meaning:
- The employee had approved leave on the selected day.

How it is evaluated:
- `has_leave = true`, or
- `effective_status = on_leave`

### `neutral`

Meaning:
- The employee should be shown in the list but does not belong to a counted attendance bucket for that date.

Typical examples:
- Off-day
- No shift assigned
- Other non-working neutral cases

## Team Attendance Live States

Used when the page is in live mode.

### `available_now`

Label:
- Arabic: `موجود الآن`
- English: `Available now`

Meaning:
- The employee is currently punched in and available to take work now.

How it is evaluated:
- `is_checked_in_now = true`
- the employee is not on leave
- if the date-state is `late`, the live state becomes `late` instead of `available_now`

Important note:
- Anyone currently punched in is operationally considered present now.
- This includes overtime users.

### `late`

Label:
- Arabic: `متأخر`
- English: `Late`

Meaning:
- The employee is currently punched in and their day is classified as late.

How it is evaluated:
- `is_checked_in_now = true`
- `team_date_state = late`

### `not_entered_yet`

Label:
- Arabic: `لم يسجل بعد`
- English: `Not entered yet`

Meaning:
- The employee should have signed in for a regular workday but has not done so yet.

How it is evaluated:
- the employee has a shift
- the day is a working day
- the employee is not on leave
- the employee is not currently checked in
- the employee has not had any regular non-overtime session yet
- current time is before scheduled `work_end_time`

Important notes:
- Overtime-only activity does not count as regular attendance here.
- A user can therefore be both `not_entered_yet` and `has_overtime`.

### `absent`

Label:
- Arabic: `غائب`
- English: `Absent`

Meaning:
- The employee still has no regular attendance by the time the workday should be considered missed.

How it is evaluated:
- the employee has a shift
- the day is a working day
- the employee is not on leave
- the employee is not currently checked in
- the employee has not had any regular non-overtime session yet
- and either:
  - the selected date is in the past, or
  - current time is at or after scheduled `work_end_time`

Important notes:
- A user can be both `absent` and `has_overtime`.
- This covers cases like overtime work before shift start with no regular sign-in later.

### `on_leave`

Label:
- Arabic: `في إجازة`
- English: `On leave`

Meaning:
- The employee has approved leave for today.

How it is evaluated:
- `has_leave = true`, or
- `team_date_state = on_leave`

### `fulfilled_shift`

Label:
- Arabic: `أكمل الدوام`
- English: `Fulfilled shift`

Meaning:
- The employee already satisfied the shift and is currently checked out.

How it is evaluated:
- the employee is not currently checked in
- the employee has at least one regular session already
- `team_date_state = fulfilled_shift`

Important note:
- In live mode this is row-visible, but it is not currently used as a live summary chip.

### `neutral`

Meaning:
- The employee is shown on the board but does not belong to a live chip bucket.

Typical examples:
- Checked in and out earlier, and day is not over yet, so they may be on a break
- Checked out after some regular attendance but did not satisfy a counted live state
- Off-day
- No shift assigned

Important note:
- `neutral` is intentionally not chip-visible.

## Team Attendance Full-List Rule

The Team Attendance page should always show the full employee list in scope unless the user applies a narrowing filter.

Default behavior:
- Show all employees in the org, grouped under their departments.
- Keep employees visible even if their primary state is `neutral`.

Exceptions:
- Department filter
- Chip filter other than `all`

This is why the team-attendance RPCs return employees even when they have no session and no counted attendance state.

## Surfaces That Still Use Other Meanings

### User Details page

The User Details page is intentionally not part of the team-state model.

It still uses the canonical day summary vocabulary for HR/history purposes:
- `present`
- `late`
- `absent`
- `on_leave`

### Dashboard

The dashboard is intentionally out of scope for this pass.

It can later choose to reuse the same team-state definitions, but that is a separate product decision.

## Quick Mapping Summary

### Stored daily summary to date-mode team state

- `present + is_short_day = false` -> `fulfilled_shift`
- `present + is_short_day = true` -> `incomplete_shift`
- `late` -> `late`
- `absent` -> `absent`
- `overtime_only` -> `absent` with `has_overtime = true`
- `on_leave` -> `on_leave`
- `null` -> `neutral`

### Live-mode special rules

- Checked in now and not late -> `available_now`
- Checked in now and late -> `late`
- No regular session yet, before shift end -> `not_entered_yet`
- No regular session yet, at/after shift end -> `absent`
- Checked out after fulfilling shift -> `fulfilled_shift`
- Checked out mid-day after some regular attendance -> `neutral`
- Any overtime activity -> `has_overtime = true` in addition to the primary state

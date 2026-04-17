# Attendance State System Plan

This document defines a consistent state system for attendance days and sessions. The goal is to identify every consumer of attendance state, determine exactly what states each consumer needs, verify our system provides those states, and ensure the implementation is clean and intentional. Scope is limited to docs and backend — any frontend changes will be noted here for later implementation. The system contains legacy code and artifacts that cause errors and unexpected behavior; we will identify these and plan their removal. Every design decision and piece of code should be questioned — nothing is taken for granted.

We design from the admin's point of view, since everything else can be derived from it. For example, the employee attendance page should present the same data as the admin's user details page.


## Core Model

The system is built around two orthogonal dimensions. Understanding the distinction between them is essential — conflating them is the root cause of past bugs.

**Attendance verdict** — the states defined in this document. They answer: *what kind of attendance day is this employee having?* Was it on time? Late? Did they complete their shift? Did they not show up? These are verdicts about the quality and completeness of attendance. A verdict does not change because an employee steps out for a break — it reflects what happened, not what is happening right now.

**Presence** — a single boolean field, `is_checked_in_now`. It answers: *does this employee currently have an open session?* This is a snapshot of the current moment, entirely orthogonal to the attendance verdict. An employee can be `late` (verdict) and currently checked in (present), or have no chip at all (verdict: on time, nothing notable) and be on a break (not present). These two facts are always independent.

**The rule for all consumers:** any consumer that needs to know who is available right now — for a section split, a dashboard count, or any other availability display — must use `is_checked_in_now` directly. Never infer availability from a state name.

**Chips signal exceptions, not the baseline.** On the live board, a chip signals something notable about an employee's day: they arrived late, they haven't shown up yet, their shift is done, etc. The absence of a chip is itself meaningful — it means the employee is on time, working a regular session, with nothing requiring the admin's attention. There is no chip for the normal baseline case.


## State Definitions

These are the canonical states in the system. Every consumer should map to these — no ad-hoc statuses elsewhere.

### Session States

A session is a single punch-in/punch-out record. These states describe what kind of session it is.

| State | Arabic Label | Definition |
|---|---|---|
| `present` | حاضر | Employee punched in within the allowed window (on time or within grace period). This is a regular, non-overtime session. |
| `late` | متأخر | Employee punched in after the grace period on a working day. This is a regular, non-overtime session. |

Overtime is indicated by an `is_overtime` flag, not the `status` field. `status` is always `present` or `late` ("were they on time?"), while `is_overtime` independently answers "does this count toward shift fulfillment?". For example, an employee can be both late and working overtime (`status='late', is_overtime=true`), which couldn't be represented if overtime were a status value.

| State | Modifier | Arabic Label | Definition |
|---|---|---|---|
| `present` | — | حاضر | Punched in on time. Regular session that counts toward shift fulfillment. |
| `late` | — | متأخر | Punched in after grace period. Regular session that counts toward shift fulfillment. |
| `present` | `is_overtime` | عمل إضافي | Punched in on time during an overtime window (off-day, before early login, after shift end). Does not count toward shift fulfillment. |
| `late` | `is_overtime` | عمل إضافي (متأخر) | Punched in late during an overtime window. Does not count toward shift fulfillment. |

### Day States

A day is the aggregated verdict for one employee on one date. These states answer: "What happened with this employee on this day?"

| State | Arabic Label | Definition |
|---|---|---|
| `present` | حاضر | Employee fulfilled the shift. At least one non-overtime session has `status=present`. |
| `late` | متأخر | Employee worked but arrived late. At least one non-overtime session exists, and the best session status is `late` (no `present` sessions). |
| `absent` | غائب | A past working day with no qualifying non-overtime sessions. The employee did not show up. |
| `on_leave` | في إجازة | An approved leave record exists for this date. Takes priority over all other states — even if sessions exist, leave wins. |
| `weekend` | عطلة أسبوعية | A non-working day per the employee's schedule. No shift was expected. |
| `holiday` | عطلة رسمية | An official holiday. No shift was expected. |
| `future` | — | A date that hasn't occurred yet. No verdict is possible. Not displayed to users as a status. |
| `not_joined` | — | A date before the employee's join date. Not applicable. Not displayed to users as a status. |

Day states are purely about punctuality/attendance (mutually exclusive). Secondary dimensions are captured as independent modifiers:

| Modifier | Definition |
|---|---|
| `has_overtime` | Employee worked overtime sessions this day. Can be true on any state — `present`, `absent` (overtime-only), `weekend`, etc. |
| `is_incomplete_shift` | Employee worked but didn't meet shift minimum hours. Only meaningful when state is `present` or `late`. |

This means `overtime_only` is not a day state — it's `absent` + `has_overtime=true`. And `incomplete_shift` is not a day state — it's `present` (or `late`) + `is_incomplete_shift=true`. Keeping these as modifiers preserves the ability to know punctuality and duration independently, same reasoning as the session overtime flag.

### Live Board States (Team Attendance — Live Mode)

These states are used exclusively on the team attendance page in live mode. They combine session data with current time context to show what's happening *right now*.

| State | Arabic Label | Definition |
|---|---|---|
| `late` | متأخر | Employee has a `late` session today. Applies whether they are currently checked in or currently on break — lateness is a fact about today that doesn't go away when the employee steps out. |
| `on_break` | في استراحة | Employee arrived on time and has at least one session today, but is not currently in an open session, has not yet met the shift minimum, and the shift window is still open. Distinct from `not_entered_yet` (they did show up) and from `fulfilled_shift` (their day isn't done yet). |
| `not_entered_yet` | لم يسجل بعد | It's a working day, shift hasn't ended yet, and the employee has no sessions. They might still show up. |
| `absent` | غائب | It's a working day, shift has ended, and the employee has no qualifying sessions. They didn't show up. |
| `on_leave` | في إجازة | Employee has approved leave for today. |
| `incomplete_shift` | دوام غير مكتمل | The shift window has ended, the employee arrived on time and has at least one session, but did not meet the shift minimum hours. Only appears after the shift window closes — during the shift window, an on-time employee who hasn't met the minimum yet carries no chip (if currently checked in) or the `on_break` chip (if not). |
| `fulfilled_shift` | أكمل الدوام | Employee has checked out and met the shift minimum. Their work day is done. |
| `neutral` | خارج التصنيف | Off-day per the employee's schedule (weekend/holiday), or no shift configured for this employee/day. Used only for "no shift was expected" situations — never for mid-shift ambiguity. |

An employee with none of the above chips who is also `is_checked_in_now = true` is in the baseline state: on time, working a regular session, nothing notable. This is the implicit normal case — it has no chip precisely because it requires no admin attention.

> **Sectioning vs. chips:** The "available now" / "not available now" split on the Live Board is driven purely by `is_checked_in_now`, independent of which chip the employee carries. A `late` employee with `is_checked_in_now = true` appears in "available now" and still carries the `late` chip so the admin can follow up on the lateness. A `late` employee on break (`is_checked_in_now = false`) appears in "not available now" and still carries the `late` chip. An on-time employee on break appears in "not available now" with the `on_break` chip, so the admin can distinguish them from employees who haven't shown up at all (who carry `not_entered_yet`).
>
> **Chip priority (post-shift-window):** When the shift window has ended and the employee's final state must be resolved, multiple conditions may overlap (e.g., an employee can be both late and have an incomplete shift). The live board shows a single chip per employee, resolved by this priority order: `on_leave` → `absent` → `late` → `incomplete_shift` → `fulfilled_shift`. Notably, `late` takes priority over `incomplete_shift` — a late employee who also didn't meet the minimum shows `late`, not `incomplete_shift`. This keeps the stronger admin signal visible; the shift completion detail is available in the drill-down (see requirement below).
>
> **Drill-down requirement:** Every consumer that shows a single chip (live board, date board, calendar) must also provide a drill-down view where the admin can see both punctuality and shift completion as separate tags. The drill-down is not constrained by the single-chip rule — it should show all applicable tags. For example, a late employee who didn't meet the minimum should show both `late` and `incomplete_shift` in the drill-down; a late employee who did meet the minimum should show `late` and `fulfilled_shift`. Each page owns its own drill-down UX — this plan only mandates that both dimensions are visible somewhere on every consumer.
>
> **Known gap:** An employee with no shift configured is indistinguishable from one who is legitimately on a weekend/holiday — both land in `neutral`. This hides config drift. Acceptable for now; see Future Work.


### Date Board States (Team Attendance — Date Mode)

These states are used on the team attendance page when viewing a specific historical date.

| State | Arabic Label | Definition |
|---|---|---|
| `fulfilled_shift` | أكمل الدوام | Employee was present (not late) and met the shift minimum hours. |
| `incomplete_shift` | دوام غير مكتمل | Employee was present but didn't meet the shift minimum hours (`is_incomplete_shift=true`). |
| `late` | متأخر | Employee worked but arrived late. |
| `absent` | غائب | No qualifying sessions on a working day. |
| `on_leave` | في إجازة | Approved leave for this date. |
| `neutral` | خارج التصنيف | Off-day, no shift, or other non-standard situation. |

> **Note:** Date board states are derived from day states + shift config. They add shift-fulfillment context (`fulfilled_shift` vs `incomplete_shift`) that raw day states don't carry.
>
> **Chip priority and drill-down:** The same rules defined for the live board apply here. Single chip per employee, resolved by the same priority order: `on_leave` → `absent` → `late` → `incomplete_shift` → `fulfilled_shift`. A late employee who also didn't complete the shift shows `late`, not `incomplete_shift`. The drill-down shows all applicable tags (e.g., `late` + `incomplete_shift` together). Filters (e.g., "show me all incomplete shifts") operate on the underlying `is_incomplete_shift` flag, not the display chip — so late employees with incomplete shifts appear when filtering by incomplete shift.


## State Consumers

These are the places in the admin panel that consume attendance state. Each has different needs:

| Consumer | What it needs | Granularity |
|---|---|---|
| Team attendance page — live mode | Real-time session awareness: who is currently checked in, who arrived late, who hasn't shown up yet | **Session-level** (open/closed sessions, current time context) |
| Team attendance page — date mode | Historical verdict for each employee on a given date: present, late, absent, on leave, etc. | **Day-level** (aggregated effective status) |
| User details page | Historical day-by-day record for a single employee: calendar view, stats, individual session breakdown | **Day-level** for the calendar/stats, **Session-level** for drill-down detail |


## Decisions

1. **Day/Session architecture:** Yes. Two-level hierarchy — `attendance_sessions` (raw punches) → `attendance_daily_summary` (daily verdict). Sessions feed into days, never the reverse.
2. **Overtime is a flag, not a status:** Session `status` is always `present` or `late`. `is_overtime` is an orthogonal boolean. This allows `late` + `is_overtime` combinations.
3. **Day modifiers over day states:** `has_overtime` and `is_incomplete_shift` are independent flags on days, not competing states. Day states stay purely about punctuality/attendance. `overtime_only` → `absent` + `has_overtime`. `incomplete_shift` → `present`/`late` + `is_incomplete_shift`.
6. **Single chip, two-layer resolution for all boards:** Both the live board and date board show a single chip per employee, resolved by priority: `on_leave` → `absent` → `late` → `incomplete_shift` → `fulfilled_shift`. This is a display concern only. The underlying data always computes both punctuality (`present`/`late`) and shift completion (`is_incomplete_shift`) independently. Filters operate on the underlying flags, not the display chip — so filtering by "incomplete shift" returns all employees who didn't meet the minimum, including those whose chip shows `late`. Every consumer must provide a drill-down where both dimensions are visible.
4. **Materialize `absent`, derive `weekend`/`future`/`not_joined`:** `absent` is written by an idempotent end-of-day job so historical verdicts are stable across schedule/join-date edits and admin overrides are simple row updates. The other three are pure functions of `(date, employee, schedule, join_date, today)` and don't need rows. Stored rows are authoritative for past dates — reads must not recompute them. Holiday is out of scope for now; it will slot in later as another sourced state without schema change.

   | State | Storage | How it gets set |
   |---|---|---|
   | `present`, `late` | sourced | Written from session aggregation |
   | `on_leave` | sourced | Written when an approved leave record covers the date |
   | `absent` | sourced | Written by the end-of-day job |
   | `weekend` | derived | Resolver returns this when the schedule says non-working day |
   | `future` | derived | Resolver returns this when `date > today` |
   | `not_joined` | derived | Resolver returns this when `date < employee.join_date` |

5. **Breaks are an availability dimension, not a status change.** When an employee checks out mid-shift for a break, their underlying session status (`present` or `late`) does not change. On the Live Board, this is reflected two ways: (a) the `late` chip persists through breaks so lateness stays visible to the admin, and (b) an on-time employee on break shows the dedicated `on_break` chip instead of falling into `neutral`. The Live Board sections ("available now" vs "not available now") are driven purely by `is_checked_in_now`, independent of which chip the row carries. This keeps `neutral` meaning "no shift was expected" and prevents mid-shift activity from ever landing there.

7. **Presence and attendance verdict are two orthogonal dimensions.** States answer "what kind of attendance day is this employee having?" — they are verdicts about punctuality and shift completion. `is_checked_in_now` answers "does this employee have an open session right now?" — it is a snapshot of the current moment. These two dimensions are always independent. Any consumer that needs to surface who is currently available must read `is_checked_in_now` directly; inferring availability from a state name is incorrect and was the source of the available-count bug.

8. **`available_now` is dropped as a live state.** The old `available_now` state encoded two facts at once (on time + currently checked in), making it redundant with `is_checked_in_now` for the presence dimension and ambiguous for the verdict dimension. Under the new model, the "on time, regular session, nothing notable" case is the baseline — it carries no chip. Presence is determined by `is_checked_in_now` alone. See the Legacy Reference section for the old definition and migration mapping.


## Open Concerns

- **Legacy `attendance_logs` table:** Predates the session/day split. Needs to be phased out.
- **State naming inconsistency:** Too many overlapping enums (`DayStatus`, `EffectiveStatus`, `TeamAttendanceLiveState`, `TeamAttendanceDateState`, `DisplayStatus`). Assess which can be consolidated.
- **`neutral` collapses off-day and missing-shift-config:** After narrowing `neutral`, it still covers two distinct situations: legitimate off-day (weekend/holiday) and a missing shift configuration. The second case silently hides config drift. See Future Work for a planned split.
- **`mark-absent` only runs for today:** No way to backfill an arbitrary date range, so a missed run leaves gaps. The underlying SQL function is idempotent and range-safe; the edge function should expose that.
- **Weekend stores a row with `effective_status = NULL`:** Conflicts with decision #4 (weekend is derived). Decide whether to stop writing these rows or treat weekend as a sourced state.
- **`overtime_only` still exists as a status value:** Conflicts with decision #3 (overtime is a modifier). Migrate to `absent` + `has_overtime`.
- **`is_short_day` exists in the codebase:** The current code uses a field called `is_short_day`. This needs to be renamed to `is_incomplete_shift` to match the plan, and its logic should be reviewed to ensure it matches the definition here (employee worked but didn't meet shift minimum hours). Whether the existing implementation fits as-is or needs adjustment, the rename is required either way.
- **Recalc reads current schedule, not historical:** Re-running recalc for a past date uses today's `work_days`/policy, so a schedule edit retroactively flips old verdicts. Breaks historical stability under idempotent re-runs.


## Future Work

### Splitting `neutral` further

Even after narrowing, `neutral` still covers two distinct situations: a legitimate off-day (weekend/holiday) and a missing shift configuration. The cleaner model would split these into `off_day` and `unscheduled`, keeping `neutral` only as a safety-net fallback. Deferred because it adds new frontend chips, colors, and labels without fixing an immediately painful bug — the current single `neutral` label is workable while admins learn the system.

When we revisit this, one UX direction worth exploring: instead of piling on more chips, visually distinguish off-day employees at the row level (e.g., subtle background tint or not greyed out) so "this person isn't expected today" is communicated without a dedicated chip. That would let `unscheduled` stand alone as a chip for the real problem case (config drift) while off-days become purely a visual treatment.

**Known gap under the current approach:** an employee with no shift configured is indistinguishable from one who is legitimately on a weekend/holiday. Both land in `neutral`. This hides config drift from the admin. Acceptable for now; worth fixing when we do the split.


## Legacy Reference

This section preserves old state definitions that have been superseded by decisions in this document. It exists solely as a migration aid — when renaming or removing these from the codebase, this is the record of what they meant and what they map to.

### Dropped: `available_now` (Live Board State)

**Old definition:** Employee is currently checked in (open session), arrived on time, and it's a working day during shift hours.

**Why it was dropped:** The state encoded two independent facts — punctuality (on time) and presence (open session) — under a single name. This caused the "available count" bug: consumers that wanted to know who was currently present used the state name as a proxy, which silently broke whenever a late-but-checked-in employee appeared. See Decision #7 and #8.

**Migration mapping:**
- The presence half (`is_checked_in_now = true`) → read `is_checked_in_now` directly on every row. This is now the canonical field for any availability display or count.
- The verdict half (on time, regular session, nothing notable) → represented by the *absence* of any exception chip. No code change needed for the verdict itself; remove any logic that sets or matches the `available_now` state value.

**Codebase artifacts to remove or rename:**
- `TeamAttendanceLiveState` / `TeamAttendancePrimaryState` enum value `'available_now'`
- `TEAM_ATTENDANCE_STATE_DEFINITIONS['available_now']`
- `resolve_team_attendance_live_state` SQL function — the branch that returns `'available_now'` should be updated
- `chipConfig.ts` — the `available_now` chip entry and its `matchesRow` predicate
- `teamState.ts` — `liveMeaning` for `late` currently incorrectly says "Currently checked in and late" — it should be corrected to reflect that `late` persists regardless of `is_checked_in_now`

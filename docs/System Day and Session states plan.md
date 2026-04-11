# Attendance State System Plan

This document defines a consistent state system for attendance days and sessions. The goal is to identify every consumer of attendance state, determine exactly what states each consumer needs, verify our system provides those states, and ensure the implementation is clean and intentional. Scope is limited to docs and backend — any frontend changes will be noted here for later implementation. The system contains legacy code and artifacts that cause errors and unexpected behavior; we will identify these and plan their removal. Every design decision and piece of code should be questioned — nothing is taken for granted.

We design from the admin's point of view, since everything else can be derived from it. For example, the employee attendance page should present the same data as the admin's user details page.


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
| `is_short_day` | Employee worked but didn't meet shift minimum hours. Only meaningful when state is `present` or `late`. |

This means `overtime_only` is not a day state — it's `absent` + `has_overtime=true`. And `incomplete_shift` is not a day state — it's `present` (or `late`) + `is_short_day=true`. Keeping these as modifiers preserves the ability to know punctuality and duration independently, same reasoning as the session overtime flag.

### Live Board States (Team Attendance — Live Mode)

These states are used exclusively on the team attendance page in live mode. They combine session data with current time context to show what's happening *right now*.

| State | Arabic Label | Definition |
|---|---|---|
| `available_now` | موجود الآن | Employee is currently checked in (open session), arrived on time, and it's a working day during shift hours. |
| `late` | متأخر | Employee has a `late` session today. Applies whether they are currently checked in or currently on break — lateness is a fact about today that doesn't go away when the employee steps out. |
| `on_break` | في استراحة | Employee arrived on time and has at least one session today, but is not currently in an open session, has not yet met the shift minimum, and the shift window is still open. Distinct from `not_entered_yet` (they did show up) and from `fulfilled_shift` (their day isn't done yet). |
| `not_entered_yet` | لم يسجل بعد | It's a working day, shift hasn't ended yet, and the employee has no sessions. They might still show up. |
| `absent` | غائب | It's a working day, shift has ended, and the employee has no qualifying sessions. They didn't show up. |
| `on_leave` | في إجازة | Employee has approved leave for today. |
| `fulfilled_shift` | أكمل الدوام | Employee has checked out and met the shift minimum. Their work day is done. |
| `neutral` | خارج التصنيف | Off-day per the employee's schedule (weekend/holiday), or no shift configured for this employee/day. Used only for "no shift was expected" situations — never for mid-shift ambiguity. |

> **Sectioning vs. chips:** The "available now" / "not available now" split on the Live Board is driven purely by whether the employee currently has an open session, independent of which chip they carry. A `late` employee on break appears in "not available now" but still carries the `late` chip so the admin can follow up on the lateness. An on-time employee on break appears in "not available now" with the `on_break` chip, so the admin can distinguish them from employees who haven't shown up at all (who carry `not_entered_yet`).
>
> **Known gap:** An employee with no shift configured is indistinguishable from one who is legitimately on a weekend/holiday — both land in `neutral`. This hides config drift. Acceptable for now; see Future Work.


### Date Board States (Team Attendance — Date Mode)

These states are used on the team attendance page when viewing a specific historical date.

| State | Arabic Label | Definition |
|---|---|---|
| `fulfilled_shift` | أكمل الدوام | Employee was present (not late) and met the shift minimum hours. |
| `incomplete_shift` | دوام غير مكتمل | Employee was present but didn't meet the shift minimum hours (`is_short_day=true`). |
| `late` | متأخر | Employee worked but arrived late. |
| `absent` | غائب | No qualifying sessions on a working day. |
| `on_leave` | في إجازة | Approved leave for this date. |
| `neutral` | خارج التصنيف | Off-day, no shift, or other non-standard situation. |

> **Note:** Date board states are derived from day states + shift config. They add shift-fulfillment context (`fulfilled_shift` vs `incomplete_shift`) that raw day states don't carry.


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
3. **Day modifiers over day states:** `has_overtime` and `is_short_day` are independent flags on days, not competing states. Day states stay purely about punctuality/attendance. `overtime_only` → `absent` + `has_overtime`. `incomplete_shift` → `present`/`late` + `is_short_day`.
4. **Materialize `absent`, derive `weekend`/`future`/`not_joined`:** `absent` is written by an idempotent end-of-day job so historical verdicts are stable across schedule/join-date edits and admin overrides are simple row updates. The other three are pure functions of `(date, employee, schedule, join_date, today)` and don't need rows. Stored rows are authoritative for past dates — reads must not recompute them. Holiday is out of scope for now; it will slot in later as another sourced state without schema change.

   | State | Storage | How it gets set |
   |---|---|---|
   | `present`, `late` | sourced | Written from session aggregation |
   | `on_leave` | sourced | Written when an approved leave record covers the date |
   | `absent` | sourced | Written by the end-of-day job |
   | `weekend` | derived | Resolver returns this when the schedule says non-working day |
   | `future` | derived | Resolver returns this when `date > today` |
   | `not_joined` | derived | Resolver returns this when `date < employee.join_date` |

5. **Breaks are an availability dimension, not a status change.** When an employee checks out mid-shift for a break, their underlying session status (`present` or `late`) does not change. On the Live Board, this is reflected two ways: (a) the `late` chip persists through breaks so lateness stays visible to the admin, and (b) an on-time employee on break shows the dedicated `on_break` chip instead of falling into `neutral`. The Live Board sections ("available now" vs "not available now") are driven purely by whether a session is currently open, independent of which chip the row carries. This keeps `neutral` meaning "no shift was expected" and prevents mid-shift activity from ever landing there.


## Open Concerns

- **Legacy `attendance_logs` table:** Predates the session/day split. Needs to be phased out.
- **State naming inconsistency:** Too many overlapping enums (`DayStatus`, `EffectiveStatus`, `TeamAttendanceLiveState`, `TeamAttendanceDateState`, `DisplayStatus`). Assess which can be consolidated.
- **`neutral` collapses off-day and missing-shift-config:** After narrowing `neutral`, it still covers two distinct situations: legitimate off-day (weekend/holiday) and a missing shift configuration. The second case silently hides config drift. See Future Work for a planned split.
- **`mark-absent` only runs for today:** No way to backfill an arbitrary date range, so a missed run leaves gaps. The underlying SQL function is idempotent and range-safe; the edge function should expose that.
- **Weekend stores a row with `effective_status = NULL`:** Conflicts with decision #4 (weekend is derived). Decide whether to stop writing these rows or treat weekend as a sourced state.
- **`overtime_only` still exists as a status value:** Conflicts with decision #3 (overtime is a modifier). Migrate to `absent` + `has_overtime`.
- **Recalc reads current schedule, not historical:** Re-running recalc for a past date uses today's `work_days`/policy, so a schedule edit retroactively flips old verdicts. Breaks historical stability under idempotent re-runs.


## Future Work

### Splitting `neutral` further

Even after narrowing, `neutral` still covers two distinct situations: a legitimate off-day (weekend/holiday) and a missing shift configuration. The cleaner model would split these into `off_day` and `unscheduled`, keeping `neutral` only as a safety-net fallback. Deferred because it adds new frontend chips, colors, and labels without fixing an immediately painful bug — the current single `neutral` label is workable while admins learn the system.

When we revisit this, one UX direction worth exploring: instead of piling on more chips, visually distinguish off-day employees at the row level (e.g., subtle background tint or not greyed out) so "this person isn't expected today" is communicated without a dedicated chip. That would let `unscheduled` stand alone as a chip for the real problem case (config drift) while off-days become purely a visual treatment.

**Known gap under the current approach:** an employee with no shift configured is indistinguishable from one who is legitimately on a weekend/holiday. Both land in `neutral`. This hides config drift from the admin. Acceptable for now; worth fixing when we do the split.

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
| `overtime` | عمل إضافي | Employee punched in during an overtime window: on an off-day, before the early login window, or after shift end. Overtime sessions never count toward shift fulfillment. |

> **Note:** Currently in code, overtime is not a session `status` — it's stored as `status='present'` + `is_overtime=true`. This is a design question: should overtime be its own status value, or remain a flag? Keeping it as a flag means a session is always either `present` or `late`, with overtime as an orthogonal modifier. Both approaches work, but the flag approach means "status" only answers "were they on time?" while the `is_overtime` flag answers "does this count toward shift fulfillment?".

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

> **Open question — `overtime_only`:** Currently the system has an `overtime_only` effective status for days where sessions exist but all are overtime. Should this be a distinct day state? Or should such days be treated as `absent` (shift not fulfilled) with an overtime flag/indicator? The admin needs to distinguish "didn't show up at all" from "showed up but only for overtime" — but is that a *state* or a *modifier on absent*?

> **Open question — `incomplete_shift` / `is_short_day`:** The team board currently shows `incomplete_shift` (دوام غير مكتمل) for days where the employee was present but didn't meet the minimum hours. This is derived from `is_short_day` on the daily summary. Should this be a day state, or is it a modifier on `present`? Currently it only exists at the display level, not as a day state.

### Live Board States (Team Attendance — Live Mode)

These states are used exclusively on the team attendance page in live mode. They combine session data with current time context to show what's happening *right now*.

| State | Arabic Label | Definition |
|---|---|---|
| `available_now` | موجود الآن | Employee is currently checked in (open session), arrived on time, and it's a working day during shift hours. |
| `late` | متأخر | Employee is currently checked in but arrived late (session status is `late`). |
| `not_entered_yet` | لم يسجل بعد | It's a working day, shift hasn't ended yet, and the employee has no sessions. They might still show up. |
| `absent` | غائب | It's a working day, shift has ended, and the employee has no qualifying sessions. They didn't show up. |
| `on_leave` | في إجازة | Employee has approved leave for today. |
| `fulfilled_shift` | أكمل الدوام | Employee has checked out and met the shift minimum. Their work day is done. |
| `neutral` | خارج التصنيف | Doesn't fit into the above: off-day with no shift, or checked out without meeting minimums. A catch-all for non-standard situations. |

> **Concern — `neutral` is vague:** This state covers too many different situations (off-day, no shift assigned, checked out early). The admin sees "خارج التصنيف" but can't tell *why*. We should consider splitting this or at least clarifying what situations land here.

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


## Decision 1: Use the Day/Session Architecture

**Decision:** Yes — we use a two-level hierarchy: **Sessions** (individual punch records) and **Days** (aggregated daily verdicts).

**Rationale:**
- Sessions are the raw source of truth. Employees can punch in and out multiple times per day (lunch breaks, split shifts, overtime). Each session carries its own classification (present/late, overtime flag). Live mode depends on knowing which sessions are currently open.
- Days are the verdict layer. "Was this employee present today?" is a day-level question. The `effective_status` field aggregates all sessions into one answer. Day-level concepts like `absent`, `on_leave`, `weekend`, and `holiday` have no sessions attached to them at all — they only exist at the day level.
- Every consumer confirms this split: live mode needs sessions, date mode needs days, user details needs both.
- The alternative (sessions only, no day layer) would force every consumer to re-derive the daily verdict independently, duplicating logic and creating inconsistency.

**What this means concretely:**
- `attendance_sessions` — one row per punch-in/punch-out, the source of truth for raw activity
- `attendance_daily_summary` — one row per user per date, the source of truth for the day's verdict
- Sessions feed into days, never the other way around


## Open Concerns

- **Legacy `attendance_logs` table:** This is a third layer that predates the session/day split. It muddies the architecture and needs to be phased out. We should identify all code that still reads from or writes to it and plan migration to the clean two-level model.
- **State naming inconsistency:** There are multiple overlapping status enums across the codebase (`DayStatus`, `EffectiveStatus`, `TeamAttendanceLiveState`, `TeamAttendanceDateState`, `DisplayStatus`). As we define the states each consumer needs, we should assess whether all of these are necessary or if some can be consolidated.
- **Overtime-only days:** Currently `overtime_only` is an effective status for days where all sessions are overtime. We need to decide if this is a distinct day state or should be folded into another state (e.g. treated as `absent` from a shift-fulfillment perspective, with an overtime flag).

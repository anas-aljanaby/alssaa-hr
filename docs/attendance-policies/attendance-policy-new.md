# Attendance Punch System — Policy & Logic Reference (v2)

This document describes how the attendance punch system works, including all statuses, time zones, overtime rules, session management, and edge cases.

---

## Work Schedule

Each employee's schedule is resolved in this order:

1. **Per-user schedule** — If a user's profile has `work_days`, `work_start_time`, and `work_end_time` all set, those are used. Off-days are derived as any day NOT in `work_days`.
2. **Org policy (default)** — Otherwise, the organization's `attendance_policy` provides `work_start_time`, `work_end_time`, and `weekly_off_days`.

The following values always come from the org policy, even for users with custom schedules:
- Grace period (default: `15` minutes if no policy exists)
- Auto-punch-out buffer (default: `5` minutes if no policy exists)
- Early login window (default: `60` minutes if no policy exists)
- Minimum required hours (default: none / not enforced if not set)

If a user has **no** custom schedule and no org policy exists, the shift is `null` (treated as "no shift configured" — see edge cases).

---

## Time Zones During a Work Day

Given a shift of **9:00 AM – 6:00 PM** with a **15 min grace period** and a **60 min early login window**:

```
|--- OVERTIME ---|--- Early Login ---|-- ON TIME --|---- LATE ----|--- OVERTIME ---|
12:00 AM        8:00 AM            9:00 AM       9:16 AM       6:00 PM         11:59 PM
```

Note: Overtime uses a strict `>` comparison against shift end. A punch at exactly 6:00 PM is still within the shift (late zone), while 6:01 PM is overtime. Example: if someone punches out at 6:10 PM, then punches back in at 6:12 PM, that 6:12 PM punch-in is an overtime session.

| Time Window | Zone | Session `status` | `is_overtime` |
|---|---|---|---|
| 12:00 AM – 7:59 AM | Overtime (before early login window) | `present` | `true` |
| 8:00 AM – 8:59 AM | Early login (within configurable window before shift) | `present` | `false` |
| 9:00 AM – 9:15 AM | Within grace period | `present` | `false` |
| 9:16 AM – 6:00 PM | After grace, during/at end of shift | `late` | `false` |
| 6:01 PM – 11:59 PM | Overtime (after shift end) | `present` | `true` |

> **Important:** The session-level `status` and `is_overtime` flag describe only that individual punch-in. They do **not** determine whether the employee fulfilled their regular shift. The day-level verdict — including whether the employee counts as truly present — is determined by `effective_status` on the daily summary, which requires at least one non-overtime session to produce `present` or `late`.

The early login window duration is configurable per organization via `early_login_minutes` in the attendance policy. The value `60` above is the default.

---

## Session Model (Multi-Session)

The system supports **multiple sessions per employee per day**. Each punch-in creates a new session. Each session is a separate row in `attendance_sessions`.

A **session** consists of:
- `check_in_time` — when the employee punched in
- `check_out_time` — when the employee punched out (null while active)
- `status` — classification at time of punch-in (`present` or `late`)
- `is_overtime` — boolean flag indicating this session was classified as overtime
- `is_auto_punch_out` — boolean, true if the system closed this session automatically
- `duration_minutes` — computed on checkout (or by auto-punch-out)

A **daily summary** (`attendance_daily_summary`) is maintained per employee per date. It aggregates all sessions for that day and holds:
- `date` — the calendar date
- `first_check_in` — earliest punch-in across all sessions
- `last_check_out` — latest punch-out across all sessions
- `total_work_minutes` — sum of all session durations
- `total_overtime_minutes` — sum of durations from sessions where `is_overtime = true`
- `effective_status` — the "headline" status for the day (see Daily Status Resolution below)
- `is_short_day` — true if total work minutes fall below the org's minimum required hours
- `session_count` — number of sessions recorded

The daily summary is recalculated each time a session is created, updated, or closed.

### Why Multiple Sessions Matter

- Employee works 8 AM – 12 PM, leaves for an appointment, returns 2 PM – 6 PM → two sessions, total 8 hours.
- Employee finishes regular shift, leaves, returns at 8 PM for overtime → regular session + overtime session, tracked separately.
- No data is ever lost or overwritten.

---

## Daily Status Resolution

The `effective_status` on the daily summary reflects whether the employee fulfilled their regular shift that day. **Overtime sessions are excluded from this determination** — they are tracked separately via `is_overtime` and `total_overtime_minutes` but have no bearing on `effective_status`.

Priority order (highest first):

1. **`on_leave`** — An approved leave record exists covering this date. This takes absolute priority, regardless of whether the employee punched in.
2. **`late`** — At least one **non-overtime** session has `status = 'late'` and no non-overtime `present` session exists. The employee arrived during their shift but after the grace period.
3. **`present`** — At least one **non-overtime** session has `status = 'present'`. The employee arrived on time during their regular shift hours.
4. **`overtime_only`** — Sessions exist for the day, but **all** of them are overtime sessions (`is_overtime = true`). The employee did not work during their regular shift hours.
5. **`absent`** — It is a past working day and no sessions exist at all.

> **Key principle:** `present` and `late` can only result from non-overtime sessions. An employee who exclusively worked overtime hours — whether before the early login window, after shift end, or on an off-day — is **not** considered present for their regular shift.

Working day with only overtime sessions → `overtime_only` (not `present`, not `absent`).

Off-days with no sessions have no `effective_status` (they are simply off-days). Off-days with sessions are shown as overtime days on the calendar; no `effective_status` is set since there is no shift to fulfill.

---

## Statuses

### Session-Level Status (per punch-in)

Evaluated at check-in time in this order:

1. **Overtime?** — Non-working day, or time is before the early login window start, or time is strictly after shift end → `status = 'present'`, `is_overtime = true`.
2. **Late?** — Working day, time is after `shiftStart + gracePeriod` → `status = 'late'`, `is_overtime = false`.
3. **On time** — Everything else → `status = 'present'`, `is_overtime = false`.

Overtime punches are **never** tagged as `late`. The overtime check runs first and is conclusive.

Note: The session `status` field uses `present` for both on-time and overtime punch-ins because, at the session level, the employee did show up — the `is_overtime` flag is what distinguishes the two cases. The day-level `effective_status` is where the full picture (shift fulfillment) is assessed.

### Status Values (Daily Summary — `effective_status`)

| Status | Meaning |
|---|---|
| `present` | At least one non-overtime session with `status = 'present'` exists. Employee arrived on time during regular shift hours. |
| `late` | At least one non-overtime session with `status = 'late'` exists, and no non-overtime `present` session exists. Employee arrived during shift hours but after the grace period. |
| `overtime_only` | Sessions exist, but all are overtime (`is_overtime = true`). Employee did not work during regular shift hours. |
| `absent` | Past working day with no sessions at all. |
| `on_leave` | Approved leave covers this date. Takes priority over all other statuses. |

### Flags (Session & Daily)

| Flag | Level | Meaning |
|---|---|---|
| `is_overtime` | Session | This session is classified as overtime |
| `is_auto_punch_out` | Session | This session was closed by the auto-punch-out job |
| `is_short_day` | Daily | Total work minutes are below the minimum required hours |
| `needs_review` | Session | This session was flagged for manager review (auto-punch-out, anomaly, etc.) |

---

## Overtime Rules

### What Counts as Overtime

A punch-in is classified as overtime when **any** of these are true:
- It is a **non-working day** (e.g., Friday/Saturday or custom off-day)
- On a working day: current time is **before** the early login window start (`shiftStart - earlyLoginMinutes`)
- On a working day: current time is **strictly after** `shiftEnd`

### Overtime Tracking

When a session is classified as overtime, the `is_overtime` flag is set to `true` on the session row. This is the **authoritative record** of overtime — it lives on the attendance data itself, not in a separate request table.

Additionally, an overtime approval request is created in the `overtime_requests` table (separate from leave requests). This request is for **manager approval purposes only** — the attendance record exists regardless of approval status. The overtime request contains:
- Reference to the session
- `status`: `pending` → `approved` / `rejected`
- Requested by (employee) and reviewed by (manager)

If overtime request creation fails, the punch-in still succeeds and the session's `is_overtime = true` flag is still set. The missing request can be identified by querying sessions with `is_overtime = true` that have no corresponding overtime request, and can be created retroactively by the employee or a manager.

### Overtime Timer Display

When an employee is checked in during regular hours and stays past shift end on a working day:
- The main clock turns amber and displays total time since punch-in
- A separate overtime elapsed counter appears showing time past shift end
- The progress bar stays at 100%

For pure overtime sessions (off-day, before early login window, or after shift end):
- The main clock shows total elapsed time in amber
- The progress bar is hidden
- No separate overtime-elapsed line is shown

### Late-Stay Overtime (Expected Flow)

When an employee stays after `shiftEnd` on a working day, the system handles overtime in two equivalent ways:

**Automatic split on checkout (primary flow)**  
If the employee checked in during regular hours (`is_overtime = false` for that session) and punches out at a time **strictly after** `shiftEnd`, the punch handler **splits** the session at checkout:
- **Regular segment:** from original check-in time through `shiftEnd` (closed at `shiftEnd`)
- **Overtime segment:** from `shiftEnd` through the actual checkout time (`is_overtime = true`)

An `overtime_requests` row is auto-created (pending) for the overtime segment. The employee does **not** need to punch out and back in for this to occur.

**Separate overtime punch-in (still supported)**  
Alternatively, the employee may close the regular session at or before `shiftEnd`, then punch in again after `shiftEnd`. That new punch-in is classified as an overtime session and also receives an auto-created overtime request.

Example (split): employee checks in at 9:00 AM and checks out at 7:00 PM with shift end 6:00 PM → one regular session 9:00–18:00 and one overtime session 18:00–19:00, plus a pending overtime request for the latter.

---

## Early Departure

When an employee checks out **before** `shiftEnd` on a working day, and the session is not an overtime session, the system evaluates:

- If `check_out_time < shiftEnd`, the session is flagged with `is_early_departure = true`
- The daily summary recalculation picks this up for `is_short_day` evaluation

Early departure is informational — it does not change the session's `status`. The employee is still `present` or `late` based on their arrival. Short-day flagging and policy enforcement (e.g., counting as half-day) are handled at the reporting/policy layer, not the punch system.

---

## Punch-In Availability

| Context | Can Punch In? | Behavior |
|---|---|---|
| Within early login window or later | Yes | Normal punch-in |
| Before early login window (overtime) | Yes, with overtime confirmation | Overtime session created |
| Non-working day | Yes, with overtime confirmation | Overtime session created |
| After shift end (overtime) | Yes, with overtime confirmation | Overtime session created |
| No shift configured | Yes, always | Status = `present`, no overtime tagging |
| Already checked in (active session) | No | Must check out first |

There is no hard time-based block on punch-in. Before the early login window, the punch is treated as overtime and shows overtime confirmation.

### Repeat check-in while a session is open

If the client sends **check_in** while an open session already exists for that day, the punch handler responds with **200** and the **same session** (idempotent). No second row is inserted. The UI should still present a single checked-in state and route the user to check-out when they intend to end the session.

There is **no** server-side time-based cooldown between punch actions. Accidental double taps are mitigated on the client by disabling the button while a request is in flight.

---

## Timer Display

### Main Clock (Circular Timer)

Shows **real elapsed time since the current session's punch-in**.

- **Blue** during regular hours
- **Amber** during overtime (past shift end, non-working day, or overtime-classified session)

### Progress Bar

Shows shift completion as a percentage (0–100%), capping at 100% when the shift duration is reached. The percentage is based on `total_work_minutes` for the day (across all sessions) divided by the expected shift duration.

Hidden when:
- The current session is a pure overtime session
- No shift is configured
- It is a non-working day with no regular session

### Hours Worked Line

While checked in, shows a live "ساعات العمل" (hours worked) counter representing total elapsed time for the **current session**.

Below it, if there are previous sessions today, a secondary line shows "إجمالي اليوم" (today's total) summing all sessions.

Once checked out (no active session), the display shows "إجمالي ساعات العمل" (total working hours) as a static summary of all sessions for the day.

---

## Monthly Calendar

- **Present** (green): `effective_status = 'present'`
- **Late** (amber): `effective_status = 'late'`
- **Overtime Only** (purple): `effective_status = 'overtime_only'` — employee worked but not during regular shift hours
- **Absent** (red): `effective_status = 'absent'` or past working day with no sessions
- **On Leave** (blue): `effective_status = 'on_leave'`
- **Weekend/Off** (no indicator): Day is in the employee's `weeklyOffDays` with no sessions
- **Overtime on off-day** (purple with overtime badge): Off-day but sessions exist (all overtime); no `effective_status` is set since it is not a working day
- **Future** (no indicator): Date is after today

Weekend detection uses the employee's actual `weeklyOffDays` (from their custom schedule or org policy), not hardcoded days.

Tapping/clicking a day shows a detail view listing all sessions for that day with their individual check-in/out times, durations, and flags.

---

## Auto Punch-Out

A server-side job (`auto-punch-out` edge function) runs periodically and automatically closes sessions for employees who forgot to punch out.

Behavior:
- Processes **open regular sessions only** (where `check_out_time IS NULL` and `is_overtime = false`) for **today's date**
- Only triggers after `shiftEnd + bufferMinutes` has passed
- Sets `check_out_time` to **the auto-punch-out trigger time** for regular sessions (actual close time, not `shiftEnd`)
- Does **not** auto-close overtime sessions (`is_overtime = true`)
- Sets `is_auto_punch_out = true` on the session
- Sets `needs_review = true` on the session — flagging it for the manager to verify/correct
- Recalculates the daily summary after closing the session
- Runs only on **working days** for regular sessions

Sessions flagged with `needs_review` appear in the manager's dashboard for verification. The manager (or admin) can adjust the checkout time if the employee provides context (e.g., "I actually left at 8 PM").

---

## Attendance Corrections

Employees and managers can request or make corrections to attendance records:

### Employee-Initiated

An employee can submit an **attendance correction request** for any of their own sessions. Use cases:
- Forgot to punch in/out
- System was down
- Punched in from wrong device / at wrong time
- Auto-punch-out recorded incorrect time

The request includes:
- The session (or date, if no session exists) being corrected
- The proposed check-in and/or check-out time
- A reason/note

Correction requests go through manager approval. Once approved, the session is updated and the daily summary is recalculated. The original values and the correction are recorded in the audit log.

### Manager/Admin-Initiated

Managers can directly edit session times for employees in their department. Admins can edit any employee's sessions. All edits are recorded in the audit log with the editor's identity and timestamp.

---

## Audit Log

Every mutation to attendance data is recorded in `attendance_audit_log`:

| Field | Description |
|---|---|
| `session_id` | The affected session (nullable for daily-level events) |
| `employee_id` | The employee whose attendance was affected |
| `action` | One of: `check_in`, `check_out`, `auto_punch_out`, `correction_approved`, `manual_edit`, `session_deleted` |
| `performed_by` | The user who performed the action (employee, manager, admin, or `system`) |
| `old_values` | JSON snapshot of the fields before the change (null for creation) |
| `new_values` | JSON snapshot of the fields after the change |
| `reason` | Optional note (e.g., correction reason) |
| `created_at` | Timestamp of the action |

The audit log is append-only. Rows are never updated or deleted. It provides a complete reconstruction history for any attendance record.

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Overnight overtime (2 AM punch-in) | Allowed. Classified as overtime on the current calendar date. Confirmation shown. |
| Employee late at 9:30 on a 9:00 shift (15 min grace) | Session tagged `late`, `is_overtime = false`. `effective_status = 'late'`. |
| Employee punches in at 9:14 on a 9:00 shift (15 min grace) | Session tagged `present`, `is_overtime = false`. `effective_status = 'present'`. |
| Employee punches in at exactly 9:15 | Tagged `present` (grace period is inclusive: `<=`). |
| Employee punches in at 9:16 | Tagged `late` (first minute after grace). |
| Didn't work regular shift, comes in at 8 PM | Overtime session created. `effective_status = 'overtime_only'` — the employee did not fulfill their regular shift. |
| Non-working day punch-in | All sessions are overtime. Confirmation shown. Calendar shows overtime day. No `effective_status` set (it is not a working day). |
| Works 8 AM – 12 PM, returns 2 PM – 6 PM | Two non-overtime sessions. `effective_status` based on first session's arrival classification (`present` or `late`). |
| Works regular shift, leaves, returns at 8 PM | Regular session + overtime session. `effective_status` is determined by the regular session alone (`present` or `late`). The overtime session contributes only to `total_overtime_minutes`. |
| Works until 7:00 PM with shift end 6:00 PM (single continuous session) | Checkout splits into regular [check-in, 18:00] + overtime [18:00, 19:00]; overtime request created for the overtime segment. |
| Works until 6:10 PM, punches out, punches in again at 6:12 PM | 6:12 PM punch-in is overtime (`> shiftEnd`). A new overtime session is created and an overtime request is auto-created. |
| Forgets to check out, auto-punch-out fires | Only regular sessions are auto-closed, at the job trigger time. Overtime sessions are excluded. Flagged `needs_review`. |
| Manager corrects auto-punch-out time | Session updated, audit log records old and new values. Daily summary recalculated. |
| Punches in twice in quick succession while session is open | Second request succeeds with **200** and returns the **same** open session (idempotent). |
| Tries to punch in while already checked in | Same as above: API is idempotent; UX should show checked-in and check-out. |
| No shift configured for user or org | Punch allowed at any time, status = `present`, no overtime tagging, no progress bar. |
| Shift spanning midnight (10 PM – 6 AM) | Not currently supported. All time math uses minutes-since-midnight. Designed as a future extension point — the session model supports it but classification logic does not yet handle it. |
| Employee on approved leave | `effective_status = 'on_leave'`. If the employee punches in despite being on leave, the session is recorded but the daily status remains `on_leave` (leave takes priority). |
| Employee submits correction for a day with no session | A new session is created with the corrected times (after manager approval). Audit log records it as a correction. |
| Policy changes mid-day (e.g., grace period updated) | Sessions already classified are not retroactively reclassified. New punches use the updated policy. |
| Multiple overtime sessions on the same off-day | All sessions are recorded. Total overtime = sum of all session durations. Each may generate its own overtime request. |

---

## Known Limitations & Future Considerations

| Limitation | Notes |
|---|---|
| Midnight-spanning shifts | The classification engine uses minutes-since-midnight. Supporting night shifts requires a different time model (e.g., shift-relative minutes or datetime-based boundaries). The multi-session data model already supports this — only the classification logic needs updating. |
| Geolocation / IP verification | Not implemented. The system does not verify where the punch was made. Can be added as optional metadata on sessions. |
| Break tracking | Sessions implicitly capture breaks (gap between checkout and next check-in), but there is no explicit "break" concept. Could be added as a session type or separate entity. |
| Biometric / hardware integration | The system is web-only. Hardware terminal integration would feed into the same session model via API. |
| Multi-timezone organizations | All times are currently in the organization's single timezone. Multi-timezone support would require per-location or per-employee timezone settings. |

# Attendance Punch System — Policy & Logic Reference

This document describes how the attendance punch-in system works, including all statuses, time zones, overtime rules, and edge cases.

## Work Schedule

Each employee's schedule is resolved in this order:

1. **Per-user schedule** — If a user's profile has `work_days`, `work_start_time`, and `work_end_time` all set, those are used. Off-days are derived as any day NOT in `work_days`.
2. **Org policy (default)** — Otherwise, the organization's `attendance_policy` provides `work_start_time`, `work_end_time`, and `weekly_off_days`.

Grace period and auto-punch-out buffer always come from the org policy, even for users with custom schedules.

## Time Zones During a Work Day

Given a shift of **9:00 AM – 6:00 PM** with a **15 min grace period**:

```
|--- OVERTIME ---|--- Early Login ---|-- ON TIME --|--- LATE ---|--- OVERTIME ---|
12:00 AM        8:00 AM            9:00 AM       9:15 AM     6:00 PM          11:59 PM
```

| Time Window | Zone | Punch-In Status |
|---|---|---|
| 12:00 AM – 7:59 AM | Overtime | `present` + overtime request |
| 8:00 AM – 8:59 AM | Early login (1h before shift) | `present` (on time) |
| 9:00 AM – 9:15 AM | Within grace period | `present` (on time) |
| 9:16 AM – 5:59 PM | After grace, during shift | `late` |
| 6:00 PM – 11:59 PM | Overtime | `present` + overtime request |

## Statuses

### On Check-In (stored in `attendance_logs.status`)

The system evaluates in this order:

1. **Overtime?** — Non-working day, or time is before `shiftStart - 60min` or after `shiftEnd` → status = `present`, auto-create overtime request.
2. **Late?** — Working day, time is after `shiftStart + gracePeriod` → status = `late`.
3. **On time** — Everything else → status = `present`.

Overtime punches are **never** tagged as `late`. This was a previous bug where punching in at 8 PM on a 9–6 shift would be marked `late` because 20:00 > 9:15.

### Status Values

| Status | Meaning |
|---|---|
| `present` | Arrived on time (or overtime punch) |
| `late` | Arrived after shift start + grace period |
| `absent` | Did not punch in on a working day (displayed in monthly calendar for past days with no log) |
| `on_leave` | On approved leave |

## Overtime Rules

### What Counts as Overtime

A punch is overtime when **any** of these are true:
- It's a **non-working day** (e.g., Friday/Saturday or custom off-day)
- On a working day: current time is **before** `shiftStart - 60 minutes`
- On a working day: current time is **after** `shiftEnd`

### Overtime Request

When a punch-in is classified as overtime, the system automatically creates a `leave_requests` row with `type: 'overtime'` that requires manager approval.

### Overtime Timer

When an employee is checked in past shift end on a working day, the UI shows:
- The **main clock** switches from blue to amber and displays total time since punch-in
- A separate **overtime elapsed** counter appears showing time past shift end
- The **progress bar** stays at 100% (shift is complete)

## Punch-In Availability

| Context | Can Punch In? |
|---|---|
| 1 hour before shift start or later | Yes |
| More than 1 hour before shift start (overtime context) | Yes, with overtime confirmation |
| Non-working day | Yes, with overtime confirmation |
| After shift end (overtime context) | Yes, with overtime confirmation |
| No shift configured | Yes, always |

The punch-in button is always available for overtime scenarios. The 1-hour restriction only applies to early regular-shift check-ins.

## Timer Display

### Main Clock (Blue Circle)

Shows **real elapsed time since punch-in**. This is the actual time the employee has been working, not clipped to the shift window.

- **Blue** during regular hours
- **Amber** during overtime (past shift end, non-working day, or overtime punch-in)

### Progress Bar

Shows shift completion as a percentage (0–100%), capping at 100% when the shift ends. Hidden during pure overtime work (e.g., non-working day or overtime-only punch-in).

### Hours Worked Line

Shows the same elapsed time since punch-in as a "ساعات العمل" label below the progress bar.

## Monthly Calendar

- **Present** (green dot): `status = 'present'`
- **Late** (amber dot): `status = 'late'`
- **Absent** (red dot): `status = 'absent'` or past working day with no log
- **Weekend/Off** (no dot): Day is in the user's `weeklyOffDays` with no attendance log
- **Future** (no dot): Date is after today

Weekend detection uses the employee's actual `weeklyOffDays` (from their custom schedule or org policy), not hardcoded Friday/Saturday.

## Auto Punch-Out

A server-side job (`auto-punch-out` edge function) runs periodically and automatically checks out employees who forgot to punch out. It:
- Sets `check_out_time` to the **shift end time** (not the current time)
- Sets `auto_punch_out = true`
- Only triggers after `shiftEnd + bufferMinutes` has passed (the buffer controls auto-punch-out timing only, not overtime classification)

## Re-Check-In (Second Session)

When an employee checks out and checks back in on the same day:
- The previous `check_in_time` and `check_out_time` are **overwritten** (DB schema supports only one session per day)
- Status is re-evaluated based on the new punch-in time
- If the new punch is overtime, an overtime request is created

**Known limitation:** The original session's times are lost. A future enhancement could add multi-session support.

## Edge Cases

| Scenario | Behavior |
|---|---|
| Overnight overtime (2 AM punch-in) | Allowed. Classified as overtime, confirmation shown. |
| Employee late at 9:30 on a 9:00 shift | Tagged `late` (past 15-min grace). |
| Didn't work regular shift, comes in at 8 PM | Tagged as overtime `present`. The day shows as absent in monthly view if no earlier log exists. |
| Non-working day punch-in | All hours = overtime. Confirmation shown. |
| Check out at 5 PM, re-check in at 6:01 PM | Second session = overtime. Original session overwritten. |
| No shift configured for user or org | Punch allowed at any time, status = `present`, no overtime tagging. |
| Shift spanning midnight (10 PM – 6 AM) | Not currently supported. All time math uses minutes-since-midnight. Documented as a limitation. |
| Employee on leave | `status = 'on_leave'` is set separately (not by the punch system). |

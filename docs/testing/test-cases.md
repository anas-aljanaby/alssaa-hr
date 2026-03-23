# Test Cases and Edge Cases

This document tracks planned test cases and edge cases in English.

- [ ] = Not implemented yet
- [x] = Implemented

## 1. Punch-In Status Classification

> Corresponding test file: `supabase/functions/punch/handler.test.ts`  
> **Scope:** Session-level fields only (`status`, `is_overtime` at punch-in). Day-level `effective_status` is in §4 and §3 daily-summary tables.

### 1.1 Grace Period Boundaries

| # | Implemented | Punch-In Time | Expected status | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.1.1 | [x] | 09:00 | `present` | `false` | Shift start, exactly on time |
| 1.1.2 | [x] | 09:14 | `present` | `false` | 1 minute inside grace |
| 1.1.3 | [x] | 09:15 | `present` | `false` | Grace boundary - inclusive (`<=`) |
| 1.1.4 | [x] | 09:16 | `late` | `false` | First minute after grace ends |
| 1.1.5 | [x] | 09:30 | `late` | `false` | Clearly late |
| 1.1.6 | [x] | 17:59 | `late` | `false` | Still within shift, long after grace |
| 1.1.7 | [x] | 18:00 | `late` | `false` | Exactly at shift end - still within shift (`<=`) |

### 1.2 Early Login Window Boundaries

| # | Implemented | Punch-In Time | Expected status | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.2.1 | [x] | 08:00 | `present` | `false` | Exactly at early login window start |
| 1.2.2 | [x] | 08:01 | `present` | `false` | Inside early login window |
| 1.2.3 | [x] | 08:59 | `present` | `false` | Last minute of early login window |
| 1.2.4 | [x] | 07:59 | `present` | `true` | One minute before window - overtime |
| 1.2.5 | [x] | 07:00 | `present` | `true` | Well before window - overtime |

### 1.3 Post-Shift Overtime Boundary

| # | Implemented | Punch-In Time | Expected status | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.3.1 | [x] | 18:00 | `late` | `false` | Exactly at shift end - NOT overtime (`>` is strict) |
| 1.3.2 | [x] | 18:01 | `present` | `true` | First minute of overtime zone |
| 1.3.3 | [x] | 20:00 | `present` | `true` | Clearly in post-shift overtime |
| 1.3.4 | [x] | 23:59 | `present` | `true` | End of calendar day |

### 1.4 Overnight / Very Early Punch-In

| # | Implemented | Punch-In Time | Expected status | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1.4.1 | [x] | 00:00 | `present` | `true` | Midnight - well before early login window |
| 1.4.2 | [x] | 02:00 | `present` | `true` | Early morning overtime |
| 1.4.3 | [x] | 07:59 | `present` | `true` | One minute before window - overtime |

## 2. Non-Working Day Punch-In

> Corresponding test file: `supabase/functions/punch/handler.test.ts`  
> **Scope:** Session-level classification on off-days (all such sessions are overtime). Off-days do **not** set `effective_status` (see policy); calendar shows an overtime day when sessions exist.

### 2.1 Off-Day Punch-In Classification

| # | Implemented | Day | Punch-In Time | Expected status | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | [x] | Friday (off-day) | 10:00 | `present` | `true` | Non-working day punch |
| 2.2 | [x] | Saturday (off-day) | 09:00 | `present` | `true` | Non-working day punch |
| 2.3 | [x] | Friday (off-day) | 08:00 | `present` | `true` | Early off-day punch |
| 2.4 | [x] | Friday (off-day) | 00:01 | `present` | `true` | Very early off-day punch |
| 2.5 | [x] | Friday (off-day) | 23:59 | `present` | `true` | End-of-day off-day punch |
| 2.6 | [x] | Custom off-day (per-user) | 10:00 | `present` | `true` | User-specific non-working day |

### 2.2 Confirmation Dialog (Non-Working Day)

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 2.2.1 | [x] | Any non-working-day punch attempt | Confirmation dialog is shown before submission | Applies to weekly off-days and custom per-user off-days |

## 3. Multi-Session - Basic

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

### 3.1 Two Sessions, Both Regular

Scenario: Employee punches in at 08:30, out at 12:00, in again at 13:00, out at 18:00.

| # | Implemented | Session | Check-In | Check-Out | Expected `status` | Expected `is_overtime` | Expected duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.1.S1 | [x] | 1 | 08:30 | 12:00 | `present` | `false` | 210 min |
| 3.1.S2 | [x] | 2 | 13:00 | 18:00 | `present` | `false` | 300 min |

Expected daily summary:

| # | Implemented | Field | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.1.1 | [x] | `total_work_minutes` | `510` | 210 + 300 |
| 3.1.2 | [x] | `total_overtime_minutes` | `0` | No overtime sessions |
| 3.1.3 | [x] | `effective_status` | `present` | Day is valid and worked |
| 3.1.4 | [x] | `session_count` | `2` | Two completed sessions |
| 3.1.5 | [x] | `first_check_in` | `08:30` | First session check-in |
| 3.1.6 | [x] | `last_check_out` | `18:00` | Last session check-out |
| 3.1.7 | [x] | `is_short_day` | `false` | 510 min = 8.5 h, above 8 h minimum |

### 3.2 Late First Session, On-Time Return

Scenario: Punches in at 09:30 (late), out at 13:00, returns at 14:00, out at 18:30.

| # | Implemented | Session | Check-In | Check-Out | Expected `status` | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.2.S1 | [x] | 1 | 09:30 | 13:00 | `late` | `false` | First check-in is after grace |
| 3.2.S2 | [x] | 2 | 14:00 | 18:00 | `late` | `false` | Second check-in is after grace |

| # | Implemented | Assertion | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.2.1 | [x] | Session classification rule | Independent per session | Each session classified by its own check-in |
| 3.2.2 | [x] | `effective_status` | `late` | Non-overtime sessions are all `late`; no non-overtime on-time session → `late` |

### 3.3 Regular Session + Post-Shift Overtime Session

Scenario: Works 09:00 - 18:10, punches out, then punches back in at 18:12.

| # | Implemented | Session | Check-In | Check-Out | Expected `status` | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.3.S1 | [x] | 1 | 09:00 | 18:10 | `present` | `false` | Regular session |
| 3.3.S2 | [x] | 2 | 18:12 | - | `present` | `true` | Check-in at 18:12 is post-shift overtime |

| # | Implemented | Assertion | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.3.1 | [x] | Overtime threshold | `18:12 > 18:00` => overtime | Session 2 is overtime session |
| 3.3.2 | [x] | Overtime request creation | Auto-created for session 2 | Separate overtime workflow trigger |
| 3.3.3 | [x] | `effective_status` | `present` | Session 1 is regular and on time |

### 3.4 Off-Day With Multiple Overtime Sessions

Scenario: Friday. Punches in at 10:00, out at 13:00, in again at 15:00, out at 19:00.

| # | Implemented | Session | Check-In | Check-Out | Expected `status` | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.4.S1 | [x] | 1 | 10:00 | 13:00 | `present` | `true` | Off-day overtime session |
| 3.4.S2 | [x] | 2 | 15:00 | 19:00 | `present` | `true` | Off-day overtime session |

Expected daily summary:

| # | Implemented | Field / Assertion | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.4.1 | [x] | `total_work_minutes` | `420` | 180 + 240 |
| 3.4.2 | [x] | `total_overtime_minutes` | `420` | All worked minutes are overtime |
| 3.4.3 | [x] | `effective_status` | *(none / null)* | Off-day: no shift to fulfill — policy does not set `effective_status` |
| 3.4.4 | [x] | `session_count` | `2` | Two completed sessions |
| 3.4.5 | [x] | Calendar display | Overtime day (purple + overtime badge) | Per policy: off-day with sessions; not green `present` |
| 3.4.6 | [x] | Overtime requests | Separate request per session | Both sessions generate overtime requests |

### 3.5 No Regular Session - Only Comes In for Overtime After Shift End

Scenario: Working day. Employee skips the regular shift entirely, punches in at 20:00.

| # | Implemented | Session | Check-In | Expected `status` | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 3.5.S1 | [x] | 1 | 20:00 | `present` | `true` | Overtime-only attendance on working day |

Expected daily summary:

| # | Implemented | Field / Assertion | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.5.1 | [x] | `effective_status` | `overtime_only` | No non-overtime session — regular shift not fulfilled |
| 3.5.2 | [x] | Attendance flag | Not `absent` | `overtime_only` ≠ `absent` (sessions exist) |
| 3.5.3 | [x] | Calendar display | Purple / `overtime_only` indicator + overtime context | Not green “present”; aligns with `attendance-policy-new.md` |

### 3.6 Many Sessions - Sum Correctness

Scenario: Three sessions on a working day.

| # | Implemented | Session | Check-In | Check-Out | Expected duration | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 3.6.S1 | [x] | 1 | 08:30 | 10:00 | 90 min | Regular session |
| 3.6.S2 | [x] | 2 | 11:00 | 13:00 | 120 min | Regular session |
| 3.6.S3 | [x] | 3 | 14:00 | 17:00 | 180 min | Regular session |

Expected daily summary:

| # | Implemented | Field | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.6.1 | [x] | `total_work_minutes` | `390` | 90 + 120 + 180 |
| 3.6.2 | [x] | `is_short_day` | `true` | 390 min = 6.5 h, below 8 h minimum |
| 3.6.3 | [x] | `session_count` | `3` | Three completed sessions |

## 4. Daily Summary — Effective Status Resolution

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

Priority order (working days): `on_leave` > `late` > `present` > `overtime_only` > `absent`

Notes / definitions used by these test cases:
- `on_leave` applies only when leave is approved for the day (`Yes (approved)`); it overrides everything else.
- `late` applies when there is at least one *non-overtime* session with `status = late`, **and** no *non-overtime* session with `status = present`, and no approved leave.
- `present` applies when there is at least one *non-overtime* session with `status = present`, and no approved leave, and the rules above do not yield `on_leave` or `late`.
- `overtime_only` applies on a **working day** when sessions exist but **all** sessions have `is_overtime = true` (regular shift not fulfilled via a non-overtime session).
- `absent` applies on a **past working day** with **no** sessions.
- Off-day (non-working day) behavior:
  - With sessions: **no** `effective_status` (nothing to fulfill); calendar shows overtime day styling.
  - Without sessions: **no** `effective_status` (must not be `absent`).

| # | Implemented | Sessions | Leave? | Expected effective_status | Notes |
| --- | --- | --- | --- | --- | --- |
| 4.1 | [x] | None | Yes (approved) | `on_leave` | Leave takes absolute priority over attendance classification |
| 4.2 | [x] | One late session | Yes (approved) | `on_leave` | `on_leave` priority over `late` |
| 4.3 | [x] | One present session (non-overtime) | No | `present` | On-time arrival during regular hours |
| 4.4 | [x] | One late session (non-overtime), no on-time non-overtime session | No | `late` | Only `late` non-overtime sessions |
| 4.5 | [x] | One present + one late (non-overtime) | No | `present` | On-time non-overtime session exists → not eligible for `effective_status=late` per policy |
| 4.6 | [x] | One present (overtime) + one late (non-overtime) | No | `late` | Overtime `present` does not count; only non-overtime is `late` |
| 4.7 | [x] | Only overtime sessions | No | `overtime_only` | Working day, sessions exist, all `is_overtime=true` |
| 4.8 | [x] | None, past working day | No | `absent` | Past working day with no sessions => absent |
| 4.9 | [x] | None, today (not yet EOD) | No | `absent` (or not yet determined — verify behavior) | Check whether the system should still return `absent` or a non-final state before end-of-day |
| 4.10 | [x] | None, off-day | No | No status (not absent) | Off-day without sessions should not be classified as `absent` |
| 4.11 | [x] | Sessions on off-day (all overtime) | No | No `effective_status` | Off-day: calendar overtime day; field null/unset like policy |

## 5. Daily Summary — Recalculation Triggers

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

Each of the following events should trigger a full recalculation of the daily summary.

| # | Implemented | Trigger | Expected recalculation behavior | Notes |
| --- | --- | --- | --- | --- |
| 5.1 | [x] | New session created (punch-in) | Daily summary is recalculated immediately after session creation | Verify all summary fields refresh from latest sessions |
| 5.2 | [x] | Session closed (punch-out) | Daily summary is recalculated immediately after session closure | Recompute worked time and short-day status |
| 5.3 | [x] | Auto punch-out fires | Daily summary is recalculated after auto punch-out update | Include auto-closed session end time in totals |
| 5.4 | [x] | Manager manually edits a session's check-in/check-out time | Daily summary is recalculated after edit persistence | Recalculation must use corrected time values |
| 5.5 | [x] | Correction request approved and applied | Daily summary is recalculated after approved correction is written | Applies to both updates and newly created sessions |
| 5.6 | [x] | Session deleted by admin | Daily summary is recalculated after session deletion | Removed session must no longer contribute to totals/status |

For every trigger above, validate these fields are up to date:

| # | Implemented | Field | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 5.V1 | [x] | `total_work_minutes` | Reflects latest sum of valid session durations | Includes only remaining/current sessions |
| 5.V2 | [x] | `total_overtime_minutes` | Reflects latest overtime-only minute total | Must update when overtime sessions change |
| 5.V3 | [x] | `effective_status` | Re-resolved from current day state | Must respect priority rules (`on_leave` … `overtime_only` … `absent`) and session flags |
| 5.V4 | [x] | `is_short_day` | Re-evaluated from current total minutes and policy | Must flip when threshold crossing occurs |

## 6. Auto Punch-Out

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

Baseline: shift ends `18:00`, buffer `30` min -> auto-punch-out job fires at or after `18:30`.

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 6.1 | [x] | Standard auto punch-out at 18:35 for 09:00 check-in | `check_out_time=18:35`, `is_auto_punch_out=true`, `needs_review=true`, duration recalculated | Uses actual trigger time, not shift end |
| 6.2 | [x] | Job runs before buffer (18:20) | Session remains open, no auto punch-out applied | Buffer must be enforced |
| 6.3 | [x] | Open overtime session exists | Overtime session is not auto-closed | Applies to `is_overtime=true` sessions |
| 6.4 | [x] | Off-day auto punch-out run | Off-day sessions are skipped | Must not auto-close off-day sessions |
| 6.5 | [x] | Multiple open non-overtime sessions (abnormal state) | Expected handling defined and applied consistently | Also verify `needs_review` and recalculation behavior |
| 6.6 | [x] | Trigger time vs shift-end regression | `check_out_time` equals job execution time | Regression guard for old behavior |
| 6.7 | [x] | Daily summary after auto punch-out | Summary fields updated (`total_work_minutes`, `last_check_out`, `effective_status`) | Recalculation should run automatically |

## 7. Early Departure

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 7.1 | [x] | Check-out before shift end (09:00 -> 15:00) | `is_early_departure=true`, status unchanged, duration computed | Early departure is informational |
| 7.2 | [x] | Check-out exactly at shift end (09:00 -> 18:00) | `is_early_departure=false` | Boundary check |
| 7.3 | [x] | Late or present session checked out early | `status` remains original (`present`/`late`) | Early departure must not rewrite status |
| 7.4 | [x] | Early departure causing short day | `is_short_day=true` when total < minimum | Validate summary update |
| 7.5 | [x] | Multiple sessions still meet minimum | `is_short_day=false` | Combined minutes override single-session early departure |
| 7.6 | [x] | Overtime session check-out | `is_early_departure=false` | Shift-end comparison should not apply to overtime session |

## 8. Overtime Request Creation

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 8.1 | [x] | Working-day overtime punch-in (e.g. 19:00) | Overtime session created and overtime request inserted as `pending` | Request references session |
| 8.2 | [x] | Off-day punch-in | Each off-day session creates its own overtime request | One request per session |
| 8.3 | [x] | Before-window punch-in (e.g. 06:00) | Overtime request created | Pre-window overtime path |
| 8.4 | [x] | Overtime request insert fails | Punch-in still succeeds with `is_overtime=true` | Best-effort request creation |
| 8.5 | [x] | Multiple overtime sessions in same day | Multiple overtime requests inserted | No dedupe across sessions |
| 8.6 | [x] | Session reference integrity | `overtime_requests.session_id` matches created session ID | Referential correctness |
| 8.7 | [x] | Table routing regression | Requests go to `overtime_requests`, not `leave_requests` | Guard old architecture behavior |

## 9. Session Flags

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Flag behavior | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 9.1 | [ ] | `needs_review` source | Set only by auto punch-out | Manual punch-outs keep `needs_review=false` |
| 9.2 | [ ] | `is_auto_punch_out` consistency | Auto-closed session has `is_auto_punch_out=true` and `needs_review=true` | Manual close has both false |
| 9.3 | [ ] | `is_overtime` immutability | Determined at check-in and not retroactively changed by policy updates | Historical consistency |

## 10. Punch-In Availability / Blocking

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 10.1 | [ ] | Second punch-in while session already open | Rejected | Must check out first |
| 10.2 | [ ] | Second punch-in within cooldown (45s) | Rejected with cooldown error | Server-side anti-double-tap |
| 10.3 | [ ] | Punch-in after cooldown (61s) and proper checkout | Allowed | Cooldown boundary |
| 10.4 | [ ] | Punch-out retried within cooldown | Rejected with cooldown error | Cooldown applies to check-out too |
| 10.5 | [ ] | No schedule/policy configured | Punch allowed, `status=present`, `is_overtime=false`, no progress-bar dependency | No policy fallback behavior |

## 11. Leave + Punch Interaction

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 11.1 | [ ] | Approved leave + punch activity on same day | Session recorded, but `effective_status=on_leave` | Leave priority over attendance status |
| 11.2 | [ ] | Approved leave on off-day | `effective_status=on_leave` | Leave still takes precedence |

## 12. Transition Boundaries - End of Period / End of Day

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Boundary time | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 12.1 | [ ] | `08:00:00` (early window start) | `present`, `is_overtime=false` | Inclusive start boundary |
| 12.2 | [ ] | `07:59:59` (one second before) | `present`, `is_overtime=true` | Pre-window overtime boundary |
| 12.3 | [ ] | `09:00:00` (shift start) | `present`, `is_overtime=false` | On-time check-in |
| 12.4 | [ ] | `09:15:00` (grace boundary) | `present`, `is_overtime=false` | Inclusive grace boundary |
| 12.5 | [ ] | `09:15:01` or `09:16` | `late`, `is_overtime=false` | First late instant |
| 12.6 | [ ] | `18:00:00` (shift end) | `late`, `is_overtime=false` | Shift-zone inclusive end |
| 12.7 | [ ] | `18:01` or `18:00:01` | `present`, `is_overtime=true` | First post-shift overtime instant |
| 12.8 | [ ] | Check-out exactly at `18:00` | `is_early_departure=false` | Check-out boundary |
| 12.9 | [ ] | Check-out at `17:59` | `is_early_departure=true` | One-unit-before boundary |
| 12.10 | [ ] | `23:59` last punch of day | Classified in same date, post-shift overtime | Midnight-edge classification |

## 13. Schedule Resolution Priority

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 13.1 | [ ] | User schedule overrides org shift times | User shift boundaries drive status/overtime classification | Per-user priority for shift times |
| 13.2 | [ ] | Org grace period with custom user schedule | Grace still applied to custom shift start | Cross-source policy composition |
| 13.3 | [ ] | Custom user work-days | Working/off-day resolution uses user work-days | No hardcoded weekday assumptions |
| 13.4 | [ ] | No user schedule, org policy exists | Org policy used as fallback | Org fallback path |
| 13.5 | [ ] | No user schedule and no org policy | Punch allowed, `status=present`, `is_overtime=false` | Null-policy behavior |

## 14. Minimum Required Hours / Short Day

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Total work minutes | Min required (min) | Expected `is_short_day` | Notes |
| --- | --- | --- | --- | --- | --- |
| 14.1 | [ ] | `480` | `480` | `false` | Exactly meets minimum |
| 14.2 | [ ] | `479` | `480` | `true` | One minute short |
| 14.3 | [ ] | `510` | `480` | `false` | Above minimum |
| 14.4 | [ ] | `0` | `480` | `true` | No work minutes |
| 14.5 | [ ] | `300` | `null` | `false` | Minimum-hours enforcement disabled |

## 15. Policy Change Mid-Day

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 15.1 | [ ] | Grace period changed after existing session | Existing session unchanged; future sessions use new grace | No retroactive mutation |
| 15.2 | [ ] | Shift end changed during active day | Existing session classification stable; new sessions use new shift end | Temporal consistency |

## 16. Audit Log

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Action | Expected audit behavior | Notes |
| --- | --- | --- | --- | --- |
| 16.1 | [ ] | Punch-in | `action=check_in`, actor is employee, new snapshot present | `old_values=null` |
| 16.2 | [ ] | Punch-out | `action=check_out`, old/new snapshots recorded | Change traceability |
| 16.3 | [ ] | Auto punch-out | `action=auto_punch_out`, actor is system | System-generated action |
| 16.4 | [ ] | Manual edit | `action=manual_edit`, actor is manager/admin, old/new values present | Admin modification trace |
| 16.5 | [ ] | Correction approval | `action=correction_approved`, includes reason and value diff | Approval workflow audit |
| 16.6 | [ ] | Append-only enforcement | No update/delete of audit rows | Immutable audit history |

## 17. Attendance Correction Requests

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 17.1 | [ ] | Approved correction updates existing session | Session times and duration updated; summary recalculated; audit logged | Existing-row correction path |
| 17.2 | [ ] | Approved correction creates missing session | New session created; summary created/updated; audit logged | Missing-day correction path |
| 17.3 | [ ] | Correction pending | No session mutation before approval | Approval gate |
| 17.4 | [ ] | Correction rejected | Session remains unchanged | Rejection path |
| 17.5 | [ ] | Manager direct edit | Edit applied without correction request flow; `manual_edit` audit entry | Direct admin path |

## 18. Calendar Display Edge Cases

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Scenario | Expected calendar state | Notes |
| --- | --- | --- | --- | --- |
| 18.1 | [ ] | Working day, `effective_status=present` | Green | Present day indicator |
| 18.2 | [ ] | Working day, `effective_status=late` | Amber | Late day indicator |
| 18.3 | [ ] | Past working day, no sessions | Red (absent) | Absence indicator |
| 18.4 | [ ] | Today, no sessions yet | Verify expected behavior | Non-final-day handling |
| 18.5 | [ ] | On leave | Blue | Leave indicator |
| 18.6 | [ ] | Off-day, no sessions | No indicator | Off-day neutral state |
| 18.7 | [ ] | Off-day with sessions (overtime) | Purple + overtime badge | Off-day attendance visual (`effective_status` N/A) |
| 18.8 | [ ] | Future date | No indicator | Future date neutral state |
| 18.9 | [ ] | Custom off-day user (e.g. Wednesday off) | Off-day detection uses user's `weeklyOffDays` | No hardcoded Fri/Sat assumption |
| 18.10 | [ ] | Working day, `effective_status=overtime_only` | Purple (or dedicated `overtime_only` style) | Not green present — regular shift not fulfilled |

## 19. Regression Tests - Old vs. New Behavior

> Corresponding test file: `supabase/functions/punch/handler.test.ts`

| # | Implemented | Old behavior | New expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 19.1 | [ ] | Re-check-in overwrote previous session | Previous session preserved and new row created | Multi-session correctness |
| 19.2 | [ ] | Only one session per day | Multiple sessions allowed and stored independently | Session model regression guard |
| 19.3 | [ ] | Auto punch-out used shift end as check-out time | Auto punch-out uses actual job trigger time | Time-source regression guard |
| 19.4 | [ ] | Overtime used `leave_requests` with `type=overtime` | Overtime uses `overtime_requests` table | Data-model regression guard |
| 19.5 | [ ] | Post-shift punch-in could be `late` | Post-shift punch-in is session `present` + `is_overtime=true` (not session `late`) | Session-level regression guard |
| 19.6 | [ ] | Single daily log row only | `attendance_daily_summary` is maintained separately | Summary-model regression guard |
| 19.7 | [ ] | Overtime-only working day showed `effective_status=present` | Working day with only overtime sessions → `overtime_only` | Aligns with `attendance-policy-new.md` |


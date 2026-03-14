# Test Cases and Edge Cases

This document tracks planned test cases and edge cases in English.

- [ ] = Not implemented yet
- [x] = Implemented

## 1. Punch-In Status Classification

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

### 3.1 Two Sessions, Both Regular

Scenario: Employee punches in at 08:30, out at 12:00, in again at 13:00, out at 18:00.

| Session | Check-In | Check-Out | Expected `status` | Expected `is_overtime` | Expected duration |
| --- | --- | --- | --- | --- | --- |
| 1 | 08:30 | 12:00 | `present` | `false` | 210 min |
| 2 | 13:00 | 18:00 | `present` | `false` | 300 min |

Expected daily summary:

| # | Implemented | Field | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.1.1 | [ ] | `total_work_minutes` | `510` | 210 + 300 |
| 3.1.2 | [ ] | `total_overtime_minutes` | `0` | No overtime sessions |
| 3.1.3 | [ ] | `effective_status` | `present` | Day is valid and worked |
| 3.1.4 | [ ] | `session_count` | `2` | Two completed sessions |
| 3.1.5 | [ ] | `first_check_in` | `08:30` | First session check-in |
| 3.1.6 | [ ] | `last_check_out` | `18:00` | Last session check-out |
| 3.1.7 | [ ] | `is_short_day` | `false` | 510 min = 8.5 h, above 8 h minimum |

### 3.2 Late First Session, On-Time Return

Scenario: Punches in at 09:30 (late), out at 13:00, returns at 14:00, out at 18:30.

| Session | Check-In | Check-Out | Expected `status` | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | 09:30 | 13:00 | `late` | `false` | First check-in is after grace |
| 2 | 14:00 | 18:00 | `late` | `false` | Second check-in is after grace |

| # | Implemented | Assertion | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.2.1 | [ ] | Session classification rule | Independent per session | Each session classified by its own check-in |
| 3.2.2 | [ ] | `effective_status` | `late` | At least one non-overtime session is `late` |

### 3.3 Regular Session + Post-Shift Overtime Session

Scenario: Works 09:00 - 18:10, punches out, then punches back in at 18:12.

| Session | Check-In | Check-Out | Expected `status` | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | 09:00 | 18:10 | `present` | `false` | Regular session |
| 2 | 18:12 | - | `present` | `true` | Check-in at 18:12 is post-shift overtime |

| # | Implemented | Assertion | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.3.1 | [ ] | Overtime threshold | `18:12 > 18:00` => overtime | Session 2 is overtime session |
| 3.3.2 | [ ] | Overtime request creation | Auto-created for session 2 | Separate overtime workflow trigger |
| 3.3.3 | [ ] | `effective_status` | `present` | Session 1 is regular and on time |

### 3.4 Off-Day With Multiple Overtime Sessions

Scenario: Friday. Punches in at 10:00, out at 13:00, in again at 15:00, out at 19:00.

| Session | Check-In | Check-Out | Expected `status` | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | 10:00 | 13:00 | `present` | `true` | Off-day overtime session |
| 2 | 15:00 | 19:00 | `present` | `true` | Off-day overtime session |

Expected daily summary:

| # | Implemented | Field / Assertion | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.4.1 | [ ] | `total_work_minutes` | `420` | 180 + 240 |
| 3.4.2 | [ ] | `total_overtime_minutes` | `420` | All worked minutes are overtime |
| 3.4.3 | [ ] | `effective_status` | `present` | Overtime attendance counts |
| 3.4.4 | [ ] | `session_count` | `2` | Two completed sessions |
| 3.4.5 | [ ] | Calendar display | Overtime day | Not absent, not off |
| 3.4.6 | [ ] | Overtime requests | Separate request per session | Both sessions generate overtime requests |

### 3.5 No Regular Session - Only Comes In for Overtime After Shift End

Scenario: Working day. Employee skips the regular shift entirely, punches in at 20:00.

| Session | Check-In | Expected `status` | Expected `is_overtime` | Notes |
| --- | --- | --- | --- | --- |
| 1 | 20:00 | `present` | `true` | Overtime-only attendance on working day |

Expected daily summary:

| # | Implemented | Field / Assertion | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.5.1 | [ ] | `effective_status` | `present` | Overtime punch counts as attendance |
| 3.5.2 | [ ] | Attendance flag | Not absent | Day should not be marked absent |
| 3.5.3 | [ ] | Calendar display | Present / overtime badge | Calendar dot shows attendance |

### 3.6 Many Sessions - Sum Correctness

Scenario: Three sessions on a working day.

| Session | Check-In | Check-Out | Expected duration | Notes |
| --- | --- | --- | --- | --- |
| 1 | 08:30 | 10:00 | 90 min | Regular session |
| 2 | 11:00 | 13:00 | 120 min | Regular session |
| 3 | 14:00 | 17:00 | 180 min | Regular session |

Expected daily summary:

| # | Implemented | Field | Expected value | Notes |
| --- | --- | --- | --- | --- |
| 3.6.1 | [ ] | `total_work_minutes` | `390` | 90 + 120 + 180 |
| 3.6.2 | [ ] | `is_short_day` | `true` | 390 min = 6.5 h, below 8 h minimum |
| 3.6.3 | [ ] | `session_count` | `3` | Three completed sessions |

## TODO List (save for later)

1. **Multi-session support** — Replace single-row overwrite with a punch log table (multiple in/out pairs per day) and a computed daily summary. Add migration to preserve existing data.
2. **Separate overtime from leave_requests** — Create a dedicated `overtime_requests` table (or a generic `requests` table). Migrate existing `type: 'overtime'` rows. Update all queries.
3. **Auto punch-out review UI** — Add a manager-facing view that filters `auto_punch_out = true` records for manual correction.
4. **Overtime request failure recovery** — Add either a retry queue, an admin alert, or a reconciliation job that finds overtime punches with no matching request.
5. **Server-side cooldown guard** — Reject check-in if the last check-in for that user was less than 60 seconds ago (don't rely on UI-only protection).
6. **Midnight-spanning shift support** — Refactor minutes-since-midnight math to handle shifts like 10 PM – 6 AM.

---

## Edge Cases to Test

### Session overwrite (document current behavior so future refactor doesn't break expectations)

| # | Case | Expected behavior (current) |
|---|---|---|
| 1 | Check in 9 AM, check out 1 PM, re-check in 2 PM | First session times are overwritten. Status re-evaluated for 2 PM. |
| 2 | Check in 9 AM, check out 1 PM, re-check in 6:01 PM | Overwrite. New status = `present` + overtime request attempted. |
| 3 | Check in 9 AM, check out 5 PM, re-check in 5:30 PM (still within shift) | Overwrite. New status = `late` (5:30 PM > 9:15 AM grace). |
| 4 | Two rapid check-ins within the same minute | Second one should still overwrite cleanly without DB errors. |

### Overtime classification boundaries

| # | Case | Expected |
|---|---|---|
| 5 | Punch at exactly `shiftStart - 60min` (8:00 AM for 9 AM shift) | **Not** overtime. Status = `present` (early login). |
| 6 | Punch at `shiftStart - 61min` (7:59 AM) | Overtime. Status = `present` + overtime request. |
| 7 | Punch at exactly `shiftEnd` (6:00 PM) | **Not** overtime. Status = `late`. |
| 8 | Punch at `shiftEnd + 1min` (6:01 PM) | Overtime. Status = `present` + overtime request. |
| 9 | Punch at exactly midnight (12:00 AM) | Overtime. |
| 10 | Punch at 11:59 PM | Overtime. |

### Grace period boundaries

| # | Case | Expected |
|---|---|---|
| 11 | Punch at exactly `shiftStart` (9:00 AM) | `present` |
| 12 | Punch at `shiftStart + gracePeriod` (9:15 AM with 15min grace) | `present` (grace is inclusive). |
| 13 | Punch at `shiftStart + gracePeriod + 1min` (9:16 AM) | `late` |
| 14 | Grace period = 0 minutes, punch at 9:01 AM | `late` |
| 15 | Grace period = 0 minutes, punch at exactly 9:00 AM | `present` |

### Overtime request failure (non-blocking)

| # | Case | Expected |
|---|---|---|
| 16 | Overtime punch, request insert succeeds | Log created with `present`, request row exists. |
| 17 | Overtime punch, request insert throws/rejects | Log still created with `present`. No error thrown to caller. |
| 18 | Overtime punch, request insert returns `{ error }` from Supabase | Same — punch succeeds, request silently fails. |

### Schedule resolution

| # | Case | Expected |
|---|---|---|
| 19 | User has custom schedule → use user's times and days | Correct shift used. |
| 20 | User has no custom schedule, org policy exists | Org policy shift used. |
| 21 | User has no custom schedule, no org policy | Shift = `null`. Punch allowed, status = `present`, no overtime tagging. |
| 22 | User has partial custom schedule (e.g., `work_days` set but `work_start_time` is null) | Should fall through to org policy, not use partial data. |
| 23 | Org policy exists but has `null` grace period | Fallback to default 15 minutes. |

### Non-working day

| # | Case | Expected |
|---|---|---|
| 24 | Friday punch (if Friday is in `weekly_off_days`) | Overtime. Confirmation dialog. Status = `present`. |
| 25 | Custom off-day (user schedule says Wednesday is off) | Overtime. |
| 26 | Day is NOT in off-days but has no shift times (misconfigured) | Treat like "no shift configured" — punch allowed, `present`. |

### Auto punch-out edge cases

| # | Case | Expected |
|---|---|---|
| 27 | Employee checked in, still open at `shiftEnd + buffer + 1min` | Auto punch-out sets `check_out_time` = `shiftEnd`, `auto_punch_out = true`. |
| 28 | Employee already checked out manually | Skip — log already has `check_out_time`. |
| 29 | Employee checked in on a non-working day (overtime) | Skip — auto punch-out runs only on working days. |
| 30 | Employee checked in, exactly at `shiftEnd + buffer` | **Not** triggered yet (needs to be strictly past buffer). Verify your `>` vs `>=`. |
| 31 | No org policy → no buffer value | Fallback to 30 min default buffer. |

### General defensiveness

| # | Case | Expected |
|---|---|---|
| 32 | `checkIn()` called with no authenticated user | Error returned, no DB write. |
| 33 | `checkIn()` called when a log already exists for today with no check-out | Depends on your logic — either update existing or error. Document which. |
| 34 | Time values at DST transitions (if applicable to your region) | Saudi Arabia doesn't observe DST, but test with a mocked edge time if you plan to support other regions. |
| 35 | `getStatusColor` / `getTimeAgoLabel` called with overtime-related data | Verify display helpers handle overtime status correctly. |

That's 35 cases. Prioritize **5–8, 11–13, 16–18, 19–23** — those directly test your classification logic and schedule resolution, which are the core of Phase 2 service tests.
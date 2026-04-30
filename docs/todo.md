# Todo

## Empty Task Template
- [ ] Done
- Commit Head:
- Title:
- Explanation:



## Task 1
- [x] Done
- Commit Head: 7895ed5
- Title: Remove sick days entirely
- Explanation:
We don't need sick days in this system at all, we just have regular off days and employees will write inside them the reason for off day, so remove it from everywhere including db, ui, any mention of it at all, make sure to analyze well and find direct and indirect code related to it and proceed accordingly.

## Task 2
- [ ] Done
- Commit Head:
- Title: Check what is happening when a user continues to work after 12 am
- Explanation: Determine the best way to handle post-midnight work, including both overtime and non-overtime cases. Some times users cant log in around 12 am.


## Task 3
- [ ] Done
- Commit Head:
- Title: Handle very early starts and late stays correctly
- Explanation: Define what should happen when a user starts work very early and continues, or stays after work assuming auto punch-out did not run. In both cases, sessions need to be segmented correctly based on their type and logged properly.

## Task 4
- [x] Done
- Commit Head:
- Title: Support different shift allocations for the same user
- Explanation:


## Task 5
- [x] Done
- Commit Head:18af817cc20de49e4bf9270e7cca6d3375b44751
- Title: Rework attendance policy page
- Explaination
also add auto punch out rules component 


## Task 6
- [ ] Done
- Commit Head:
- Title: Revisit notifications system architecture (test vs real, function splits)
- Explanation:
Concerns to think through when revisiting the notifications system (see `docs/Implementation Plan - Notifications System.md`):

1. **Test path may not exercise the real delivery path.** `send-test-notification` and `notify` likely have their own copies of "build payload + insert notifications row + send web push." A green test button then only proves the test copy works, not production. Fix: extract a single `deliverNotification(userId, payload, linkUrl)` helper into `supabase/functions/_shared/notifications.ts` and have both edge functions call it. After the refactor, the test button genuinely diagnoses the operationally fragile delivery layer (VAPID, push subscription validity, browser permission, payload encoding, SW handling). It still won't catch recipient resolution / pref filtering / actor exclusion / JWT validation bugs — those are real-only logic and need separate coverage (the Phase 5 manual test matrix is partly there for this).

2. **Don't merge entrypoints.** Tempting to fold `send-test-notification` into `notify`, or `notify` into `send-scheduled-notifications`, but the auth and lifecycle models differ:
   - `notify`: JWT-validated, must verify caller actually performed the claimed action, sub-second latency, fire-and-forget.
   - `send-test-notification`: admin-only, sends to self, no action validation.
   - `send-scheduled-notifications`: cron-driven, runs as service role, batch latency, dedup via `sent_scheduled_notifications`.
   Merging means flag-driven auth branches, which is the exact shape of bug that bypasses validation. Keep separate entrypoints, share leaf utilities.

3. **Audit the implemented `notify` for inline insert+push code.** If the implementing agent built insert/push inline rather than going through a shared helper, refactor before this is considered done.

4. **Future shared helper home:** if more duplication appears (payload rendering, recipient row shape), pull into `supabase/functions/_shared/notifications.ts` rather than duplicating across functions.

## Task 7
- [ ] Done
- Commit Head:
- Title: Pre-shift overtime causes day to render as "absent" alongside "overtime"
- Explanation:
Repro: user with shift 17:00→01:00 punches in at 10:57 (pre-shift overtime, correctly flagged). Profile overview tab shows "absent 10:57:00". Attendance tab on user-details page and the employees-attendance page render the day with **both** an `absent` status badge and an `overtime` tag. After 17:00 (shift start) the day still shows absent + overtime. Even after the user punches out at 20:30, the day stays "absent + overtime" instead of flipping to "present + overtime".

Note: Admin dashboard "absent today" metric and the team-attendance page do **not** double-count this user — they correctly show "available now" with the overtime tag while she's checked in. So the bug only affects the history/profile rendering layer.

The same scenario reproduces with any user whose shift is overnight (end ≤ start in clock minutes) who punches in pre-shift, or whose regular session crosses midnight.

Three interlocking root causes; some may dissolve once the timestamptz session migration lands, others probably won't. Reassess all three after that migration.

1. **Overnight shifts skip the OT-session split on checkout.** `resolveOvertimeSessionSplit` in `supabase/functions/punch/handler.ts` (around line 264) early-returns the original single overtime segment whenever `shiftEndM <= shiftStartM` (overnight shift) or `checkOutM <= checkInM` (session crosses midnight) — explicitly marked "out of scope" and asserted by the test at `handler.test.ts:450`. As a result, a user whose pre-shift OT session continues into and past their shift never gets that session split into pre-shift-OT + regular + post-shift-OT segments. The session stays a single all-overtime row in `attendance_sessions` indefinitely. (`resolveCheckoutOvertimeHandling` in the same file already does the `+1440` overnight normalization correctly — the split function never got the same treatment.) The timestamptz migration may eliminate the wall-clock-overnight ambiguity that this short-circuit was working around; if it does, this bail-out can be removed and the function rewritten on a normalized timestamp frame.

2. **Daily-summary trigger encodes "OT-only day" as `effective_status='absent'`.** `recalculate_attendance_daily_summary` in `supabase/migrations/023_state_system_alignment.sql` (lines 218-219): when `_has_non_ot_present=false` and `_has_overtime=true` the effective status is set to `'absent'`. This is intentionally a two-axis representation — `effective_status='absent'` plus `has_overtime=true` is the DB's way of saying "did overtime, never showed up for the regular shift" — but it relies on every consumer reading both axes and combining them correctly. While root cause #1 keeps the only session classified as overtime, this trigger keeps the day flagged absent for the entire workday, even after shift-start has passed. (Once #1 is fixed and the post-checkout split runs, the regular segment makes `_has_non_ot_present=true` and the trigger naturally flips to `'present'`, so this is mostly downstream of #1 — but the footgun shape remains.)

3. **History/profile calendar resolver reads only `effective_status`.** `resolveCalendarInput` in `src/lib/services/attendance.service.ts` (lines 193-213) maps `summary.effective_status === 'absent'` directly to `'absent'`, ignoring `has_overtime`, ignoring whether there's an open session right now, and ignoring whether shift end has passed. `mapHistoryPrimaryState` then turns that into `primaryState='absent'`, which `AttendanceHistoryList` renders as the absent `StatusBadge` — independently of the overtime `DayTag` derived from `day.hasOvertime`. The team-side equivalent (`resolve_team_attendance_live_state` in migration 023) is already presence-aware: it returns `'available_now'` when the user is currently checked-in regardless of stored `effective_status`. The history-side path was never given the same presence/time awareness, so the two surfaces diverge for the same user on the same day. (`buildSummaryFallback` at lines 464-469 of the same file duplicates the "all overtime → absent" rule client-side; same shape.)

## Later (Needs Review From Radhwan)

## Task 5
- [ ] Done
- Commit Head:
- Title: Universal settings
- Explanation: Add universal settings for 12/24 hour format, number style (Arabic or English), and month names. 
update: he said no need to add settings for it, use 12 hour format, use arabic month names like nisan, and use ensligh numbers


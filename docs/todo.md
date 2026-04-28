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

## Later (Needs Review From Radhwan)

## Task 5
- [ ] Done
- Commit Head:
- Title: Universal settings
- Explanation: Add universal settings for 12/24 hour format, number style (Arabic or English), and month names. 
update: he said no need to add settings for it, use 12 hour format, use arabic month names like nisan, and use ensligh numbers


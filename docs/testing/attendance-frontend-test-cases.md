# Attendance Frontend Test Cases

This document tracks attendance frontend/UI test coverage for the web app and client behavior.

- Scope: `npm run test`
- Primary files: `src/app/components/attendance/*.test.tsx`, `src/lib/services/*.test.ts`

- [ ] = Not implemented yet
- [x] = Implemented

## 20. UI Timer Regression - Worked Hours After Punch-In

> Corresponding test file: `src/app/components/attendance/TodayStatusCard.test.tsx`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 20.1 | [x] | User is checked in and `check_in_time` is returned as ISO datetime | `ساعات العمل` starts from correct elapsed value and increments every second (does not stay at `00:00`) | Regression test intentionally failing until parser/format handling is fixed |
| 20.2 | [x] | Production regression symptom: after punch-in UI shows `ساعات العمل: 00:00` and never moves | Timer should tick forward (`00:01`, `00:02`, ...) while user is checked in | Covered by `20.2 worked-hours line advances each second when check_in_time is ISO datetime` (UTC-aligned `05:00` → `05:01`); fails until ISO parsing is fixed |

## 21. Completed-Day CTA vs Mid-Shift Resume

> Corresponding test files: `src/app/components/attendance/TodayStatusCard.test.tsx`, `src/app/components/attendance/QuickPunchCard.test.tsx`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 21.1 | [x] | Working day, first session ended early (`13:15` -> `13:16`), now is `13:20` (before `workEndTime`) on `TodayStatusCard` | Main action must not imply overtime-only flow and must not open overtime confirmation dialog unless current time is actually overtime | Implemented as a regression guard; currently fails and exposes the bug |
| 21.2 | [x] | Same as 21.1 on `QuickPunchCard` | CTA copy should remain regular resume/punch-in behavior, not overtime-only wording | Implemented as a regression guard; currently fails and exposes the bug |
| 21.3 | [x] | True overtime context (post-shift, e.g. `18:01`) on completed day | Overtime confirmation dialog is allowed and overtime CTA copy is acceptable | Boundary test implemented |

## 22. Open Second Session Rendering

> Corresponding test files: `src/app/components/attendance/TodayStatusCard.test.tsx`, `src/app/components/attendance/QuickPunchCard.test.tsx`, `src/app/pages/employee/AttendancePage.test.tsx`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 22.1 | [x] | Day contains two sessions where first is closed and second is open | Card must render as checked-in state (checkout action visible), not completed-day state | Regression target for pseudo-log/open-session mismatch |
| 22.2 | [x] | `AttendancePage` refresh after successful check-in returns open current session | Page should keep checked-in UX and should not revert to completed-day overtime CTA | Covers the reported "returns to overtime button" symptom |

## 23. Cooldown and Loading Interaction

> Corresponding test file: `src/app/pages/employee/AttendancePage.test.tsx`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 23.1 | [x] | After successful check-in, cooldown starts at 60 seconds | Action text shows cooldown (`انتظر Nث`) and decrements each second | Mirrors `COOLDOWN_SECONDS = 60` behavior |
| 23.2 | [x] | During in-flight check-in request | Action text shows loading (`جاري التسجيل...`) before cooldown appears | Covered by `shows check-in loading text before cooldown after click (23.2)` in `AttendancePage.test.tsx` |
| 23.3 | [x] | Server response already indicates user is checked in | UX should not look like a failed punch or loop back to overtime prompt after cooldown | Ensures post-check-in state stability |

# Attendance Frontend Test Cases

This document tracks attendance frontend/UI test coverage for the web app and client behavior.

- Scope: `npm run test`
- Primary files: `src/app/components/attendance/*.test.tsx` (includes `TodayPunchLog.test.tsx`), `src/app/pages/employee/AttendancePage.test.tsx`, `src/lib/services/*.test.ts`

- [ ] = Not implemented yet
- [x] = Implemented

## 20. UI Timer Regression - Worked Hours After Punch-In

> Corresponding test file: `src/app/components/attendance/TodayStatusCard.test.tsx`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 20.1 | [x] | User is checked in and `check_in_time` is returned as ISO datetime | `ساعات العمل` starts from correct elapsed value and increments every second (does not stay at `00:00`) | Regression test intentionally failing until parser/format handling is fixed |
| 20.2 | [x] | Production regression symptom: after punch-in UI shows `ساعات العمل: 00:00` and never moves | Timer should tick forward (`00:01`, `00:02`, ...) while user is checked in | Covered by `20.2 worked-hours line advances each second when check_in_time is ISO datetime` (UTC-aligned `05:00` → `05:01`); fails until ISO parsing is fixed |

## 21. Completed-Day CTA vs Mid-Shift Resume

> Corresponding test file: `src/app/components/attendance/TodayStatusCard.test.tsx`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 21.1 | [x] | Working day, first session ended early (`13:15` -> `13:16`), now is `13:20` (before `workEndTime`) on `TodayStatusCard` | Main action must not imply overtime-only flow and must not open overtime confirmation dialog unless current time is actually overtime | Implemented as a regression guard; currently fails and exposes the bug |
| 21.2 | [x] | Same as 21.1 on `TodayStatusCard` (single canonical card) | CTA copy should remain regular resume/punch-in behavior, not overtime-only wording | Implemented as a regression guard; currently fails and exposes the bug |
| 21.3 | [x] | True overtime context (post-shift, e.g. `18:01`) on completed day | Overtime confirmation dialog is allowed and overtime CTA copy is acceptable | Boundary test implemented |

## 22. Open Second Session Rendering

> Corresponding test files: `src/app/components/attendance/TodayStatusCard.test.tsx`, `src/app/pages/employee/AttendancePage.test.tsx`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 22.1 | [x] | Day contains two sessions where first is closed and second is open | Card must render as checked-in state (checkout action visible), not completed-day state | Regression target for pseudo-log/open-session mismatch |
| 22.2 | [x] | `AttendancePage` refresh after successful check-in returns open current session | Page should keep checked-in UX and should not revert to completed-day overtime CTA | Covers the reported "returns to overtime button" symptom |

## 23. Check-in loading and post-check-in state

> Corresponding test file: `src/app/pages/employee/AttendancePage.test.tsx`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 23.1 | [x] | During in-flight check-in request | Action text shows loading (`جاري التسجيل...`) until the request completes | Covered by `shows check-in loading then checked-in state after check-in resolves` |
| 23.2 | [x] | After check-in resolves | Today state shows checked-in (`today-state` / refreshed today record) | No post-check-in timer lockout on the button |
| 23.3 | [x] | Server response already indicates user is checked in | UX should not look like a failed punch or loop back to overtime prompt | Ensures post-check-in state stability |

## 24. Third Session, Pseudo `log`, and Today’s Punch Log

> Added Mar 2026. Covers two short breaks / third check-in UX and full “سجل اليوم” ordering. Some cases **fail** until client `isCheckedIn` / pseudo-log handling matches an open latest session.

### 24.1 `TodayStatusCard` — aggregate `log` vs open third session

> Corresponding test file: `src/app/components/attendance/TodayStatusCard.test.tsx`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 24.1a | [x] | Punch in → out → in again: S1 closed, S2 open; pseudo `log` still has S1’s `check_out_time` (`08:30` / `12:00`) | Primary CTA must be **checkout** (`تسجيل الانصراف`) — user is in second session | **Currently failing** — same aggregate-`log` issue as third check-in |
| 24.1 | [x] | Three sessions: S1/S2 closed, S3 open; `log` still has `check_out_time` from S2 (pseudo-summary bug shape) | Primary CTA must be **checkout** (`تسجيل الانصراف`), not punch-in | **Currently failing** — documents desired fix |

### 24.2–24.3 `TodayPunchLog` — ordered rows for every in/out

> Corresponding test file: `src/app/components/attendance/TodayPunchLog.test.tsx`

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 24.2 | [x] | Three closed segments (six `PunchEntry` rows) | Three “← تسجيل حضور” and three “→ تسجيل انصراف”; times `08:30` … `18:00` in order | Guards missing middle check-outs in the list |
| 24.3 | [x] | Two closed segments + third open (`isCheckedIn === true`, five punches) | Two check-outs and three check-ins visible; last time `14:30` | Open segment without polluting prior rows |

### 24.4–24.5 `AttendancePage` — refresh and multi-step CTA

> Corresponding test file: `src/app/pages/employee/AttendancePage.test.tsx`  
> `TodayStatusCard` is mocked using the **same** `isCheckedIn` rule as production (`log.check_in_time && !log.check_out_time`).

| # | Implemented | Scenario | Expected behavior | Notes |
| --- | --- | --- | --- | --- |
| 24.4 | [x] | Initial load has open third session + full punches; `visibilitychange` refresh returns pseudo `log` with stale `check_out_time` | Stays **checked-in** with checkout button | **Currently failing** — matches “refresh then punch-in again” |
| 24.5 | [x] | Happy path: three check-ins and two check-outs with consistent API `log` / `getAttendanceToday` payloads | `today-state` alternates `checked-in` / `completed`; ends on checkout CTA | Passes; validates mock + handler wiring |

---

## Global UI Route Smoke Coverage

- Global route render smoke tests are covered in `src/app/routes.smoke.test.tsx`.
- Scope includes all routes from `src/app/routes.tsx` (auth, employee, manager, admin, and dynamic detail routes).
- Run directly with: `npm run test -- src/app/routes.smoke.test.tsx`.

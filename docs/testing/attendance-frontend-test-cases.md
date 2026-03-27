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
| 20.2 | [ ] | Production regression symptom: after punch-in UI shows `ساعات العمل: 00:00` and never moves | Timer should tick forward (`00:01`, `00:02`, ...) while user is checked in | Add dedicated UI assertion for exact displayed text behavior from production |


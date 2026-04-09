# Attendance Summary Cards By View

This document defines how attendance-related summary cards/chips work across app views.

Current scope is **Admin** only.  
Manager and Employee sections are reserved for the next iteration.

---

## Admin

### 1) Dashboard "Today Summary" cards

#### Where in the app
- Route: `/` (admin lands on `AdminDashboard`)
- Page: `src/app/pages/admin/AdminDashboard.tsx`
- Section title: `ملخص اليوم`
- Cards:
  - `حاضرون`
  - `متأخرون`
  - `غائبون`
  - `في إجازة`

#### Data sources
- `profilesService.listUsers()` -> used to determine active employee scope.
- `attendanceService.getTeamAttendanceDay({ date: today })` -> detailed day rows for all users.
- `departmentsService.listDepartments()` -> header metadata only, not card counts.

#### Scope rules before counting
Card counting is not over all users blindly. `overallStats` first defines eligible users:
- Exclude admins from the population.
- Apply join-date gate with `hasJoinedBy(today, profile.join_date)`.
- Build `activeUserIds` from this filtered set.
- Keep only attendance rows where:
  - `row.role !== 'admin'`
  - `row.userId` exists in `activeUserIds`

Then each row is normalized to a UI display state using:
- `mapTeamRowDayStatus(row.displayStatus)` -> canonical day status
- `mapTeamRowLivePresence(row)` -> `checked_in` / `checked_out` / `no_session`
- `resolveDisplayStatus(...)` with `isWithinShiftWindow: row.displayStatus == null`

#### State definitions and counting formula
Counts are produced by `countByChip(getChipsForRole(DASHBOARD_SUMMARY_CHIPS, 'admin'), summaryRows)`.

- `حاضرون` (`present`)
  - Chip key: `present`
  - Matches statuses: `present_now`, `late_now`, `finished`
  - Meaning: currently in office, currently late-but-present, or attended and already left.

- `متأخرون` (`late`)
  - Chip key: `late`
  - Matches statuses: `late_now`
  - Meaning: currently checked in and categorized as late today.

- `غائبون` (`absent`)
  - Chip key: `absent`
  - Matches statuses: `absent`, `not_registered`
  - Meaning:
    - `absent`: absent after shift window / explicit absent day status.
    - `not_registered`: no attendance session yet while still inside shift window.

- `في إجازة` (`on_leave`)
  - Chip key: `on_leave`
  - Matches statuses: `on_leave`

#### Click behavior
Clicking a card navigates to `/team-attendance` with:
- `mode=live`
- `date=today`
- `filter` mapped from card key:
  - `present -> present_now`
  - `late -> late`
  - `absent -> absent`
  - `on_leave -> on_leave`

---

### 2) User Details "All-Time Attendance Stats" cards

#### Where in the app
- Route: `/user-details/:userId`
- Page: `src/app/pages/admin/UserDetailsPage.tsx`
- Tab: `نظرة عامة`
- Section title: `إحصائيات كل الوقت`
- Cards:
  - `أيام الحضور`
  - `أيام التأخير`
  - `أيام الغياب`
  - `أيام الإجازة`

#### Data source
- `attendanceService.getAllTimeStats(userId)` -> returns `MonthlyStats`:
  - `presentDays`
  - `lateDays`
  - `absentDays`
  - `leaveDays`
  - `totalWorkingDays`

#### How counting works technically
`getAllTimeStats` performs a month-by-month aggregation:
- Determine start month from `getUserJoinDate(userId)` (fallback: current month if unavailable).
- For each month up to current month:
  - call `getAttendanceMonthly(userId, year, month)`.

`getAttendanceMonthly` computes per-day status by:
- Reading month rows from `attendance_daily_summary`.
- Loading user effective shift (`getEffectiveShiftForUser`) to know weekly off days.
- Resolving each day via `resolveCalendarStatus(...)`, which considers:
  - future vs past day
  - before-join-date days
  - summary `effective_status` when present
  - off-day and session behavior (including overtime-only/off-day overtime)
  - shift-window-independent display mapping for historical mode

Final card counters:
- `أيام الحضور` -> days with status `present`
- `أيام التأخير` -> days with status `late`
- `أيام الغياب` -> days with status `absent`
- `أيام الإجازة` -> days with status `on_leave`

`totalWorkingDays` includes all non-null statuses except `future` and `weekend`.

#### Click behavior
Each card switches the page to the Attendance tab and pre-applies filter:
- set `activeTab = 'attendance'`
- set `attendanceViewMode = 'all_time'`
- set `attendanceFilter` to one of: `present`, `late`, `absent`, `on_leave`

---

### 3) Team Attendance clickable summary chips

#### Where in the app
- Route: `/team-attendance`
- Page: `src/app/pages/team/TeamAttendancePage.tsx`
- Component: sticky `StatusCountChips` strip at top.

#### Admin data pipeline
For admin users, board rows come from:
- `attendanceService.getTeamAttendanceDay({ date, departmentId })`
- RPC backend source: `get_team_attendance_day`

Rows include attendance fields used by chip evaluation:
- `displayStatus` (day-level backend status for that date)
- `isCheckedInNow`
- `sessionCount`
- `firstCheckIn`
- `lastCheckOut`
- plus user/dept metadata

#### Live mode (`mode=live`) states
Visible chips for admin (`TEAM_ATTENDANCE_LIVE_CHIPS`):
- `all`
- `present_now` (label: `موجودون الآن`)
- `late`
- `absent`
- `on_leave`
- `finished`

How each row is evaluated:
- Day status: `mapDetailedDayStatus(row.displayStatus)`
  - `late -> late`
  - `absent -> absent`
  - `on_leave -> on_leave`
  - `overtime_offday -> weekend`
  - `present/overtime_only/null -> present`
- Live presence: `mapDetailedLivePresence(row)`
  - `isCheckedInNow -> checked_in`
  - else if `sessionCount > 0 || firstCheckIn || lastCheckOut -> checked_out`
  - else `no_session`
- Resolver: `resolveDisplayStatus(dayStatus, livePresence, { isWithinShiftWindow: row.displayStatus == null })`
  - `checked_in + late -> late_now`
  - `checked_in + non-late -> present_now`
  - `checked_out -> finished`
  - `no_session + absent -> absent`
  - `no_session + non-absent`:
    - within shift window -> `not_registered`
    - after shift window -> `absent`
  - leave/weekend/holiday remain as-is

Chip counts are generated by `countByChip(activeChips, boardRows)`.

#### Date mode (`mode=date`) states
Visible chips for admin (`TEAM_ATTENDANCE_DATE_CHIPS`):
- `all`
- `present` (label: `حضر`)
- `late`
- `absent`
- `on_leave`

How each row is evaluated:
- Resolver: `resolveDisplayStatus(dayStatus, null, { isWithinShiftWindow: false })`
- Output statuses in date mode:
  - `present`
  - `late`
  - `absent_day`
  - `on_leave_day`
  - `weekend` / `holiday`

Chip matching:
- `present` chip counts `present` and `late`.
- `late` chip counts only `late`.
- `absent` chip counts `absent_day`.
- `on_leave` chip counts `on_leave_day`.

#### How "available now" is decided
For admin on Team Attendance live mode, a user is considered available now when the resolved status is one of:
- `present_now`
- `late_now`

Operationally this is driven by `isCheckedInNow` from `get_team_attendance_day`:
- If `isCheckedInNow` is true, user resolves to `present_now` or `late_now`.
- If false, user resolves to `finished`, `absent`, `not_registered`, or `on_leave` depending on day status + session history + shift-window context.

---

## Manager (Reserved)

Planned content for next pass:
- Manager attendance summary cards/chips
- Visibility rules per state
- Counting/evaluation details and data sources
- Routes and component mapping

---

## Employee (Reserved)

Planned content for next pass:
- Employee attendance summary cards/chips
- Visibility rules per state
- Counting/evaluation details and data sources
- Routes and component mapping


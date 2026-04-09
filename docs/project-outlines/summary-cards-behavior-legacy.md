# Summary Cards Behavior By View

This document explains how summary cards (and summary chips where applicable) work by role view.

Scope now: **Admin**.
Placeholders for **Manager** and **Employee** are included for next steps.

---

## Admin View

### 1) Dashboard "Today Summary" cards

- **Where in the app**
  - Route: `/` (for admin users, routed by `DashboardRouter` to `AdminDashboard`)
  - File: `src/app/pages/admin/AdminDashboard.tsx`
  - UI block title: `ملخص اليوم`
  - Cards: `حاضرون`, `متأخرون`, `غائبون`, `في إجازة`

- **States shown**
  - Present (`present`)
  - Late (`late`)
  - Absent (`absent`)
  - On leave (`on_leave`)

- **How each state is evaluated**
  - Data source for the day: `attendanceService.getAllLogsForDate(today)` from `attendance_logs`.
  - Employee scope is filtered to non-admin users whose `join_date` is on/before today.
  - Present count = number of today logs where `status === 'present'`.
  - Late count = number of today logs where `status === 'late'`.
  - On leave count = number of today logs where `status === 'on_leave'`.
  - Absent count = `activeEmployees.length - checkedIn`, where `checkedIn` is count of logs with a non-null `check_in_time`.

- **Important behavior notes**
  - Absent is derived from missing check-in (not only from explicit `status === 'absent'` rows).
  - Realtime updates are wired via `subscribeToAttendanceLogs`, so card values update after inserts/updates for today.

- **Legacy usage**
  - **Partially legacy / transitional**.
  - This dashboard summary relies directly on `attendance_logs` (`getAllLogsForDate`) instead of the newer summary RPC/view pipeline (`attendance_daily_summary` / `get_team_attendance_day`).

---

### 2) User Details "All-Time Stats" cards

- **Where in the app**
  - Route: `/user-details/:userId`
  - File: `src/app/pages/admin/UserDetailsPage.tsx`
  - UI block title: `إحصائيات كل الوقت`
  - Cards: `أيام الحضور`, `أيام التأخير`, `أيام الغياب`, `أيام الإجازة`

- **States shown**
  - Present days
  - Late days
  - Absent days
  - Leave days

- **How each state is evaluated**
  - Card values come from `attendanceService.getAllTimeStats(userId)`.
  - `getAllTimeStats` iterates from user join month to current month and consumes monthly summaries from `getAttendanceMonthly`.
  - `getAttendanceMonthly` reads `attendance_daily_summary` and resolves day status via policy-aware logic (`resolveCalendarStatus`), including:
    - Future days excluded as `future`
    - Off-days as `weekend` unless attendance/overtime exists
    - Join-date boundary respected
  - Totals are counted by day status:
    - `presentDays`: status `present`
    - `lateDays`: status `late`
    - `absentDays`: status `absent`
    - `leaveDays`: status `on_leave`

- **Card interaction behavior**
  - Clicking any card switches to the attendance tab and applies the matching filter (`present`, `late`, `absent`, `on_leave`) in all-time mode.

- **Legacy usage**
  - **Not legacy** for all-time cards.
  - Uses the newer summary-based calculation path (`attendance_daily_summary`) rather than only raw `attendance_logs`.

- **Related card in same page (today status, not all-time)**
  - The `حالة اليوم` panel in this page uses `attendanceService.getTodayLog(userId)` from `attendance_logs`.
  - That piece is still tied to the legacy/raw log table path.

---

### 3) Team Attendance clickable summary chips

- **Where in the app**
  - Route: `/team-attendance`
  - File: `src/app/pages/team/TeamAttendancePage.tsx`
  - UI element: sticky top `StatusCountChips` (clickable filter chips with counts)

- **States shown (live mode: "الآن")**
  - `الكل` (all)
  - `موجودون الآن`
  - `متأخر`
  - `غائب`
  - `إجازة`
  - `أنهى الدوام`

- **States shown (date mode: "اليوم/التاريخ")**
  - `الكل` (all)
  - `حضر`
  - `تأخر`
  - `غائب`
  - `إجازة`

- **How each state is evaluated for admin**
  - Admin data source is detailed rows from `attendanceService.getTeamAttendanceDay({ date, departmentId })` (RPC `get_team_attendance_day`).
  - Live mode mapping:
    - If `isCheckedInNow && displayStatus === 'late'` => late
    - Else if `isCheckedInNow` => present now
    - Else if `displayStatus === 'on_leave'` => on leave
    - Else if `displayStatus === 'absent'` => absent
    - Else if user has punches/sessions (`firstCheckIn` or `lastCheckOut` or `sessionCount > 0`) => finished
    - Else => not yet punched (included in "not present now" grouping)
  - Date mode mapping:
    - Present-day if status is present/late/overtime-only/overtime-offday or session count > 0
    - Explicit late/absent/on_leave override that generic present-day value
  - Chip counters are computed by counting rows whose `filterKeys` contain each chip key.

- **"How it decides available now" (explicit)**
  - In admin detailed mode, availability is based on `isCheckedInNow` from `get_team_attendance_day`.
  - `available now` essentially means user currently has an open attendance session according to backend-derived row state.

- **Legacy usage**
  - **Not legacy** for admin.
  - Uses newer RPC-driven team attendance model (`get_team_attendance_day`) and session-aware fields.

---

## Manager View (placeholder)

To be documented:
- Manager dashboard summary cards
- Team attendance manager-specific visibility and redacted vs detailed logic
- Any manager-only summary components
- Legacy vs non-legacy path per component

---

## Employee View (placeholder)

To be documented:
- Employee dashboard summary cards
- Attendance page summary cards/chips
- Requests-related summary blocks
- Legacy vs non-legacy path per component


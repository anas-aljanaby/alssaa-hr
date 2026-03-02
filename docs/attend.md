# Employee Attendance Page — Implementation Plan

**Constraint:** Keep the current design of the **pulsing round clock** (the circular timer card with `animate-pulse` when clocked in). All other behavior and layout follow this plan.

---

## Overview

Rebuild the attendance page into **three vertical sections** (RTL, Arabic):

1. **Today's Status Card** — Top section with the existing pulsing round clock, date, shift, status badge, and main action button.
2. **Today's Punch Log** — Vertical timeline of today's punches (سجل اليوم).
3. **Monthly Calendar Heatmap** — Month grid with status dots; tap a day → bottom sheet with that day's details.

---

## Current Design to Preserve: Pulsing Round Clock

- **Component:** `TimeLoggingTimerCard` (or equivalent renamed).
- **Visual:** A single round circle (`w-28 h-28`, `rounded-full`):
  - **Not clocked in:** `bg-gray-50 border-4 border-gray-200`; icon + "لم يتم التسجيل".
  - **Clocked in:** `bg-blue-50 border-4 border-blue-200 animate-pulse`; clock icon + **live elapsed time** (e.g. `04h 32m` or `H:MM:SS`) + "في العمل".
  - **Shift complete:** `bg-emerald-50 border-4 border-emerald-200`; checkmark + "اكتمل اليوم".
- **Do not remove** the pulse animation or the round shape. New UX (progress bar, extra badges, labels) should be **around** or **below** the circle, not replacing it.

---

## Data Model Expectations (align with existing DB)

Current schema:

- **attendance_logs:** one row per user per day — `date`, `check_in_time`, `check_out_time` (first in / last out), `status`, lat/lng.
- **attendance_sessions:** multiple rows per log (each session = one in/out pair for breaks).
- **attendance_policy:** `work_start_time`, `work_end_time`, `grace_period_minutes`.

Spec concepts map as follows:

| Spec concept | Implementation |
|--------------|----------------|
| **Attendance record (per day)** | `attendance_logs` row + policy + work schedule. Derive `shiftStart`, `shiftEnd`, `gracePeriodMinutes`, `status`. |
| **Punches array** | Build from `attendance_sessions`: each session → two entries (clock_in at `check_in_time`, clock_out at `check_out_time`). Order by time. Flag `isOvertime` per segment using existing overtime logic. |
| **Punch entry** | `{ id, timestamp, type: 'clock_in' \| 'clock_out', isOvertime, location }` — map from session fields + overtime segments. |

No new tables required if we keep sessions as the source of truth; optional later: add `weekend` / `holiday` / `future` to status (e.g. in a view or computed on the client for calendar dots).

---

## API / Service Layer

Implement (or refactor) these as the main entry points. They can wrap existing Supabase calls.

| Endpoint / Function | Purpose |
|---------------------|--------|
| **GET today** | `getAttendanceToday(userId)` — today's log + all sessions (punches) + shift info + computed status. Return one “today record” object. |
| **POST punch** | Existing `checkIn` / `checkOut` — ensure server decides in/out from last punch state and sets overtime. Accept location in body. |
| **GET monthly** | `getAttendanceMonthly(userId, month, year)` — 28–31 day records: `date`, `status`, `totalHoursWorked`. No punch details. Can derive from existing `getMonthlyLogs` + sessions for total hours. |
| **GET day** | `getAttendanceDay(userId, date)` — single day full record + all punches (sessions → punch list). Used when opening the day bottom sheet. |

**Punch flow:** Keep using existing `checkIn` / `checkOut` from `attendance.service`; add 60-second cooldown and optional 1-minute guard on server.

---

## Section 1 — Today's Status Card

- **Layout:** Card at top. **Keep the existing pulsing round clock** (same circle and states).
- **First line:** Today's date in Arabic (e.g. "الاثنين، 2 مارس 2026").
- **Second line:** Shift time: "الدوام: 08:00 — 16:00".
- **Status logic and UI:**

  | State | Circle (keep as-is) | Extra below/around circle |
  |-------|---------------------|----------------------------|
  | Not clocked in, within allowed time | Gray circle, "لم يتم التسجيل" | Big button: "تسجيل الحضور". If current time &lt; shift start: note "لم يبدأ دوامك بعد". If punch would be overtime: warning "سيتم احتساب هذا كعمل إضافي". |
  | Clocked in, shift in progress | **Pulsing blue circle**, live timer "04h 32m", "في العمل" | Green **progress bar** (worked / shift duration). Button: "تسجيل الانصراف". |
  | Clocked out mid-day (on break) | Gray or neutral circle | Show total worked so far (not live). Button: "تسجيل الحضور" + subtitle "العودة من الاستراحة". |
  | Shift complete | Emerald circle, "اكتمل اليوم" | Total hours worked; optional overtime badge. Optionally allow clock-in again with overtime warning. |

- **Punch-in status badge:** Next to first clock-in time: Green "في الوقت" (if first punch ≤ shiftStart + grace), Orange "متأخر", or Blue "عمل إضافي" (outside shift).
- **Location note:** Below button: "📍 سيتم تسجيل موقعك تلقائياً" (keep existing).
- **Live timer:** Client-side only: elapsed from last `clock_in` timestamp, update every second (tabular-nums). No polling for the timer; sync on load and after punch.

---

## Section 2 — Today's Punch Log

- **Placement:** Directly below the status card.
- **Heading:** "سجل اليوم".
- **Content:** Vertical timeline built from today's sessions (each session → clock_in + clock_out entries).
  - Each row: time (HH:mm), arrow (→ تسجيل حضور / ← تسجيل انصراف), label.
  - If currently clocked in: last entry shown as "--:-- ← تسجيل انصراف (قيد الانتظار)".
  - If a punch is overtime: small "عمل إضافي" tag.
  - Empty state: "لا يوجد تسجيلات لهذا اليوم".
- **Data:** Use same “today” payload (sessions converted to ordered punches).

---

## Section 3 — Monthly Calendar Heatmap

- **Layout:** Month/year header with left/right arrows (reuse current `MonthCalendar` behavior).
- **Grid:** 7 columns, Arabic day abbreviations. Day number in cell; **current day:** blue ring/highlight (keep current design).
- **Dot under day number:**
  - Green — present (on time)
  - Orange — late
  - Red — absent
  - No dot — weekend, holiday, or future
  - Gray (optional) — holiday
- **Restrictions:** No navigating to months after current month. Past months navigable (e.g. up to 12 months or employment start).
- **Tap:** On a past/current day with attendance data → open bottom sheet. Fetch `getAttendanceDay(userId, date)` when sheet opens; show loading skeleton; then show date, shift, status badge, total hours, full punch log (same format as Section 2). Dismiss by swipe down or tap outside.

---

## Action Button Behavior (Punch Flow)

1. Request geolocation; get coordinates.
2. Show loading state on button.
3. Call `checkIn` or `checkOut` with location.
4. On success: refresh today data, update card and punch log, success toast ("تم تسجيل الحضور بنجاح" / "تم تسجيل الانصراف بنجاح").
5. On failure: error toast, re-enable button.
6. If geolocation denied: allow punch with `null` location, show warning.
7. **Cooldown:** Disable button for 60 seconds after a successful punch; server should reject punches within 1 minute of last punch.

---

## Confirmation Dialogs

Show only in these cases:

- **Overtime punch:** "أنت خارج ساعات الدوام. سيتم تسجيل هذا كعمل إضافي. هل تريد المتابعة؟"
- **Clock out &gt; 1 hour before shift end:** "أنت تغادر قبل نهاية الدوام بأكثر من ساعة. هل تريد المتابعة؟"

Normal in-shift punch: no dialog (fast, frictionless).

---

## Styling and UX

- Page is RTL (Arabic).
- Primary blue for actions and current day.
- Status: green (on-time/present), orange (late), red (absent), blue (overtime).
- Action button: large and prominent.
- Live timer: tabular-nums so digits don’t jump.
- Optional: `navigator.vibrate` on punch.
- On **visibilitychange** (tab/app focus): refresh today’s data (and optionally monthly) so state is correct if user left the page open.

---

## Page Load Sequence

1. Fetch today + monthly in parallel.
2. Render status card (with pulsing clock) and punch log from today.
3. Render calendar from monthly.
4. If clocked in, start 1s interval for live timer.
5. On unmount: clear timer.

---

## Edge Cases

- **No shift today:** "لا يوجد دوام مجدول لهذا اليوم", no action button.
- **On leave:** "أنت في إجازة اليوم" + leave type badge; hide action button.
- **Multiple shifts per day:** Out of scope; assume one shift per day.
- **Midnight crossing:** Server groups by shift start date; UI can show shift times that cross midnight (e.g. 22:00–06:00).

---

## Implementation Checklist (high level)

- [ ] **Services:** Add or refactor `getAttendanceToday`, `getAttendanceMonthly` (with total hours), `getAttendanceDay`. Keep `checkIn`/`checkOut`; add cooldown and optional server-side 1-min guard.
- [ ] **Types:** Define a “TodayRecord” and “DayRecord” (and punch type) that match the spec; map from DB in services.
- [ ] **Status card:** Keep pulsing round clock; add date line, shift line, status badge, progress bar when clocked in, and conditional notes (shift not started, overtime warning). Add confirmation dialogs for overtime and early clock-out.
- [ ] **Today's Punch Log:** New component; consume today’s punches; show pending clock-out row when clocked in; overtime tags; empty state.
- [ ] **Page layout:** Order = Status Card → Punch Log → Calendar; ensure RTL.
- [ ] **Calendar:** Restrict future months; optional gray dot for holiday; keep blue ring for today.
- [ ] **Day details sheet:** Open on day tap; fetch `getAttendanceDay` on open; loading skeleton; header (date), shift, status, total hours, full punch log; swipe/tap to dismiss.
- [ ] **Punch flow:** Geolocation, loading, toasts, 60s disable, visibility refresh.
- [ ] **Copy:** Add any missing Arabic strings (e.g. "في الوقت", "العودة من الاستراحة", confirmation texts).

This plan keeps the **pulsing round clock** as the central visual of the status card and layers the rest of the spec around it.

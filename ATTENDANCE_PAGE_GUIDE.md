# Attendance Page Implementation Guide

## Quick Start

The attendance page has been completely redesigned with three vertical sections following the specification in `docs/attend.md`.

## Architecture Overview

### Components

```
AttendancePage (main page)
├── TodayStatusCard (pulsing clock + action buttons)
├── TodayPunchLog (timeline of today's punches)
├── MonthlyCalendar (month grid with status dots)
└── DayDetailsSheet (bottom sheet for day details)
```

### Service Functions

All service functions are in `src/lib/services/attendance.service.ts`:

```typescript
// Get today's complete record
const today = await attendanceService.getAttendanceToday(userId);
// Returns: TodayRecord {
//   log: AttendanceLog | null
//   policy: AttendancePolicy
//   punches: PunchEntry[]
//   totalHoursWorked?: number
//   shiftStart: string (HH:mm)
//   shiftEnd: string (HH:mm)
//   gracePeriodMinutes: number
//   isCheckedIn: boolean
//   isCompleted: boolean
// }

// Get a specific day's record
const day = await attendanceService.getAttendanceDay(userId, '2026-03-02');
// Returns: DayRecord {
//   log: AttendanceLog
//   policy: AttendancePolicy
//   punches: PunchEntry[]
//   totalHoursWorked: number
//   shiftStart: string
//   shiftEnd: string
// }

// Get monthly summary for calendar
const monthly = await attendanceService.getAttendanceMonthlyWithSummary(userId, 2026, 2);
// Returns: MonthlySummary[] {
//   date: string (YYYY-MM-DD)
//   status: AttendanceStatus
//   totalHoursWorked?: number
// }
```

## Key Features

### 1. Pulsing Round Clock (Preserved)
- **Location:** `TodayStatusCard` component
- **Styling:** `w-28 h-28 rounded-full` with `animate-pulse` when checked in
- **States:**
  - Gray (`bg-gray-50`) when not clocked in
  - Blue with pulse (`bg-blue-50 animate-pulse`) when clocked in
  - Emerald (`bg-emerald-50`) when shift complete

### 2. Live Timer
- Updates every second client-side
- Calculates elapsed time from check_in_time
- Uses `font-tabular-nums` to prevent digit jumping
- Format: HH:MM:SS

### 3. Punch Cooldown
- 60 seconds after any successful punch
- Countdown timer displayed to user
- Button disabled until cooldown expires
- Server-side guard recommended (1 minute)

### 4. Confirmation Dialogs
Two confirmation scenarios:

**Overtime Punch:**
```typescript
// Triggered when: nowMinutes > shiftEndMinutes
// Text: "أنت خارج ساعات الدوام. سيتم تسجيل هذا كعمل إضافي. هل تريد المتابعة؟"
```

**Early Checkout:**
```typescript
// Triggered when: checking out > 1 hour before shift end
// Text: "أنت تغادر قبل نهاية الدوام بأكثر من ساعة. هل تريد المتابعة؟"
```

### 5. Calendar Navigation
- Can view current month and past months
- Cannot navigate to future months
- Days with attendance data are clickable
- Tap day → opens bottom sheet with details

### 6. RTL Support
All components properly marked with `dir="rtl"`:
- Text direction flows right-to-left
- Navigation arrows reversed
- Flexbox/Grid layouts optimized

## Data Flow

### Check In Flow:
1. User taps "تسجيل الحضور" button
2. System checks if punch would be overtime
3. If overtime: show confirmation dialog
4. Request geolocation (with graceful fallback)
5. Call `checkIn(userId, coords)`
6. Update `TodayRecord` via `getAttendanceToday()`
7. Start 60-second cooldown
8. Show success/error toast

### Check Out Flow:
Similar to check in, but:
- Check if checkout > 1 hour early
- Show early checkout confirmation if needed
- Optional vibration feedback on success

### Calendar Day Tap:
1. User taps day with attendance data
2. Open bottom sheet (overlay)
3. Fetch `getAttendanceDay(userId, date)`
4. Display day details with full punch log
5. User swipes down or taps outside to close

## Styling Classes

### Status Colors:
- Present (on-time): `emerald-500`
- Late: `amber-500`
- Absent: `red-500`
- Leave: `blue-500`

### Component Styling:
- Rounded cards: `rounded-2xl`
- Subtle borders: `border border-gray-100`
- Shadows: `shadow-sm`
- Spacing: `space-y-4` or `gap-3`

## Common Modifications

### Change Shift Times:
Modify `attendance_policy` in database:
```sql
UPDATE attendance_policy 
SET work_start_time = '09:00', work_end_time = '17:00'
WHERE org_id = '...'
```

### Change Cooldown Duration:
In `AttendancePage.tsx`:
```typescript
setActionDisabledUntil(Date.now() + 60000); // Change 60000 to desired ms
```

### Change Overtime Threshold:
In `TodayStatusCard.tsx`:
```typescript
const wouldBeOvertime = nowMinutes > shiftEndMinutes; // Add/subtract offset
```

### Change Early Checkout Threshold:
In `AttendancePage.tsx`:
```typescript
const earlyCheckout = nowMinutes < shiftEndMinutes - 60; // Change 60 to desired minutes
```

## Testing Checklist

- [ ] Today's Status Card displays correct state
- [ ] Live timer updates every second
- [ ] Progress bar shows correct percentage
- [ ] Check in button triggers geolocation
- [ ] Overtime confirmation appears when needed
- [ ] Cooldown countdown works
- [ ] Calendar navigates correctly
- [ ] Can only navigate to past/current months
- [ ] Tap calendar day opens bottom sheet
- [ ] Day sheet loads with correct data
- [ ] Swipe down closes bottom sheet
- [ ] All text is Arabic and RTL
- [ ] Punch log shows all entries
- [ ] Empty state message appears when no punches
- [ ] Error states handled gracefully

## Browser Console Testing

```javascript
// Test service functions
import * as attendanceService from '@/lib/services/attendance.service';

// Get today's record
const today = await attendanceService.getAttendanceToday('user-id');
console.log(today);

// Get specific day
const day = await attendanceService.getAttendanceDay('user-id', '2026-03-02');
console.log(day);

// Get monthly summary
const monthly = await attendanceService.getAttendanceMonthlyWithSummary('user-id', 2026, 2);
console.log(monthly);
```

## Troubleshooting

### Timer not updating:
- Check browser DevTools for JavaScript errors
- Verify `useEffect` is running for the timer
- Check that `record.isCheckedIn` is true

### Location not captured:
- Check browser permissions for geolocation
- Verify `navigator.geolocation` is available
- Check browser console for permission errors
- Should still allow punch with `null` location

### Calendar not navigating:
- Verify month calculations are correct
- Check that current date is being calculated properly
- Ensure `onMonthChange` is being called

### Punch not recorded:
- Check `actionDisabledUntil` is not blocking
- Verify server response in DevTools Network tab
- Check database triggers/constraints
- Verify user organization association

## Performance Notes

- Service functions load today + monthly in parallel
- Data refreshes automatically on tab focus
- Bottom sheet lazy-loads day data on open
- No polling after initial load (manual refresh on focus)
- Live timer only updates UI, no API calls

## Accessibility Considerations

Recommended enhancements:
- Add ARIA labels to buttons
- Add keyboard navigation (Tab, Enter, Escape)
- Add focus visible states
- Add screen reader announcements for status changes
- High contrast mode support

## References

- Full specification: `docs/attend.md`
- Implementation summary: `IMPLEMENTATION_SUMMARY.md`
- Service types: `src/lib/services/attendance.service.ts`
- Database schema: `supabase/migrations/001_initial_schema.sql`

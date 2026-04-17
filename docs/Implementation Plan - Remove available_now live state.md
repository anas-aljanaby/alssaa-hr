# Implementation Plan: Remove `available_now` Live State

This document tracks every code change required to bring the codebase in line with the state system design. Delete this file once all changes are shipped and verified.

**Why:** The old `available_now` live state encoded two independent facts (on-time punctuality + open session) under one name. This caused dashboard counts and board section logic to break whenever a late-but-checked-in employee appeared. The new model separates these: `is_checked_in_now` is the canonical field for presence; chips are for exception states only. The baseline case (on time, regular session, currently working) carries no chip.

See `docs/System Day and Session states plan.md` for the full design.

---

## Summary of Changes

| Layer | Change |
|---|---|
| SQL | Remove `available_now` return value from live state resolver; update sorting |
| `teamState.ts` | Remove `available_now` from enums, definitions, and fix `late` description |
| `chipConfig.ts` | Add `isCheckedInNow` to chip row type; remove `available_now` chip; update dashboard count |
| `statusConfig.ts` | Remove or repurpose `available_now` display config |
| `TeamAttendancePage.tsx` | Verify section split logic (partially already correct) |
| `AdminDashboard.tsx` | Update available-now count to use `isCheckedInNow` |
| Tests | Update all test fixtures and expectations that reference `available_now` |

---

## 1. SQL — New Migration

Create a new migration file (do not edit `023_state_system_alignment.sql`).

### 1a. `resolve_team_attendance_live_state`

The function currently returns `'available_now'` for the on-time checked-in case:

```sql
-- BEFORE
when coalesce(p_is_checked_in_now, false) then
  case
    when p_team_date_state = 'late' then 'late'
    else 'available_now'
  end
```

Change the `else` branch to return `null`. The baseline case has no live state chip.

```sql
-- AFTER
when coalesce(p_is_checked_in_now, false) then
  case
    when p_team_date_state = 'late' then 'late'
    else null
  end
```

> **Note:** The return type of the function will need to change from `text` (not-null implied) to `text` (nullable). Check the `returns text` declaration and any calling SQL that assumes a non-null result.

### 1b. Sorting logic in `get_team_attendance_day`

There is a `CASE` expression that uses `'available_now'` for sort ordering:

```sql
-- BEFORE (find and update this block)
when 'late' then 0
when 'available_now' then 1
```

The baseline (null live state) should sort in the same position as the old `available_now`. Update to handle null:

```sql
-- AFTER
when 'late' then 0
when null then 1   -- or: else 1
```

### 1c. `get_redacted_department_availability` — consider renaming `availability_state` values

This function already correctly uses `is_checked_in_now` to compute a binary field:

```sql
case when s.is_checked_in_now then 'available_now' else 'unavailable_now' end as availability_state
```

The values `'available_now'` / `'unavailable_now'` here are this function's own output format — they are NOT the live state and are already semantically correct (they mean "has open session" / "no open session"). However, sharing the string value `'available_now'` with the old live state creates confusion.

**Decision needed:** rename to `'present'` / `'absent'` (or `'checked_in'` / `'checked_out'`) to make clear this is a presence field, not a live state chip. If you rename here, you must also update the TypeScript interface and the page logic that reads `availabilityState` (see section 4).

---

## 2. `src/shared/attendance/teamState.ts`

### 2a. Remove `'available_now'` from state arrays

```typescript
// BEFORE
export const TEAM_ATTENDANCE_LIVE_STATES = [
  'available_now',
  'late',
  ...
] as const;

export const TEAM_ATTENDANCE_PRIMARY_STATES = [
  'available_now',
  ...
] as const;
```

```typescript
// AFTER — remove 'available_now' from both arrays
export const TEAM_ATTENDANCE_LIVE_STATES = [
  'late',
  'on_break',
  'not_entered_yet',
  'absent',
  'on_leave',
  'incomplete_shift',
  'fulfilled_shift',
  'neutral',
] as const;

export const TEAM_ATTENDANCE_PRIMARY_STATES = [
  'fulfilled_shift',
  'incomplete_shift',
  'late',
  'on_break',
  'not_entered_yet',
  'absent',
  'on_leave',
  'neutral',
] as const;
```

The derived types `TeamAttendanceLiveState` and `TeamAttendancePrimaryState` will update automatically. Any code that does `primaryState === 'available_now'` will become a TypeScript error — use those errors as your checklist.

### 2b. Remove `available_now` from `TEAM_ATTENDANCE_STATE_DEFINITIONS`

Delete the entire `available_now` entry:

```typescript
// DELETE this block
available_now: {
  label: 'موجود الآن',
  labelEn: 'Available now',
  chipVisible: true,
  liveMeaning: 'Currently checked in, not late, and available to take work now.',
},
```

### 2c. Fix `late` liveMeaning

```typescript
// BEFORE
late: {
  liveMeaning: 'Currently checked in and late.',
  ...
}

// AFTER
late: {
  liveMeaning: 'Arrived late today. Applies whether the employee is currently checked in or not — lateness persists through breaks and sign-outs.',
  ...
}
```

---

## 3. `src/shared/attendance/chipConfig.ts`

### 3a. Add `isCheckedInNow` to `TeamAttendanceChipRow`

```typescript
// BEFORE
export interface TeamAttendanceChipRow {
  primaryState: TeamAttendancePrimaryState;
  hasOvertime: boolean;
}

// AFTER
export interface TeamAttendanceChipRow {
  primaryState: TeamAttendancePrimaryState | null;  // null = baseline, no chip
  hasOvertime: boolean;
  isCheckedInNow: boolean;
}
```

> All places that construct a `TeamAttendanceChipRow` (or pass a row to chip functions) must be updated to include `isCheckedInNow`. TypeScript will surface these.

### 3b. Remove the `available_now` chip from `TEAM_ATTENDANCE_LIVE_CHIPS`

```typescript
// DELETE this entry
{
  key: 'available_now',
  label: 'موجودون الآن',
  themeStatus: 'available_now',
  visibleToRoles: ALL_ROLES,
  matchesRow: (row) => row.primaryState === 'available_now',
},
```

### 3c. Add `checked_in` chip to `TEAM_ATTENDANCE_LIVE_CHIPS`

Add a new chip that matches by `isCheckedInNow`. This replaces `available_now` as both a filter chip on the team attendance page and as the basis for any availability count.

```typescript
// ADD to TEAM_ATTENDANCE_LIVE_CHIPS (first non-all entry)
{
  key: 'checked_in',
  label: 'موجودون الآن',
  themeStatus: 'checked_in',          // see statusConfig note below
  visibleToRoles: ALL_ROLES,
  matchesRow: (row) => row.isCheckedInNow,
},
```

### 3d. Update `DASHBOARD_LIVE_CHIP_KEYS`

```typescript
const DASHBOARD_LIVE_CHIP_KEYS = [
  'checked_in',        // replaces 'available_now'
  'late',
  'not_entered_yet',
  'absent',
] as const;
```

### 3e. Update `isTeamAttendanceChipKey`

```typescript
// BEFORE — contains 'available_now'
export function isTeamAttendanceChipKey(value: string): value is TeamAttendanceChipKey {
  return ['all', 'available_now', ...].includes(value);
}

// AFTER — replace 'available_now' with 'checked_in'
export function isTeamAttendanceChipKey(value: string): value is TeamAttendanceChipKey {
  return ['all', 'checked_in', ...].includes(value);
}
```

Also update the `TeamAttendanceChipKey` union type accordingly.

---

## 4. `src/shared/attendance/statusConfig.ts`

The `available_now` entry exists for display styling. Two options:

**Option A (recommended):** Rename the key to `checked_in` to match the new chip key. Keep the same emerald green colors — they still visually communicate "currently present."

```typescript
// RENAME key from available_now → checked_in
checked_in: makeStatusDisplayConfig({
  label: 'موجودون الآن',
  labelEn: 'Checked in',
  color: 'text-emerald-700',
  bgColor: 'bg-emerald-50',
  borderColor: 'border-emerald-500',
  dotColor: 'bg-emerald-500',
  hexColor: '#10B981',
  tone: 'emerald',
}),
```

**Option B:** Delete the entry entirely if nothing else references it after the other changes. Check for references first.

Also update `DisplayStatus` / `TeamAttendancePrimaryState` union types in `statusConfig.ts` if `available_now` appears there as a key type.

---

## 5. `src/lib/services/attendance.service.ts`

### 5a. `SafeAvailabilityRow.availabilityState`

If you renamed the SQL `availability_state` values in step 1c, update the TypeScript interface to match:

```typescript
// BEFORE
availabilityState: 'available_now' | 'unavailable_now';

// AFTER (if renamed in SQL)
availabilityState: 'checked_in' | 'checked_out';   // or whatever names were chosen
```

### 5b. `TeamAttendanceDayRow`

`teamLiveState` is typed as `TeamAttendanceLiveState`. After removing `'available_now'` from the enum (step 2a), rows that previously came back with `teamLiveState = 'available_now'` from the DB will now return `null`. Update the interface:

```typescript
// BEFORE
teamLiveState: TeamAttendanceLiveState;

// AFTER
teamLiveState: TeamAttendanceLiveState | null;
```

Update the mapping from the DB row to handle the null case.

---

## 6. `src/app/pages/team/TeamAttendancePage.tsx`

### 6a. Detailed row section split — already correct

The detailed (full-access) row builder already uses `isCheckedInNow`:

```typescript
const group: BoardGroup = row.isCheckedInNow ? 'present' : 'not_present';
```

No change needed here.

### 6b. Generic row section split — verify after step 1c

The generic (redacted) row builder uses `availabilityState`:

```typescript
group: row.availabilityState === 'available_now' ? 'present' : 'not_present',
```

If you renamed `availabilityState` values in step 1c, update this string comparison to match. If you kept the values as-is, no change needed.

### 6c. Any chip filter that checks `primaryState === 'available_now'`

Search the file for `'available_now'`. If any filter or display logic checks for it directly, update to use `isCheckedInNow` or remove.

---

## 7. `src/app/pages/admin/AdminDashboard.tsx`

Out of scope for this implementation — dashboard display decisions will be made separately.

---

## 8. Tests

### `src/shared/attendance/chipConfig.test.ts`

The temp commit added a test asserting `available_now` count is not inflated by late employees. Update it to test the new model:

- The `checked_in` chip should count employees where `isCheckedInNow = true`, regardless of `primaryState`
- A late employee with `isCheckedInNow = true` should be counted by the `checked_in` chip
- A late employee with `isCheckedInNow = false` should NOT be counted by the `checked_in` chip

Example fixture:

```typescript
const rows = [
  { primaryState: null,         hasOvertime: false, isCheckedInNow: true  },  // baseline, present
  { primaryState: 'late',       hasOvertime: false, isCheckedInNow: true  },  // late, present
  { primaryState: 'late',       hasOvertime: false, isCheckedInNow: false },  // late, on break
  { primaryState: 'on_break',   hasOvertime: false, isCheckedInNow: false },  // on break
];

expect(counts.checked_in).toBe(2);   // first two rows
expect(counts.late).toBe(2);         // both late rows regardless of presence
```

### `src/app/pages/admin/AdminDashboard.test.tsx`

The temp commit changed the test expectation to `available_now = 1, late = 1`. This is wrong under the new model — emp-2 (Mona, `isCheckedInNow: true, teamLiveState: 'late'`) should also count as present.

Update the test fixture to include `isCheckedInNow` on each row, and update the expectation:

```typescript
// emp-1: isCheckedInNow: true  → counts toward checked_in
// emp-2: isCheckedInNow: true  → counts toward checked_in AND late
// emp-3: isCheckedInNow: false → neither
// emp-4: isCheckedInNow: false → neither

expect(screen.getByRole('button', { name: /موجودون الآن/i })).toHaveTextContent('2');
expect(screen.getByRole('button', { name: /متأخر/i })).toHaveTextContent('1');
```

---

## Open Questions (decide before implementing)

1. **What does the SQL `resolve_team_attendance_live_state` return for the baseline case?** Recommended: `null`. This makes the absence of a chip explicit. Check that the function's declared return type allows null and that all callers handle it.

2. **Rename `availability_state` values?** The `get_redacted_department_availability` SQL function uses `'available_now'` / `'unavailable_now'` as binary string values. These are semantically correct but share the string `'available_now'` with the old live state. Recommend renaming to avoid confusion, but it requires coordinated SQL + TypeScript + component changes.

---

## Checklist

- [ ] New SQL migration: update `resolve_team_attendance_live_state` baseline branch
- [ ] New SQL migration: update `get_team_attendance_day` sort ordering
- [ ] (Optional) New SQL migration: rename `availability_state` values
- [ ] `teamState.ts`: remove `available_now` from enums and definitions
- [ ] `teamState.ts`: fix `late` liveMeaning
- [ ] `chipConfig.ts`: add `isCheckedInNow` to `TeamAttendanceChipRow`
- [ ] `chipConfig.ts`: remove `available_now` chip
- [ ] `chipConfig.ts`: add `checked_in` chip with `isCheckedInNow` matcher
- [ ] `chipConfig.ts`: update `DASHBOARD_LIVE_CHIP_KEYS`
- [ ] `chipConfig.ts`: update `isTeamAttendanceChipKey` and `TeamAttendanceChipKey` type
- [ ] `statusConfig.ts`: rename `available_now` → `checked_in` (or delete)
- [ ] `attendance.service.ts`: update `TeamAttendanceDayRow.teamLiveState` to nullable
- [ ] `attendance.service.ts`: update `SafeAvailabilityRow.availabilityState` if SQL values renamed
- [ ] `TeamAttendancePage.tsx`: verify section split logic; update if `availabilityState` values renamed
- [ ] `AdminDashboard.tsx`: out of scope — dashboard display decided separately
- [ ] `chipConfig.test.ts`: rewrite to cover new `checked_in` chip behavior
- [ ] `AdminDashboard.test.tsx`: fix expected counts (2 checked-in, not 1)
- [ ] TypeScript: resolve all new type errors introduced by enum changes (use as a checklist)
- [ ] Smoke test: verify dashboard count matches team attendance page employee count in the "available now" section

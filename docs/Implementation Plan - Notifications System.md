# Notifications System — Implementation Plan

## Task tracker

Mark `[x]` when complete. Each item maps to a section below.

### Phase 1 — Data layer
- [x] Migration: create `notification_preferences` table + RLS policies
- [x] Migration: add `link_url` column to `notifications`

### Phase 2 — `notify` edge function
- [x] Extract `sendWebPushToUser` helper to `supabase/functions/_shared/web-push.ts` (if not already shared)
- [x] Create `supabase/functions/notify/handler.ts` skeleton + event contract
- [x] Implement recipient resolution (role + department lookup)
- [x] Implement preference filtering + actor exclusion
- [x] Implement JWT validation (verify caller is authorized to emit each event type)
- [x] Implement notification row insert + web push send
- [x] Build i18n string table (EN + AR) for all 5 event types

### Phase 3 — Wire emission into service code
- [x] Add `src/lib/notifications/emit.ts` thin wrappers
- [x] Wire `emitLeaveRequestSubmitted` into `requests.service.ts:submitRequest`
- [x] Wire `emitLeaveRequestDecided` into `requests.service.ts:updateRequestStatus` (with row-affected guard)
- [x] Locate OT submission insert path and wire `emitOvertimeRequestSubmitted`
- [x] Wire `emitOvertimeRequestDecided` into `overtime-requests.service.ts:updateOvertimeRequestStatus` (with row-affected guard)
- [x] Locate schedule save path and wire `emitScheduleChanged`

### Phase 4 — Settings UI
- [x] Loosen route guard on settings page from `admin` to `admin || manager`
- [x] Add `src/lib/services/notification-preferences.service.ts` (`getMyPreferences`, `updateMyPreferences`)
- [x] Refactor `NotificationSettingsPage.tsx` into 3 sections (Attendance templates / Team activity / My activity)
- [x] Hide "Attendance templates" section for managers
- [x] Implement "Team activity" toggles wired to `notification_preferences`
- [x] Implement "My activity" read-only display

### Phase 5 — Polish & verification
- [x] Push permission inline nudge in "Team activity" section
- [x] In-app dropdown click navigates to `link_url`
- [x] Confirm SW push click handler routes via `url` payload field
- [ ] Run full manual test matrix (see Phase 5 below)

---

## Context (what already exists)

The hard infrastructure is already in place — this is mostly wiring up new event triggers and a UI section, not building from scratch.

- **Push delivery pipeline:** VAPID keys, service worker push handler, `push_subscriptions` table, `send-test-notification` edge function with `sendWebPushToUser()` helper. Working.
- **In-app notifications:** `notifications` table (with `type` enum already including `request_update` and `approval`), bell icon + dropdown in `src/app/components/layout/MobileLayout.tsx:39`, realtime sync via `src/lib/services/notifications.service.ts`.
- **Settings page:** `src/app/pages/admin/NotificationSettingsPage.tsx` with 4 attendance toggles (shift reminders, auto-punch-out alert) — admin-only.
- **Leave/OT flows:** Atomic pending-check approval already in `src/lib/services/requests.service.ts:129` and `src/lib/services/overtime-requests.service.ts:87`. Both have `status`, `approver_id`/`reviewed_by`, `decision_note`/`note`.
- **Roles & hierarchy:** `departments.manager_uid` + `profiles.department_id` defines reports-to. Helper SQL fns `current_user_role()`, `current_user_department()`.

---

## Locked decisions

1. **Approver-side notifications** (toggleable): leave request submitted, OT request submitted.
2. **Requester-side notifications** (always on): your leave/OT request approved or rejected, your schedule was changed.
3. **Excluded from v1:** late, absent, auto punch-out anomalies, cancellation/withdrawal pings (admin will reject + ask refile).
4. **Self-action exclusion:** the actor who approves/rejects/edits-schedule does not get a notification about their own action.
5. **Mute scope:** only approver-side toggles are user-controlled. Personal "my activity" notifications cannot be muted, so a manager can't accidentally mute their own approval pings.
6. **Rejection reason** (`decision_note`) surfaces in the notification body when present.
7. **Cancellation state machine:** only allowed while `status='pending'`. Approved/rejected requests cannot be cancelled — that would be a separate flow we're not building.
8. **Manager-as-requester routing:** when a manager submits leave/OT, **all admins in the org** receive the team-activity notification (filtered by their toggle). The general manager isn't special-cased.
9. **Settings page access:** loosen route guard to `admin || manager`. The existing 4-category "Attendance templates" section renders only when `role === 'admin'`. The new "Team activity" + "My activity" sections render for both.
10. **Preference storage:** new table `notification_preferences`, one row per user, two booleans defaulting to `true`. Lazy-create on first read.
11. **Emission strategy:** app code in the existing service files calls a new edge function `notify`, which resolves recipients, filters by prefs, inserts `notifications` rows, and sends web push. Failures don't block the originating action.

---

## Architecture

```
┌─ submitRequest() / updateRequestStatus() / saveSchedule() ─┐
│                                                            │
│   after successful DB write:                               │
│   supabase.functions.invoke('notify', {                    │
│     event: 'leave_request_submitted',                      │
│     payload: { request_id, requester_id, org_id, ... }     │
│   })  ── fire-and-forget, errors logged not thrown ──      │
└────────────────────────────────────────────────────────────┘
              │
              ▼
┌─ supabase/functions/notify/handler.ts (NEW) ──────────────┐
│  1. Resolve recipients (role + dept lookup)                │
│  2. Filter by notification_preferences                     │
│  3. Exclude actor                                          │
│  4. Insert notifications rows (one per recipient)          │
│  5. For each recipient: sendWebPushToUser()                │
└────────────────────────────────────────────────────────────┘
```

The existing `sendWebPushToUser()` helper lives inside the edge function package — reuse it directly, don't duplicate. The shared helper should be extracted to `supabase/functions/_shared/web-push.ts` if it isn't already, and imported by both `send-test-notification` and the new `notify` function.

---

## Phase 1 — Data layer

### Migration: `notification_preferences`

```sql
create table notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  leave_requests_team boolean not null default true,
  overtime_requests_team boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create policy "users read own prefs" on notification_preferences
  for select using (user_id = auth.uid());
create policy "users update own prefs" on notification_preferences
  for update using (user_id = auth.uid());
create policy "users insert own prefs" on notification_preferences
  for insert with check (user_id = auth.uid());
```

No backfill — the read path lazy-creates the row if missing (default-true semantics mean "no row = all toggles on", which is the desired default anyway).

### Migration: extend `notifications`

Add a `link_url text` column (nullable). The SW already accepts `url` in the push payload; this column persists it so in-app clicks from the dropdown can route too.

```sql
alter table notifications add column link_url text;
```

No change to the existing `type` enum — `request_update` covers approve/reject + schedule changes; `approval` covers incoming leave/OT requests for approvers.

---

## Phase 2 — `notify` edge function

**Path:** `supabase/functions/notify/handler.ts`

**Contract:**

```ts
type NotifyEvent =
  | { event: 'leave_request_submitted'; request_id: string; requester_id: string; org_id: string }
  | { event: 'overtime_request_submitted'; request_id: string; requester_id: string; org_id: string }
  | { event: 'leave_request_decided'; request_id: string; requester_id: string; status: 'approved' | 'rejected'; decision_note: string | null; actor_id: string }
  | { event: 'overtime_request_decided'; request_id: string; requester_id: string; status: 'approved' | 'rejected'; decision_note: string | null; actor_id: string }
  | { event: 'schedule_changed'; employee_id: string; actor_id: string };
```

**Recipient resolution rules:**

| Event | Recipients |
|---|---|
| `*_submitted` (regular employee) | Department manager (`departments.manager_uid` for the requester's `department_id`) **plus** all admins in `org_id`. Filter to those with the corresponding `*_team` toggle = true. Exclude requester. |
| `*_submitted` (manager) | All admins in `org_id`. Same toggle filter. Exclude requester. |
| `*_submitted` (admin) | All other admins in `org_id`. Same toggle filter. Exclude requester. |
| `*_decided` | Just the requester. No toggle filter. Skip if `actor_id === requester_id` (self-approval edge case). |
| `schedule_changed` | Just the employee. Skip if `actor_id === employee_id`. |

Use the service-role client inside the edge function for these lookups so RLS doesn't get in the way. The function authenticates the *caller* via the JWT (verify they're allowed to emit these events — see security note below).

**Security note:** the `notify` edge function must not blindly accept any event from any caller — that would let a regular employee fabricate "leave request approved" notifications. Verify the JWT and check that the caller actually performed the action being notified about (e.g. for `leave_request_decided`, fetch the request and confirm `approver_id === jwt.sub`). If validation fails, return 403 without emitting. This is non-negotiable.

**Error handling:** the function should never 500 in a way that would break the calling flow. Always return 200 with `{ ok: true | false, sent: N, errors: [...] }`. The caller fires-and-forgets.

**i18n strings** (build once, store in a constants file in the edge function — match tone of existing notification strings in `NotificationSettingsPage.tsx`):

| Event | EN title | EN body | AR title | AR body |
|---|---|---|---|---|
| leave_request_submitted | New leave request | {name} submitted a {type} request | طلب إجازة جديد | قدّم {name} طلب {type} |
| overtime_request_submitted | New overtime request | {name} submitted an overtime request | طلب عمل إضافي جديد | قدّم {name} طلب عمل إضافي |
| leave_request_decided (approved) | Leave request approved | Your {type} request was approved | تمت الموافقة على طلب الإجازة | تمت الموافقة على طلب {type} الخاص بك |
| leave_request_decided (rejected) | Leave request rejected | Your {type} request was rejected. {decision_note} | تم رفض طلب الإجازة | تم رفض طلب {type}. {decision_note} |
| overtime_request_decided | (analogous) | (analogous) | (analogous) | (analogous) |
| schedule_changed | Schedule updated | Your work schedule was updated | تم تحديث الجدول | تم تحديث جدول عملك |

**Deep-link URLs** (used as `link_url` and as push `url`):

| Event | Recipient role | Link |
|---|---|---|
| `*_submitted` | approver | `/admin/requests?highlight={request_id}` (or whatever the existing approvals queue route is) |
| `*_decided` | requester | `/requests?highlight={request_id}` |
| `schedule_changed` | employee | `/user-details/{employee_id}` or wherever they view their own schedule |

Implementing agent: confirm exact routes against the existing router config; don't trust these paths blindly.

---

## Phase 3 — Wire emission into service code

**File:** `src/lib/services/requests.service.ts`
- After successful insert in `submitRequest()` (~line 43), call `notify` with `leave_request_submitted`.
- After successful update in `updateRequestStatus()` (~line 129), call `notify` with `leave_request_decided`. **Important:** only emit if the update affected a row (the atomic `eq('status', 'pending')` guard means the update is a no-op on a non-pending request — check the returned data length before emitting).

**File:** `src/lib/services/overtime-requests.service.ts`
- Find the OT submission path. Exploration showed there's no explicit submit function in this service — confirm where rows get inserted (likely from the attendance/timesheet flow). Add the emit there.
- After `updateOvertimeRequestStatus()` (~line 87), emit `overtime_request_decided` with the same row-affected guard.

**File: schedule edit save path**
- Implementing agent must locate this — exploration narrowed it to admin user-details page using `WorkScheduleEditor`. Likely `src/app/pages/admin/UserDetailsPage.tsx` or a sibling. Find the function that persists `profiles.work_schedule` (or wherever schedules live) and emit `schedule_changed` after success.

**Helper to centralize the call:** add `src/lib/notifications/emit.ts` with one thin wrapper per event, e.g.:

```ts
export async function emitLeaveRequestSubmitted(p: {...}) {
  try {
    await supabase.functions.invoke('notify', { body: { event: 'leave_request_submitted', ...p }});
  } catch (e) { console.error('notify failed', e); }
}
```

This keeps the call sites in the service files one-liners and makes the event contract grep-able.

---

## Phase 4 — Settings UI

**File:** `src/app/pages/admin/NotificationSettingsPage.tsx`

Refactor into three sections (use existing card/section patterns from this file — don't introduce new layout primitives):

### Section 1 — Attendance templates *(unchanged, admin-only)*
The existing 4 categories (`pre_shift_reminder`, `work_start`, `punch_out_reminder`, `auto_punch_out_alert`). Hide entire section if `role !== 'admin'`.

### Section 2 — Team activity *(new, admin + manager)*
Two toggles backed by `notification_preferences`:
- "Leave requests from your team" → `leave_requests_team`
- "Overtime requests from your team" → `overtime_requests_team`

Each row: label, short description ("Get notified when someone in your team submits a request"), toggle. No edit-message, no send-test — these aren't templates, they're personal mute switches.

### Section 3 — My activity *(new, all roles)*
Display-only. List of events with descriptions, no toggles, with a small note: "These notifications can't be turned off." Items:
- Your leave or overtime request was approved or rejected
- Your work schedule was updated

This is intentionally read-only — the point is to set expectations, not to allow muting.

### Route guard
Find the route definition for the settings page (likely in a router config or a layout-level role guard). Change from `role === 'admin'` to `role === 'admin' || role === 'manager'`.

### Service for prefs
Add `src/lib/services/notification-preferences.service.ts` with:
- `getMyPreferences()` — selects own row, lazy-inserts defaults if missing.
- `updateMyPreferences(patch)` — partial update.

---

## Phase 5 — Polish & verification

1. **Push permission nudge:** in section 2, if any toggle is `true` but the browser hasn't been granted notification permission, show an inline button "Enable browser notifications" that calls the existing subscribe flow in `src/lib/push/push-manager.ts`. Don't auto-prompt.

2. **In-app dropdown click → deep link:** `src/app/components/notifications/NotificationsDropdown.tsx` currently marks-as-read on click. Extend it to also `navigate(notification.link_url)` if present.

3. **SW push click:** `src/pwa/sw.ts:138` already handles `url` in payload. Confirm the new payload from `notify` includes the `url` field.

4. **i18n:** match the EN/AR pattern already used in `NotificationSettingsPage.tsx`. All notification strings live in the edge function (server-side) since they're inserted into the DB at emit time.

5. **Manual test matrix:**
   - Employee submits leave → manager + admins get bell + push, requester does not.
   - Manager submits leave → only admins get bell + push.
   - Admin submits leave → other admins get bell + push, the submitting admin does not.
   - Approver toggles `leave_requests_team` off → no longer receives, but other approvers do.
   - Manager rejects with `decision_note="not enough notice"` → requester sees the note in the body.
   - Approver approves → does not get a notification about their own action.
   - Admin edits employee's schedule → employee gets notification, admin does not.
   - Admin edits *their own* schedule → no notification (actor === employee).
   - Same matrix for OT requests.
   - With browser permission denied: bell still works, no push, no errors thrown.

---

## Out of scope / future

- Cancellation/withdrawal of pending requests (admin rejects + asks refile in v1).
- Notification mutation on cancel (when cancellation is added later).
- Auto-punch-out anomaly alerts.
- Late/absent daily digest.
- Shift swaps, document/contract expiry — slot into "Team activity" later.

---

## Implementation order suggestion

1. Migrations (`notification_preferences`, `notifications.link_url`).
2. Extract `web-push.ts` to `_shared`.
3. New `notify` edge function (with JWT validation + recipient resolution).
4. Wire emission into leave service first; manually verify end-to-end (DB row + push delivered).
5. Wire emission into OT service.
6. Wire emission into schedule editor.
7. Build the settings UI sections.
8. Loosen route guard.
9. Run the test matrix.

This sequence keeps each step independently verifiable — stop and confirm after each one rather than waiting until the end.

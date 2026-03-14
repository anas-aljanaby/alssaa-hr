# Testing Rollout Plan

## Phase 0 — Tooling Setup
**One Cursor task. No real tests yet.**

| What | Detail |
|---|---|
| Install | `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `msw` (for service mocking) |
| Config | `vitest.config.ts` — use your existing Vite config, add `jsdom` environment, resolve `@` alias |
| Scripts | `"test"`, `"test:watch"`, `"test:coverage"` in `package.json` |
| Proof | One dummy test that imports `cn()` from `src/app/components/ui/utils.ts` and asserts it merges classes |
| Setup file | `src/test/setup.ts` — import `@testing-library/jest-dom`, any global mocks |

**Prompt to Cursor:**
> "Set up Vitest for this Vite + React + TypeScript project. Add jsdom environment, resolve the `@` → `src` alias, create a setup file at `src/test/setup.ts` that imports `@testing-library/jest-dom`. Add test/test:watch/test:coverage scripts. Write one smoke test for the `cn()` utility in `src/app/components/ui/utils.ts` to prove the pipeline works."

---

## Phase 1 — Pure Utility Functions (highest value, zero dependencies)

These are stateless, importable, no React, no Supabase. Fastest confidence gain.

### Task 1.1 — `src/lib/time.ts`
**Priority: 🔴 Critical** — date/time logic drives attendance correctness.

Test: all exported functions, edge cases around midnight, timezone handling, Hijri/Gregorian if relevant, DST boundaries.

### Task 1.2 — `src/lib/validations.ts`
**Priority: 🔴 Critical** — Zod schemas gate every form and API payload.

Test: valid input passes, invalid input returns expected Zod errors, boundary values (empty strings, wrong types, edge lengths).

### Task 1.3 — `src/lib/errorMessages.ts`
**Priority: 🟡 Medium** — mapping correctness matters for UX but is low-risk.

Test: known error codes map to expected Arabic strings, unknown codes return a fallback.

### Task 1.4 — `src/lib/ui-helpers.ts`
**Priority: 🟡 Medium**

Test: each helper with representative inputs.

### Task 1.5 — `src/app/components/ui/utils.ts` (already covered in Phase 0, expand if needed)

### Task 1.6 — `src/app/data/helpContent.ts` & `src/app/data/mockData.ts`
**Priority: 🟢 Low** — static data, but a quick structural assertion (e.g., no missing keys) can catch typos.

**One Cursor prompt per task.** Always include the source file with `@filename`.

---

## Phase 2 — Service Layer (`src/lib/services/`)

Each service talks to Supabase. You need a shared mock first.

### Task 2.0 — Supabase Client Mock Factory
**Priority: 🔴 Critical setup** — every service test depends on this.

Create `src/test/mocks/supabase.ts`:
- A factory that returns a mock Supabase client matching your `database.types.ts` shape
- Chainable `.from().select().eq()` etc. that you can control return values on
- Helper to mock `supabase.functions.invoke()` for edge function calls

**Prompt to Cursor:**
> "Create a reusable mock factory for my typed Supabase client (see `src/lib/supabase.ts` and `src/lib/database.types.ts`). It should let me control return values for chained query builders (`.from().select().eq()` etc.) and for `.functions.invoke()`. Put it at `src/test/mocks/supabase.ts`. Use `vi.fn()` from Vitest."

### Task 2.1 — `attendance.service.ts`
**Priority: 🔴 Critical** — core business operation.

Tests:
- Fetch today's attendance (happy path, no records, error)
- Punch in/out calls (correct payload sent to edge function, error handling)
- Monthly/period queries

### Task 2.2 — `auth.service.ts`
**Priority: 🔴 Critical** — gates everything.

Tests:
- Login, signup, signout call correct Supabase auth methods
- Error mapping (invalid credentials, network failure)
- Session refresh logic if any

### Task 2.3 — `requests.service.ts`
**Priority: 🔴 Critical** — leave/request workflow.

Tests:
- Submit request (valid payload, missing fields)
- Fetch requests by status
- Cancel request
- Manager approve/reject

### Task 2.4 — `profiles.service.ts`
**Priority: 🟠 High**

Tests: fetch profile, update profile, role-based field visibility.

### Task 2.5 — `departments.service.ts`
**Priority: 🟠 High**

Tests: list, create, update, delete — verify correct Supabase calls.

### Task 2.6 — `organizations.service.ts`
**Priority: 🟠 High**

### Task 2.7 — `notifications.service.ts`
**Priority: 🟡 Medium**

Tests: fetch, mark read, realtime subscription setup.

### Task 2.8 — `policy.service.ts`
**Priority: 🟡 Medium**

### Task 2.9 — `leave-balance.service.ts`
**Priority: 🟡 Medium**

### Task 2.10 — `audit.service.ts`
**Priority: 🟢 Low**

### Task 2.11 — `storage.service.ts`
**Priority: 🟢 Low**

---

## Phase 3 — Edge Functions (`supabase/functions/`)

Each is a self-contained Deno file. Test with **Deno's built-in test runner** or keep using Vitest and just test the logic by extracting/importing where possible. If the functions are thin HTTP handlers wrapping Supabase calls, write **contract-style tests** (mock `fetch`/Supabase client, assert request→response).

### Task 3.1 — `punch/index.ts`
**Priority: 🔴 Critical** — the most important endpoint.

Tests:
- Unauthenticated → 401
- Missing/invalid payload → 400 with correct error shape
- Check-in when already checked in → appropriate error
- Check-out without check-in → error
- Happy path check-in → correct DB state
- Policy violations (early, late, outside geofence if applicable)

### Task 3.2 — `invite-user/index.ts`
**Priority: 🔴 Critical** — admin-only, uses service role key.

Tests:
- Non-admin caller → 403
- Missing fields → 400
- Duplicate email → expected error
- Happy path → user created with correct role/org

### Task 3.3 — `delete-user/index.ts`
**Priority: 🟠 High**

Tests: auth check, cannot delete self, cannot delete GM, happy path.

### Task 3.4 — `auto-punch-out/index.ts`
**Priority: 🟠 High**

Tests: identifies unpunched users, creates punch-out records, sends notifications.

### Task 3.5 — `dev-seed-attendance/index.ts` & `dev-reset-attendance/index.ts`
**Priority: 🟢 Low** — dev-only, but quick to test.

---
*** done up to this point ***
---

## Phase 4 — React Contexts & Hooks

### Task 4.1 — `src/app/contexts/AuthContext.tsx`
**Priority: 🔴 Critical**

Test with `@testing-library/react` `renderHook`:
- Provides session after login
- Clears session on logout
- Redirects unauthenticated users
- Handles expired session

### Task 4.2 — `src/app/contexts/AppContext.tsx`
**Priority: 🟠 High**

Test: state initialization, key state transitions.

### Task 4.3 — `src/app/hooks/useQuickPunch.ts`
**Priority: 🟠 High**

Test: calls attendance service correctly, manages loading/error/success states, debounce/double-tap protection.

### Task 4.4 — `src/lib/hooks/useRealtimeSubscription.ts`
**Priority: 🟡 Medium**

Test: subscribes to correct channel, cleans up on unmount.

### Task 4.5 — `src/app/components/ui/use-mobile.ts`
**Priority: 🟢 Low**

---

## Phase 5 — Critical Component Tests

Not every component needs a test. Focus on components with **logic**, not pure display.

### Task 5.1 — `ErrorBoundary.tsx`
**Priority: 🟠 High** — verify it catches errors and renders fallback.

### Task 5.2 — `RequireAdmin.tsx`
**Priority: 🔴 Critical** — security gate. Verify redirect for non-admin roles.

### Task 5.3 — `QuickPunchCard.tsx`
**Priority: 🟠 High** — verify button states, loading, success/error display.

### Task 5.4 — `TodayStatusCard.tsx` + `TodayPunchLog.tsx`
**Priority: 🟡 Medium**

### Task 5.5 — `PasswordChecklist.tsx`
**Priority: 🟡 Medium** — verify rule checking logic renders correctly.

### Task 5.6 — `PendingRequestsCard.tsx`, `RequestCard.tsx`, `StatCard.tsx`
**Priority: 🟢 Low** — mostly display.

**Skip testing:** `src/app/components/ui/*.tsx` (Radix/shadcn primitives — tested upstream), layout components (unless they contain routing logic), `src/app/components/figma/`, `src/app/components/dev/`.

---

## Phase 6 — E2E Smoke Tests (last, smallest)

Use **Playwright**. Keep it to ≤5 flows.

| Flow | What it proves |
|---|---|
| Employee login → sees dashboard | Auth + routing + role redirect |
| Punch in → punch out | Core attendance loop |
| Submit leave request | Request creation |
| Manager approves request | Cross-role workflow |
| Admin invites user | Edge function + admin gate |

---

## Summary — Execution Order & Sizing

| Phase | Tasks | Est. Cursor prompts | Model |
|---|---|---|---|
| 0 — Tooling | 1 | 1 | Sonnet |
| 1 — Utilities | 6 | 6 | Sonnet |
| 2 — Services | 12 (inc. mock) | 12 | Sonnet (2.1–2.3 optionally Opus) |
| 3 — Edge Fns | 5 | 5 | **Opus** |
| 4 — Contexts/Hooks | 5 | 5 | Sonnet |
| 5 — Components | 6 | 6 | Sonnet |
| 6 — E2E | 1 setup + 5 flows | 3–4 | Sonnet |
| **Total** | | **~38 prompts** | |

**Start today:** Phase 0 → Phase 1.1 (`time.ts`) → Phase 1.2 (`validations.ts`). You'll have meaningful coverage of your most critical logic within a few hours.
Testing Rollout Checklist

 1) Define testing strategy and scope

Decide test layers: unit, integration (services + DB), edge functions, E2E.
Identify “must not break” business flows (attendance, leave approvals, roles/RLS, invites).

 2) Set up test tooling + CI gates

Add test runners/frameworks for unit/integration/E2E.
Add scripts and CI jobs so tests run on every PR.

 3) Build reusable test foundations

Create shared fixtures/factories for orgs, users, departments, roles.
Add helpers for auth/session setup and seeded data.

 4) Cover core unit logic first

Time/date calculations, attendance status logic, leave balance math, validation helpers.
Target pure functions first for fast confidence.

 5) Add service-layer integration tests

Test src/lib/services/* behavior with realistic Supabase responses.
Include happy path + expected failures (invalid state, unauthorized, missing data).

 6) Add database migration + RLS tests

Validate schema changes, constraints, and policies after each migration.
Verify role/tenant boundaries (admin, manager, employee) and cross-org denial.

 7) Add edge function contract tests

punch and invite-user: auth, payload validation, permissions, error codes/messages.
Confirm behavior under production-like and dev-specific branches.

 8) Add minimal E2E smoke flows

Login by role, submit request, approve/reject, attendance check-in/out, invite user.
Keep this suite small but stable.

 9) Convert manual checklist items into automated tests

Gradually automate items from GM_MANAGER_SYNC_TEST_CHECKLIST.md.
Keep manual checklist only for truly exploratory/UX checks.

 10) Define quality thresholds and ownership

Set baseline coverage goals (per layer, not just global %).
Set “blocking” rules (e.g., critical test failures block merge).
Assign ownership for flaky test triage and maintenance.
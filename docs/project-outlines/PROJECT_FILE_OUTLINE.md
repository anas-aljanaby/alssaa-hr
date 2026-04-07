# Project file outline

One line per file (filename + short purpose). Excludes `docs/`, `node_modules/`, `dist/`, `.git/`, and `supabase/.temp/`. Omit `.env` (local secrets); use `.env.example`.

## Root

| File | Description |
|------|-------------|
| `.gitignore` | Git ignore rules |
| `ATTRIBUTIONS.md` | Third-party / asset attributions |
| `index.html` | Vite HTML shell (RTL Arabic title, mounts `#root`) |
| `package.json` / `package-lock.json` | NPM dependencies and scripts |
| `deno.lock` | Deno dependency lockfile (Edge Function test/runtime deps) |
| `tsconfig.json` | TypeScript compiler options (app) |
| `tsconfig.node.json` | TypeScript options for Node tooling (e.g. Vite config) |
| `vite.config.ts` | Vite: React, Tailwind plugin, `@` → `src` alias |
| `vitest.config.ts` | Vitest configuration (jsdom, setup, exclusions) |
| `vercel.json` | Vercel deployment config |

## `scripts/`

| File | Description |
|------|-------------|
| `deploy-functions.sh` | Batch deploy Supabase Edge Functions |

## `src/`
### Root
| File | Description |
|------|-------------|
| `main.tsx` | React entry: StrictMode, imports global CSS, renders `App` |
### `src/app/`

| File | Description |
|------|-------------|
| `App.tsx` | Top-level `RouterProvider` with `router` from `routes` |
| `routes.tsx` | `createBrowserRouter` route tree, lazy pages, layouts, admin guard |

### `src/app/pages/`

| File | Description |
|------|-------------|
| `LoginPage.tsx` | Login screen |
| `AuthCallbackPage.tsx` | OAuth / magic-link callback handler |
| `SetPasswordPage.tsx` | Invite / password setup flow |
| `DashboardRouter.tsx` | Role-based dashboard redirect (employee/manager/admin) |
| `admin/AdminDashboard.tsx` | Admin home dashboard |
| `admin/UsersPage.tsx` | Admin user list / management |
| `admin/UserDetailsPage.tsx` | Single user admin detail |
| `admin/DepartmentsPage.tsx` | Department list |
| `admin/DepartmentDetailsPage.tsx` | Single department detail |
| `admin/ReportsPage.tsx` | Admin reports |
| `admin/TransferGeneralManagerPage.tsx` | Transfer GM workflow |
| `employee/EmployeeDashboard.tsx` | Employee home |
| `employee/AttendancePage.tsx` | Attendance views / punch UI |
| `employee/RequestsPage.tsx` | Employee requests |
| `employee/NotificationsPage.tsx` | Notifications list |
| `employee/MorePage.tsx` | Employee “more” menu hub |
| `employee/AttendancePolicyPage.tsx` | Attendance policy content |
| `employee/SecurityPrivacyPage.tsx` | Security / privacy |
| `employee/TermsPage.tsx` | Terms & conditions |
| `employee/HelpSupportPage.tsx` | Help / support |
| `manager/ManagerDashboard.tsx` | Manager home |
| `manager/ApprovalsPage.tsx` | Manager approvals queue |
| `team/TeamAttendancePage.tsx` | Team attendance monitoring page |

### `src/app/contexts/`

| File | Description |
|------|-------------|
| `AuthContext.tsx` | Auth state / session for the app |
| `AppContext.tsx` | Global app state (non-auth) |
| `DevTimeContext.tsx` | Dev-only “fake now” for testing attendance |

### `src/app/hooks/`

| File | Description |
|------|-------------|
| `useQuickPunch.ts` | Hook for quick punch-in/out UX |

### `src/app/data/`

| File | Description |
|------|-------------|
| `helpContent.ts` | Static help copy |
| `mockData.ts` | Mock / demo data for UI |

### `src/app/components/` (shared / feature)

| File | Description |
|------|-------------|
| `ErrorBoundary.tsx` | Catches render errors, shows fallback |
| `RequireAdmin.tsx` | Wraps routes needing admin role |
| `Pagination.tsx` | List pagination control |
| `PasswordChecklist.tsx` | Password strength / rules UI |
| `PasswordGenerateCopyRow.tsx` | Generate/copy password helper row |
| `PendingRequestsCard.tsx` | Card summarizing pending requests |
| `RequireManagerOrAdmin.tsx` | Wraps routes needing manager/admin role |
| `skeletons.tsx` | Loading skeletons (e.g. full-page spinner) |

### `src/app/components/layout/`

| File | Description |
|------|-------------|
| `RootLayout.tsx` | Outer shell / outlet for auth vs app |
| `MobileLayout.tsx` | Bottom-nav mobile shell for main app routes |
| `PageLayout.tsx` | Standard page chrome (header, etc.) |

### `src/app/components/attendance/`

| File | Description |
|------|-------------|
| `QuickPunchCard.tsx` | Primary punch in/out card |
| `TodayStatusCard.tsx` | Today’s attendance status summary |
| `TodayPunchLog.tsx` | Today’s punch timeline |
| `DayDetailsSheet.tsx` | Sheet/drawer for one day’s detail |
| `MonthCalendarHeatmap.tsx` | Month calendar / heatmap for attendance |

### `src/app/components/notifications/`

| File | Description |
|------|-------------|
| `NotificationsDropdown.tsx` | Header dropdown preview for recent notifications |

### `src/app/components/dashboard/`

| File | Description |
|------|-------------|
| `index.ts` | Barrel exports for dashboard widgets |
| `AttendanceCharts.tsx` | Charts for attendance stats |
| `EmployeeListUnified.tsx` | Combined employee list widget |
| `EmployeeStatusList.tsx` | Status list (present/late/etc.) |
| `MonthlyStatsCard.tsx` | Monthly aggregates card |

### `src/app/components/shared/`

| File | Description |
|------|-------------|
| `DashboardHeader.tsx` | Dashboard page header |
| `EmptyState.tsx` | Empty list placeholder |
| `FilterChips.tsx` | Filter chip UI |
| `RequestCard.tsx` | Single request row/card |
| `StatCard.tsx` | Metric summary card |

### `src/app/components/dev/`

| File | Description |
|------|-------------|
| `DevTimeToolbar.tsx` | Dev UI to adjust “current time” |

### `src/app/components/figma/`

| File | Description |
|------|-------------|
| `ImageWithFallback.tsx` | Image with broken-state fallback |

### `src/app/components/ui/` (design system primitives)

| File | Description |
|------|-------------|
| `utils.ts` | `cn()` / className merge helpers |
| `use-mobile.ts` | Breakpoint hook for mobile |
| `accordion.tsx` | Accordion (Radix) |
| `alert.tsx` | Alert / banner |
| `alert-dialog.tsx` | Modal confirm (Radix) |
| `aspect-ratio.tsx` | Aspect ratio box |
| `avatar.tsx` | Avatar |
| `badge.tsx` | Badge |
| `breadcrumb.tsx` | Breadcrumbs |
| `button.tsx` | Button |
| `calendar.tsx` | Date calendar (react-day-picker wrapper) |
| `card.tsx` | Card layout |
| `carousel.tsx` | Carousel |
| `chart.tsx` | Chart helpers (Recharts wrappers) |
| `checkbox.tsx` | Checkbox |
| `collapsible.tsx` | Collapsible |
| `command.tsx` | Command palette (cmdk) |
| `context-menu.tsx` | Context menu |
| `dialog.tsx` | Dialog |
| `drawer.tsx` | Drawer (Vaul) |
| `dropdown-menu.tsx` | Dropdown menu |
| `form.tsx` | Form field wiring (react-hook-form) |
| `hover-card.tsx` | Hover card |
| `input.tsx` | Text input |
| `input-otp.tsx` | OTP input |
| `label.tsx` | Label |
| `menubar.tsx` | Menubar |
| `navigation-menu.tsx` | Navigation menu |
| `pagination.tsx` | Pagination (design-system variant) |
| `popover.tsx` | Popover |
| `progress.tsx` | Progress bar |
| `radio-group.tsx` | Radio group |
| `resizable.tsx` | Resizable panels |
| `scroll-area.tsx` | Scroll area |
| `select.tsx` | Select |
| `separator.tsx` | Separator |
| `sheet.tsx` | Side sheet |
| `sidebar.tsx` | Sidebar layout |
| `skeleton.tsx` | Skeleton placeholder |
| `slider.tsx` | Slider |
| `sonner.tsx` | Toasts (Sonner) |
| `switch.tsx` | Switch |
| `table.tsx` | Table |
| `tabs.tsx` | Tabs |
| `textarea.tsx` | Textarea |
| `toggle.tsx` | Toggle |
| `toggle-group.tsx` | Toggle group |
| `tooltip.tsx` | Tooltip |

### `src/lib/`

| File | Description |
|------|-------------|
| `supabase.ts` | Typed Supabase browser client (`VITE_*` env) |
| `database.types.ts` | Generated / maintained DB types for Supabase |
| `authSnapshot.ts` | Auth/user snapshot normalization helpers |
| `network.ts` | Network error and response utility helpers |
| `generatePassword.ts` | Password generation helpers for admin flows |
| `profileDisplay.ts` | Profile presentation/formatting helpers |
| `services/index.ts` | Barrel re-export of services |
| `services/auth.service.ts` | Auth API helpers |
| `services/attendance.service.ts` | Attendance queries / punch calls |
| `services/requests.service.ts` | Leave / request workflows |
| `services/overtime-requests.service.ts` | Overtime request workflows |
| `services/notifications.service.ts` | Notifications CRUD / fetch |
| `services/profiles.service.ts` | User profiles |
| `services/departments.service.ts` | Departments |
| `services/organizations.service.ts` | Orgs |
| `services/policy.service.ts` | Attendance policy fetch/update |
| `services/leave-balance.service.ts` | Leave balances |
| `services/storage.service.ts` | Supabase storage uploads |
| `services/audit.service.ts` | Audit log access |
| `hooks/useRealtimeSubscription.ts` | Supabase realtime channel helper |
| `validations.ts` | Zod schemas / validators |
| `errorMessages.ts` | User-facing error message mapping |
| `time.ts` | Date/time utilities |
| `ui-helpers.ts` | Miscellaneous UI helpers |

### `src/styles/`

| File | Description |
|------|-------------|
| `index.css` | Global CSS entry (imports theme/tailwind) |
| `tailwind.css` | Tailwind layers / directives |
| `theme.css` | CSS variables / theme tokens |
| `fonts.css` | Font faces / font setup |

## `supabase/`

### `supabase/migrations/`

| File | Description |
|------|-------------|
| `000_reset_all.sql` | Full reset helper / teardown |
| `001_initial_schema.sql` | Primary schema (tables, RLS, triggers) |
| `002_storage_bucket.sql` | Storage bucket + policies |
| `003_reset_demo_data.sql` | Demo data reset |
| `004_seed_demo.sql` | Demo seed data |
| `005_add_real_org.sql` | Real org migration / seed |
| `006_attendance_sessions_and_daily_summary.sql` | Attendance sessions and daily summary structures |
| `007_backfill_attendance_sessions_columns.sql` | Backfill/repair attendance session columns |
| `008_sync_profile_email_from_auth.sql` | Keep profile email synced from auth identities |
| `009_departments_manager_limited_update.sql` | Restrict manager department update scope |
| `010_departments_revoke_manager_update.sql` | Revoke broad manager department updates |
| `011_leave_recalculate_daily_summary.sql` | Recalculate daily summary for leave handling |
| `012_departments_optional_english_name.sql` | Add optional English department name |
| `013_team_attendance_functions.sql` | Team attendance database functions |
| `014_departments_manager_membership_guard.sql` | Enforce manager membership guard on department ops |

### `supabase/functions/`

| File | Description |
|------|-------------|
| `punch/index.ts` | Edge: check-in / check-out with policy rules |
| `invite-user/index.ts` | Edge: admin invite user (service role) |
| `delete-user/index.ts` | Edge: admin delete auth user |
| `auto-punch-out/index.ts` | Edge: scheduled auto punch-out + notification |
| `mark-absent/index.ts` | Edge: mark absent records for eligible users |
| `dev-seed-attendance/index.ts` | Edge: dev-only attendance seed |
| `dev-reset-attendance/index.ts` | Edge: dev-only clear dev attendance rows |
| `_shared/bearer.ts` | Shared bearer-token parsing/auth helpers |
| `_shared/cors.ts` | Shared CORS response helpers |
| `_shared/queued_supabase.ts` | Shared Supabase queue/serialization helper |

### `supabase/` (misc)

| File | Description |
|------|-------------|
| `GM_MANAGER_SYNC_TEST_CHECKLIST.md` | Manual checklist for GM/manager sync |

## Env template (root)

| File | Description |
|------|-------------|
| `.env.example` | Sample `VITE_SUPABASE_*` (and notes for Edge secrets) |

## Project Overview
This repository contains a web app for an HR attendance workflow (clock-in/clock-out) with role-based access for employees, managers, and administrators.

At a high level, the frontend handles:
- Authentication and session setup (login / signup / auth callback / set-password)
- Employee attendance actions (punch in/out, attendance views, requests/notifications)
- Manager + admin workflows (approvals, reporting, user/department management)

The backend is powered by Supabase:
- A Postgres database defined via SQL migrations
- Supabase Auth for identity
- Supabase Edge Functions (serverless endpoints) for attendance-related operations and admin-only actions

## Tech Stack
### Frontend
- TypeScript + React
- Vite for bundling/build
- React Router (`createBrowserRouter`) for navigation
- UI and styling:
  - Tailwind CSS (via `@tailwindcss/vite` + Tailwind files in `src/styles/`)
  - Material UI (MUI)
  - Radix UI primitives
  - Emotion (used by MUI)
- Charts/visualization: `recharts` is included for dashboards
- RTL / Arabic UI: the app is rendered with `<html lang="ar" dir="rtl">` (see `index.html`)

### Backend (Supabase)
- Supabase Postgres schema managed in `supabase/migrations/*.sql`
- Supabase Auth (used by the app via the Supabase client)
- Supabase Edge Functions in `supabase/functions/*/index.ts` (Deno)
  - Includes attendance check-in/out logic and automation such as `auto-punch-out`

### Deployment / Tooling
- `npm run dev`, `npm run build`, `npm run preview` (Vite)
- Tests: `npm test`, `npm run test:watch`, `npm run test:coverage`, and `npm run test:edge` (see [Testing](#testing))
- `npm run deploy:functions` runs `scripts/deploy-functions.sh` to deploy the required Edge Functions
- App configuration uses environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `DEMO_RESET_SECRET` is referenced by dev edge functions (via Supabase secrets; see `.env.example`)

## Testing
The repo uses two test runners: **Vitest** for the Vite app (TypeScript/React and shared `src/lib` code) and **Deno’s built-in test runner** for Supabase Edge Function handlers under `supabase/functions/`.

### Commands
| Script | What it runs |
| --- | --- |
| `npm test` | Vitest once (`vitest run`) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with V8 coverage (`@vitest/coverage-v8`) |
| `npm run test:edge` | Deno tests for Edge Functions (`TZ=UTC` for stable time-based assertions) |

### Vitest (app and shared libraries)
- Config: `vitest.config.ts` merges the Vite config, uses a **jsdom** environment, `globals: true`, and `src/test/setup.ts` (imports `@testing-library/jest-dom`).
- `supabase/functions/**` is excluded from Vitest so those tests stay on Deno.
- Typical areas covered: pure helpers (`src/lib/time.ts`, validations, error messages, UI helpers), co-located `*.test.ts` files next to **services** in `src/lib/services/`, static data checks under `src/app/data/`, and a smoke test for shared UI utilities (e.g. `cn()` in `src/app/components/ui/utils.test.ts`).
- **MSW** and **@testing-library/react** are available for component and network mocking when tests need them.

### Edge Functions (Deno)
- Each function can ship a `handler.test.ts`; Deno picks up `**/*.test.ts` per `supabase/functions/deno.json`.
- Run the full Edge suite with `npm run test:edge` (not part of `npm test`).

### Documentation
- `docs/testing-plan.md` describes the phased rollout and priorities for expanding coverage.

## General Repository Structure
- `src/`
  - `main.tsx`: React entrypoint (mounts the app)
  - `app/`
    - `routes.tsx`: the main route tree (login/signup/auth/callback + dashboard routes)
    - `pages/`: screens grouped by role (e.g., `employee/`, `manager/`, `admin/`)
    - `components/`: shared UI building blocks (layouts, cards, attendance widgets, etc.)
    - `contexts/`: React contexts (notably auth/app/dev-time state)
    - `hooks/`: reusable hooks (attendance and realtime helpers)
  - `lib/`
    - `supabase.ts`: Supabase client initialization (typed via `database.types.ts`)
    - `services/`: data-access / API wrapper logic for app features (auth, attendance, requests, policies, etc.); most services have co-located `*.service.test.ts` files
    - utility modules (e.g., time helpers, validations, realtime hook)
  - `styles/`: Tailwind/theme styles and global CSS
  - `test/`: Vitest setup (`setup.ts`) and shared test utilities/mocks (e.g. Supabase client mocks for service tests)

- `supabase/`
  - `migrations/`: SQL files defining the schema and demo/seed data
  - `functions/`: Supabase Edge Functions used by the app
  - `GM_MANAGER_SYNC_TEST_CHECKLIST.md`: helper documentation for manager sync testing

- `docs/`
  - Project documentation and operational policies (attendance, policies, testing plan and checklists)

- `scripts/`
  - `deploy-functions.sh`: deploy script for the Edge Functions


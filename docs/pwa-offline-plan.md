# PWA Offline & Stability Improvements — Implementation Guide

## Instructions for the implementing model

Before writing any code, **analyze the existing codebase thoroughly**. Key files to understand first:

- `src/pwa/sw.ts` — the current service worker (Workbox, injectManifest strategy)
- `src/app/pwa/runtime.ts` — the PWA runtime state manager (install, update, online/offline detection)
- `vite.config.ts` — VitePWA plugin config (injectManifest, registerType: 'prompt')
- `public/manifest.webmanifest` — the app manifest
- `src/main.tsx` — app entry point
- `src/app/App.tsx` (and the router/layout structure) — to understand where to place error boundaries, update toasts, and the offline indicator
- The data fetching layer — understand what library is used (likely TanStack Query), how queries are structured, and what Supabase endpoints are called

Use this plan as **general goals**, not a rigid spec. If the codebase already partially solves something, adapt accordingly. Prefer extending existing patterns over introducing new ones. The guiding principle throughout is: **a decent, working system — not an over-engineered one**. Keep it simple, keep it maintainable.

---

## Context & constraints

This is an HR attendance/leave PWA for a company called شبكة الساعة (Al-Saa Network). Employees use it to check their attendance records, shifts, requests, and notifications. The offline use case is **read-only only** — employees need to be able to view their own data (e.g. "what time do I work tomorrow", "was I late today") when they have no internet connection.

There are **no offline writes**. The company has a policy that employees must be connected to perform any action. All write operations should simply be disabled when offline with a clear UI message. This constraint removes all complexity around sync, conflict resolution, and background sync — do not implement any of that.

**Caching scope is intentionally limited.** The goal is not to make every screen work offline — it is to make sure users don't encounter broken or confusing experiences. Cache only the most important data that employees are likely to check offline (today's shift, recent attendance, their own profile). For everything else, a clear, friendly Arabic error message telling the user to check their internet connection or pull to refresh is perfectly acceptable and preferred over a complex caching setup. Showing a "تحقق من اتصالك بالإنترنت" message is not a failure — it is the intended behavior for non-critical screens.

---

## Items to implement

### 1. Blank-screen hardening

The app currently shows a completely blank white or black screen in certain failure states (e.g. the PWA was installed from a localhost dev build that is no longer running, or a JS boot failure). Fix this with three layers:

- Add an inline loading splash inside `index.html` (`#root` contents before React mounts) — just the app logo and a brief Arabic loading text — so there is always *something* visible while JS loads. Use inline CSS only, no external resources.
- Add a top-level React error boundary that catches any unhandled render error and shows a friendly Arabic error card with a reload button instead of unmounting the whole app.
- Add an offline fallback in the service worker: if the navigation handler cannot serve `index.html` from precache (e.g. cache is empty), serve a minimal baked-in `offline.html` file rather than a browser network error page.

### 2. Update prompt UI

The runtime already tracks `updateAvailable` state and exposes `applyPwaUpdate()`. What is missing is a visible UI. Implement a small, unobtrusive toast or banner (Arabic text) that appears when `updateAvailable` is true, prompting the user to reload for the new version. Tapping it should call `applyPwaUpdate()`. This is the only reliable way for iOS PWA users to get new versions, since there is no browser refresh button in standalone mode.

### 3. Manual refresh action

Add a "تحديث" (refresh) button or menu item in the app's header or navigation. Wire it to `refreshPwaApp()` which already exists in `runtime.ts`. This is the fallback for users on installed PWAs who have no browser chrome. Optionally add a pull-to-refresh gesture on the main scrollable screens if it fits naturally into the existing layout — but the header button is the minimum.

### 4. Visibility-change query refresh

When the PWA comes back to the foreground after being backgrounded (`document.visibilitychange` → `visible`), invalidate or refetch the active queries so the user sees fresh data on return. This is a standard TanStack Query pattern and should be a small hook or config option. Check whether TanStack Query's `refetchOnWindowFocus` already handles this and just needs to be enabled — do not re-implement something that exists.

### 5. Runtime caching for Supabase reads

Extend `sw.ts` to add a `StaleWhileRevalidate` strategy for Supabase REST API GET requests (`/rest/v1/*`). This makes pages load instantly from cache and refresh in the background when online. Important constraints:
- Scope the rule only to GET requests.
- Explicitly exclude `/auth/v1/*` and any token/session endpoints from caching.
- Use a named cache (e.g. `alssaa-supabase-read-v1`) with an expiration of 24 hours and a reasonable max entries limit.
- Also add caching for any cross-origin static assets that are not already covered (e.g. Google Fonts, avatar image URLs from Supabase storage) if they are used — use `CacheFirst` with a longer TTL for those.

### 6. TanStack Query cache persistence (core offline feature)

This is the main item that delivers the offline read experience. Persist the TanStack Query cache to IndexedDB so that when an employee opens the app with no internet connection, they see their last-known data rather than empty screens.

- Use the standard persistence approach for TanStack Query (check what version is in use and use the appropriate persister — `@tanstack/query-sync-storage-persister` + `idb-keyval`, or `@tanstack/react-query-persist-client` with an async persister for IndexedDB).
- Set a `maxAge` of 24 hours — cached data older than that should be treated as unavailable rather than potentially misleading.
- Include a `buster` / cache version string tied to the app version so a breaking schema change invalidates old persisted data cleanly.
- Be selective and minimal about what to persist: focus on the data employees are most likely to check without internet — today's/upcoming shift, recent attendance records, their own profile. Do not try to persist everything. For screens or data that are not cached, a friendly offline error message is the right outcome, not a caching rule.
- Show a subtle "last updated at <time>" indicator on screens that are showing cached data when offline.

### 7. Disable all writes when offline

Audit every mutation trigger in the UI (form submissions, approval buttons, clock-in/out, request submissions, etc.) and ensure they are visually disabled when `isOffline` is true in the PWA state. Show a short Arabic tooltip or message explaining that an internet connection is required. Do not silently fail — make it clear before the user tries. This should be straightforward since `isOffline` is already tracked in `runtime.ts`.

---

## What not to implement

- Background sync or write queuing of any kind
- Conflict resolution or optimistic UI for offline mutations
- Any service worker push-to-sync mechanism
- Complex cache invalidation logic — keep it simple: 24h TTL, version busting, done

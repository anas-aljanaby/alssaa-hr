/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import type { PrecacheEntry } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | PrecacheEntry>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// Navigation (HTML) handling
// ---------------------------------------------------------------------------

const navigationHandler = createHandlerBoundToURL('/index.html');

registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api\//],
  })
);

// ---------------------------------------------------------------------------
// Runtime caching
// ---------------------------------------------------------------------------

// Same-origin static assets (Vite build output, icons, fonts we ship ourselves).
registerRoute(
  ({ request, sameOrigin }) =>
    sameOrigin &&
    ['style', 'script', 'worker', 'font', 'image'].includes(request.destination),
  new CacheFirst({
    cacheName: 'alssaa-static-assets-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

// Supabase REST reads — stale-while-revalidate with a short TTL.
// Scoped strictly to /rest/v1 GET requests, and we explicitly avoid caching
// anything under /auth/v1 or /storage/v1/object/sign (tokens, session endpoints
// and signed URLs must always hit the network).
registerRoute(
  ({ url, request }) => {
    if (request.method !== 'GET') return false;
    if (!url.pathname.startsWith('/rest/v1')) return false;
    if (url.pathname.startsWith('/auth/v1')) return false;
    return true;
  },
  new StaleWhileRevalidate({
    cacheName: 'alssaa-supabase-read-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Cross-origin images coming from Supabase Storage (avatars, uploaded files).
registerRoute(
  ({ url, request }) =>
    request.destination === 'image' &&
    /\/storage\/v1\/object\/public\//.test(url.pathname),
  new CacheFirst({
    cacheName: 'alssaa-supabase-images-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Google Fonts (stylesheet + font files) if used by the app or its docs.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'alssaa-google-fonts-stylesheets-v1',
  })
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'alssaa-google-fonts-webfonts-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

// ---------------------------------------------------------------------------
// Offline fallback — if navigation handler cannot serve /index.html from the
// precache (e.g. the cache was wiped or never populated because the PWA was
// installed from a stale dev build), serve offline.html instead of letting the
// browser show its native network error page.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Web Push
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string; notificationId?: string } = {};
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { title: 'إشعار جديد', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'إشعار جديد', {
      body: payload.body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      // Store notificationId so we can mark it as read when the user taps the banner
      data: { notificationId: payload.notificationId ?? null },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationId: string | null =
    (event.notification.data as { notificationId?: string | null })?.notificationId ?? null;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Tell the app to mark this notification as read (if we have the ID)
        const markRead = (client: WindowClient) => {
          if (notificationId) {
            client.postMessage({ type: 'MARK_NOTIFICATION_READ', notificationId });
          }
        };

        if (clientList.length > 0) {
          // App is already open — just bring it to the front, don't navigate away
          const client = clientList[0] as WindowClient;
          markRead(client);
          return client.focus();
        }

        // App is closed — open it at home, then mark the notification as read
        return self.clients.openWindow('/').then((newClient) => {
          if (newClient && notificationId) {
            // Wait briefly for the app to initialise before posting the message
            setTimeout(() => {
              newClient.postMessage({ type: 'MARK_NOTIFICATION_READ', notificationId });
            }, 2000);
          }
        });
      })
  );
});

// ---------------------------------------------------------------------------
// Offline fallback
// ---------------------------------------------------------------------------

setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate' || request.destination === 'document') {
    const cached = await matchPrecache('/offline.html');
    if (cached) return cached;
  }
  return Response.error();
});

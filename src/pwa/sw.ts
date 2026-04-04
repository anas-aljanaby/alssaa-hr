/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
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

const navigationHandler = createHandlerBoundToURL('/index.html');

registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api\//],
  })
);

registerRoute(
  ({ request, sameOrigin }) =>
    sameOrigin &&
    ['style', 'script', 'worker', 'font', 'image'].includes(request.destination),
  new CacheFirst({
    cacheName: 'alssaa-static-assets-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

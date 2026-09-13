/// <reference lib="webworker" />
declare var self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

const CACHE_NAME = "v2-yellow-brand";

// Purge any caches from older versions of workbox
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

// Force waiting service worker to activate immediately
self.addEventListener("install", () => {
    self.skipWaiting();
});

// Take control of all open client tabs immediately and purge obsolete caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheName.includes(CACHE_NAME) && !cacheName.startsWith("workbox-precache")) {
                        return caches.delete(cacheName);
                    }
                    return Promise.resolve(true);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Aggressively cache favicons fetched via icons.duckduckgo.com
registerRoute(
    ({ request }) => request.url.startsWith("https://icons.duckduckgo.com"),
    new CacheFirst({
        cacheName: `${CACHE_NAME}-image-cache`,
    })
);

self.addEventListener("message", (event) => {
    const action = event.data && event.data.type;

    let response: any = undefined;

    switch (action) {
        case "SKIP_WAITING":
        case "INSTALL_UPDATE":
            self.skipWaiting();
            if (self.clients) {
                self.clients.claim();
            }
            break;
        case "GET_VERSION":
            response = {
                version: CACHE_NAME,
            };
            break;
    }

    if (event.ports && event.ports[0]) {
        event.ports[0].postMessage(response);
    }
});

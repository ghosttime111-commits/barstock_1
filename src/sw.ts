import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

registerRoute(
  ({ request, url }) =>
    request.method === "GET" && request.mode === "navigate" && url.origin === self.location.origin,
  async ({ request }) => {
    try {
      return await fetch(request);
    } catch {
      return (
        (await matchPrecache("/offline.html")) ??
        new Response("Нет подключения к интернету", {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8" },
        })
      );
    }
  },
);

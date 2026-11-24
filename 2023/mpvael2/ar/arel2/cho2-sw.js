const revision = "cho2-start2";

self.addEventListener("install", event => {
    event.waitUntil(Promise.resolve(revision).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);
    const shell = url.origin === self.location.origin &&
        /(?:^\/(?:index\.html)?$|cho2-webgl\.(?:js|css)$|cho2-sw\.js$|manifest\.webmanifest$)/.test(url.pathname);
    event.respondWith(fetch(event.request, shell ? {cache: "no-store"} : {}));
});

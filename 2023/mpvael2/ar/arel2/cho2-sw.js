self.addEventListener("install", event => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    const scope = new URL(self.registration.scope);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
    const path = url.pathname.slice(scope.pathname.length);
    const shell = /^(?:index\.html|cho2-webgl\.(?:js|css)|cho2-sw\.js|manifest\.webmanifest)?$/.test(path);
    if (shell || path.startsWith("Build/") && !url.searchParams.has("v"))
        event.respondWith(fetch(event.request, {cache: "no-store"}));
});

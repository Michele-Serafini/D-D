/* Cache only the offline reader. Auth, Firebase responses and private pages never enter Cache Storage. */
const BASE = new URL(self.registration.scope);
const PREFIX = 'mercante-reader:' + BASE.pathname + ':';
const CACHE = PREFIX + '__OFFLINE_VERSION__';
const FILES = __OFFLINE_FILES__;
const ALLOWED = new Set(FILES.map((file) => new URL(file, BASE).href));
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const file of FILES) {
        const request = new Request(new URL(file, BASE), { cache: 'reload' });
        const response = await fetch(request);
        if (!response.ok || response.type === 'opaque')
          throw new Error('Risorsa offline non disponibile.');
        await cache.put(request, response);
      }
      await self.skipWaiting();
    })
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(PREFIX) && name !== CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== BASE.origin ||
    !url.pathname.startsWith(BASE.pathname) ||
    url.search
  )
    return;
  if (ALLOWED.has(url.href)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => (await cache.match(request)) || fetch(request))
    );
    return;
  }
  if (
    request.mode === 'navigate' &&
    [BASE.pathname, BASE.pathname + 'index.html'].includes(url.pathname)
  ) {
    const offline = async () =>
      (await caches.open(CACHE)).match(new URL('offline.html', BASE).href);
    event.respondWith(
      self.navigator?.onLine === false
        ? offline()
        : fetch(request, { cache: 'no-store' }).catch(offline)
    );
  }
});

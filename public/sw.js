const CACHE_PREFIX = 'bible-study-shell-';
const CACHE = CACHE_PREFIX + 'v2';
const SHELL = ['/', '/style.css', '/app.js', '/pwa.js', '/commands.js', '/infographic.js', '/image-store.js', '/zip.js', '/depth-report.js', '/docx-generator.js', '/manifest.webmanifest', '/icons/logo.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // Cache only the app shell. Never retain API responses, credentials or generated media here.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (!SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(url.pathname, response.clone());
      if (!response.ok) { const cached = await cache.match(url.pathname); if (cached) return cached; }
      return response;
    } catch {
      return await cache.match(url.pathname) || new Response('Este recurso no está disponible sin conexión.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});

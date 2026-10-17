// Service worker de CellStore.
// Sube el número de VERSION cada vez que publiques cambios para que los celulares se actualicen.
const VERSION = 'v2';
const CACHE = 'cellstore-' + VERSION;

const ARCHIVOS = [
  './',
  './index.html',
  './venta.html',
  './celulares.html',
  './accesorios.html',
  './hidrogel.html',
  './caja.html',
  './respaldo.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cada archivo por separado: si uno falla, los demás se guardan igual
    await Promise.all(ARCHIVOS.map((url) => cache.add(url).catch(() => {})));
    // Tailwind (CDN) se guarda para que funcione sin internet
    try {
      const r = await fetch('https://cdn.tailwindcss.com', { mode: 'no-cors' });
      await cache.put('https://cdn.tailwindcss.com', r);
    } catch (err) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tailwind: primero caché, y se refresca en segundo plano
  if (url.hostname === 'cdn.tailwindcss.com') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const guardado = await cache.match('https://cdn.tailwindcss.com');
      const red = fetch(req).then((r) => { cache.put('https://cdn.tailwindcss.com', r.clone()); return r; }).catch(() => null);
      return guardado || (await red) || Response.error();
    })());
    return;
  }

  // Archivos propios: primero internet (para ver cambios), y si no hay, la copia guardada
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        // no-cache: siempre pregunta al servidor si hay una versión nueva (evita ver archivos viejos)
        const r = await fetch(req, { cache: 'no-cache' });
        if (r && r.ok) cache.put(req, r.clone());
        return r;
      } catch (err) {
        const guardado = await cache.match(req, { ignoreSearch: true });
        if (guardado) return guardado;
        if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
      }
    })());
  }
});

/* ────────────────────────────────────────────────────────────────
   GRAMMAR.AI · SERVICE WORKER
   Cache strategy:
   - Shell files (HTML/CSS/JS): stale-while-revalidate
   - Config JSON: network-first (so module list updates appear)
   - Icons: cache-first
   - API calls: never cached (handled by browser, sent direct)
   ──────────────────────────────────────────────────────────────── */

const VERSION = 'gai-v1.0.1';
const SHELL_CACHE  = `${VERSION}-shell`;
const CONFIG_CACHE = `${VERSION}-config`;

const SHELL_URLS = [
  './',
  'index.html',
  'manifest.json',
  'assets/theme.css',
  'assets/home.css',
  'assets/settings.css',
  'modules/chat/chat.css',
  'modules/chat/view.html',
  'modules/chat/controller.js',
  'modules/chat/manifest.json',
  'core/app.js',
  'core/router.js',
  'core/loader.js',
  'core/home.js',
  'core/settings.js',
  'core/storage.js',
  'core/ui.js',
  'core/ai.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(c => c.addAll(SHELL_URLS).catch(err => console.warn('Cache addAll partial fail:', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache cross-origin (AI APIs, fonts, etc.)
  if (url.origin !== location.origin) return;

  // Config files: network-first
  if (url.pathname.includes('/config/') && url.pathname.endsWith('.json')) {
    e.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CONFIG_CACHE).then(c => c.put(req, copy));
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Shell: stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const networkPromise = fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(SHELL_CACHE).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || networkPromise;
    })
  );
});

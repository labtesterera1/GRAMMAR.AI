/* ────────────────────────────────────────────────────────────────
   ROUTER · home / module / settings, hash-based
   #/             → home
   #/m/<id>       → module
   #/settings     → settings
   ──────────────────────────────────────────────────────────────── */

const _listeners = new Set();

export function parseRoute() {
  const h = (location.hash || '#/').replace(/^#/, '');
  if (h === '/' || h === '') return { name: 'home' };
  if (h === '/settings')     return { name: 'settings' };
  const m = h.match(/^\/m\/([\w-]+)$/);
  if (m)                     return { name: 'module', id: m[1] };
  return { name: 'home' };
}

export function go(route) {
  if (route === 'home')          location.hash = '/';
  else if (route === 'settings') location.hash = '/settings';
  else if (route?.startsWith('m:')) location.hash = '/m/' + route.slice(2);
  else if (typeof route === 'string') location.hash = route;
}

export function onChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

window.addEventListener('hashchange', () => {
  const r = parseRoute();
  for (const fn of _listeners) {
    try { fn(r); } catch (e) { console.error(e); }
  }
});

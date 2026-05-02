/* ────────────────────────────────────────────────────────────────
   STORAGE · namespaced localStorage + Persistent Storage API
   ──────────────────────────────────────────────────────────────── */

const NS = 'gai.';

export const Storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch { return fallback; }
  },

  set(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage.set failed:', e);
      return false;
    }
  },

  remove(key) { localStorage.removeItem(NS + key); },

  keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) out.push(k.slice(NS.length));
    }
    return out;
  },

  snapshot() {
    const dump = {};
    for (const k of this.keys()) dump[k] = this.get(k, null);
    return dump;
  },

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('Invalid snapshot');
    for (const [k, v] of Object.entries(snapshot)) this.set(k, v);
  },

  clearAll() {
    for (const k of this.keys()) this.remove(k);
  },

  scope(prefix) {
    return {
      get: (key, fallback = null) => Storage.get(`${prefix}.${key}`, fallback),
      set: (key, value) => Storage.set(`${prefix}.${key}`, value),
      remove: (key) => Storage.remove(`${prefix}.${key}`),
      keys: () => Storage.keys().filter(k => k.startsWith(`${prefix}.`)).map(k => k.slice(prefix.length + 1))
    };
  }
};

/* ─── Persistent Storage API ─────────────────────────────────── */

export async function isPersisted() {
  if (!navigator.storage?.persisted) return false;
  try { return await navigator.storage.persisted(); } catch { return false; }
}

export async function requestPersist() {
  if (!navigator.storage?.persist) return false;
  try { return await navigator.storage.persist(); } catch { return false; }
}

export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null;
  try {
    const e = await navigator.storage.estimate();
    return { usage: e.usage || 0, quota: e.quota || 0 };
  } catch { return null; }
}

export function fmtBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return n.toFixed(n < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
}

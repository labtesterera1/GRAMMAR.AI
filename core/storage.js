/* ────────────────────────────────────────────────────────────────
   STORAGE · simple namespaced localStorage with JSON helpers
   Every module uses this. Single change point for export/import.
   ──────────────────────────────────────────────────────────────── */

const NS = 'gai.';

export const Storage = {
  /** Read a JSON value (or fallback). */
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  /** Write a JSON value. */
  set(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage.set failed:', e);
      return false;
    }
  },

  /** Remove a single key. */
  remove(key) {
    localStorage.removeItem(NS + key);
  },

  /** List all keys belonging to this app (without namespace prefix). */
  keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) out.push(k.slice(NS.length));
    }
    return out;
  },

  /** Get a snapshot of every app key as a plain object — used by export. */
  snapshot() {
    const dump = {};
    for (const k of this.keys()) {
      dump[k] = this.get(k, null);
    }
    return dump;
  },

  /** Replace storage from a snapshot — used by import. */
  restore(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Invalid snapshot');
    }
    for (const [k, v] of Object.entries(snapshot)) {
      this.set(k, v);
    }
  },

  /** Wipe all app keys (does not touch other apps). */
  clearAll() {
    for (const k of this.keys()) this.remove(k);
  }
};

/* Convenience for module-scoped keys: Storage.scope('chat').get('history') */
Storage.scope = function(prefix) {
  return {
    get: (key, fallback = null) => Storage.get(`${prefix}.${key}`, fallback),
    set: (key, value) => Storage.set(`${prefix}.${key}`, value),
    remove: (key) => Storage.remove(`${prefix}.${key}`),
    keys: () => Storage.keys().filter(k => k.startsWith(`${prefix}.`)).map(k => k.slice(prefix.length + 1))
  };
};

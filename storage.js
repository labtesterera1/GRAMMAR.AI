/* ────────────────────────────────────────────────────────────────
   STORAGE · namespaced localStorage + Persistent Storage API
   ──────────────────────────────────────────────────────────────── */

const NS = 'gai.';

/* ─── Module key prefixes — defines what each module owns ─── */
const MODULE_PREFIXES = {
  chat:       ['chat.'],
  paragraph:  ['paragraph.'],
  email:      ['email.'],
  translator: ['translator.'],
  exercise:   ['exercise.'],
  notes:      ['notes.'],
  rewrite:    ['rewrite.'],
  timezone:   ['timezone.'],
  settings:   ['workerUrl','mode','primary','key.','lang','fn.']
};

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

  /* ─── Raw snapshot (all keys) ─── */
  snapshot() {
    const dump = {};
    for (const k of this.keys()) dump[k] = this.get(k, null);
    return dump;
  },

  /* ─── Structured backup — clean per-module JSON ─── */
  structuredBackup(opts = {}) {
    const includeKeys  = opts.includeKeys  !== false;  // settings keys default true
    const includePinHash = opts.includePinHash !== false; // notes pin default true
    const allKeys = this.keys();

    function keysFor(prefixes) {
      return allKeys.filter(k => prefixes.some(p => k.startsWith(p)));
    }

    function pickModule(prefixes) {
      const obj = {};
      for (const k of keysFor(prefixes)) {
        // Skip API keys if not wanted
        if (!includeKeys && k.startsWith('key.')) continue;
        // Skip PIN hash if not wanted
        if (!includePinHash && k === 'notes.pinHash') continue;
        obj[k] = Storage.get(k, null);
      }
      return obj;
    }

    const now = new Date();
    return {
      _meta: {
        app:        'Grammar.AI',
        version:    Storage.get('version', '1.3.7') || '1.3.7',
        exportedAt: now.toISOString(),
        exportedOn: now.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' }),
        device:     navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
      },
      modules: {
        chat:       pickModule(MODULE_PREFIXES.chat),
        paragraph:  pickModule(MODULE_PREFIXES.paragraph),
        email:      pickModule(MODULE_PREFIXES.email),
        translator: pickModule(MODULE_PREFIXES.translator),
        exercise:   pickModule(MODULE_PREFIXES.exercise),
        notes:      pickModule(MODULE_PREFIXES.notes),
        rewrite:    pickModule(MODULE_PREFIXES.rewrite),
        timezone:   pickModule(MODULE_PREFIXES.timezone),
      },
      settings:   pickModule(MODULE_PREFIXES.settings)
    };
  },

  /* ─── Restore from structured backup ─── */
  restoreStructured(backup, opts = {}) {
    if (!backup || !backup.modules) throw new Error('Invalid backup format');
    const mode = opts.mode || 'full'; // full | merge | settings-only | notes-only

    function applyModule(moduleData) {
      if (!moduleData || typeof moduleData !== 'object') return;
      for (const [k, v] of Object.entries(moduleData)) {
        // Skip API keys unless explicitly included
        if (!opts.includeKeys && k.startsWith('key.')) continue;
        Storage.set(k, v);
      }
    }

    if (mode === 'settings-only') {
      applyModule(backup.settings);
      return;
    }

    if (mode === 'notes-only') {
      applyModule(backup.modules.notes);
      return;
    }

    if (mode === 'merge') {
      // Notes — keep newest version when duplicate id found
      const existing = Storage.scope('notes').get('notes', []);
      const imported = backup.modules.notes?.['notes.notes'] || [];
      const noteMap = new Map();
      // Add existing first
      existing.forEach(n => noteMap.set(n.id, n));
      // Imported wins if it has newer updatedAt
      imported.forEach(n => {
        const ex = noteMap.get(n.id);
        if (!ex || (n.updatedAt || 0) > (ex.updatedAt || 0)) {
          noteMap.set(n.id, n);
        }
      });
      Storage.scope('notes').set('notes', Array.from(noteMap.values()));

      // Chat history — keep all unique by ts
      const existingChat = Storage.scope('chat').get('history', []);
      const importedChat = backup.modules.chat?.['chat.history'] || [];
      const chatMap = new Map();
      existingChat.forEach(m => chatMap.set(m.ts, m));
      importedChat.forEach(m => chatMap.set(m.ts, m)); // imported wins on same ts
      const mergedChat = Array.from(chatMap.values()).sort((a,b) => a.ts - b.ts);
      Storage.scope('chat').set('history', mergedChat);

      // Translator history — keep all unique by ts
      const existingTr = Storage.scope('translator').get('history', []);
      const importedTr = backup.modules.translator?.['translator.history'] || [];
      const trMap = new Map();
      existingTr.forEach(m => trMap.set(m.ts, m));
      importedTr.forEach(m => trMap.set(m.ts, m));
      const mergedTr = Array.from(trMap.values()).sort((a,b) => b.ts - a.ts);
      Storage.scope('translator').set('history', mergedTr);

      // Other modules — apply imported (overwrite)
      for (const mod of ['paragraph','email','exercise','rewrite','timezone']) {
        applyModule(backup.modules[mod]);
      }
      applyModule(backup.settings);
      return;
    }

    // Full restore — apply everything
    for (const mod of Object.values(backup.modules)) applyModule(mod);
    applyModule(backup.settings);
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
      get:    (key, fallback = null) => Storage.get(`${prefix}.${key}`, fallback),
      set:    (key, value)           => Storage.set(`${prefix}.${key}`, value),
      remove: (key)                  => Storage.remove(`${prefix}.${key}`),
      keys:   ()                     => Storage.keys().filter(k => k.startsWith(`${prefix}.`)).map(k => k.slice(prefix.length + 1))
    };
  }
};

/* ─── Backup reminder — nudge every 7 days ─── */
export function checkBackupReminder() {
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const last = Storage.get('lastBackupAt', null);
  if (!last) return true; // never backed up
  return (Date.now() - new Date(last).getTime()) > SEVEN_DAYS;
}

export function markBackupDone() {
  Storage.set('lastBackupAt', new Date().toISOString());
}


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

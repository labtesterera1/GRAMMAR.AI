/* ────────────────────────────────────────────────────────────────
   AI CLIENT · Worker proxy + direct provider calls
   Mode:
     'worker-first' → try Worker, fall back to direct keys
     'worker-only'  → only Worker
     'direct-only'  → only direct keys, ignore Worker
   ──────────────────────────────────────────────────────────────── */

import { Storage } from './storage.js';

let _providers = null;
let _fallback  = [];

export async function loadProviders() {
  const r = await fetch('config/providers.json');
  const j = await r.json();
  _providers = j.providers;
  _fallback  = j.fallbackOrder;
  return j;
}

export function getProviders() { return _providers; }
export function getFallbackOrder() { return _fallback; }

/* ─── Keys ─── */
export function getKey(id) { return Storage.get(`keys.${id}`, '') || ''; }
export function setKey(id, key) { Storage.set(`keys.${id}`, (key || '').trim()); }
export function clearKey(id) { Storage.remove(`keys.${id}`); }
export function hasAnyKey() { return _fallback.some(id => !!getKey(id)); }

/* ─── Worker config ─── */
export function getWorkerUrl() { return Storage.get('worker.url', '') || ''; }
export function setWorkerUrl(u) { Storage.set('worker.url', (u || '').trim()); }
export function clearWorkerUrl() { Storage.remove('worker.url'); }
export function hasWorker() { return !!getWorkerUrl(); }

/* ─── Mode ─── */
export const MODES = ['worker-first', 'worker-only', 'direct-only'];
export function getMode() { return Storage.get('ai.mode', 'worker-first'); }
export function setMode(m) { if (MODES.includes(m)) Storage.set('ai.mode', m); }

/* ─── Primary provider ─── */
export function getPrimary() { return Storage.get('ai.primary', '') || ''; }
export function setPrimary(id) { Storage.set('ai.primary', id || ''); }

/** Resolve effective try-order: primary → fallback (skipping primary) */
function resolveOrder() {
  const order = [];
  const prim = getPrimary();
  if (prim && _providers?.[prim]) order.push(prim);
  for (const id of _fallback) if (!order.includes(id)) order.push(id);
  return order;
}

/* ─── Request builders ─── */

function buildDirect(provider, messages, opts) {
  const temperature = opts.temperature ?? 0.6;
  const maxTokens   = opts.maxTokens   ?? 1024;

  if (provider.format === 'openai') {
    return {
      url: provider.endpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.key}`
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      })
    };
  }

  if (provider.format === 'gemini') {
    const url = provider.endpoint.replace('{model}', provider.model) + `?key=${encodeURIComponent(opts.key)}`;
    const sys = messages.find(m => m.role === 'system');
    const turns = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const body = {
      contents: turns,
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    };
    if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
    return { url, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  throw new Error(`Unknown provider format: ${provider.format}`);
}

function parseDirect(provider, json) {
  if (provider.format === 'openai') {
    return json?.choices?.[0]?.message?.content?.trim() || '';
  }
  if (provider.format === 'gemini') {
    const parts = json?.candidates?.[0]?.content?.parts;
    return parts ? parts.map(p => p.text || '').join('').trim() : '';
  }
  return '';
}

/** Build the Worker request — Worker accepts a flexible payload. */
function buildWorker(messages, opts) {
  const url = getWorkerUrl();
  if (!url) throw new Error('Worker URL not set');
  return {
    url: url.replace(/\/$/, '') + (opts.path || '/api/chat'),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      provider: opts.preferred || getPrimary() || _fallback[0],
      temperature: opts.temperature ?? 0.6,
      maxTokens: opts.maxTokens ?? 1024
    })
  };
}

/** Worker response can be either OpenAI-shaped or {text:...}. */
function parseWorker(json) {
  if (!json) return '';
  if (typeof json === 'string') return json.trim();
  if (json.text) return String(json.text).trim();
  if (json.choices?.[0]?.message?.content) return json.choices[0].message.content.trim();
  if (json.candidates?.[0]?.content?.parts) {
    return json.candidates[0].content.parts.map(p => p.text || '').join('').trim();
  }
  return '';
}

/* ─── Public API ─── */

/**
 * @returns {Promise<{text:string, route:'worker'|string}>}
 */
export async function chat(messages, opts = {}) {
  if (!_providers) await loadProviders();

  const mode = getMode();
  const errors = [];

  // Try Worker first if applicable
  if ((mode === 'worker-first' || mode === 'worker-only') && hasWorker()) {
    try {
      const req = buildWorker(messages, opts);
      const r = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: opts.signal });
      if (r.ok) {
        const j = await r.json();
        const text = parseWorker(j);
        if (text) return { text, route: 'worker' };
        errors.push('worker: empty response');
      } else {
        const t = await r.text().catch(() => '');
        errors.push(`worker: HTTP ${r.status} ${t.slice(0,120)}`);
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      errors.push(`worker: ${e.message}`);
    }
    if (mode === 'worker-only') {
      const err = new Error('Worker call failed (worker-only mode)');
      err.details = errors;
      throw err;
    }
  }

  // Direct provider calls
  if (mode !== 'worker-only') {
    const order = opts.preferred && _providers[opts.preferred]
      ? [opts.preferred, ...resolveOrder().filter(id => id !== opts.preferred)]
      : resolveOrder();

    for (const id of order) {
      const prov = _providers[id];
      const key  = getKey(id);
      if (!key) { errors.push(`${id}: no key`); continue; }
      try {
        const req = buildDirect(prov, messages, { ...opts, key });
        const r = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: opts.signal });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          errors.push(`${id}: HTTP ${r.status} ${t.slice(0,120)}`);
          continue;
        }
        const j = await r.json();
        const text = parseDirect(prov, j);
        if (!text) { errors.push(`${id}: empty response`); continue; }
        return { text, route: id };
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        errors.push(`${id}: ${e.message}`);
      }
    }
  }

  const err = new Error('All routes failed');
  err.details = errors;
  throw err;
}

/* ─── Tests ─── */

export async function testProvider(id) {
  if (!_providers) await loadProviders();
  const prov = _providers[id];
  const key  = getKey(id);
  if (!prov) return { ok: false, msg: 'Unknown provider' };
  if (!key)  return { ok: false, msg: 'No API key set' };
  try {
    const req = buildDirect(prov, [
      { role: 'system', content: 'Reply with one word: OK' },
      { role: 'user',   content: 'ping' }
    ], { key, temperature: 0, maxTokens: 8 });
    const r = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { ok: false, msg: `HTTP ${r.status} ${t.slice(0,80)}` };
    }
    const j = await r.json();
    const text = parseDirect(prov, j);
    return text ? { ok: true, msg: 'Connected' } : { ok: false, msg: 'Empty response' };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

export async function testWorker() {
  if (!hasWorker()) return { ok: false, msg: 'No Worker URL' };
  try {
    const req = buildWorker(
      [{ role: 'system', content: 'Reply OK' }, { role: 'user', content: 'ping' }],
      { temperature: 0, maxTokens: 8 }
    );
    const r = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { ok: false, msg: `HTTP ${r.status} ${t.slice(0,80)}` };
    }
    const j = await r.json();
    const text = parseWorker(j);
    return text ? { ok: true, msg: 'Connected' } : { ok: false, msg: 'Empty response' };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

/* ─── Convenience aggregate ─── */
export const AI = {
  chat, testProvider, testWorker, loadProviders,
  getKey, setKey, clearKey, hasAnyKey,
  getProviders, getFallbackOrder,
  getWorkerUrl, setWorkerUrl, clearWorkerUrl, hasWorker,
  getMode, setMode, getPrimary, setPrimary, MODES,
  /** Is *any* AI route available? */
  hasAnyRoute() {
    const m = getMode();
    if (m === 'worker-only')  return hasWorker();
    if (m === 'direct-only')  return hasAnyKey();
    return hasWorker() || hasAnyKey();
  }
};

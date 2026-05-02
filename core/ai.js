/* ────────────────────────────────────────────────────────────────
   AI CLIENT · v1.1.1
   Worker contract matches NikGrammer-Agent-main exactly:
     POST <url>/api/chat  body: {messages, maxTokens}  → {text} or {error}
     GET  <url>/test                                    → 200/non-200
     GET  <url>/test/<provider>                         → 200/non-200
   Direct fallback: groq → cerebras → gemini → mistral.
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

/* ─── Worker ─── */
export function getWorkerUrl() {
  const u = Storage.get('worker.url', '') || '';
  return u.replace(/\/$/, '');
}
export function setWorkerUrl(u) { Storage.set('worker.url', (u || '').trim().replace(/\/$/, '')); }
export function clearWorkerUrl() { Storage.remove('worker.url'); }
export function hasWorker() { return !!getWorkerUrl(); }

/* ─── Mode ─── */
export const MODES = ['worker-first', 'worker-only', 'direct-only'];
export function getMode() { return Storage.get('ai.mode', 'worker-first'); }
export function setMode(m) { if (MODES.includes(m)) Storage.set('ai.mode', m); }

/* ─── Primary provider ─── */
export function getPrimary() { return Storage.get('ai.primary', '') || ''; }
export function setPrimary(id) { Storage.set('ai.primary', id || ''); }

function resolveOrder() {
  const order = [];
  const prim = getPrimary();
  if (prim && _providers?.[prim]) order.push(prim);
  for (const id of _fallback) if (!order.includes(id)) order.push(id);
  return order;
}

/* ─── Timeout helper ─── */
function timeoutSignal(ms) {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(ms);
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/* ─── Direct provider request builders ─── */

function buildDirect(provider, messages, opts) {
  const temperature = opts.temperature ?? 0.6;
  const maxTokens   = opts.maxTokens   ?? 1200;

  if (provider.format === 'openai') {
    return {
      url: provider.endpoint,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${opts.key}` },
      body: JSON.stringify({ model: provider.model, messages, temperature, max_tokens: maxTokens, stream: false })
    };
  }
  if (provider.format === 'gemini') {
    const url = provider.endpoint.replace('{model}', provider.model) + `?key=${encodeURIComponent(opts.key)}`;
    const sys = messages.find(m => m.role === 'system');
    const turns = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const body = { contents: turns, generationConfig: { temperature, maxOutputTokens: maxTokens } };
    if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
    return { url, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }
  throw new Error(`Unknown provider format: ${provider.format}`);
}

function parseDirect(provider, json) {
  if (provider.format === 'openai') return json?.choices?.[0]?.message?.content?.trim() || '';
  if (provider.format === 'gemini') {
    const parts = json?.candidates?.[0]?.content?.parts;
    return parts ? parts.map(p => p.text || '').join('').trim() : '';
  }
  return '';
}

/* ─── Public chat ─── */

/**
 * @returns {Promise<{text:string, route:'worker'|string}>}
 */
export async function chat(messages, opts = {}) {
  if (!_providers) await loadProviders();
  const mode = getMode();
  const errors = [];
  const maxTokens = opts.maxTokens ?? 1200;

  // ── Worker route ──
  if ((mode === 'worker-first' || mode === 'worker-only') && hasWorker()) {
    try {
      const url = getWorkerUrl() + '/api/chat';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, maxTokens }),
        signal: opts.signal || timeoutSignal(45000)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        errors.push(`worker: ${data.error || 'HTTP ' + r.status}`);
      } else if (!data.text) {
        errors.push('worker: empty response');
      } else {
        return { text: String(data.text).trim(), route: 'worker' };
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      if (e.message.includes('Failed to fetch')) errors.push('worker: cannot reach (check URL/CORS)');
      else if (e.name === 'TimeoutError') errors.push('worker: timeout 45s');
      else errors.push(`worker: ${e.message}`);
    }
    if (mode === 'worker-only') {
      const err = new Error('Worker call failed (worker-only mode)');
      err.details = errors;
      throw err;
    }
  }

  // ── Direct provider route ──
  if (mode !== 'worker-only') {
    const order = opts.preferred && _providers[opts.preferred]
      ? [opts.preferred, ...resolveOrder().filter(id => id !== opts.preferred)]
      : resolveOrder();

    for (const id of order) {
      const prov = _providers[id];
      const key  = getKey(id);
      if (!key) { errors.push(`${id}: no key`); continue; }
      try {
        const req = buildDirect(prov, messages, { ...opts, key, maxTokens });
        const r = await fetch(req.url, {
          method: 'POST', headers: req.headers, body: req.body,
          signal: opts.signal || timeoutSignal(45000)
        });
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

  // If Worker is set, use Worker's /test/<id> endpoint (matches old app)
  if (hasWorker()) {
    try {
      const r = await fetch(getWorkerUrl() + '/test/' + id, { signal: timeoutSignal(15000) });
      return r.ok ? { ok: true, msg: 'Connected (via Worker)' } : { ok: false, msg: `HTTP ${r.status}` };
    } catch (e) {
      // fall through to direct test
    }
  }

  if (!key) return { ok: false, msg: 'No API key set' };
  try {
    const req = buildDirect(prov, [
      { role: 'system', content: 'Reply with one word: OK' },
      { role: 'user',   content: 'ping' }
    ], { key, temperature: 0, maxTokens: 8 });
    const r = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: timeoutSignal(15000) });
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
    const r = await fetch(getWorkerUrl() + '/test', { signal: timeoutSignal(10000) });
    return r.ok ? { ok: true, msg: 'Connected' } : { ok: false, msg: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

/* ─── Aggregate ─── */
export const AI = {
  chat, testProvider, testWorker, loadProviders,
  getKey, setKey, clearKey, hasAnyKey,
  getProviders, getFallbackOrder,
  getWorkerUrl, setWorkerUrl, clearWorkerUrl, hasWorker,
  getMode, setMode, getPrimary, setPrimary, MODES,
  hasAnyRoute() {
    const m = getMode();
    if (m === 'worker-only')  return hasWorker();
    if (m === 'direct-only')  return hasAnyKey();
    return hasWorker() || hasAnyKey();
  }
};

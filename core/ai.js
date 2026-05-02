/* ────────────────────────────────────────────────────────────────
   AI CLIENT · direct browser calls, no Worker/backend
   Reads providers.json + user keys, tries fallbackOrder until one
   succeeds. Modules just call AI.chat(messages, opts).
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

export function getKey(providerId) {
  return Storage.get(`keys.${providerId}`, '') || '';
}
export function setKey(providerId, key) {
  Storage.set(`keys.${providerId}`, (key || '').trim());
}
export function clearKey(providerId) { Storage.remove(`keys.${providerId}`); }
export function hasAnyKey() { return _fallback.some(id => !!getKey(id)); }

/** Build the request body in the right format for each provider. */
function buildRequest(provider, messages, opts) {
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
    // Gemini has a different shape: contents[] with role + parts, key in URL
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
    return {
      url,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
  }

  throw new Error(`Unknown provider format: ${provider.format}`);
}

/** Parse provider-specific responses into plain text. */
function parseResponse(provider, json) {
  if (provider.format === 'openai') {
    return json?.choices?.[0]?.message?.content?.trim() || '';
  }
  if (provider.format === 'gemini') {
    const parts = json?.candidates?.[0]?.content?.parts;
    if (!parts) return '';
    return parts.map(p => p.text || '').join('').trim();
  }
  return '';
}

/**
 * Chat — main entry point.
 * @param {Array<{role:string, content:string}>} messages
 * @param {Object} opts { temperature, maxTokens, preferred, signal }
 * @returns {Promise<{text:string, provider:string}>}
 */
export async function chat(messages, opts = {}) {
  if (!_providers) await loadProviders();

  // Build try-order: preferred first if given, then fallback list
  const order = [];
  if (opts.preferred && _providers[opts.preferred]) order.push(opts.preferred);
  for (const id of _fallback) if (!order.includes(id)) order.push(id);

  const errors = [];
  for (const id of order) {
    const prov = _providers[id];
    const key  = getKey(id);
    if (!key) { errors.push(`${id}: no key`); continue; }

    try {
      const req = buildRequest(prov, messages, { ...opts, key });
      const r = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: opts.signal });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        errors.push(`${id}: HTTP ${r.status} ${t.slice(0,120)}`);
        continue;
      }
      const j = await r.json();
      const text = parseResponse(prov, j);
      if (!text) { errors.push(`${id}: empty response`); continue; }
      return { text, provider: id };
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      errors.push(`${id}: ${e.message}`);
    }
  }
  const err = new Error('All providers failed');
  err.details = errors;
  throw err;
}

/** Quick test — used by Settings → Test Connection. */
export async function testProvider(id) {
  if (!_providers) await loadProviders();
  const prov = _providers[id];
  const key  = getKey(id);
  if (!prov) return { ok: false, msg: 'Unknown provider' };
  if (!key)  return { ok: false, msg: 'No API key set' };
  try {
    const req = buildRequest(prov, [
      { role: 'system', content: 'Reply with the single word: OK' },
      { role: 'user',   content: 'ping' }
    ], { key, temperature: 0, maxTokens: 10 });
    const r = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { ok: false, msg: `HTTP ${r.status} ${t.slice(0,80)}` };
    }
    const j = await r.json();
    const text = parseResponse(prov, j);
    return text ? { ok: true, msg: 'Connected' } : { ok: false, msg: 'Empty response' };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

export const AI = { chat, testProvider, getKey, setKey, clearKey, hasAnyKey, getProviders, getFallbackOrder, loadProviders };

/* ────────────────────────────────────────────────────────────────
   MODULE LOADER · the heart of the SmartApp
   Reads modules.json. For each module:
   • status=ready  → lazy import controller.js, render view.html
   • status=soon   → render coming-soon screen
   Adding a new module = drop folder + one entry in modules.json.
   ──────────────────────────────────────────────────────────────── */

import { esc } from './ui.js';

let _modules = [];

export async function loadModulesConfig() {
  const r = await fetch('config/modules.json');
  const j = await r.json();
  _modules = (j.modules || []).filter(m => m.showInNav !== false).sort((a, b) => a.order - b.order);
  return _modules;
}

export function getModules() { return _modules; }
export function getModule(id) { return _modules.find(m => m.id === id) || null; }

/** Mounted modules cache so we don't re-fetch on every navigation. */
const _mounted = new Map();

/**
 * Load and render a module into a host element.
 * @param {string} id      module id
 * @param {HTMLElement} host
 */
export async function mountModule(id, host) {
  const mod = getModule(id);
  if (!mod) {
    host.innerHTML = renderError(`Module "${esc(id)}" not found`);
    return null;
  }

  // Soon → static placeholder, no fetches
  if (mod.status !== 'ready') {
    host.innerHTML = renderSoon(mod);
    return null;
  }

  // Already mounted? Just call onShow if it exists.
  if (_mounted.has(id)) {
    const ctrl = _mounted.get(id);
    if (host !== ctrl._host) {
      host.innerHTML = '';
      host.appendChild(ctrl._root);
      ctrl._host = host;
    }
    if (typeof ctrl.onShow === 'function') ctrl.onShow();
    return ctrl;
  }

  // First mount
  try {
    const [viewHtml, ctrlMod] = await Promise.all([
      fetch(`modules/${id}/view.html`).then(r => r.text()),
      import(`../modules/${id}/controller.js`)
    ]);

    const root = document.createElement('div');
    root.className = `module module-${id}`;
    root.innerHTML = viewHtml;
    host.innerHTML = '';
    host.appendChild(root);

    // Controllers export a default factory: ({ root, module }) => { onShow?, onHide? }
    const factory = ctrlMod.default || ctrlMod.init;
    const ctrl = factory ? (await factory({ root, module: mod })) || {} : {};
    ctrl._root = root;
    ctrl._host = host;
    _mounted.set(id, ctrl);
    if (typeof ctrl.onShow === 'function') ctrl.onShow();
    return ctrl;
  } catch (e) {
    console.error(`Failed to mount module ${id}:`, e);
    host.innerHTML = renderError(`Failed to load: ${esc(e.message)}`);
    return null;
  }
}

export function unmountAll() {
  for (const ctrl of _mounted.values()) {
    if (typeof ctrl.onHide === 'function') {
      try { ctrl.onHide(); } catch (e) { console.warn(e); }
    }
  }
}

/* ──────────── view templates ──────────── */

function renderSoon(mod) {
  return `
    <div class="page-inner">
      <div class="kicker">
        <span>MOD ${esc(mod.num)} / ${esc(mod.name).toUpperCase()}</span>
        <span class="badge badge-soon">SOON</span>
      </div>
      <div class="headline">${esc(mod.name)}</div>
      <div class="subline">
        <span>${esc(mod.tagline)}</span>
        <span>SCHEDULED</span>
      </div>
      <div class="ticks">${'<i></i>'.repeat(40)}</div>

      <div class="frame subtle" style="margin-top:24px;padding:32px 20px;text-align:center;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div style="font-size:42px;margin-bottom:14px;opacity:0.5;">${esc(mod.icon)}</div>
        <div class="serif" style="font-size:22px;margin-bottom:8px;">Coming next</div>
        <div class="mono" style="font-size:11px;color:var(--muted);letter-spacing:0.1em;line-height:1.7;max-width:300px;margin:0 auto;">
          This module is queued for the next build.<br>
          Once activated it will appear here automatically.
        </div>
        <div class="ticks" style="justify-content:center;margin-top:18px;">${'<i></i>'.repeat(20)}</div>
        <div class="mono" style="font-size:9px;color:var(--dim);letter-spacing:0.18em;text-transform:uppercase;margin-top:14px;">
          MOD ${esc(mod.num)} · STANDBY
        </div>
      </div>
    </div>
  `;
}

function renderError(msg) {
  return `
    <div class="page-inner">
      <div class="frame" style="padding:24px;border-color:var(--rust-dim);">
        <span class="c tl" style="border-color:var(--rust);"></span>
        <span class="c tr" style="border-color:var(--rust);"></span>
        <span class="c bl" style="border-color:var(--rust);"></span>
        <span class="c br" style="border-color:var(--rust);"></span>
        <div class="kicker rust">ERROR</div>
        <div class="serif" style="font-size:24px;margin-top:8px;">${msg}</div>
      </div>
    </div>
  `;
}

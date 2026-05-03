/* ────────────────────────────────────────────────────────────────
   MODULE LOADER · loads ready modules, renders soon placeholders
   ──────────────────────────────────────────────────────────────── */

import { esc } from './ui.js';
import { go } from './router.js';

let _modules = [];

/* ─── Inject ← HOME back button into module kicker rows ─── */
function injectBackButton(root) {
  const kickers = root.querySelectorAll('.kicker');
  kickers.forEach(k => {
    // Only inject once and only into module kickers (not sheets)
    if (k.querySelector('.back-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'back-btn';
    btn.title = 'Back to Home';
    btn.innerHTML = '← HOME';
    btn.addEventListener('click', () => go('home'));
    k.insertBefore(btn, k.firstChild);
  });
}

export async function loadModulesConfig() {
  const r = await fetch('config/modules.json');
  const j = await r.json();
  _modules = (j.modules || []).filter(m => m.showInNav !== false).sort((a, b) => a.order - b.order);
  return _modules;
}

export function getModules() { return _modules; }
export function getModule(id) { return _modules.find(m => m.id === id) || null; }

const _mounted = new Map();

export async function mountModule(id, host) {
  const mod = getModule(id);
  if (!mod) {
    host.innerHTML = renderError(`Module "${esc(id)}" not found`);
    return null;
  }

  if (mod.status !== 'ready') {
    host.innerHTML = renderSoon(mod);
    return null;
  }

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

    // Inject ← HOME into every kicker row after mount
    injectBackButton(root);

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
      <div class="ticks">${'<i></i>'.repeat(48)}</div>

      <div class="frame subtle" style="margin-top:24px;padding:32px 20px;text-align:center;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div style="font-size:48px;margin-bottom:16px;opacity:0.45;">${esc(mod.icon)}</div>
        <div class="serif" style="font-size:26px;margin-bottom:10px;">Coming next</div>
        <div class="mono" style="font-size:11px;color:var(--muted);letter-spacing:0.1em;line-height:1.7;max-width:320px;margin:0 auto;">
          This module is queued for the next build.<br>
          Once activated it will appear here automatically.
        </div>
        <div class="ticks" style="justify-content:center;margin-top:22px;">${'<i></i>'.repeat(20)}</div>
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

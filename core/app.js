/* ────────────────────────────────────────────────────────────────
   APP · v1.1.0 · orchestrator
   - Boots config, providers, modules
   - Builds side-rail (desktop) + bottom nav (mobile)
   - Routes to home / settings / module/<id>
   - Requests persistent storage on first boot
   - Keyboard shortcuts: '/' focus, 'Esc' close sheets, 'g h', 'g s'
   ──────────────────────────────────────────────────────────────── */

import { $, esc } from './ui.js';
import { Storage, requestPersist, isPersisted } from './storage.js';
import { AI } from './ai.js';
import { loadModulesConfig, getModules, getModule, mountModule } from './loader.js';
import { parseRoute, onChange, go } from './router.js';
import { renderHome, setVersionInfo as setHomeVer } from './home.js';
import { renderSettings, setVersionInfo as setSettingsVer } from './settings.js';

const $$$ = (sel) => document.querySelectorAll(sel);

let _versionInfo = null;
const _moduleHosts = new Map();

async function boot() {
  // Load configs in parallel
  const [versionRes, modulesRes, _providersRes] = await Promise.all([
    fetch('config/version.json').then(r => r.json()),
    loadModulesConfig(),
    AI.loadProviders()
  ]);
  _versionInfo = versionRes;
  setHomeVer(versionRes);
  setSettingsVer(versionRes);

  // Brand
  $('#brand-name').textContent = versionRes.name || 'Grammar.AI';
  $('#brand-ver').textContent = 'v' + (versionRes.version || '1.1.0');

  // Build pages
  const app = $('#app-content');
  const homePage = pageEl('home'); app.appendChild(homePage);
  const settingsPage = pageEl('settings'); app.appendChild(settingsPage);
  for (const m of getModules()) {
    const p = pageEl('module-' + m.id);
    app.appendChild(p);
    _moduleHosts.set(m.id, p);
  }

  // Build navs
  buildSideRail();
  buildBottomNav();

  // Top bar buttons
  $('#nav-home').addEventListener('click', () => go('home'));
  $('#nav-settings').addEventListener('click', () => go('settings'));

  // Routes
  onChange(handleRoute);
  await handleRoute(parseRoute());

  // Persistent storage — silent attempt on first boot, retry on re-visit
  const persisted = await isPersisted();
  if (!persisted && navigator.storage?.persist) {
    requestPersist().catch(() => {});
  }

  // Keyboard shortcuts (desktop)
  setupShortcuts();

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW reg failed', e));
  }
}

function pageEl(name) {
  const p = document.createElement('section');
  p.className = 'page';
  p.id = 'page-' + name;
  return p;
}

/* ─── Side rail (desktop) ─── */
function buildSideRail() {
  const rail = $('#side-rail');
  if (!rail) return;
  const mods = getModules();
  rail.innerHTML = `
    <button class="side-btn" data-target="__home" data-route="home">
      <span class="icn">⌂</span><span>Home</span>
    </button>

    <div class="side-section">Modules</div>

    ${mods.map(m => `
      <button class="side-btn" data-target="${esc(m.id)}" data-route="m:${esc(m.id)}" ${m.status === 'ready' ? '' : 'disabled'}>
        <span class="icn">${esc(m.icon)}</span>
        <span>${esc(m.name)}</span>
        ${m.status === 'ready'
          ? `<span class="num">${esc(m.num)}</span>`
          : `<span class="soon-tag">SOON</span>`}
      </button>
    `).join('')}

    <div class="side-section">System</div>
    <button class="side-btn" data-target="__settings" data-route="settings">
      <span class="icn">⚙</span><span>Settings</span>
    </button>

    <div class="side-foot">
      <div>v${esc(_versionInfo?.version || '1.1.0')}</div>
      <div>${esc(_versionInfo?.build || '—')}</div>
      <div class="lime">● LOCAL · NO BACKEND</div>
    </div>
  `;
  rail.querySelectorAll('.side-btn').forEach(b => {
    if (b.disabled) return;
    b.addEventListener('click', () => go(b.dataset.route));
  });
}

/* ─── Bottom nav (mobile) ─── */
function buildBottomNav() {
  const nav = $('#bnav-inner');
  if (!nav) return;
  const mods = getModules();
  nav.innerHTML = '';
  nav.appendChild(navBtn({ id: '__home', label: 'Home', icn: '⌂', route: 'home' }));
  for (const m of mods) {
    nav.appendChild(navBtn({ id: m.id, label: m.name, icn: m.icon, route: 'm:' + m.id, status: m.status }));
  }
}

function navBtn({ id, label, icn, route, status }) {
  const b = document.createElement('button');
  b.className = 'bnav-btn';
  b.dataset.target = id;
  b.innerHTML = `
    <span class="icn">${esc(icn || '·')}</span>
    <span>${esc((label || '').slice(0,5).toUpperCase())}</span>
    ${status === 'soon' ? '<span class="dot-soon"></span>' : ''}
  `;
  b.addEventListener('click', () => go(route));
  return b;
}

function setNavActive(targetId) {
  $$$('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
  $$$('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.target === targetId));
  // Topbar buttons
  $('#nav-home')?.classList.toggle('active', targetId === '__home');
  $('#nav-settings')?.classList.toggle('active', targetId === '__settings');
  // Topbar route label (desktop)
  const lbl = $('#topbar-route');
  if (lbl) {
    if (targetId === '__home') lbl.textContent = '/ HOME';
    else if (targetId === '__settings') lbl.textContent = '/ SETTINGS';
    else {
      const m = getModule(targetId);
      lbl.textContent = m ? `/ ${m.name.toUpperCase()}` : '';
    }
  }
}

async function handleRoute(r) {
  $$$('.page').forEach(p => p.classList.remove('active'));

  if (r.name === 'home') {
    const host = $('#page-home');
    renderHome(host);
    host.classList.add('active');
    setNavActive('__home');
    return;
  }

  if (r.name === 'settings') {
    const host = $('#page-settings');
    await renderSettings(host);
    host.classList.add('active');
    setNavActive('__settings');
    return;
  }

  if (r.name === 'module') {
    const host = _moduleHosts.get(r.id);
    if (!host) { go('home'); return; }
    host.classList.add('active');
    setNavActive(r.id);
    await mountModule(r.id, host);
    return;
  }
}

/* ─── Keyboard shortcuts ─── */
function setupShortcuts() {
  let gPressed = false;
  let gTimer = null;
  document.addEventListener('keydown', (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    const inField = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

    // Esc closes sheets
    if (e.key === 'Escape') {
      const sb = document.querySelector('.sheet-backdrop.show');
      if (sb) sb.click();
    }

    if (inField) return;

    // '/' focuses chat composer
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      const composer = document.querySelector('#composer-input');
      if (composer) { e.preventDefault(); composer.focus(); }
    }

    // 'g' starts a sequence: 'g h' = home, 'g s' = settings, 'g c' = chat
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
      gPressed = true;
      clearTimeout(gTimer);
      gTimer = setTimeout(() => gPressed = false, 800);
      return;
    }
    if (gPressed) {
      gPressed = false;
      clearTimeout(gTimer);
      if (e.key === 'h') { go('home'); }
      else if (e.key === 's') { go('settings'); }
      else if (e.key === 'c') { go('m:chat'); }
    }
  });
}

// Boot
boot().catch(e => {
  console.error('Boot failed', e);
  document.body.innerHTML = `<pre style="color:#c97a5a;padding:24px;font-family:monospace;">Boot failed:\n${esc(e.message)}\n\n${esc(e.stack || '')}</pre>`;
});

// Expose for debugging
window.GAI = { Storage, AI, getModules, getModule, go, version: () => _versionInfo };

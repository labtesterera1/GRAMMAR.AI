/* ────────────────────────────────────────────────────────────────
   APP · orchestrator / boot
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc } from './ui.js';
import { Storage } from './storage.js';
import { AI } from './ai.js';
import { loadModulesConfig, getModules, getModule, mountModule } from './loader.js';
import { parseRoute, onChange, go } from './router.js';
import { renderHome, setVersionInfo as setHomeVer } from './home.js';
import { renderSettings, setVersionInfo as setSettingsVer } from './settings.js';

const $$$ = (sel) => document.querySelectorAll(sel);

let _versionInfo = null;
let _moduleHosts = new Map(); // id -> div

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
  $('#brand-ver').textContent = 'v' + (versionRes.version || '1.0.0');

  // Build pages: home, settings, plus one per module
  const app = $('#app');

  const homePage = pageEl('home');
  app.appendChild(homePage);
  const settingsPage = pageEl('settings');
  app.appendChild(settingsPage);

  for (const m of getModules()) {
    const p = pageEl('module-' + m.id);
    app.appendChild(p);
    _moduleHosts.set(m.id, p);
  }

  // Build bottom nav
  buildBottomNav();

  // Top bar buttons
  $('#nav-home').addEventListener('click', () => go('home'));
  $('#nav-settings').addEventListener('click', () => go('settings'));

  // Route changes
  onChange(handleRoute);
  handleRoute(parseRoute());

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

function buildBottomNav() {
  const nav = $('#bnav-inner');
  nav.innerHTML = '';
  const mods = getModules();

  // Home button first
  nav.appendChild(navBtn({ id: '__home', label: 'Home', icn: '⌂', route: 'home' }));

  for (const m of mods) {
    nav.appendChild(navBtn({
      id: m.id,
      label: m.name,
      icn: m.icon,
      route: 'm:' + m.id,
      status: m.status
    }));
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
  $$$('.bnav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.target === targetId);
  });
}

async function handleRoute(r) {
  // Hide all pages
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
    renderSettings(host);
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

// Boot
boot().catch(e => {
  console.error('Boot failed', e);
  document.body.innerHTML = `<pre style="color:#c97a5a;padding:24px;font-family:monospace;">Boot failed:\n${esc(e.message)}\n\n${esc(e.stack || '')}</pre>`;
});

// Expose for debugging
window.GAI = { Storage, AI, getModules, getModule, go, version: () => _versionInfo };

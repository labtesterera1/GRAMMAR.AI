/* ────────────────────────────────────────────────────────────────
   HOME SCREEN · modules grid
   Renders the "Sign-Up Kit / Reader / Vault" style cards.
   ──────────────────────────────────────────────────────────────── */

import { esc } from './ui.js';
import { getModules } from './loader.js';
import { go } from './router.js';
import { AI } from './ai.js';

let _versionInfo = null;

export function setVersionInfo(v) { _versionInfo = v; }

export function renderHome(host) {
  const mods = getModules();
  const ready = mods.filter(m => m.status === 'ready').length;
  const soon  = mods.filter(m => m.status === 'soon').length;
  const keysSet = AI.getFallbackOrder().filter(id => !!AI.getKey(id)).length;

  host.innerHTML = `
    <div class="page-inner home">
      <div class="kicker">
        <span>HOME · OVERVIEW</span>
        <span class="lime">● v${esc(_versionInfo?.version || '1.0.0')}</span>
      </div>
      <div class="headline">Grammar.AI</div>
      <div class="subline">
        <span>${esc(_versionInfo?.tagline || 'SmartApp · Modular · Local-First')}</span>
        <span>${ready} READY · ${soon} SOON</span>
      </div>
      <div class="ticks">${'<i></i>'.repeat(48)}</div>

      <!-- Status strip -->
      <div class="status-strip">
        <div class="status-cell">
          <div class="status-lbl">PROVIDERS</div>
          <div class="status-val ${keysSet ? 'lime' : 'muted'}">${keysSet}/4</div>
          <div class="status-sub">${keysSet ? 'KEYS ACTIVE' : 'NOT CONFIGURED'}</div>
        </div>
        <div class="status-cell">
          <div class="status-lbl">MODULES</div>
          <div class="status-val lime">${ready}<span class="muted">/${ready+soon}</span></div>
          <div class="status-sub">READY</div>
        </div>
        <div class="status-cell">
          <div class="status-lbl">STORAGE</div>
          <div class="status-val">LOCAL</div>
          <div class="status-sub">NO BACKEND</div>
        </div>
      </div>

      <div class="s-ttl"><span>MODULES</span></div>

      <div class="mod-grid">
        ${mods.map(renderCard).join('')}
      </div>

      <div class="footer-blk">
        <div class="ticks">${'<i></i>'.repeat(48)}</div>
        <div class="footer-row">
          <span class="mono dim tu" style="font-size:9px;">BUILD ${esc(_versionInfo?.build || '—')}</span>
          <span class="mono dim tu" style="font-size:9px;">${esc((_versionInfo?.channel || 'stable').toUpperCase())} CHANNEL</span>
        </div>
      </div>
    </div>
  `;

  // Wire clicks
  host.querySelectorAll('[data-mod]').forEach(card => {
    const id = card.getAttribute('data-mod');
    const status = card.getAttribute('data-status');
    if (status === 'ready') {
      card.addEventListener('click', () => go('m:' + id));
    }
  });
}

function renderCard(m) {
  const ready = m.status === 'ready';
  return `
    <button class="mod-card frame ${ready ? '' : 'subtle'}" data-mod="${esc(m.id)}" data-status="${esc(m.status)}" ${ready ? '' : 'disabled'}>
      <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
      <span class="mod-num">${esc(m.num)}</span>
      <div class="mod-card-title serif">${esc(m.name)}</div>
      <div class="mod-card-tagline mono">${esc(m.tagline)}</div>
      <div class="mod-card-foot">
        <span class="badge ${ready ? 'badge-ready' : 'badge-soon'}">${ready ? 'READY' : 'SOON'}</span>
        <span class="mod-arrow">${ready ? '→' : '··'}</span>
      </div>
    </button>
  `;
}

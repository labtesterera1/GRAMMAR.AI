/* ────────────────────────────────────────────────────────────────
   SETTINGS · v1.2.0
   Sections: Install · Providers · Worker · Mode · Storage · Data · About
   ──────────────────────────────────────────────────────────────── */

import { esc, $, $$, toast, downloadFile, pickFile, readFileAsText } from './ui.js';
import { AI } from './ai.js';
import { Storage, isPersisted, requestPersist, storageEstimate, fmtBytes } from './storage.js';

let _versionInfo = null;
export function setVersionInfo(v) { _versionInfo = v; }

/** Get install prompt from app.js — lazy import to avoid circular dep */
async function getPrompt() {
  try {
    const m = await import('./app.js');
    return m.getInstallPrompt ? m.getInstallPrompt() : null;
  } catch { return null; }
}
async function clearPrompt() {
  try { const m = await import('./app.js'); m.clearInstallPrompt?.(); } catch {}
}

/** Build a nicely-named export filename */
function exportFilename(scope = 'AllModules') {
  const v = _versionInfo?.version || '1.0.0';
  const d = new Date().toISOString().slice(0, 10);
  return `Grammar.AI_v${v}_${scope}_${d}.json`;
}
function exportFilenameTxt(scope = 'AllModules') {
  const v = _versionInfo?.version || '1.0.0';
  const d = new Date().toISOString().slice(0, 10);
  return `Grammar.AI_v${v}_${scope}_${d}.txt`;
}

export async function renderSettings(host) {
  const v = _versionInfo || {};
  const providers = AI.getProviders() || {};
  const order     = AI.getFallbackOrder() || [];
  const prompt    = await getPrompt();
  const isInstalled = window.matchMedia?.('(display-mode: standalone)').matches
                   || window.navigator?.standalone === true;

  host.innerHTML = `
    <div class="page-inner settings">
      <div class="kicker">
        <span>HOME · SETTINGS</span>
        <span class="lime">v${esc(v.version || '1.2.0')}</span>
      </div>
      <div class="headline">Settings</div>
      <div class="subline">
        <span>INSTALL · PROVIDERS · WORKER · STORAGE · DATA</span>
        <span>LOCAL · NO BACKEND</span>
      </div>
      <div class="ticks">${'<i></i>'.repeat(48)}</div>

      <div class="set-grid">

        <!-- ─── INSTALL APP ─────────────────────────────────────── -->
        <div class="set-card full">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="set-card-hd">
            <span class="set-card-hd-l">INSTALL APP</span>
            <span class="prov-badge ${isInstalled ? 'lime' : 'dim'}">${isInstalled ? '● INSTALLED' : prompt ? '● AVAILABLE' : '● NOT SUPPORTED'}</span>
          </div>
          ${isInstalled ? `
            <div class="mono" style="font-size:12px;line-height:1.7;color:var(--muted);">
              Grammar.AI is already installed on this device. You can find it on your home screen or desktop.
            </div>
          ` : prompt ? `
            <div class="mono" style="font-size:12px;line-height:1.7;color:var(--text);">
              Install Grammar.AI as an app on this device. It will appear on your home screen, work offline, and launch like a native app.
            </div>
            <button class="btn btn-primary mt-12" id="install-btn" style="width:100%;">
              ⬇ INSTALL GRAMMAR.AI
            </button>
          ` : `
            <div class="mono" style="font-size:12px;line-height:1.7;color:var(--muted);">
              Install is not available on this browser. On Android, use <strong>Chrome</strong> → menu → <em>Add to Home Screen</em>. On desktop, use Chrome → address bar install icon.
            </div>
          `}
        </div>

        <!-- ─── PROVIDERS ─────────────────────────────────────── -->
        <div class="set-card lime full">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="set-card-hd">
            <span class="set-card-hd-l">PROVIDERS · <span class="num">${String(order.length).padStart(2,'0')}</span></span>
            <button class="btn btn-icon" id="test-all">▶ TEST ALL</button>
          </div>
          <div class="prov-list" id="prov-list">
            ${order.map(id => renderProvider(id, providers[id])).join('')}
          </div>
          <div class="mode-help">
            ★ marks the primary provider — tried first in Direct mode.
          </div>
        </div>

        <!-- ─── WORKER ─────────────────────────────────────── -->
        <div class="set-card">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="set-card-hd">
            <span class="set-card-hd-l">CLOUDFLARE WORKER</span>
            <span class="prov-badge ${AI.hasWorker() ? 'lime' : 'dim'}" id="worker-badge">${AI.hasWorker() ? '● SET' : '● EMPTY'}</span>
          </div>
          <div class="prov-input-row">
            <input class="prov-input" id="worker-url" type="url"
              placeholder="https://your-worker.workers.dev"
              value="${esc(AI.getWorkerUrl())}"
              autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
          </div>
          <div class="prov-actions">
            <button id="worker-save">SAVE</button>
            <button id="worker-clear">CLEAR</button>
            <button id="worker-test">TEST</button>
          </div>
          <div class="mode-help">Worker handles auth + key storage server-side. No API keys needed when using Worker-only mode.</div>
        </div>

        <!-- ─── AI MODE ─────────────────────────────────────── -->
        <div class="set-card">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="set-card-hd">
            <span class="set-card-hd-l">AI ROUTE MODE</span>
          </div>
          <div class="mode-row" id="mode-row">
            ${renderModeBtn('worker-first', 'Worker first', AI.getMode())}
            ${renderModeBtn('worker-only',  'Worker only',  AI.getMode())}
            ${renderModeBtn('direct-only',  'Direct keys',  AI.getMode())}
          </div>
          <div class="mode-help" id="mode-help">${esc(modeHelp(AI.getMode()))}</div>
        </div>

        <!-- ─── STORAGE ─────────────────────────────────────── -->
        <div class="set-card">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="set-card-hd">
            <span class="set-card-hd-l">STORAGE</span>
            <button class="btn btn-icon" id="storage-refresh" title="Refresh">↻</button>
          </div>
          <div class="kv-row"><span class="k">MODE</span><span class="v" id="storage-mode">…</span></div>
          <div class="kv-row"><span class="k">USED</span><span class="v" id="storage-used">…</span></div>
          <div class="mode-help">
            Browser cache clearing will not wipe persistent data.
            <span class="rust">"Clear all site data" still will</span> — keep export backups.
          </div>
        </div>

        <!-- ─── DATA ─────────────────────────────────────── -->
        <div class="set-card full">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="set-card-hd">
            <span class="set-card-hd-l">DATA · BACKUP &amp; RESTORE</span>
          </div>
          <div class="mono" style="font-size:10px;color:var(--muted);letter-spacing:0.08em;margin-bottom:12px;">
            Files saved as: <span class="lime" id="export-fname-preview">${esc(exportFilename())}</span>
          </div>
          <div class="row gap-12" style="flex-wrap:wrap;">
            <button class="btn flex-1" id="data-export" style="min-width:160px;">⬇ EXPORT JSON</button>
            <button class="btn flex-1" id="data-import" style="min-width:160px;">⬆ IMPORT JSON</button>
            <button class="btn btn-rust flex-1" id="data-clear" style="min-width:160px;">⚠ CLEAR ALL</button>
          </div>
          <div class="mode-help">
            Export creates a single JSON file with every setting, key, draft, note, and history on this device.
          </div>
        </div>

        <!-- ─── ABOUT ─────────────────────────────────────── -->
        <div class="set-card full">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="set-card-hd">
            <span class="set-card-hd-l">ABOUT &amp; CHANGELOG</span>
          </div>
          <div class="kv-row"><span class="k">NAME</span><span class="v">${esc(v.name || 'Grammar.AI')}</span></div>
          <div class="kv-row"><span class="k">VERSION</span><span class="v lime">${esc(v.version || '1.2.0')}</span></div>
          <div class="kv-row"><span class="k">BUILD</span><span class="v">${esc(v.build || '—')}</span></div>
          <div class="kv-row"><span class="k">CHANNEL</span><span class="v">${esc((v.channel || 'stable').toUpperCase())}</span></div>
          <div class="kv-row"><span class="k">BACKEND</span><span class="v">NONE — DIRECT / WORKER</span></div>
          <div class="s-ttl" style="margin-top:18px;"><span>HISTORY</span></div>
          ${(v.history || []).map((h, i) => `
            <div class="history-item ${i === 0 ? 'current' : ''}">
              <h4>v${esc(h.version)}${i === 0 ? ' · current' : ''}</h4>
              <div class="h-date">${esc(h.date)}</div>
              <div class="h-notes">${esc(h.notes)}</div>
            </div>
          `).join('')}
        </div>

      </div>
    </div>
  `;

  /* ─── Install button ─── */
  const installBtn = $('#install-btn', host);
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      const p = await getPrompt();
      if (!p) { toast('Install not available', 'error'); return; }
      installBtn.disabled = true;
      installBtn.textContent = 'INSTALLING…';
      const { outcome } = await p.prompt();
      if (outcome === 'accepted') {
        toast('Grammar.AI installed!', 'success');
        await clearPrompt();
        setTimeout(() => renderSettings(host), 800);
      } else {
        installBtn.disabled = false;
        installBtn.textContent = '⬇ INSTALL GRAMMAR.AI';
        toast('Install dismissed');
      }
    });
  }

  /* ─── Wire providers ─── */
  $$('.prov-row', host).forEach(row => {
    wireProvider(host, row.getAttribute('data-prov'));
  });

  /* ─── Test all ─── */
  $('#test-all', host).addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'TESTING…';
    await Promise.all(AI.getFallbackOrder().map(id => runTestRow(host, id)));
    btn.disabled = false;
    btn.textContent = '▶ TEST ALL';
  });

  /* ─── Worker ─── */
  $('#worker-save', host).addEventListener('click', () => {
    const u = $('#worker-url', host).value.trim();
    if (!/^https?:\/\//.test(u) && u !== '') { toast('URL must start with https://', 'error'); return; }
    AI.setWorkerUrl(u);
    paintWorkerBadge(host);
    toast(u ? 'Worker URL saved' : 'Worker URL cleared', 'success');
  });
  $('#worker-clear', host).addEventListener('click', () => {
    AI.clearWorkerUrl();
    $('#worker-url', host).value = '';
    paintWorkerBadge(host);
    toast('Worker cleared');
  });
  $('#worker-test', host).addEventListener('click', async () => {
    const badge = $('#worker-badge', host);
    badge.textContent = 'TESTING…';
    badge.className = 'prov-badge muted';
    const r = await AI.testWorker();
    if (r.ok) { badge.textContent = '● OK'; badge.className = 'prov-badge lime'; toast('Worker connected', 'success'); }
    else      { badge.textContent = '● FAIL'; badge.className = 'prov-badge rust'; toast(`Worker: ${r.msg}`, 'error'); }
  });

  /* ─── Mode toggle ─── */
  $$('.mode-btn', host).forEach(b => {
    b.addEventListener('click', () => {
      const m = b.dataset.mode;
      AI.setMode(m);
      $$('.mode-btn', host).forEach(x => x.classList.toggle('on', x.dataset.mode === m));
      $('#mode-help', host).textContent = modeHelp(m);
      toast('Mode: ' + m.replace(/-/g, ' '), 'success');
    });
  });

  /* ─── Storage ─── */
  await refreshStorage(host);
  $('#storage-refresh', host).addEventListener('click', () => refreshStorage(host));

  /* ─── Data ─── */
  $('#data-export', host).addEventListener('click', () => {
    const dump = {
      _meta: {
        app: 'Grammar.AI',
        version: v.version,
        scope: 'AllModules',
        exportedAt: new Date().toISOString()
      },
      data: Storage.snapshot()
    };
    downloadFile(exportFilename('AllModules'), JSON.stringify(dump, null, 2), 'application/json');
  });

  $('#data-import', host).addEventListener('click', async () => {
    const f = await pickFile('application/json,.json');
    if (!f) return;
    try {
      const txt = await readFileAsText(f);
      const obj = JSON.parse(txt);
      const data = obj.data || obj;
      if (!confirm('Import will overwrite existing data with the backup. Continue?')) return;
      Storage.restore(data);
      toast('Data imported · reloading', 'success');
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      toast('Import failed: ' + e.message, 'error');
    }
  });

  $('#data-clear', host).addEventListener('click', () => {
    if (!confirm('Permanently delete ALL data — keys, notes, history, drafts. Are you sure?')) return;
    if (!confirm('Final confirmation. Delete everything?')) return;
    Storage.clearAll();
    toast('All data cleared · reloading', 'success');
    setTimeout(() => location.reload(), 700);
  });
}

/* ─── Renderers ─── */

function renderProvider(id, p) {
  if (!p) return '';
  const k = AI.getKey(id);
  const isPrim = AI.getPrimary() === id;
  return `
    <div class="prov-row ${isPrim ? 'is-primary' : ''}" data-prov="${esc(id)}">
      <div class="prov-head">
        <span class="prov-icn">${esc(p.icon)}</span>
        <div class="prov-meta">
          <div class="prov-name">
            <span class="prov-star ${isPrim ? 'on' : ''}" data-star="${esc(id)}" title="Make primary">${isPrim ? '★' : '☆'}</span>
            ${esc(p.label)}
          </div>
          <div class="prov-model">${esc(p.model)}</div>
        </div>
        <span class="prov-badge ${k ? 'lime' : 'dim'}">${k ? '● SET' : '● EMPTY'}</span>
      </div>
      <div class="prov-input-row">
        <input class="prov-input" type="password" placeholder="API key…" value="${esc(k)}"
          autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-key />
        <button class="prov-eye" data-eye>👁</button>
      </div>
      <div class="prov-actions">
        <button data-act="save">SAVE</button>
        <button data-act="clear">CLEAR</button>
        <button data-act="test">TEST</button>
        <a data-act="link" href="${esc(p.keyUrl)}" target="_blank" rel="noopener">GET KEY ↗</a>
      </div>
    </div>
  `;
}

function renderModeBtn(mode, label, current) {
  return `<button class="mode-btn ${mode === current ? 'on' : ''}" data-mode="${esc(mode)}">${esc(label)}</button>`;
}

function modeHelp(mode) {
  if (mode === 'worker-first') return 'Try the Worker first; fall back to direct provider keys if it fails. Recommended.';
  if (mode === 'worker-only')  return 'Use only the Cloudflare Worker. Direct keys are ignored.';
  if (mode === 'direct-only')  return 'Ignore the Worker. Use saved provider keys directly from the browser.';
  return '';
}

/* ─── Wiring helpers ─── */

function wireProvider(host, id) {
  const row = host.querySelector(`.prov-row[data-prov="${id}"]`);
  if (!row) return;
  const inp  = row.querySelector('[data-key]');
  const eye  = row.querySelector('[data-eye]');
  const star = row.querySelector('[data-star]');

  eye.addEventListener('click', () => {
    inp.type = inp.type === 'password' ? 'text' : 'password';
    eye.textContent = inp.type === 'password' ? '👁' : '🙈';
  });
  row.querySelector('[data-act="save"]').addEventListener('click', () => {
    AI.setKey(id, inp.value);
    paintProvBadge(row, id);
    toast(`${id.toUpperCase()} key saved`, 'success');
  });
  row.querySelector('[data-act="clear"]').addEventListener('click', () => {
    AI.clearKey(id);
    inp.value = '';
    paintProvBadge(row, id);
    toast(`${id.toUpperCase()} key cleared`);
  });
  row.querySelector('[data-act="test"]').addEventListener('click', () => runTestRow(host, id));
  star.addEventListener('click', () => {
    const cur = AI.getPrimary();
    AI.setPrimary(cur === id ? '' : id);
    repaintAllStars(host);
    toast(cur === id ? 'Primary cleared' : `${id.toUpperCase()} is now primary`, 'success');
  });
}

async function runTestRow(host, id) {
  const row = host.querySelector(`.prov-row[data-prov="${id}"]`);
  if (!row) return;
  const badge = row.querySelector('.prov-badge');
  badge.textContent = 'TESTING…'; badge.className = 'prov-badge muted';
  const r = await AI.testProvider(id);
  if (r.ok) { badge.textContent = '● OK'; badge.className = 'prov-badge lime'; toast(`${id}: connected`, 'success'); }
  else      { badge.textContent = '● FAIL'; badge.className = 'prov-badge rust'; toast(`${id}: ${r.msg}`, 'error'); }
}

function paintProvBadge(row, id) {
  const has = !!AI.getKey(id);
  const badge = row.querySelector('.prov-badge');
  badge.textContent = has ? '● SET' : '● EMPTY';
  badge.className = 'prov-badge ' + (has ? 'lime' : 'dim');
}

function repaintAllStars(host) {
  const prim = AI.getPrimary();
  $$('.prov-row', host).forEach(row => {
    const id   = row.getAttribute('data-prov');
    const star = row.querySelector('[data-star]');
    const isP  = id === prim;
    star.textContent = isP ? '★' : '☆';
    star.classList.toggle('on', isP);
    row.classList.toggle('is-primary', isP);
  });
}

function paintWorkerBadge(host) {
  const badge = $('#worker-badge', host);
  if (!badge) return;
  if (AI.hasWorker()) { badge.textContent = '● SET'; badge.className = 'prov-badge lime'; }
  else                { badge.textContent = '● EMPTY'; badge.className = 'prov-badge dim'; }
}

async function refreshStorage(host) {
  const persisted = await isPersisted();
  const est = await storageEstimate();
  const modeEl = $('#storage-mode', host);
  const usedEl = $('#storage-used', host);
  if (modeEl) {
    if (persisted) {
      modeEl.innerHTML = '<span class="lime">✓ Persistent</span>';
    } else if (navigator.storage?.persist) {
      modeEl.innerHTML = '<span class="muted">Best-effort · <button class="btn btn-icon" id="ask-persist" style="margin-left:8px;font-size:9px;">REQUEST</button></span>';
      setTimeout(() => {
        document.getElementById('ask-persist')?.addEventListener('click', async () => {
          const ok = await requestPersist();
          toast(ok ? 'Granted · persistent storage active' : 'Browser declined', ok ? 'success' : 'error');
          refreshStorage(host);
        });
      }, 50);
    } else {
      modeEl.innerHTML = '<span class="muted">Not supported on this browser</span>';
    }
  }
  if (usedEl && est) {
    usedEl.innerHTML = `<span class="lime">${fmtBytes(est.usage)}</span> <span class="muted">/ ${fmtBytes(est.quota)}</span>`;
  } else if (usedEl) {
    usedEl.textContent = 'Unavailable';
  }
}

/* Export helpers — used by Notes and other modules for consistent naming */
export { exportFilename, exportFilenameTxt };

/* ────────────────────────────────────────────────────────────────
   SETTINGS · v1.1.0
   Sections: Providers · Worker · Mode · Storage · Data · About
   ──────────────────────────────────────────────────────────────── */

import { esc, $, $$, toast, downloadFile, pickFile, readFileAsText } from './ui.js';
import { AI } from './ai.js';
import { Storage, isPersisted, requestPersist, storageEstimate, fmtBytes } from './storage.js';

let _versionInfo = null;
export function setVersionInfo(v) { _versionInfo = v; }

export async function renderSettings(host) {
  const v = _versionInfo || {};
  const providers = AI.getProviders() || {};
  const order     = AI.getFallbackOrder() || [];

  host.innerHTML = `
    <div class="page-inner settings">
      <div class="kicker">
        <span>HOME · SETTINGS</span>
        <span class="lime">v${esc(v.version || '1.1.0')}</span>
      </div>
      <div class="headline">Settings</div>
      <div class="subline">
        <span>PROVIDERS · WORKER · STORAGE · DATA</span>
        <span>LOCAL · NO BACKEND</span>
      </div>
      <div class="ticks">${'<i></i>'.repeat(48)}</div>

      <div class="set-grid">

        <!-- ─── PROVIDERS ─────────────────────────────────────── -->
        <div class="set-card lime full">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="set-card-hd">
            <span class="set-card-hd-l">PROVIDERS · <span class="num">${order.length.toString().padStart(2,'0')}</span></span>
            <button class="btn btn-icon" id="test-all">▶ TEST ALL</button>
          </div>
          <div class="prov-list" id="prov-list">
            ${order.map(id => renderProvider(id, providers[id])).join('')}
          </div>
          <div class="mode-help">
            ★ marks the primary provider — tried first when AI mode is "Direct" or "Worker-first" falls back.
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
            <input class="prov-input" id="worker-url" type="url" placeholder="https://your-worker.workers.dev" value="${esc(AI.getWorkerUrl())}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
          </div>
          <div class="prov-actions">
            <button id="worker-save">SAVE</button>
            <button id="worker-clear">CLEAR</button>
            <button id="worker-test">TEST</button>
          </div>
          <div class="mode-help">
            Saved Worker URL is used for AI calls (mode below). Worker handles auth + key storage server-side.
          </div>
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
            Browser cache clearing will not wipe persistent data. <span class="rust">"Clear all site data" still will</span> — keep export backups.
          </div>
        </div>

        <!-- ─── DATA ─────────────────────────────────────── -->
        <div class="set-card full">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="set-card-hd">
            <span class="set-card-hd-l">DATA · BACKUP &amp; RESTORE</span>
          </div>
          <div class="row gap-12" style="flex-wrap:wrap;">
            <button class="btn flex-1" id="data-export" style="min-width:160px;">⬇ EXPORT JSON</button>
            <button class="btn flex-1" id="data-import" style="min-width:160px;">⬆ IMPORT JSON</button>
            <button class="btn btn-rust flex-1" id="data-clear" style="min-width:160px;">⚠ CLEAR ALL</button>
          </div>
          <div class="mode-help">
            Export creates a single JSON file with every setting, key, draft, and history item on this device. Import overwrites current data.
          </div>
        </div>

        <!-- ─── ABOUT ─────────────────────────────────────── -->
        <div class="set-card full">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="set-card-hd">
            <span class="set-card-hd-l">ABOUT &amp; CHANGELOG</span>
          </div>
          <div class="kv-row"><span class="k">NAME</span><span class="v">${esc(v.name || 'Grammar.AI')}</span></div>
          <div class="kv-row"><span class="k">VERSION</span><span class="v lime">${esc(v.version || '1.1.0')}</span></div>
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

  /* ─── Wire providers ─── */
  $$('.prov-row', host).forEach(row => {
    const id = row.getAttribute('data-prov');
    wireProvider(host, id);
  });

  /* ─── Test all ─── */
  $('#test-all', host).addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'TESTING…';
    const ids = AI.getFallbackOrder();
    await Promise.all(ids.map(id => {
      const row = host.querySelector(`.prov-row[data-prov="${id}"]`);
      if (row) return runTestRow(host, id);
    }));
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
      toast('Mode: ' + m.replace('-', ' '), 'success');
    });
  });

  /* ─── Storage ─── */
  await refreshStorage(host);
  $('#storage-refresh', host).addEventListener('click', () => refreshStorage(host));

  /* ─── Data ─── */
  $('#data-export', host).addEventListener('click', () => {
    const dump = {
      _meta: { app: 'Grammar.AI', version: v.version, exportedAt: new Date().toISOString() },
      data: Storage.snapshot()
    };
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadFile(`grammar-ai-backup-${ts}.json`, JSON.stringify(dump, null, 2), 'application/json');
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
    if (!confirm('Permanently delete ALL data on this device — keys, notes, history, drafts, preferences. Are you sure?')) return;
    if (!confirm('Final confirmation. Delete everything?')) return;
    Storage.clearAll();
    toast('All data cleared · reloading', 'success');
    setTimeout(() => location.reload(), 700);
  });
}

/* ───────────────── Renderers ───────────────── */

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
        <input class="prov-input" type="password" placeholder="API key…" value="${esc(k)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-key />
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
  if (mode === 'worker-only')  return 'Use only the Cloudflare Worker. If it fails, AI calls fail. No direct keys are tried.';
  if (mode === 'direct-only')  return 'Ignore the Worker. Use saved provider keys directly from the browser.';
  return '';
}

/* ───────────────── Wiring helpers ───────────────── */

function wireProvider(host, id) {
  const row = host.querySelector(`.prov-row[data-prov="${id}"]`);
  if (!row) return;
  const inp = row.querySelector('[data-key]');
  const eye = row.querySelector('[data-eye]');
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
  badge.textContent = 'TESTING…';
  badge.className = 'prov-badge muted';
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
    const id = row.getAttribute('data-prov');
    const star = row.querySelector('[data-star]');
    const isP = id === prim;
    star.textContent = isP ? '★' : '☆';
    star.classList.toggle('on', isP);
    row.classList.toggle('is-primary', isP);
  });
}

function paintWorkerBadge(host) {
  const badge = $('#worker-badge', host);
  if (AI.hasWorker()) { badge.textContent = '● SET'; badge.className = 'prov-badge lime'; }
  else { badge.textContent = '● EMPTY'; badge.className = 'prov-badge dim'; }
}

async function refreshStorage(host) {
  const persisted = await isPersisted();
  const est = await storageEstimate();
  const modeEl = $('#storage-mode', host);
  const usedEl = $('#storage-used', host);

  if (persisted) {
    modeEl.innerHTML = '<span class="lime">✓ Persistent</span>';
  } else if (navigator.storage?.persist) {
    modeEl.innerHTML = '<span class="muted">Best-effort · <button class="btn btn-icon" id="ask-persist" style="margin-left:8px;font-size:9px;">REQUEST</button></span>';
    setTimeout(() => {
      const btn = document.getElementById('ask-persist');
      if (btn) btn.addEventListener('click', async () => {
        const ok = await requestPersist();
        toast(ok ? 'Granted · persistent storage active' : 'Browser declined the request', ok ? 'success' : 'error');
        refreshStorage(host);
      });
    }, 50);
  } else {
    modeEl.innerHTML = '<span class="muted">Not supported on this browser</span>';
  }

  if (est) {
    usedEl.innerHTML = `<span class="lime">${fmtBytes(est.usage)}</span> <span class="muted">/ ${fmtBytes(est.quota)}</span>`;
  } else {
    usedEl.textContent = 'Unavailable';
  }
}

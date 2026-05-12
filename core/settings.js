/* ────────────────────────────────────────────────────────────────
   SETTINGS · v1.2.0
   Sections: Install · Providers · Worker · Mode · Storage · Data · About
   ──────────────────────────────────────────────────────────────── */

import { esc, $, $$, toast, downloadFile, pickFile, readFileAsText } from './ui.js';
import { AI } from './ai.js';
import { Storage, isPersisted, requestPersist, storageEstimate, fmtBytes, checkBackupReminder, markBackupDone } from './storage.js';
import { gFileName } from './ui.js';

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
          <div id="edge-worker-note" class="mono hide" style="font-size:10px;line-height:1.65;color:var(--muted);margin-top:8px;padding:8px 10px;background:var(--surface-2);border-left:2px solid var(--rust);"></div>
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
            <span class="prov-badge ${checkBackupReminder() ? 'rust' : 'lime'}" id="backup-status">
              ${checkBackupReminder() ? '⚠ BACKUP NEEDED' : '● BACKED UP'}
            </span>
          </div>

          <!-- What's included -->
          <div class="backup-modules-grid">
            ${['Chat','Paragraph','Email','Translator','Exercise','Notes','Rewrite','Settings'].map(m => `
              <span class="backup-module-tag">✓ ${esc(m)}</span>
            `).join('')}
          </div>

          <!-- Export options -->
          <div class="s-ttl" style="margin-top:14px;"><span>EXPORT</span></div>
          <div class="row gap-12" style="flex-wrap:wrap;">
            <button class="btn btn-primary flex-1" id="data-export-all" style="min-width:160px;">
              ⬇ EXPORT ALL MODULES
            </button>
            <button class="btn flex-1" id="data-export-notes" style="min-width:140px;">
              ⬇ NOTES ONLY
            </button>
            <button class="btn flex-1" id="data-export-settings" style="min-width:160px;">
              ⬇ SETTINGS ONLY
            </button>
          </div>
          <div class="mono dim" style="font-size:9px;letter-spacing:0.06em;line-height:1.6;margin-top:6px;">
            API keys are NOT included in export for security. Re-enter them once per device.
          </div>

          <!-- Import options -->
          <div class="s-ttl" style="margin-top:14px;"><span>IMPORT / RESTORE</span></div>
          <div class="row gap-12" style="flex-wrap:wrap;">
            <button class="btn flex-1" id="data-import-full" style="min-width:140px;">
              ⬆ FULL RESTORE
            </button>
            <button class="btn flex-1" id="data-import-merge" style="min-width:140px;">
              ⬆ MERGE
            </button>
            <button class="btn flex-1" id="data-import-notes" style="min-width:140px;">
              ⬆ NOTES ONLY
            </button>
            <button class="btn flex-1" id="data-import-settings" style="min-width:160px;">
              ⬆ SETTINGS ONLY
            </button>
          </div>
          <div class="mono dim" style="font-size:9px;letter-spacing:0.06em;line-height:1.6;margin-top:6px;">
            FULL RESTORE replaces everything. MERGE adds imported notes/chat to existing without overwriting.
          </div>

          <!-- Danger zone -->
          <div class="s-ttl" style="margin-top:14px;"><span>DANGER ZONE</span></div>
          <button class="btn btn-rust" id="data-clear" style="width:100%;">⚠ CLEAR ALL DATA</button>
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
    // Save backup key — survives Edge storage clearing
    if (u) Storage.set('workerUrl.bk', u);
    paintWorkerBadge(host);
    paintEdgeWorkerNote(host);
    toast(u ? 'Worker URL saved ✓' : 'Worker URL cleared', 'success');
  });
  $('#worker-clear', host).addEventListener('click', () => {
    AI.clearWorkerUrl();
    Storage.remove('workerUrl.bk');
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
  paintEdgeWorkerNote(host);

  /* ─── Data ─── */
  /* ─── Structured Export ─── */
  function doExport(mode = 'all') {
    let backup, filename, label;
    if (mode === 'all') {
      backup   = Storage.structuredBackup({ includeKeys: false, includePinHash: true });
      filename = gFileName('BACKUP', 'BK', 'json');
      label    = 'All modules exported';
    } else if (mode === 'notes') {
      const nb = Storage.structuredBackup({ includeKeys: false });
      backup   = { _meta: { ...nb._meta, scope: 'Notes' }, modules: { notes: nb.modules.notes } };
      filename = gFileName('BACKUP', 'BK', 'json');
      label    = 'Notes exported';
    } else if (mode === 'settings') {
      const nb = Storage.structuredBackup({ includeKeys: false });
      backup   = { _meta: { ...nb._meta, scope: 'Settings' }, settings: nb.settings };
      filename = gFileName('BACKUP', 'BK', 'json');
      label    = 'Settings exported';
    }
    downloadFile(filename, JSON.stringify(backup, null, 2), 'application/json');
    markBackupDone();
    // Refresh badge
    const badge = document.getElementById('backup-status');
    if (badge) { badge.textContent = '● BACKED UP'; badge.className = 'prov-badge lime'; }
    toast(label + ' → ' + filename, 'success');
  }

  $('#data-export-all',      host).addEventListener('click', () => doExport('all'));
  $('#data-export-notes',    host).addEventListener('click', () => doExport('notes'));
  $('#data-export-settings', host).addEventListener('click', () => doExport('settings'));

  /* ─── Structured Import ─── */
  async function doImport(mode) {
    const modeLabels = {
      full:          'Full Restore — replaces ALL existing data',
      merge:         'Merge — adds imported notes/chat without overwriting existing',
      'notes-only':  'Notes Only — restores notes vault only',
      'settings-only': 'Settings Only — restores settings only'
    };
    const f = await pickFile('application/json,.json');
    if (!f) return;
    try {
      const txt  = await readFileAsText(f);
      const obj  = JSON.parse(txt);

      // Support both old raw dump and new structured format
      const isStructured = !!obj.modules;
      if (!isStructured && mode !== 'full') {
        toast('This is an old format backup — only Full Restore supported', 'error');
        return;
      }

      const confirm1 = confirm(`${modeLabels[mode]}\n\nBackup from: ${obj._meta?.exportedOn || 'unknown date'}\n\nContinue?`);
      if (!confirm1) return;

      if (isStructured) {
        Storage.restoreStructured(obj, { mode, includeKeys: false });
      } else {
        // Old format — raw dump restore
        const data = obj.data || obj;
        Storage.restore(data);
      }

      toast(`${modeLabels[mode]} complete — reloading`, 'success');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      toast('Import failed: ' + e.message, 'error');
    }
  }

  $('#data-import-full',     host).addEventListener('click', () => doImport('full'));
  $('#data-import-merge',    host).addEventListener('click', () => doImport('merge'));
  $('#data-import-notes',    host).addEventListener('click', () => doImport('notes-only'));
  $('#data-import-settings', host).addEventListener('click', () => doImport('settings-only'));

  /* ─── Clear all ─── */
  $('#data-clear', host).addEventListener('click', () => {
    if (!confirm('Permanently delete ALL data — notes, history, drafts, settings. Are you sure?')) return;
    if (!confirm('Final confirmation. This cannot be undone. Delete everything?')) return;
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

function paintEdgeWorkerNote(host) {
  const isEdge    = navigator.userAgent.includes('Edg/');
  const isMobile  = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const noteEl    = $('#edge-worker-note', host);
  if (!noteEl) return;
  if (isEdge && !isMobile && !AI.hasWorker()) {
    noteEl.innerHTML = `
      <span class="rust">⚠ Edge Desktop — Worker URL may be wiped on browser close.</span><br>
      Fix: Press <strong>Ctrl+D</strong> to add to Favorites, or install via Edge menu → Apps.<br>
      A backup copy is saved automatically each time you tap SAVE.
    `;
    noteEl.classList.remove('hide');
  } else if (isEdge && !isMobile && AI.hasWorker()) {
    noteEl.innerHTML = '● Worker URL backed up — will auto-restore if Edge clears storage.';
    noteEl.classList.remove('hide');
  } else {
    noteEl.classList.add('hide');
  }
}

async function refreshStorage(host) {
  const persisted = await isPersisted();
  const est = await storageEstimate();
  const isEdge   = navigator.userAgent.includes('Edg/');
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const modeEl = $('#storage-mode', host);
  const usedEl = $('#storage-used', host);

  if (modeEl) {
    if (persisted) {
      modeEl.innerHTML = '<span class="lime">✓ Persistent — data protected</span>';
    } else if (isEdge && !isMobile) {
      // Edge desktop — specific guidance
      modeEl.innerHTML = `
        <span class="rust">⚠ Edge Browser — Not Persistent</span>
        <div class="mono" style="font-size:10px;color:var(--muted);line-height:1.7;margin-top:8px;">
          To protect data in Edge, do ONE of these:<br>
          → Press <strong>Ctrl+D</strong> to add this site to Favorites<br>
          → OR Edge menu <strong>(...)</strong> → Apps → Install this site as app<br>
          Then tap REQUEST below.
        </div>
        <button class="btn mt-8" id="ask-persist" style="width:100%;">REQUEST PERSISTENT STORAGE</button>
      `;
      setTimeout(() => {
        document.getElementById('ask-persist')?.addEventListener('click', async () => {
          const ok = await requestPersist();
          toast(ok ? '✓ Granted — data is now protected' : 'Add to Favorites first, then try again', ok ? 'success' : 'error');
          refreshStorage(host);
        });
      }, 50);
    } else if (navigator.storage?.persist) {
      // Chrome / other — standard request
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

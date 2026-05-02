/* ────────────────────────────────────────────────────────────────
   SETTINGS · provider keys + data + about
   ──────────────────────────────────────────────────────────────── */

import { esc, $, $$, toast, downloadFile, pickFile, readFileAsText, copyToClipboard } from './ui.js';
import { AI } from './ai.js';
import { Storage } from './storage.js';

let _versionInfo = null;
export function setVersionInfo(v) { _versionInfo = v; }

export function renderSettings(host) {
  const providers = AI.getProviders();
  const order     = AI.getFallbackOrder();
  const v = _versionInfo || {};

  host.innerHTML = `
    <div class="page-inner settings">
      <div class="kicker">
        <span>HOME · SETTINGS</span>
        <span class="lime">v${esc(v.version || '1.0.0')}</span>
      </div>
      <div class="headline">Settings</div>
      <div class="subline">
        <span>PROVIDERS · DATA · ABOUT</span>
        <span>LOCAL ONLY</span>
      </div>
      <div class="ticks">${'<i></i>'.repeat(48)}</div>

      <!-- Providers -->
      <div class="s-ttl"><span>PROVIDERS · <span class="num">04</span></span></div>
      <div class="prov-list" id="prov-list">
        ${order.map(id => renderProvider(id, providers[id])).join('')}
      </div>
      <button class="btn mt-12" id="test-all">▶ TEST ALL CONNECTIONS</button>

      <!-- Data -->
      <div class="s-ttl"><span>DATA</span></div>
      <div class="frame subtle" style="padding:14px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="row gap-12">
          <button class="btn flex-1" id="data-export">⬇ EXPORT JSON</button>
          <button class="btn flex-1" id="data-import">⬆ IMPORT JSON</button>
        </div>
        <button class="btn mt-12" style="width:100%;color:var(--rust);border-color:var(--rust-dim);" id="data-clear">⚠ CLEAR ALL DATA</button>
        <div class="mono dim" style="font-size:9px;letter-spacing:0.1em;line-height:1.6;margin-top:10px;">
          Export creates a JSON file containing every key, note, draft, preference and provider key on this device. Import replaces current data.
        </div>
      </div>

      <!-- About -->
      <div class="s-ttl"><span>ABOUT</span></div>
      <div class="frame subtle about" style="padding:14px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="kv-row"><span class="k">NAME</span><span class="v">${esc(v.name || 'Grammar.AI')}</span></div>
        <div class="kv-row"><span class="k">VERSION</span><span class="v lime">${esc(v.version || '1.0.0')}</span></div>
        <div class="kv-row"><span class="k">BUILD</span><span class="v">${esc(v.build || '—')}</span></div>
        <div class="kv-row"><span class="k">CHANNEL</span><span class="v">${esc((v.channel || 'stable').toUpperCase())}</span></div>
        <div class="kv-row"><span class="k">BACKEND</span><span class="v">NONE — DIRECT</span></div>
        <div class="kv-row"><span class="k">STORAGE</span><span class="v">LOCAL · BROWSER</span></div>
      </div>
    </div>
  `;

  // Wire provider rows
  $$('.prov-row', host).forEach(row => {
    const id = row.getAttribute('data-prov');
    const inp = row.querySelector('.prov-input');
    const eye = row.querySelector('.prov-eye');
    const save = row.querySelector('.prov-save');
    const clear = row.querySelector('.prov-clear');
    const test = row.querySelector('.prov-test');
    const badge = row.querySelector('.prov-badge');

    eye.addEventListener('click', () => {
      inp.type = inp.type === 'password' ? 'text' : 'password';
      eye.textContent = inp.type === 'password' ? '👁' : '🙈';
    });
    save.addEventListener('click', () => {
      AI.setKey(id, inp.value);
      toast(`${id.toUpperCase()} key saved`, 'success');
      paintBadge(id, badge);
    });
    clear.addEventListener('click', () => {
      AI.clearKey(id);
      inp.value = '';
      toast(`${id.toUpperCase()} key cleared`);
      paintBadge(id, badge);
    });
    test.addEventListener('click', async () => {
      badge.textContent = 'TESTING…';
      badge.className = 'prov-badge muted';
      const r = await AI.testProvider(id);
      if (r.ok) { badge.textContent = '● OK'; badge.className = 'prov-badge lime'; toast(`${id}: connected`, 'success'); }
      else      { badge.textContent = '● FAIL'; badge.className = 'prov-badge rust'; toast(`${id}: ${r.msg}`, 'error'); }
    });
    paintBadge(id, badge);
  });

  // Test all
  $('#test-all', host).addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'TESTING…';
    for (const id of AI.getFallbackOrder()) {
      const row = host.querySelector(`.prov-row[data-prov="${id}"]`);
      if (row) row.querySelector('.prov-test').click();
      await new Promise(r => setTimeout(r, 400));
    }
    e.target.disabled = false;
    e.target.textContent = '▶ TEST ALL CONNECTIONS';
  });

  // Export
  $('#data-export', host).addEventListener('click', () => {
    const dump = {
      _meta: {
        app: 'Grammar.AI',
        version: v.version,
        exportedAt: new Date().toISOString()
      },
      data: Storage.snapshot()
    };
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadFile(`grammar-ai-backup-${ts}.json`, JSON.stringify(dump, null, 2), 'application/json');
  });

  // Import
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

  // Clear all
  $('#data-clear', host).addEventListener('click', () => {
    if (!confirm('This will permanently delete ALL data on this device — notes, drafts, history, API keys. Are you sure?')) return;
    if (!confirm('Final confirmation. Delete everything?')) return;
    Storage.clearAll();
    toast('All data cleared · reloading', 'success');
    setTimeout(() => location.reload(), 700);
  });
}

function renderProvider(id, p) {
  if (!p) return '';
  const k = AI.getKey(id);
  return `
    <div class="prov-row frame subtle" data-prov="${esc(id)}">
      <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
      <div class="prov-head">
        <span class="prov-icn">${esc(p.icon)}</span>
        <div class="prov-meta">
          <div class="prov-name">${esc(p.label)}</div>
          <div class="prov-model">${esc(p.model)}</div>
        </div>
        <span class="prov-badge muted">—</span>
      </div>
      <div class="prov-input-row">
        <input class="prov-input" type="password" placeholder="API key…" value="${esc(k)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
        <button class="prov-eye" title="Toggle visibility">👁</button>
      </div>
      <div class="prov-actions">
        <button class="btn-ghost prov-save">SAVE</button>
        <button class="btn-ghost prov-clear">CLEAR</button>
        <button class="btn-ghost prov-test">TEST</button>
        <a class="btn-ghost prov-link" href="${esc(p.keyUrl)}" target="_blank" rel="noopener">GET KEY ↗</a>
      </div>
    </div>
  `;
}

function paintBadge(id, badge) {
  const has = !!AI.getKey(id);
  badge.textContent = has ? '● SET' : '● EMPTY';
  badge.className = 'prov-badge ' + (has ? 'lime' : 'dim');
}

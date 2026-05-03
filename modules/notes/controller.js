/* ────────────────────────────────────────────────────────────────
   NOTES MODULE · controller · v1.0.0
   Gate: 6-digit PIN (SHA-256 hashed in localStorage)
   Features: Quick/Daily/Study types, tags, search, filter,
   AI (improve/summarise/translate/explain), full toolbar,
   copy, send to chat, download TXT/JSON, import JSON
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, copyToClipboard, downloadFile, pickFile, readFileAsText, openSheet, closeSheet, timeAgo, gFileName, renderMd } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';
import { go } from '../../core/router.js';
import { mountToolbar, renderToolbarHTML } from '../../core/toolbar.js';
import { exportFilename, exportFilenameTxt } from '../../core/settings.js';

const SCOPE = Storage.scope('notes');

/* ─── SHA-256 hash helper (Web Crypto) ─── */
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function fmtDate(ts) {
  return new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(ts));
}

export default async function init({ root, module }) {

  let manifest = { options: {} };
  try { manifest = await fetch('modules/notes/manifest.json').then(r => r.json()); } catch {}
  const opts = manifest.options || {};

  let prompts = {};
  try { prompts = await fetch('config/prompts.json').then(r => r.json()); } catch {}

  /* ─── Persistent state ─── */
  const state = {
    unlocked: false,
    notes: SCOPE.get('notes', []),
    filter: 'all',
    searchQ: '',
    editingId: null,
    aiResult: null,
    toolbarCtrl: null
  };

  /* ─── Gate elements ─── */
  const elGate    = $('#notes-gate', root);
  const elMain    = $('#notes-main', root);
  const elGateStatus = $('#gate-status', root);
  const elGateSub    = $('#gate-sub', root);
  const elGateLabel  = $('#gate-label', root);
  const elPinDots    = $('#pin-dots', root);
  const elPinError   = $('#pin-error', root);
  const elPinOk      = $('#pin-ok', root);
  const elPinClear   = $('#pin-clear', root);
  const elPinResetRow = $('#pin-reset-row', root);
  const elPinReset   = $('#pin-reset', root);

  /* ─── PIN state ─── */
  let pinEntry = '';
  const storedHash = () => SCOPE.get('pinHash', null);
  const hasPin     = () => !!storedHash();
  let pinMode      = hasPin() ? 'verify' : 'setup-1'; // setup-1, setup-2, verify
  let setup1Hash   = '';

  async function initGate() {
    pinEntry = '';
    if (!hasPin()) {
      pinMode = 'setup-1';
      elGateLabel.textContent = 'SET A 6-DIGIT PASSWORD';
      elGateSub.textContent = 'FIRST TIME SETUP';
      elPinResetRow.classList.add('hide');
    } else {
      pinMode = 'verify';
      elGateLabel.textContent = 'ENTER 6-DIGIT PASSWORD';
      elGateSub.textContent = 'ENTER PASSWORD';
      elPinResetRow.classList.remove('hide');
    }
    paintDots();
    elPinError.textContent = '';
  }

  function paintDots() {
    $$('.pin-dot', elPinDots).forEach((d, i) => {
      d.classList.toggle('filled', i < pinEntry.length);
      d.classList.toggle('active', i === pinEntry.length);
    });
  }

  // Numpad wiring
  $$('.num-btn[data-n]', root).forEach(b => {
    b.addEventListener('click', () => {
      if (pinEntry.length >= 6) return;
      pinEntry += b.dataset.n;
      paintDots();
      elPinError.textContent = '';
      if (pinEntry.length === 6) elPinOk.classList.add('ready');
    });
  });
  elPinClear.addEventListener('click', () => {
    pinEntry = pinEntry.slice(0, -1);
    paintDots();
    elPinOk.classList.remove('ready');
    elPinError.textContent = '';
  });
  elPinOk.addEventListener('click', () => handlePinSubmit());
  // Also allow keyboard
  document.addEventListener('keydown', gateKeyHandler);

  async function handlePinSubmit() {
    if (pinEntry.length < 6) { elPinError.textContent = 'Enter all 6 digits'; return; }

    if (pinMode === 'setup-1') {
      setup1Hash = await sha256(pinEntry);
      pinMode = 'setup-2';
      pinEntry = '';
      elGateLabel.textContent = 'CONFIRM PASSWORD';
      elGateSub.textContent = 'RE-ENTER SAME DIGITS';
      paintDots();
      elPinError.textContent = '';
      return;
    }

    if (pinMode === 'setup-2') {
      const confirmHash = await sha256(pinEntry);
      if (confirmHash !== setup1Hash) {
        elPinError.textContent = 'Passwords do not match — try again';
        pinEntry = ''; pinMode = 'setup-1'; setup1Hash = '';
        elGateLabel.textContent = 'SET A 6-DIGIT PASSWORD';
        elGateSub.textContent = 'START OVER';
        paintDots();
        return;
      }
      SCOPE.set('pinHash', confirmHash);
      toast('Password set successfully', 'success');
      unlock();
      return;
    }

    if (pinMode === 'verify') {
      const entered = await sha256(pinEntry);
      if (entered !== storedHash()) {
        elPinError.textContent = 'Incorrect password — try again';
        pinEntry = '';
        paintDots();
        return;
      }
      unlock();
    }
  }

  function unlock() {
    state.unlocked = true;
    document.removeEventListener('keydown', gateKeyHandler);
    elGate.classList.add('hide');
    elMain.classList.remove('hide');
    renderNotes();
  }

  function lock() {
    state.unlocked = false;
    elMain.classList.add('hide');
    elGate.classList.remove('hide');
    pinEntry = ''; pinMode = 'verify';
    initGate();
  }

  elPinReset.addEventListener('click', () => {
    if (!confirm('This will delete your current password. You will need to set a new one. Continue?')) return;
    SCOPE.remove('pinHash');
    pinMode = 'setup-1';
    pinEntry = '';
    elGateLabel.textContent = 'SET A NEW 6-DIGIT PASSWORD';
    elGateSub.textContent = 'PASSWORD RESET';
    elPinResetRow.classList.add('hide');
    setup1Hash = '';
    paintDots();
    elPinError.textContent = '';
    toast('Password cleared — set a new one');
  });

  function gateKeyHandler(e) {
    if (e.key >= '0' && e.key <= '9' && pinEntry.length < 6) {
      pinEntry += e.key;
      paintDots();
      if (pinEntry.length === 6) elPinOk.classList.add('ready');
    } else if (e.key === 'Backspace') {
      pinEntry = pinEntry.slice(0, -1);
      paintDots();
    } else if (e.key === 'Enter') {
      handlePinSubmit();
    }
  }

  initGate();

  /* ─────────────────────────────────────────────
     NOTES MAIN SECTION
     ───────────────────────────────────────────── */

  const elNotesList  = $('#notes-list', root);
  const elNotesEmpty = $('#notes-empty', root);
  const elStatsLine  = $('#notes-stats-line', root);
  const elSearch     = $('#notes-search', root);
  const elNewBtn     = $('#notes-new-btn', root);
  const elLockBtn    = $('#notes-lock-btn', root);
  const elDlBtn      = $('#notes-download-btn', root);

  // Filter chips
  $$('.chip[data-filter]', root).forEach(b => {
    b.addEventListener('click', () => {
      state.filter = b.dataset.filter;
      $$('.chip[data-filter]', root).forEach(x => x.classList.toggle('on', x.dataset.filter === state.filter));
      renderNotes();
    });
  });

  elSearch.addEventListener('input', () => { state.searchQ = elSearch.value; renderNotes(); });
  elNewBtn.addEventListener('click', () => openEditor(null));
  elLockBtn.addEventListener('click', lock);
  elDlBtn.addEventListener('click', openDownloadSheet);

  /* ─── Render notes list ─── */
  function renderNotes() {
    let notes = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt);

    if (state.filter !== 'all') {
      notes = notes.filter(n => n.type === state.filter);
    }
    if (state.searchQ.trim()) {
      const q = state.searchQ.toLowerCase();
      notes = notes.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q) ||
        (n.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    updateStats();

    if (!notes.length) {
      elNotesList.innerHTML = '';
      elNotesEmpty.classList.remove('hide');
      return;
    }
    elNotesEmpty.classList.add('hide');

    const typeIcons = { quick: '⚡', daily: '📓', study: '📚' };
    elNotesList.innerHTML = notes.map(n => {
      const preview = (n.content || '').slice(0, 280);
      const isLong  = (n.content || '').length > 200;
      const tagsHtml = (n.tags || []).map(t =>
        `<span class="note-tag">${esc(t)}</span>`
      ).join('');
      return `
        <div class="note-card frame subtle" data-nid="${esc(n.id)}">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="note-header">
            <span class="note-type-badge">${typeIcons[n.type] || '📝'} ${esc(n.type)}</span>
            <span class="note-date mono">${esc(timeAgo(n.updatedAt))}</span>
          </div>
          ${n.title ? `<div class="note-title serif">${esc(n.title)}</div>` : ''}
          <div class="note-preview mono ${isLong ? 'collapsed' : ''}" id="nprev-${esc(n.id)}">${renderMd(preview)}${isLong ? '<span class="dim">…</span>' : ''}</div>
          ${tagsHtml ? `<div class="note-tags">${tagsHtml}</div>` : ''}
          <div class="note-actions">
            ${isLong ? `<button class="note-act" data-expand="${esc(n.id)}">▼ MORE</button>` : ''}
            <button class="note-act" data-edit="${esc(n.id)}">✏️ EDIT</button>
            <button class="note-act" data-copy="${esc(n.id)}">⧉ COPY</button>
            <button class="note-act" data-chat="${esc(n.id)}">💬 CHAT</button>
            <button class="note-act note-act-danger" data-del="${esc(n.id)}">🗑</button>
          </div>
        </div>
      `;
    }).join('');

    // Wire card actions
    $$('[data-expand]', elNotesList).forEach(b => {
      b.addEventListener('click', () => {
        const id   = b.dataset.expand;
        const prev = document.getElementById('nprev-' + id);
        const collapsed = prev.classList.contains('collapsed');
        prev.classList.toggle('collapsed', !collapsed);
        b.textContent = collapsed ? '▲ LESS' : '▼ MORE';
      });
    });
    $$('[data-edit]', elNotesList).forEach(b => {
      b.addEventListener('click', () => openEditor(b.dataset.edit));
    });
    $$('[data-copy]', elNotesList).forEach(b => {
      b.addEventListener('click', () => {
        const n = state.notes.find(x => x.id === b.dataset.copy);
        if (n) copyToClipboard((n.title ? n.title + '\n\n' : '') + n.content);
      });
    });
    $$('[data-chat]', elNotesList).forEach(b => {
      b.addEventListener('click', () => {
        const n = state.notes.find(x => x.id === b.dataset.chat);
        if (!n) return;
        // Navigate to chat and pre-fill
        Storage.scope('chat').set('draft', (n.title ? n.title + '\n\n' : '') + n.content);
        go('m:chat');
        toast('Note sent to Chat', 'success');
      });
    });
    $$('[data-del]', elNotesList).forEach(b => {
      b.addEventListener('click', () => {
        if (!confirm('Delete this note?')) return;
        state.notes = state.notes.filter(n => n.id !== b.dataset.del);
        saveNotes();
        renderNotes();
        toast('Note deleted', 'success');
      });
    });
  }

  function updateStats() {
    const total = state.notes.length;
    const q = state.notes.filter(n => n.type === 'quick').length;
    const d = state.notes.filter(n => n.type === 'daily').length;
    const s = state.notes.filter(n => n.type === 'study').length;
    if (elStatsLine) {
      elStatsLine.textContent = `${total} NOTE${total !== 1 ? 'S' : ''} · ⚡${q} 📓${d} 📚${s}`;
    }
  }

  function saveNotes() {
    SCOPE.set('notes', state.notes);
  }

  /* ─── NOTE EDITOR SHEET ─── */

  function openEditor(id) {
    state.editingId = id;
    const n = id ? state.notes.find(x => x.id === id) : null;

    const typeOpts = (opts.noteTypes || []).map(t => ({
      ...t,
      sel: (n ? n.type : 'quick') === t.key
    }));
    const tagOpts = (opts.tags || []).map(tag => ({
      tag,
      sel: n ? (n.tags || []).includes(tag) : false
    }));
    const aiActions = opts.aiActions || [];

    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-inner">
        <div class="kicker"><span>${n ? 'EDIT NOTE' : 'NEW NOTE'}</span><span class="lime">${n ? 'UPDATE' : 'CREATE'}</span></div>
        <div class="sheet-title">${n ? esc(n.title || 'Untitled') : 'New Note'}</div>

        <div class="field">
          <label class="field-label">NOTE TYPE</label>
          <div class="lang-chips" id="ed-types">
            ${typeOpts.map(t => `
              <button class="chip ${t.sel ? 'on' : ''}" data-ntype="${esc(t.key)}">${esc(t.label)}</button>
            `).join('')}
          </div>
        </div>

        <div class="field">
          <label class="field-label">TITLE (optional)</label>
          <input class="input" id="ed-title" placeholder="e.g. Present Perfect rules, Daily reflection…" value="${esc(n?.title || '')}" autocomplete="off" />
        </div>

        <div class="field">
          <label class="field-label">TAGS</label>
          <div class="lang-chips" id="ed-tags">
            ${tagOpts.map(t => `
              <button class="chip ${t.sel ? 'on' : ''}" data-tag="${esc(t.tag)}">${esc(t.tag)}</button>
            `).join('')}
          </div>
        </div>

        <div class="field">
          <label class="field-label">CONTENT · <span id="ed-wc">0 WORDS</span>
            <button class="notes-casual-btn" id="ed-casual" title="Toggle casual reading mode">Aa</button>
          </label>
          <textarea class="composer-input" id="ed-content" placeholder="Write your note here… no length limit." rows="6" style="max-height:280px;">${esc(n?.content || '')}</textarea>
          <div id="ed-toolbar"></div>
        </div>

        <div class="field">
          <label class="field-label">AI TOOLS</label>
          <div class="lang-chips">
            ${aiActions.map(a => `
              <button class="chip" data-ai="${esc(a.key)}">${esc(a.label)}</button>
            `).join('')}
          </div>
        </div>

        <div id="ed-ai-result" class="hide">
          <div class="frame subtle" style="padding:12px 14px;">
            <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
            <div class="s-ttl" style="margin-top:0;"><span id="ed-ai-label">AI RESULT</span></div>
            <div class="output-box" id="ed-ai-text" style="border:none;padding:0;background:transparent;"></div>
            <div class="row gap-12 mt-8">
              <button class="btn btn-primary flex-1" id="ed-ai-apply">USE THIS</button>
              <button class="btn flex-1" id="ed-ai-dismiss">DISMISS</button>
            </div>
          </div>
        </div>

        <div class="row gap-12 mt-12">
          <button class="btn flex-1" id="ed-cancel">CANCEL</button>
          <button class="btn btn-primary flex-1" id="ed-save">💾 SAVE NOTE</button>
          ${n ? `<button class="btn btn-rust" id="ed-delete">🗑</button>` : ''}
        </div>
      </div>
    `);

    setTimeout(() => {
      // Wire type chips
      const edTypes = document.getElementById('ed-types');
      const edTags  = document.getElementById('ed-tags');
      const edTitle = document.getElementById('ed-title');
      const edContent = document.getElementById('ed-content');
      const edWc    = document.getElementById('ed-wc');
      const edCasual = document.getElementById('ed-casual');
      const edTbMount = document.getElementById('ed-toolbar');
      const edAiResult = document.getElementById('ed-ai-result');
      const edAiText = document.getElementById('ed-ai-text');
      const edAiLabel = document.getElementById('ed-ai-label');

      // Casual mode — same JetBrains Mono, just breathes more
      const casualOn = SCOPE.get('casualMode', false);
      function applyCasual(on) {
        if (!edContent) return;
        edContent.style.fontSize   = on ? '15px'  : '';
        edContent.style.lineHeight = on ? '1.95'  : '';
        edContent.style.letterSpacing = on ? '0.01em' : '';
        if (edCasual) {
          edCasual.classList.toggle('on', on);
          edCasual.title = on ? 'Casual mode ON — tap to turn off' : 'Toggle casual reading mode';
        }
      }
      applyCasual(casualOn);
      edCasual?.addEventListener('click', () => {
        const next = !SCOPE.get('casualMode', false);
        SCOPE.set('casualMode', next);
        applyCasual(next);
        toast(next ? 'Casual mode ON — breathes more' : 'Casual mode OFF', 'success');
      });

      // Word count
      function updateWC() {
        const t = edContent.value.trim();
        const n = t ? t.split(/\s+/).length : 0;
        if (edWc) edWc.textContent = n + ' WORD' + (n === 1 ? '' : 'S');
      }
      updateWC();
      edContent.addEventListener('input', updateWC);

      // Type toggle
      if (edTypes) {
        $$('.chip[data-ntype]', edTypes).forEach(b => {
          b.addEventListener('click', () => {
            $$('.chip[data-ntype]', edTypes).forEach(x => x.classList.toggle('on', x.dataset.ntype === b.dataset.ntype));
          });
        });
      }

      // Tag toggle
      if (edTags) {
        $$('.chip[data-tag]', edTags).forEach(b => {
          b.addEventListener('click', () => b.classList.toggle('on'));
        });
      }

      // AI actions
      $$('.chip[data-ai]').forEach(b => {
        b.addEventListener('click', () => runAiAction(b.dataset.ai, edContent, edAiResult, edAiText, edAiLabel));
      });

      // AI apply / dismiss
      document.getElementById('ed-ai-apply')?.addEventListener('click', () => {
        if (state.aiResult) {
          edContent.value = state.aiResult;
          updateWC();
          edAiResult.classList.add('hide');
        }
      });
      document.getElementById('ed-ai-dismiss')?.addEventListener('click', () => {
        edAiResult.classList.add('hide');
      });

      // Mount toolbar
      if (edTbMount && edContent) {
        edTbMount.innerHTML = renderToolbarHTML();
        if (state.toolbarCtrl) state.toolbarCtrl.destroy();
        state.toolbarCtrl = mountToolbar(edTbMount, {
          textarea: edContent,
          voiceLang: 'en-IN',
          enterToSend: false,
          attachAccept: '.txt,.md,.json,.csv',
          onAttach: async (file) => {
            const text = await file.text().catch(() => '');
            const cur = edContent.value;
            edContent.value = cur + (cur ? '\n\n' : '') + text;
            updateWC?.();
            toast(`Attached: ${file.name}`, 'success');
          },
          onImprove:   () => runAiAction('improve',   edContent, edAiResult, edAiText, edAiLabel),
          onTranslate: () => runAiAction('translate', edContent, edAiResult, edAiText, edAiLabel)
        });
      }

      // Save
      document.getElementById('ed-cancel')?.addEventListener('click', () => {
        closeSheet();
        state.editingId = null;
      });

      document.getElementById('ed-save')?.addEventListener('click', () => {
        const title   = edTitle?.value.trim() || '';
        const content = edContent?.value.trim() || '';
        if (!content) { toast('Write something first'); return; }
        const type = ($$('.chip[data-ntype]', edTypes || document).find(x => x.classList.contains('on'))?.dataset.ntype) || 'quick';
        const tags = Array.from($$(`.chip[data-tag]`, edTags || document)).filter(x => x.classList.contains('on')).map(x => x.dataset.tag);
        const now  = Date.now();
        if (state.editingId) {
          const idx = state.notes.findIndex(x => x.id === state.editingId);
          if (idx !== -1) state.notes[idx] = { ...state.notes[idx], title, content, type, tags, updatedAt: now };
        } else {
          state.notes.unshift({ id: uid(), title, content, type, tags, createdAt: now, updatedAt: now });
        }
        saveNotes();
        renderNotes();
        closeSheet();
        toast(state.editingId ? 'Note updated' : 'Note saved', 'success');
        state.editingId = null;
      });

      // Delete
      document.getElementById('ed-delete')?.addEventListener('click', () => {
        if (!confirm('Delete this note permanently?')) return;
        state.notes = state.notes.filter(x => x.id !== state.editingId);
        saveNotes();
        renderNotes();
        closeSheet();
        toast('Note deleted', 'success');
        state.editingId = null;
      });
    }, 80);
  }

  /* ─── AI note actions ─── */
  async function runAiAction(action, edContent, edAiResult, edAiText, edAiLabel) {
    const content = edContent?.value.trim();
    if (!content) { toast('Write something first'); return; }
    if (!AI.hasAnyRoute()) { toast('Set an AI route in Settings', 'error'); return; }

    const actionMap = {
      improve:   { label: '✨ Improved English', sys: 'You are an expert English editor.', user: 'Improve the English grammar, clarity, and flow. Keep same meaning. Show only the improved version:\n\n' + content },
      summarise: { label: '📝 Summary',          sys: 'You are a concise summariser.',     user: 'Summarise into 3-5 clear bullet points:\n\n' + content },
      translate: { label: '🇮🇳 Hindi',           sys: 'You are a Hindi-English translator.', user: 'Translate into simple, natural Hindi:\n\n' + content },
      explain:   { label: '💡 Explanation',      sys: 'You are a helpful teacher.',         user: 'Explain in very simple English for a beginner. Use short sentences:\n\n' + content }
    };
    const p = actionMap[action];
    if (!p) return;

    if (edAiLabel) edAiLabel.textContent = p.label;
    if (edAiText)  edAiText.textContent = 'Thinking…';
    if (edAiResult) edAiResult.classList.remove('hide');

    try {
      const r = await AI.chat([
        { role: 'system', content: p.sys },
        { role: 'user',   content: p.user }
      ], { temperature: 0.5, maxTokens: 1500 });
      state.aiResult = r.text;
      if (edAiText) edAiText.textContent = r.text;
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      if (edAiText) edAiText.textContent = 'Error: ' + (e.details?.[0] || e.message);
      toast('AI failed', 'error');
    }
  }

  /* ─── Download sheet ─── */
  function openDownloadSheet() {
    if (!state.notes.length) { toast('No notes to download'); return; }
    const v = '1.0.0';
    const d = new Date().toISOString().slice(0, 10);
    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-inner">
        <div class="kicker"><span>DOWNLOAD</span><span class="lime">${state.notes.length} NOTES</span></div>
        <div class="sheet-title">Export notes</div>
        <div class="col gap-12">
          <button class="btn btn-primary" id="dl-all-txt">⬇ ALL NOTES · TXT</button>
          <button class="btn" id="dl-quick-txt">⬇ QUICK NOTES · TXT</button>
          <button class="btn" id="dl-daily-txt">⬇ DAILY JOURNAL · TXT</button>
          <button class="btn" id="dl-study-txt">⬇ STUDY NOTES · TXT</button>
          <div class="ticks" style="margin:4px 0;">${'<i></i>'.repeat(28)}</div>
          <button class="btn" id="dl-all-json">⬇ ALL NOTES · JSON</button>
          <button class="btn btn-rust" id="dl-cancel">CANCEL</button>
        </div>
      </div>
    `);
    setTimeout(() => {
      document.getElementById('dl-all-txt')?.addEventListener('click',   () => doDownloadTxt('all'));
      document.getElementById('dl-quick-txt')?.addEventListener('click', () => doDownloadTxt('quick'));
      document.getElementById('dl-daily-txt')?.addEventListener('click', () => doDownloadTxt('daily'));
      document.getElementById('dl-study-txt')?.addEventListener('click', () => doDownloadTxt('study'));
      document.getElementById('dl-all-json')?.addEventListener('click',  () => doDownloadJson());
      document.getElementById('dl-cancel')?.addEventListener('click', closeSheet);
    }, 50);
  }

  function doDownloadTxt(type) {
    const labels = { all:'All Notes', quick:'Quick Notes', daily:'Daily Journal', study:'Study Notes' };
    const notes = type === 'all' ? [...state.notes] : state.notes.filter(n => n.type === type);
    if (!notes.length) { toast('No notes in this category'); return; }
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    const typeIcons = { quick:'⚡ QUICK NOTE', daily:'📓 DAILY JOURNAL', study:'📚 STUDY NOTE' };
    let txt = `MY NOTES — Grammar.AI\n${'='.repeat(50)}\n`;
    txt += `Filter: ${labels[type]}\n`;
    txt += `Exported: ${new Date().toLocaleString('en-IN')}\n`;
    txt += `Total: ${notes.length} note${notes.length !== 1 ? 's' : ''}\n`;
    txt += `${'='.repeat(50)}\n\n`;
    notes.forEach((n, i) => {
      txt += `${i+1}. ${typeIcons[n.type] || 'NOTE'}\n`;
      txt += `Date: ${fmtDate(n.updatedAt)}\n`;
      if (n.title)  txt += `Title: ${n.title}\n`;
      if (n.tags?.length) txt += `Tags: ${n.tags.join(', ')}\n`;
      txt += `${'-'.repeat(30)}\n${n.content}\n\n${'='.repeat(50)}\n\n`;
    });
    const vv = Storage.get('version', '1.0.0') || '1.0.0';
    const d  = new Date().toISOString().slice(0, 10);
    downloadFile(gFileName('NOTES', 'NO'), txt, 'text/plain');
    closeSheet();
  }

  function doDownloadJson() {
    const notes = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt);
    const vv = Storage.get('version', '1.0.0') || '1.0.0';
    const d  = new Date().toISOString().slice(0, 10);
    const dump = {
      _meta: { app: 'Grammar.AI', scope: 'Notes', exportedAt: new Date().toISOString(), count: notes.length },
      notes
    };
    downloadFile(gFileName('NOTES', 'NO', 'json'), JSON.stringify(dump, null, 2), 'application/json');
    closeSheet();
  }

  return {
    onShow() {
      // Re-check lock state — if user navigated away and back, re-lock
      if (state.unlocked) { renderNotes(); }
    },
    onHide() {
      // Auto-lock when leaving the module
      if (state.unlocked) { lock(); }
    },
    destroy() {
      document.removeEventListener('keydown', gateKeyHandler);
      if (state.toolbarCtrl) state.toolbarCtrl.destroy();
    }
  };
}

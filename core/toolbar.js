/* ────────────────────────────────────────────────────────────────
   COMPOSER TOOLBAR · shared component
   The standard toolbar pattern applied to every typing area:
     Format row:  B / H / ◐ / 👁 / aA / 📖 / ⧉
     Action row:  📎 🎤 ✨ 🌐 🗑 ▸
   Modules call:
     mountToolbar(rootEl, { textarea, onSend, onAttach, onImprove, onTranslate })
   Returns: { destroy() }
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, openSheet, closeSheet } from './ui.js';

export function renderToolbarHTML() {
  return `
    <div class="toolbar" role="toolbar" aria-label="Format">
      <button class="toolbar-btn" data-tool="bold"      title="Bold (**text**)"><b>B</b></button>
      <button class="toolbar-btn" data-tool="heading"   title="Heading">H</button>
      <button class="toolbar-btn" data-tool="highlight" title="Highlight">◐</button>
      <button class="toolbar-btn" data-tool="preview"   title="Preview formatted">👁</button>
      <button class="toolbar-btn" data-tool="case"      title="Toggle case">aA</button>
      <button class="toolbar-btn" data-tool="dictionary" title="Dictionary lookup">📖</button>
      <button class="toolbar-btn" data-tool="duplicate" title="Duplicate line">⧉</button>
    </div>
    <div class="toolbar toolbar-2" role="toolbar" aria-label="Actions">
      <button class="toolbar-btn" data-tool="attach"    title="Attach file">📎</button>
      <button class="toolbar-btn" data-tool="voice"     title="Voice input">🎤</button>
      <button class="toolbar-btn" data-tool="improve"   title="AI improve grammar">✨</button>
      <button class="toolbar-btn" data-tool="translate" title="Translate EN ↔ HI">🌐</button>
      <button class="toolbar-btn danger" data-tool="clear-input" title="Clear input">🗑</button>
      <button class="toolbar-btn send-btn" data-tool="send" title="Send (Enter)">▸</button>
    </div>
  `;
}

/** Markdown-lite preview renderer (shared). */
function renderMd(s) {
  let html = esc(s);
  html = html.replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${c}</code></pre>`);
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^\*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|\W)\*([^\*\n]+)\*(?=\W|$)/g, '$1<em>$2</em>');
  html = html.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  html = html.replace(/(^|\n)(\d+)\.\s+(.+)/g, (_, br, n, t) => `${br}<div>${n}. ${t}</div>`);
  html = html.replace(/(^|\n)[-•]\s+(.+)/g, (_, br, t) => `${br}<div>• ${t}</div>`);
  html = html.replace(/\n/g, '<br>');
  return html;
}

/**
 * Mount toolbar event handlers on an existing toolbar markup.
 * @param {HTMLElement} root - element containing the rendered toolbar HTML
 * @param {Object} cfg
 * @param {HTMLTextAreaElement} cfg.textarea - the textarea this toolbar controls
 * @param {Function} cfg.onSend       - called when user clicks ▸ or hits Enter
 * @param {Function} [cfg.onAttach]   - optional: called when user clicks 📎 with no file picker fallback
 * @param {Function} [cfg.onImprove]  - optional override for ✨ AI improve
 * @param {Function} [cfg.onTranslate]- optional override for 🌐 quick translate
 * @param {Function} [cfg.onAutoresize] - optional: called after any change to resize textarea
 * @returns {{destroy:Function}}
 */
export function mountToolbar(root, cfg) {
  const ta = cfg.textarea;
  if (!ta) throw new Error('mountToolbar: textarea is required');

  const handlers = new Map();

  function on(tool, fn) {
    const btns = $$(`.toolbar-btn[data-tool="${tool}"]`, root);
    btns.forEach(b => {
      b.addEventListener('click', fn);
      handlers.set(b, fn);
    });
  }

  function autoresize() {
    if (cfg.onAutoresize) cfg.onAutoresize();
    else { ta.style.height = 'auto'; ta.style.height = Math.min(200, ta.scrollHeight) + 'px'; }
  }

  /* Format helpers */
  function wrap(before, after) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || 'text';
    ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
    ta.focus();
    ta.selectionStart = s + before.length;
    ta.selectionEnd   = s + before.length + sel.length;
    autoresize();
  }
  function prefixLine(prefix) {
    const s = ta.selectionStart;
    const before = ta.value.slice(0, s);
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineEnd = ta.value.indexOf('\n', s) === -1 ? ta.value.length : ta.value.indexOf('\n', s);
    const line = ta.value.slice(lineStart, lineEnd);
    if (line.startsWith(prefix)) ta.value = ta.value.slice(0, lineStart) + line.slice(prefix.length) + ta.value.slice(lineStart + line.length);
    else ta.value = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
    autoresize();
    ta.focus();
  }
  function toggleCase() {
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e) { toast('Select some text first'); return; }
    const sel = ta.value.slice(s, e);
    let next;
    if (sel === sel.toUpperCase())     next = sel.toLowerCase();
    else if (sel === sel.toLowerCase()) next = sel.replace(/\b\w/g, c => c.toUpperCase());
    else                                next = sel.toUpperCase();
    ta.value = ta.value.slice(0, s) + next + ta.value.slice(e);
    ta.selectionStart = s; ta.selectionEnd = s + next.length;
    autoresize();
  }
  function duplicateLine() {
    const s = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = ta.value.indexOf('\n', s);
    if (lineEnd === -1) lineEnd = ta.value.length;
    const line = ta.value.slice(lineStart, lineEnd);
    ta.value = ta.value.slice(0, lineEnd) + '\n' + line + ta.value.slice(lineEnd);
    autoresize();
    ta.focus();
  }
  function openPreview() {
    const text = ta.value.trim();
    if (!text) { toast('Nothing to preview'); return; }
    openSheet(`
      <div class="kicker"><span>PREVIEW</span><span class="lime">FORMATTED</span></div>
      <div class="sheet-title">Preview</div>
      <div class="frame subtle output-box" style="padding:14px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        ${renderMd(text)}
      </div>
      <button class="btn mt-12" style="width:100%;" id="cmp-prev-close">CLOSE</button>
    `);
    setTimeout(() => document.getElementById('cmp-prev-close')?.addEventListener('click', closeSheet), 50);
  }
  function openDict() {
    const s = ta.selectionStart, e = ta.selectionEnd;
    let word = ta.value.slice(s, e).trim();
    if (!word) {
      const m1 = ta.value.slice(0, s).match(/[\w'-]+$/);
      const m2 = ta.value.slice(s).match(/^[\w'-]+/);
      word = (m1?.[0] || '') + (m2?.[0] || '');
    }
    if (!word) { toast('Select a word first'); return; }
    runDict(word);
  }
  async function runDict(word) {
    openSheet(`
      <div class="kicker"><span>DICTIONARY</span><span class="muted" id="cmp-dict-status">FETCHING…</span></div>
      <div class="sheet-title">${esc(word)}</div>
      <div class="frame subtle output-box" id="cmp-dict-body" style="padding:14px;min-height:80px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="muted mono" style="font-size:11px;">Looking up…</div>
      </div>
      <button class="btn mt-12" style="width:100%;" id="cmp-dict-close">CLOSE</button>
    `);
    setTimeout(() => document.getElementById('cmp-dict-close')?.addEventListener('click', closeSheet), 50);
    try {
      const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
      if (!r.ok) throw new Error('Not found');
      const arr = await r.json();
      const entry = arr[0];
      const meanings = entry.meanings || [];
      const html = `
        ${entry.phonetic ? `<div class="mono" style="font-size:12px;color:var(--muted);margin-bottom:8px;">${esc(entry.phonetic)}</div>` : ''}
        ${meanings.map(m => `
          <div class="mono lime" style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;margin-top:10px;margin-bottom:4px;">${esc(m.partOfSpeech)}</div>
          ${(m.definitions || []).slice(0, 3).map((d, i) => `
            <div style="display:flex;gap:6px;font-size:12px;line-height:1.55;margin-bottom:4px;">
              <span class="muted">${i+1}.</span><span>${esc(d.definition)}</span>
            </div>
            ${d.example ? `<div class="serif muted" style="font-size:13px;font-style:italic;margin:2px 0 8px 16px;">"${esc(d.example)}"</div>` : ''}
          `).join('')}
        `).join('')}
      `;
      const status = document.getElementById('cmp-dict-status');
      const body = document.getElementById('cmp-dict-body');
      if (status) { status.textContent = '● FOUND'; status.className = 'lime'; }
      if (body) body.innerHTML = `<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>${html}`;
    } catch {
      const status = document.getElementById('cmp-dict-status');
      const body = document.getElementById('cmp-dict-body');
      if (status) { status.textContent = '● NOT FOUND'; status.className = 'rust'; }
      if (body) body.innerHTML = `<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span><div class="muted mono" style="font-size:11px;">No definition found for "${esc(word)}".</div>`;
    }
  }

  /* Voice */
  let voiceRec = null;
  function toggleVoice() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { toast('Voice not supported on this browser', 'error'); return; }
    const btn = root.querySelector('[data-tool="voice"]');
    if (voiceRec) { voiceRec.stop(); voiceRec = null; btn?.classList.remove('on'); toast('Voice off'); return; }
    const r = new Rec();
    r.lang = (cfg.voiceLang) || 'en-IN';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (ev) => {
      let t = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) t += ev.results[i][0].transcript + ' ';
      }
      if (t) {
        ta.value = (ta.value ? ta.value + ' ' : '') + t.trim();
        autoresize();
      }
    };
    r.onerror = () => { toast('Voice error', 'error'); btn?.classList.remove('on'); voiceRec = null; };
    r.onend   = () => { btn?.classList.remove('on'); voiceRec = null; };
    r.start();
    voiceRec = r;
    btn?.classList.add('on');
    toast('Listening…');
  }

  /* Hidden file input for attach */
  let fileInput = null;
  function ensureFileInput() {
    if (fileInput) return fileInput;
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    // ANDROID FIX: display:none blocks click on Android Chrome.
    // Use opacity:0 + fixed position + zero size attached to body instead.
    fileInput.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    if (cfg.attachAccept) fileInput.accept = cfg.attachAccept;
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      fileInput.value = '';
      if (f && cfg.onAttach) cfg.onAttach(f);
    });
    // Attach to body so Android Chrome allows programmatic click
    document.body.appendChild(fileInput);
    return fileInput;
  }

  /* Wire all tools */
  on('bold',       () => wrap('**', '**'));
  on('heading',    () => prefixLine('# '));
  on('highlight',  () => wrap('==', '=='));
  on('preview',    openPreview);
  on('case',       toggleCase);
  on('dictionary', openDict);
  on('duplicate',  duplicateLine);
  on('attach',     () => { if (cfg.onAttach) ensureFileInput().click(); else toast('Attach not enabled in this module'); });
  on('voice',      toggleVoice);
  on('improve',    () => cfg.onImprove ? cfg.onImprove() : toast('AI improve not enabled here'));
  on('translate',  () => cfg.onTranslate ? cfg.onTranslate() : toast('Translate not enabled here'));
  on('clear-input',() => { ta.value = ''; autoresize(); ta.focus(); });
  on('send',       () => cfg.onSend && cfg.onSend());

  /* Enter to send (unless Shift) */
  const enterHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && cfg.onSend) {
      e.preventDefault();
      cfg.onSend();
    }
  };
  if (cfg.enterToSend !== false) ta.addEventListener('keydown', enterHandler);
  ta.addEventListener('input', autoresize);

  return {
    destroy() {
      handlers.forEach((fn, btn) => btn.removeEventListener('click', fn));
      ta.removeEventListener('keydown', enterHandler);
      ta.removeEventListener('input', autoresize);
      if (voiceRec) { try { voiceRec.stop(); } catch {} }
      if (fileInput) fileInput.remove();
    }
  };
}

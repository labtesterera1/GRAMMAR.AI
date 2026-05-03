/* ────────────────────────────────────────────────────────────────
   COMPOSER TOOLBAR · v2 · shared component
   Format row:  B / H / ◐ / 👁 / aA / 😊 / 📖 / ⧉
   Action row:  📎 🎤 ✨ 🌐 🗑 ▸

   KEY DESIGN: Every tool works WITHOUT needing a text selection.
   - Dictionary / Case / Bold / Highlight → auto-detect word at cursor
   - If textarea is empty, show friendly hint instead of error
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, openSheet, closeSheet } from './ui.js';

/* ─── Color definitions ─── */
const COLORS = {
  highlight: [
    { key: 'hl-yellow', label: 'Yellow',  tag: '[[hl-yellow]]',  css: '#f5e642', bg: '#f5e642', fg: '#000' },
    { key: 'hl-blue',   label: 'Blue',    tag: '[[hl-blue]]',    css: '#42a8f5', bg: '#42a8f5', fg: '#fff' },
    { key: 'hl-green',  label: 'Green',   tag: '[[hl-green]]',   css: '#42f57e', bg: '#42f57e', fg: '#000' },
    { key: 'hl-pink',   label: 'Pink',    tag: '[[hl-pink]]',    css: '#f542b0', bg: '#f542b0', fg: '#fff' }
  ],
  text: [
    { key: 'tx-lime',   label: 'Lime',    tag: '[[tx-lime]]',    css: '#d4ff3a', fg: '#d4ff3a' },
    { key: 'tx-red',    label: 'Red',     tag: '[[tx-red]]',     css: '#c97a5a', fg: '#c97a5a' },
    { key: 'tx-blue',   label: 'Blue',    tag: '[[tx-blue]]',    css: '#42a8f5', fg: '#42a8f5' },
    { key: 'tx-muted',  label: 'Muted',   tag: '[[tx-muted]]',   css: '#8a8479', fg: '#8a8479' }
  ]
};
const EMOJIS = {
  'Faces':   ['😊','😂','🤔','😍','😎','🥺','😅','🙏','😇','🤩','😆','😴','🤗','😬','🫡'],
  'Gestures':['👋','👍','👎','✌️','🤞','👏','🙌','🫶','💪','🤝','☝️','👉','💯','✅','❌'],
  'Objects': ['📝','📖','✏️','📎','🔍','💡','⭐','❤️','🔥','💬','📱','🎯','🏆','✨','🌟'],
  'India':   ['🇮🇳','🙏','🤙','💛','🌿','🎊','📚','🪔','🌺','☀️','🌙','💫','🎶','🌈','✈️']
};

export function renderToolbarHTML() {
  return `
    <div class="toolbar" role="toolbar" aria-label="Format">
      <button class="toolbar-btn" data-tool="bold"       title="Bold — wraps word or selection"><b>B</b></button>
      <button class="toolbar-btn" data-tool="heading"    title="Heading">H</button>
      <button class="toolbar-btn" data-tool="highlight"  title="Highlight — wraps word or selection">◐</button>
      <button class="toolbar-btn" data-tool="preview"    title="Preview formatted">👁</button>
      <button class="toolbar-btn" data-tool="case"       title="Toggle case — cycles word or selection">aA</button>
      <button class="toolbar-btn" data-tool="emoji"      title="Emoji picker">😊</button>
      <button class="toolbar-btn" data-tool="color"      title="Color — highlight & text color">🎨</button>
      <button class="toolbar-btn" data-tool="dictionary" title="Dictionary — looks up word at cursor">📖</button>
      <button class="toolbar-btn" data-tool="duplicate"  title="Duplicate current line">⧉</button>
    </div>
    <div class="toolbar toolbar-2" role="toolbar" aria-label="Actions">
      <button class="toolbar-btn" data-tool="attach"     title="Attach file">📎</button>
      <button class="toolbar-btn" data-tool="voice"      title="Voice input">🎤</button>
      <button class="toolbar-btn" data-tool="improve"    title="AI: improve grammar">✨</button>
      <button class="toolbar-btn" data-tool="translate"  title="Translate EN ↔ HI">🌐</button>
      <button class="toolbar-btn danger" data-tool="clear-input" title="Clear input">🗑</button>
      <button class="toolbar-btn send-btn" data-tool="send" title="Send (Enter)">▸</button>
    </div>
  `;
}

/** Markdown-lite preview renderer */
function renderMd(s) {
  let html = esc(s);
  // Color highlight tags: [[hl-yellow]]text[[/]]
  html = html.replace(/\[\[hl-yellow\]\](.*?)\[\[\/\]\]/g, '<mark style="background:#f5e642;color:#000;padding:0 3px;">$1</mark>');
  html = html.replace(/\[\[hl-blue\]\](.*?)\[\[\/\]\]/g,   '<mark style="background:#42a8f5;color:#fff;padding:0 3px;">$1</mark>');
  html = html.replace(/\[\[hl-green\]\](.*?)\[\[\/\]\]/g,  '<mark style="background:#42f57e;color:#000;padding:0 3px;">$1</mark>');
  html = html.replace(/\[\[hl-pink\]\](.*?)\[\[\/\]\]/g,   '<mark style="background:#f542b0;color:#fff;padding:0 3px;">$1</mark>');
  // Text color tags: [[tx-lime]]text[[/]]
  html = html.replace(/\[\[tx-lime\]\](.*?)\[\[\/\]\]/g,   '<span style="color:#d4ff3a;">$1</span>');
  html = html.replace(/\[\[tx-red\]\](.*?)\[\[\/\]\]/g,    '<span style="color:#c97a5a;">$1</span>');
  html = html.replace(/\[\[tx-blue\]\](.*?)\[\[\/\]\]/g,   '<span style="color:#42a8f5;">$1</span>');
  html = html.replace(/\[\[tx-muted\]\](.*?)\[\[\/\]\]/g,  '<span style="color:#8a8479;">$1</span>');
  // Standard markdown
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

/* ────────────────────────────────────────────────────────────────
   WORD-AT-CURSOR helper
   Returns {start, end, word} of the word touching the cursor.
   If there is an active selection, returns the selection instead.
   ──────────────────────────────────────────────────────────────── */
function wordAtCursor(ta) {
  const s = ta.selectionStart;
  const e = ta.selectionEnd;
  const val = ta.value;

  // If user has a real selection, use it
  if (s !== e) return { start: s, end: e, word: val.slice(s, e) };

  // Auto-detect: scan left and right from cursor for word chars
  const WORD = /[\wÀ-ÖØ-öø-ÿ'-]/;
  let left  = s;
  let right = s;
  while (left  > 0        && WORD.test(val[left  - 1])) left--;
  while (right < val.length && WORD.test(val[right]))    right++;

  return { start: left, end: right, word: val.slice(left, right) };
}

/* ────────────────────────────────────────────────────────────────
   PUBLIC: mountToolbar
   ──────────────────────────────────────────────────────────────── */
export function mountToolbar(root, cfg) {
  const ta = cfg.textarea;
  if (!ta) throw new Error('mountToolbar: textarea is required');

  const handlers = new Map();

  function on(tool, fn) {
    $$(`.toolbar-btn[data-tool="${tool}"]`, root).forEach(b => {
      b.addEventListener('click', fn);
      handlers.set(b, fn);
    });
  }

  function autoresize() {
    if (cfg.onAutoresize) cfg.onAutoresize();
    else { ta.style.height = 'auto'; ta.style.height = Math.min(200, ta.scrollHeight) + 'px'; }
  }

  /* ─── Format tools ─── */

  function wrap(before, after) {
    const { start, end, word } = wordAtCursor(ta);
    const val = ta.value;
    if (!word && !val.trim()) { toast('Type something first'); return; }
    const target = word || 'text';
    const insert = before + target + after;
    ta.value = val.slice(0, start) + insert + val.slice(end);
    ta.focus();
    ta.selectionStart = start + before.length;
    ta.selectionEnd   = start + before.length + target.length;
    autoresize();
  }

  function prefixLine(prefix) {
    const s = ta.selectionStart;
    const val = ta.value;
    const lineStart = val.lastIndexOf('\n', s - 1) + 1;
    const lineEnd   = val.indexOf('\n', s) === -1 ? val.length : val.indexOf('\n', s);
    const line = val.slice(lineStart, lineEnd);
    if (line.startsWith(prefix)) {
      ta.value = val.slice(0, lineStart) + line.slice(prefix.length) + val.slice(lineStart + line.length);
    } else {
      ta.value = val.slice(0, lineStart) + prefix + val.slice(lineStart);
    }
    autoresize();
    ta.focus();
  }

  function toggleCase() {
    const { start, end, word } = wordAtCursor(ta);
    if (!word) { toast('Type something first'); return; }
    let next;
    if (word === word.toUpperCase())     next = word.toLowerCase();
    else if (word === word.toLowerCase()) next = word.replace(/\b\w/g, c => c.toUpperCase());
    else                                  next = word.toUpperCase();
    ta.value = ta.value.slice(0, start) + next + ta.value.slice(end);
    ta.selectionStart = start;
    ta.selectionEnd   = start + next.length;
    autoresize();
  }

  function duplicateLine() {
    const s = ta.selectionStart;
    const val = ta.value;
    const lineStart = val.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = val.indexOf('\n', s);
    if (lineEnd === -1) lineEnd = val.length;
    const line = val.slice(lineStart, lineEnd);
    ta.value = val.slice(0, lineEnd) + '\n' + line + val.slice(lineEnd);
    autoresize();
    ta.focus();
  }

  function openPreview() {
    const text = ta.value.trim();
    if (!text) { toast('Nothing to preview'); return; }
    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-inner">
        <div class="kicker"><span>PREVIEW</span><span class="lime">FORMATTED</span></div>
        <div class="sheet-title">Preview</div>
        <div class="frame subtle output-box" style="padding:14px;">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          ${renderMd(text)}
        </div>
        <button class="btn mt-12" style="width:100%;" id="cmp-prev-close">CLOSE</button>
      </div>
    `);
    setTimeout(() => document.getElementById('cmp-prev-close')?.addEventListener('click', closeSheet), 50);
  }

  /* ─── Dictionary — works without selection ─── */
  function openDict() {
    const { word } = wordAtCursor(ta);
    if (!word) { toast('Place cursor on a word first'); return; }
    runDict(word.replace(/[^a-zA-Z'-]/g, ''));
  }

  async function runDict(word) {
    if (!word) { toast('No word found at cursor'); return; }
    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-inner">
        <div class="kicker"><span>DICTIONARY</span><span class="muted" id="cmp-dict-status">FETCHING…</span></div>
        <div class="sheet-title" id="cmp-dict-word">${esc(word)}</div>
        <div class="frame subtle output-box" id="cmp-dict-body" style="padding:14px;min-height:80px;">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="mono dim" style="font-size:11px;">Looking up "${esc(word)}"…</div>
        </div>
        <button class="btn mt-12" style="width:100%;" id="cmp-dict-close">CLOSE</button>
      </div>
    `);
    setTimeout(() => document.getElementById('cmp-dict-close')?.addEventListener('click', closeSheet), 50);
    try {
      const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
      if (!r.ok) throw new Error('Not found');
      const arr = await r.json();
      const entry = arr[0];
      const html = `
        ${entry.phonetic ? `<div class="mono" style="font-size:12px;color:var(--muted);margin-bottom:8px;">${esc(entry.phonetic)}</div>` : ''}
        ${(entry.meanings || []).map(m => `
          <div class="mono lime" style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;margin-top:12px;margin-bottom:4px;">${esc(m.partOfSpeech)}</div>
          ${(m.definitions || []).slice(0, 3).map((d, i) => `
            <div style="display:flex;gap:6px;font-size:12px;line-height:1.55;margin-bottom:4px;">
              <span class="mono muted">${i+1}.</span>
              <span>${esc(d.definition)}</span>
            </div>
            ${d.example ? `<div class="serif" style="font-size:13px;font-style:italic;color:var(--muted);margin:2px 0 8px 16px;">"${esc(d.example)}"</div>` : ''}
          `).join('')}
        `).join('')}
      `;
      document.getElementById('cmp-dict-status')?.setAttribute('class', 'lime');
      const s = document.getElementById('cmp-dict-status');
      if (s) s.textContent = '● FOUND';
      const b = document.getElementById('cmp-dict-body');
      if (b) b.innerHTML = `<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>${html}`;
    } catch {
      const s = document.getElementById('cmp-dict-status');
      const b = document.getElementById('cmp-dict-body');
      if (s) { s.textContent = '● NOT FOUND'; s.className = 'rust'; }
      if (b) b.innerHTML = `<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span><div class="mono dim" style="font-size:11px;">No definition found for "<strong>${esc(word)}</strong>".</div>`;
    }
  }

  /* ─── Emoji picker ─── */
  function openEmoji() {
    const catKeys = Object.keys(EMOJIS);
    let activeTab = catKeys[0];

    function renderEmojiSheet(tab) {
      return `
        <div class="sheet-handle"></div>
        <div class="sheet-inner">
          <div class="kicker"><span>EMOJI</span><span class="lime">TAP TO INSERT</span></div>
          <div class="lang-chips" id="emoji-tabs">
            ${catKeys.map(k => `<button class="chip ${k === tab ? 'on' : ''}" data-etab="${esc(k)}">${esc(k)}</button>`).join('')}
          </div>
          <div class="emoji-grid mt-12" id="emoji-grid">
            ${(EMOJIS[tab] || []).map(e => `
              <button class="emoji-btn" data-emoji="${esc(e)}">${e}</button>
            `).join('')}
          </div>
          <button class="btn mt-12" style="width:100%;" id="emoji-close">CLOSE</button>
        </div>
      `;
    }

    openSheet(renderEmojiSheet(activeTab));

    setTimeout(() => {
      function wireSheet() {
        $$('#emoji-tabs .chip[data-etab]').forEach(b => {
          b.addEventListener('click', () => {
            activeTab = b.dataset.etab;
            const grid = document.getElementById('emoji-grid');
            const tabs = document.querySelectorAll('#emoji-tabs .chip[data-etab]');
            tabs.forEach(x => x.classList.toggle('on', x.dataset.etab === activeTab));
            if (grid) grid.innerHTML = (EMOJIS[activeTab] || []).map(e =>
              `<button class="emoji-btn" data-emoji="${esc(e)}">${e}</button>`
            ).join('');
            wireEmojis();
          });
        });
        wireEmojis();
        document.getElementById('emoji-close')?.addEventListener('click', closeSheet);
      }

      function wireEmojis() {
        $$('#emoji-grid .emoji-btn[data-emoji]').forEach(b => {
          b.addEventListener('click', () => {
            const emoji = b.dataset.emoji;
            const pos = ta.selectionStart || ta.value.length;
            ta.value = ta.value.slice(0, pos) + emoji + ta.value.slice(pos);
            ta.focus();
            ta.selectionStart = ta.selectionEnd = pos + emoji.length;
            autoresize();
            toast(emoji + ' inserted');
          });
        });
      }
      wireSheet();
    }, 60);
  }

  /* ─── Color picker ─── */
  function openColorPicker() {
    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-inner">
        <div class="kicker"><span>COLOR</span><span class="lime">HIGHLIGHT + TEXT</span></div>
        <div class="sheet-title">Color picker</div>

        <div class="s-ttl" style="margin-top:0;"><span>HIGHLIGHT</span></div>
        <div class="color-swatches" id="cp-hl">
          ${COLORS.highlight.map(c => `
            <button class="color-swatch" data-ckey="${esc(c.key)}" data-ctype="highlight"
              style="background:${esc(c.bg)};color:${esc(c.fg)};" title="${esc(c.label)}">
              ${esc(c.label)}
            </button>
          `).join('')}
        </div>

        <div class="s-ttl"><span>TEXT COLOR</span></div>
        <div class="color-swatches" id="cp-tx">
          ${COLORS.text.map(c => `
            <button class="color-swatch color-swatch-text" data-ckey="${esc(c.key)}" data-ctype="text"
              style="border-color:${esc(c.fg)};color:${esc(c.fg)};" title="${esc(c.label)}">
              ${esc(c.label)}
            </button>
          `).join('')}
        </div>

        <div class="mono dim" style="font-size:9px;letter-spacing:0.06em;line-height:1.6;margin-top:10px;">
          Colors render in 👁 Preview, chat bubbles, and note cards.
          In the textarea you will see the tag syntax — tap 👁 to preview.
        </div>
        <button class="btn mt-12" style="width:100%;" id="cp-close">CLOSE</button>
      </div>
    `);

    setTimeout(() => {
      // Wire highlight swatches
      document.querySelectorAll('[data-ckey][data-ctype="highlight"]').forEach(b => {
        b.addEventListener('click', () => {
          const col = COLORS.highlight.find(c => c.key === b.dataset.ckey);
          if (!col) return;
          wrapColor(col.tag, col.key);
          closeSheet();
        });
      });
      // Wire text color swatches
      document.querySelectorAll('[data-ckey][data-ctype="text"]').forEach(b => {
        b.addEventListener('click', () => {
          const col = COLORS.text.find(c => c.key === b.dataset.ckey);
          if (!col) return;
          wrapColor(col.tag, col.key);
          closeSheet();
        });
      });
      document.getElementById('cp-close')?.addEventListener('click', closeSheet);
    }, 60);
  }

  function wrapColor(tag, key) {
    const { start, end, word } = wordAtCursor(ta);
    const val    = ta.value;
    const target = (start !== end) ? val.slice(start, end) : (word || 'text');
    const s      = start !== end ? start : (start - (word?.length || 0));
    const e      = start !== end ? end   : start;
    const insert = `${tag}${target}[[/]]`;
    ta.value = val.slice(0, s) + insert + val.slice(e);
    ta.focus();
    ta.selectionStart = s + tag.length;
    ta.selectionEnd   = s + tag.length + target.length;
    autoresize();
  }
  let voiceRec = null;
  function toggleVoice() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { toast('Voice not supported on this browser', 'error'); return; }
    const btn = root.querySelector('[data-tool="voice"]');
    if (voiceRec) {
      voiceRec.stop();
      voiceRec = null;
      btn?.classList.remove('on');
      toast('Voice off');
      return;
    }
    const r = new Rec();
    r.lang = cfg.voiceLang || 'en-IN';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (ev) => {
      let t = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) t += ev.results[i][0].transcript + ' ';
      }
      if (t) {
        const pos = ta.selectionStart;
        ta.value = ta.value.slice(0, pos) + t.trim() + ' ' + ta.value.slice(pos);
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

  /* ─── File input (Android-safe) ─── */
  let fileInput = null;
  function ensureFileInput() {
    if (fileInput) return fileInput;
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    // Android fix: position:fixed + opacity:0 + body-attached
    fileInput.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    if (cfg.attachAccept) fileInput.accept = cfg.attachAccept;
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      fileInput.value = '';
      if (f && cfg.onAttach) cfg.onAttach(f);
    });
    document.body.appendChild(fileInput);
    return fileInput;
  }

  /* ─── Wire all tools ─── */
  on('bold',        () => wrap('**', '**'));
  on('heading',     () => prefixLine('# '));
  on('highlight',   () => wrap('==', '=='));
  on('preview',     openPreview);
  on('case',        toggleCase);
  on('emoji',       openEmoji);
  on('color',       openColorPicker);
  on('dictionary',  openDict);
  on('duplicate',   duplicateLine);
  on('attach',      () => { if (cfg.onAttach) ensureFileInput().click(); else toast('Attach not enabled here'); });
  on('voice',       toggleVoice);
  on('improve',     () => cfg.onImprove   ? cfg.onImprove()   : toast('AI improve not enabled here'));
  on('translate',   () => cfg.onTranslate ? cfg.onTranslate() : toast('Translate not enabled here'));
  on('clear-input', () => { ta.value = ''; autoresize(); ta.focus(); });
  on('send',        () => cfg.onSend && cfg.onSend());

  /* Enter to send */
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

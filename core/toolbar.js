/* ────────────────────────────────────────────────────────────────
   COMPOSER TOOLBAR · v3 · shared component
   Format row:  B / H / ◐ / 👁 / aA / 😊 / ⧉
   Action row:  📎 🎤 ✨ 🌐 🗑 ▸

   INPUT always stays clean — no color tags injected here.
   Color picker is output-only via mountOutputColorPicker() in ui.js.
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, openSheet, closeSheet } from './ui.js';

const EMOJIS = {
  'Faces':   ['😊','😂','🤔','😍','😎','🥺','😅','🙏','😇','🤩','😆','😴','🤗','😬','🫡'],
  'Gestures':['👋','👍','👎','✌️','🤞','👏','🙌','🫶','💪','🤝','☝️','👉','💯','✅','❌'],
  'Objects': ['📝','📖','✏️','📎','🔍','💡','⭐','❤️','🔥','💬','📱','🎯','🏆','✨','🌟'],
  'India':   ['🇮🇳','🙏','🤙','💛','🌿','🎊','📚','🪔','🌺','☀️','🌙','💫','🎶','🌈','✈️']
};

export function renderToolbarHTML() {
  return `
    <div class="toolbar" role="toolbar" aria-label="Format">
      <button class="toolbar-btn" data-tool="bold"       title="Bold"><b>B</b></button>
      <button class="toolbar-btn" data-tool="heading"    title="Heading">H</button>
      <button class="toolbar-btn" data-tool="highlight"  title="Highlight word">◐</button>
      <button class="toolbar-btn" data-tool="preview"    title="Preview formatted">👁</button>
      <button class="toolbar-btn" data-tool="case"       title="Toggle case">aA</button>
      <button class="toolbar-btn" data-tool="emoji"      title="Emoji picker">😊</button>
      <button class="toolbar-btn" data-tool="duplicate"  title="Duplicate line">⧉</button>
    </div>
    <div class="toolbar toolbar-2" role="toolbar" aria-label="Actions">
      <button class="toolbar-btn" data-tool="attach"      title="Attach file">📎</button>
      <button class="toolbar-btn" data-tool="voice"       title="Voice input">🎤</button>
      <button class="toolbar-btn" data-tool="improve"     title="AI: improve grammar">✨</button>
      <button class="toolbar-btn" data-tool="translate"   title="Translate EN ↔ HI">🌐</button>
      <button class="toolbar-btn danger" data-tool="clear-input" title="Clear input">🗑</button>
      <button class="toolbar-btn send-btn" data-tool="send" title="Send">▸</button>
    </div>
  `;
}

/** Markdown-lite preview renderer */
function renderMd(s) {
  let html = esc(s);
  // Color highlight tags — [\s\S]*? handles multiline spans
  html = html.replace(/\[\[hl-yellow\]\]([\s\S]*?)\[\[\/\]\]/g, '<mark style="background:#f5e642;color:#000;padding:0 3px;">$1</mark>');
  html = html.replace(/\[\[hl-blue\]\]([\s\S]*?)\[\[\/\]\]/g,   '<mark style="background:#42a8f5;color:#fff;padding:0 3px;">$1</mark>');
  html = html.replace(/\[\[hl-green\]\]([\s\S]*?)\[\[\/\]\]/g,  '<mark style="background:#42f57e;color:#000;padding:0 3px;">$1</mark>');
  html = html.replace(/\[\[hl-pink\]\]([\s\S]*?)\[\[\/\]\]/g,   '<mark style="background:#f542b0;color:#fff;padding:0 3px;">$1</mark>');
  // Text color tags
  html = html.replace(/\[\[tx-lime\]\]([\s\S]*?)\[\[\/\]\]/g,   '<span style="color:#d4ff3a;">$1</span>');
  html = html.replace(/\[\[tx-red\]\]([\s\S]*?)\[\[\/\]\]/g,    '<span style="color:#c97a5a;">$1</span>');
  html = html.replace(/\[\[tx-blue\]\]([\s\S]*?)\[\[\/\]\]/g,   '<span style="color:#42a8f5;">$1</span>');
  html = html.replace(/\[\[tx-muted\]\]([\s\S]*?)\[\[\/\]\]/g,  '<span style="color:#8a8479;">$1</span>');
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

  /* ─── Emoji picker ─── */
  function openEmoji() {
    // Save cursor position before sheet opens (mobile loses focus)
    const savedPos = ta.selectionStart !== undefined ? ta.selectionStart : ta.value.length;
    const catKeys  = Object.keys(EMOJIS);
    let activeTab  = catKeys[0];

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
            // Use savedPos — textarea lost focus when sheet opened on mobile
            const pos = savedPos;
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

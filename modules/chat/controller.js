/* ────────────────────────────────────────────────────────────────
   CHAT MODULE · controller · v1.1.0
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, copyToClipboard, downloadFile, openSheet, closeSheet, timeAgo, readFileAsText } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';
import { go } from '../../core/router.js';

/** Markdown-lite renderer. */
function renderMd(s) {
  let html = esc(s);
  html = html.replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${c}</code></pre>`);
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^\*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|\W)\*([^\*\n]+)\*(?=\W|$)/g, '$1<em>$2</em>');
  html = html.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  html = html.replace(/(^|\n)(\d+)\.\s+(.+)/g, (_, br, n, t) => `${br}<div class="li-num">${n}. ${t}</div>`);
  html = html.replace(/(^|\n)[-•]\s+(.+)/g, (_, br, t) => `${br}<div class="li-bul">• ${t}</div>`);
  html = html.replace(/\n/g, '<br>');
  return html;
}

const SCOPE = Storage.scope('chat');

export default async function init({ root, module }) {

  /* ─── Load module manifest + prompts ─── */
  let manifest = { options: {} };
  try { manifest = await fetch('modules/chat/manifest.json').then(r => r.json()); } catch {}
  const opts = manifest.options || {};

  let prompts = {};
  try { prompts = await fetch('config/prompts.json').then(r => r.json()); } catch {}

  /* ─── State ─── */
  const state = {
    lang: SCOPE.get('lang', opts.defaultLanguageMode || 'english'),
    history: SCOPE.get('history', []),
    attachments: [],
    sending: false,
    voice: null
  };

  /* ─── Refs ─── */
  const elStream     = $('#msg-stream', root);
  const elStreamWrap = root.querySelector('.chat-stream-wrap');
  const elInput      = $('#composer-input', root);
  const elQuick      = $('#quick-chips', root);
  const elAttach     = $('#attach-bar', root);
  const elFile       = $('#file-input', root);
  const elHistL      = root.querySelector('[data-bind="historyLine"]');
  const elModelL     = root.querySelector('[data-bind="modelLine"]');
  const elStatus     = root.querySelector('[data-bind="status"]');
  const elModNum     = root.querySelector('[data-bind="moduleNum"]');

  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  /* ─── No-route helper sheet ─── */
  function showNoRouteHelp() {
    const hasW = AI.hasWorker();
    const hasK = AI.hasAnyKey();
    openSheet(`
      <div class="kicker"><span>SETUP REQUIRED</span><span class="rust">● NO ROUTE</span></div>
      <div class="sheet-title">Connect an AI route</div>
      <div class="frame subtle" style="padding:14px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="mono" style="font-size:12px;line-height:1.7;color:var(--text);">
          Grammar.AI needs at least one route to talk to an AI:
        </div>
        <div class="ticks" style="margin:12px 0 8px;">${'<i></i>'.repeat(28)}</div>
        <div class="mono" style="font-size:11px;line-height:1.8;letter-spacing:0.06em;">
          ${hasW ? '✓' : '○'} <span class="${hasW ? 'lime' : 'muted'}">Cloudflare Worker URL</span><br>
          ${hasK ? '✓' : '○'} <span class="${hasK ? 'lime' : 'muted'}">Or a free provider key (Groq is fastest)</span>
        </div>
        <div class="mode-help" style="margin-top:10px;">Set up either one — or both. Direct keys work as fallback if the Worker fails.</div>
      </div>
      <div class="row gap-12 mt-12">
        <button class="btn flex-1" id="nr-cancel">CANCEL</button>
        <button class="btn btn-primary flex-1" id="nr-go">⚙ OPEN SETTINGS</button>
      </div>
    `);
    setTimeout(() => {
      document.getElementById('nr-cancel')?.addEventListener('click', closeSheet);
      document.getElementById('nr-go')?.addEventListener('click', () => { closeSheet(); go('settings'); });
    }, 50);
  }

  /* ─── Initial paint ─── */
  paintLang();
  paintQuickChips();
  refreshStatus();

  if (state.history.length === 0) paintWelcome();
  else paintHistory();

  /* ─── Wire language chips ─── */
  $$('.chip[data-lang]', root).forEach(b => {
    b.addEventListener('click', () => {
      state.lang = b.dataset.lang;
      SCOPE.set('lang', state.lang);
      paintLang();
      refreshStatus();
    });
  });

  /* ─── Quick chips ─── */
  function paintQuickChips() {
    elQuick.innerHTML = (opts.quickChips || []).map(q =>
      `<button class="quick-chip" data-text="${esc(q.text)}">${esc(q.label)}</button>`
    ).join('');
    $$('.quick-chip', elQuick).forEach(c => {
      c.addEventListener('click', () => {
        elInput.value = c.dataset.text;
        elInput.focus();
        autoresize();
      });
    });
  }

  /* ─── Toolbar wiring ─── */
  $$('.toolbar-btn', root).forEach(b => {
    b.addEventListener('click', () => onTool(b.dataset.tool));
  });

  /* ─── File input ─── */
  elFile.addEventListener('change', () => {
    const f = elFile.files?.[0];
    elFile.value = '';
    if (f) addAttachment(f);
  });

  /* ─── Composer ─── */
  elInput.addEventListener('input', autoresize);
  elInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  /* ─── Header buttons ─── */
  $('#chat-history-clear', root).addEventListener('click', () => {
    if (state.history.length === 0) { toast('No history to clear'); return; }
    if (!confirm('Clear the entire chat history?')) return;
    state.history = [];
    SCOPE.set('history', state.history);
    paintWelcome();
    refreshStatus();
    toast('History cleared', 'success');
  });
  $('#chat-export', root).addEventListener('click', () => exportChat());

  /* ─── Toolbar router ─── */
  function onTool(tool) {
    switch (tool) {
      case 'bold':       return wrap('**', '**');
      case 'heading':    return prefixLine('# ');
      case 'highlight':  return wrap('==', '==');
      case 'preview':    return openPreview();
      case 'case':       return toggleCase();
      case 'dictionary': return openDictionary();
      case 'duplicate':  return duplicateLine();
      case 'attach':     return elFile.click();
      case 'voice':      return toggleVoice();
      case 'improve':    return runQuick('quick_improve', 'Improving…');
      case 'translate':  return quickTranslate();
      case 'clear-input':elInput.value = ''; autoresize(); return;
      case 'send':       return send();
    }
  }

  /* ─── Toolbar implementations ─── */

  function wrap(before, after) {
    const ta = elInput;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || 'text';
    ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
    ta.focus();
    ta.selectionStart = s + before.length;
    ta.selectionEnd   = s + before.length + sel.length;
    autoresize();
  }

  function prefixLine(prefix) {
    const ta = elInput;
    const s = ta.selectionStart;
    const before = ta.value.slice(0, s);
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineEnd = ta.value.indexOf('\n', s) === -1 ? ta.value.length : ta.value.indexOf('\n', s);
    const line = ta.value.slice(lineStart, lineEnd);
    if (line.startsWith(prefix)) {
      ta.value = ta.value.slice(0, lineStart) + line.slice(prefix.length) + ta.value.slice(lineStart + line.length);
    } else {
      ta.value = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
    }
    autoresize();
    ta.focus();
  }

  function toggleCase() {
    const ta = elInput;
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
    const ta = elInput;
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
    const text = elInput.value.trim();
    if (!text) { toast('Nothing to preview'); return; }
    openSheet(`
      <div class="kicker"><span>PREVIEW</span><span class="lime">FORMATTED</span></div>
      <div class="sheet-title">Preview</div>
      <div class="frame subtle preview-body" style="padding:14px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        ${renderMd(text)}
      </div>
      <button class="btn mt-12" style="width:100%;" id="prev-close">CLOSE</button>
    `);
    setTimeout(() => document.getElementById('prev-close')?.addEventListener('click', closeSheet), 50);
  }

  function openDictionary() {
    const ta = elInput;
    const s = ta.selectionStart, e = ta.selectionEnd;
    let word = ta.value.slice(s, e).trim();
    if (!word) {
      const before = ta.value.slice(0, s);
      const after  = ta.value.slice(s);
      const m1 = before.match(/[\w'-]+$/);
      const m2 = after.match(/^[\w'-]+/);
      word = (m1?.[0] || '') + (m2?.[0] || '');
    }
    if (!word) { toast('Select a word first'); return; }
    runDictionary(word);
  }

  async function runDictionary(word) {
    openSheet(`
      <div class="kicker"><span>DICTIONARY</span><span class="muted" id="dict-status">FETCHING…</span></div>
      <div class="sheet-title" id="dict-word">${esc(word)}</div>
      <div class="frame subtle" id="dict-body" style="padding:14px;min-height:80px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="muted mono" style="font-size:11px;letter-spacing:0.06em;">Looking up…</div>
      </div>
      <button class="btn mt-12" style="width:100%;" id="dict-close">CLOSE</button>
    `);
    setTimeout(() => document.getElementById('dict-close')?.addEventListener('click', closeSheet), 50);
    try {
      const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
      if (!r.ok) throw new Error('Not found');
      const arr = await r.json();
      const entry = arr[0];
      const meanings = entry.meanings || [];
      const html = `
        ${entry.phonetic ? `<div class="dict-phonetic mono">${esc(entry.phonetic)}</div>` : ''}
        ${meanings.map(m => `
          <div class="dict-pos mono">${esc(m.partOfSpeech)}</div>
          ${(m.definitions || []).slice(0, 3).map((d, i) => `
            <div class="dict-def">
              <span class="dict-num mono">${i+1}.</span>
              <span>${esc(d.definition)}</span>
            </div>
            ${d.example ? `<div class="dict-ex serif">"${esc(d.example)}"</div>` : ''}
          `).join('')}
        `).join('')}
      `;
      const dictStatus = document.getElementById('dict-status');
      const dictBody = document.getElementById('dict-body');
      if (dictStatus) { dictStatus.textContent = '● FOUND'; dictStatus.className = 'lime'; }
      if (dictBody) dictBody.innerHTML = `<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>${html}`;
    } catch {
      const dictStatus = document.getElementById('dict-status');
      const dictBody = document.getElementById('dict-body');
      if (dictStatus) { dictStatus.textContent = '● NOT FOUND'; dictStatus.className = 'rust'; }
      if (dictBody) dictBody.innerHTML = `<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span><div class="muted mono" style="font-size:11px;">No definition found for "${esc(word)}".</div>`;
    }
  }

  /* ─── Voice ─── */
  function toggleVoice() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { toast('Voice input not supported on this browser', 'error'); return; }
    const btn = root.querySelector('[data-tool="voice"]');
    if (state.voice) {
      state.voice.stop();
      state.voice = null;
      btn.classList.remove('on');
      toast('Voice off');
      return;
    }
    const r = new Rec();
    r.lang = state.lang === 'hindi' ? 'hi-IN' : 'en-IN';
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (ev) => {
      const t = ev.results[0][0].transcript;
      elInput.value = (elInput.value ? elInput.value + ' ' : '') + t;
      autoresize();
    };
    r.onerror = () => { toast('Voice error', 'error'); btn.classList.remove('on'); state.voice = null; };
    r.onend   = () => { btn.classList.remove('on'); state.voice = null; };
    r.start();
    state.voice = r;
    btn.classList.add('on');
    toast('Listening…');
  }

  /* ─── Quick AI: improve / translate ─── */
  async function runQuick(promptKey, busyMsg) {
    const text = elInput.value.trim();
    if (!text) { toast('Type something first'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }
    const prompt = prompts[promptKey];
    if (!prompt) { toast('Prompt missing', 'error'); return; }
    toast(busyMsg);
    try {
      const r = await AI.chat([
        { role: 'system', content: prompt },
        { role: 'user',   content: text }
      ], { temperature: 0.3, maxTokens: 700 });
      elInput.value = r.text;
      autoresize();
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      toast('Failed: ' + (e.details?.[0] || e.message), 'error');
    }
  }

  function quickTranslate() {
    const text = elInput.value.trim();
    if (!text) { toast('Type something first'); return; }
    const isHindi = /[\u0900-\u097F]/.test(text);
    runQuick(isHindi ? 'quick_translate_hi2en' : 'quick_translate_en2hi', isHindi ? 'Hindi → English…' : 'English → Hindi…');
  }

  /* ─── Attachments ─── */
  async function addAttachment(file) {
    const maxKb = (opts.attachments?.maxSizeKb) || 256;
    if (file.size > maxKb * 1024) { toast(`File too large (max ${maxKb} KB)`, 'error'); return; }
    const isText = file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name);
    const att = { id: Math.random().toString(36).slice(2), name: file.name, size: file.size, type: file.type, content: null };
    if (isText) att.content = await readFileAsText(file);
    else if (file.type.startsWith('image/')) att.content = '[image attached: ' + file.name + ']';
    else att.content = '[file attached: ' + file.name + ']';
    state.attachments.push(att);
    paintAttachments();
  }

  function paintAttachments() {
    if (state.attachments.length === 0) { elAttach.innerHTML = ''; return; }
    elAttach.innerHTML = state.attachments.map(a => `
      <div class="attach-chip" data-id="${esc(a.id)}">
        <span class="attach-icn">📎</span>
        <span class="attach-name">${esc(a.name)}</span>
        <button class="attach-x" data-rem="${esc(a.id)}" title="Remove">×</button>
      </div>
    `).join('');
    $$('[data-rem]', elAttach).forEach(b => {
      b.addEventListener('click', () => {
        state.attachments = state.attachments.filter(a => a.id !== b.dataset.rem);
        paintAttachments();
      });
    });
  }

  /* ─── Send ─── */
  async function send() {
    if (state.sending) { toast('Already sending'); return; }
    const text = elInput.value.trim();
    if (!text && state.attachments.length === 0) { toast('Type a message'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }

    let userText = text;
    if (state.attachments.length) {
      const att = state.attachments.map(a => `\n\n[Attachment: ${a.name}]\n${a.content || ''}`).join('');
      userText = (userText || '(see attachments)') + att;
    }

    const userMsg = { role: 'user', content: userText, ts: Date.now() };
    state.history.push(userMsg);
    saveHistory();
    appendBubble(userMsg);

    elInput.value = '';
    state.attachments = [];
    paintAttachments();
    autoresize();

    const sysKey = state.lang === 'english' ? 'chat_english_only' : state.lang === 'hindi' ? 'chat_hindi_only' : 'chat_default';
    const conv = [
      { role: 'system', content: prompts[sysKey] || prompts.chat_default || '' },
      ...state.history.slice(-20).map(m => ({ role: m.role, content: m.content }))
    ];

    state.sending = true;
    refreshStatus();
    const typingEl = appendTyping();

    try {
      const r = await AI.chat(conv, { temperature: 0.6, maxTokens: 900 });
      typingEl.remove();
      const botMsg = { role: 'assistant', content: r.text, ts: Date.now(), route: r.route };
      state.history.push(botMsg);
      const max = opts.historyMax || 50;
      if (state.history.length > max) state.history = state.history.slice(-max);
      saveHistory();
      appendBubble(botMsg);
    } catch (e) {
      typingEl.remove();
      const errMsg = { role: 'assistant', content: '⚠ ' + (e.details?.[0] || e.message), ts: Date.now(), error: true };
      state.history.push(errMsg);
      saveHistory();
      appendBubble(errMsg);
    } finally {
      state.sending = false;
      refreshStatus();
    }
  }

  /* ─── Render helpers ─── */

  function paintLang() {
    $$('.chip[data-lang]', root).forEach(b => b.classList.toggle('on', b.dataset.lang === state.lang));
  }

  function paintWelcome() {
    elStream.innerHTML = renderWelcome();
    const cta = document.getElementById('welcome-cta-btn');
    if (cta) cta.addEventListener('click', showNoRouteHelp);
  }

  function paintHistory() {
    if (state.history.length === 0) { paintWelcome(); return; }
    elStream.innerHTML = '';
    for (const m of state.history) appendBubble(m, false);
    scrollBottom();
  }

  function appendBubble(m, scroll = true) {
    const wrap = document.createElement('div');
    wrap.className = 'bubble bubble-' + m.role + (m.error ? ' bubble-err' : '');
    wrap.dataset.ts = m.ts;
    wrap.innerHTML = `
      <div class="bubble-meta">
        <span>${m.role === 'user' ? 'YOU' : (m.route ? m.route.toUpperCase() : 'GRAMMAR.AI')}</span>
        <span>${esc(timeAgo(m.ts))}</span>
      </div>
      <div class="bubble-body">${renderMd(m.content)}</div>
      <div class="bubble-actions">
        <button class="bubble-act" data-act="copy">COPY</button>
        ${m.role === 'assistant' ? `<button class="bubble-act" data-act="reuse">REUSE</button>` : ''}
      </div>
    `;
    wrap.querySelector('[data-act="copy"]').addEventListener('click', () => copyToClipboard(m.content));
    const reuse = wrap.querySelector('[data-act="reuse"]');
    if (reuse) reuse.addEventListener('click', () => { elInput.value = m.content; elInput.focus(); autoresize(); });
    elStream.appendChild(wrap);
    if (scroll) scrollBottom();
  }

  function appendTyping() {
    const w = document.createElement('div');
    w.className = 'bubble bubble-assistant typing';
    w.innerHTML = `
      <div class="bubble-meta"><span>GRAMMAR.AI</span><span>typing…</span></div>
      <div class="bubble-body"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
    `;
    elStream.appendChild(w);
    scrollBottom();
    return w;
  }

  function renderWelcome() {
    const greet = state.lang === 'hindi' ? 'नमस्ते! ग्रामर सीखने के लिए तैयार?'
                : state.lang === 'english' ? "Hi! Ready to learn some grammar?"
                : 'Namaste! Ready to learn some grammar?';
    const tip = 'Tap a chip above or type a question. Long messages, voice, attachments — all supported.';
    const noRoute = !AI.hasAnyRoute();
    return `
      <div class="welcome frame subtle">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="kicker"><span>WELCOME</span><span class="${noRoute ? 'rust' : 'lime'}">● ${noRoute ? 'NEEDS SETUP' : 'READY'}</span></div>
        <div class="welcome-greet serif">${esc(greet)}</div>
        <div class="welcome-tip mono">${esc(tip)}</div>
        ${noRoute ? `
          <div class="welcome-cta mono">
            <span>⚠ Set up an AI route once to start chatting.</span>
            <button class="btn btn-primary btn-icon" id="welcome-cta-btn">⚙ SETUP</button>
          </div>` : ''}
      </div>
    `;
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      if (elStreamWrap) elStreamWrap.scrollTop = elStreamWrap.scrollHeight;
    });
  }

  function refreshStatus() {
    const max = opts.historyMax || 50;
    if (elHistL) elHistL.textContent = `HISTORY ${state.history.length}/${max}`;
    if (elModelL) {
      const route = AI.hasWorker() && AI.getMode() !== 'direct-only' ? 'WORKER' : 'DIRECT';
      elModelL.textContent = `${route} · ${state.lang.toUpperCase()}`;
    }
    if (elStatus) {
      if (state.sending) { elStatus.textContent = '● THINKING'; elStatus.className = 'lime'; }
      else if (!AI.hasAnyRoute()) { elStatus.textContent = '● NO ROUTE'; elStatus.className = 'rust'; }
      else { elStatus.textContent = '● READY'; elStatus.className = 'lime'; }
    }
  }

  function saveHistory() { SCOPE.set('history', state.history); refreshStatus(); }

  function autoresize() {
    elInput.style.height = 'auto';
    elInput.style.height = Math.min(180, elInput.scrollHeight) + 'px';
  }

  function exportChat() {
    if (state.history.length === 0) { toast('No history to export'); return; }
    const lines = state.history.map(m => {
      const who = m.role === 'user' ? 'YOU' : 'GRAMMAR.AI';
      const t = new Date(m.ts).toISOString();
      return `[${t}] ${who}:\n${m.content}\n`;
    }).join('\n');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadFile(`grammar-ai-chat-${ts}.txt`, lines, 'text/plain');
  }

  /* Return controller */
  return {
    onShow() { refreshStatus(); scrollBottom(); },
    onHide() {}
  };
}

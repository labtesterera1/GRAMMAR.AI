/* ────────────────────────────────────────────────────────────────
   CHAT MODULE · controller · v1.1.1
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, copyToClipboard, downloadFile, openSheet, closeSheet, timeAgo, readFileAsText, mountSendOut } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';
import { go } from '../../core/router.js';
import { mountToolbar, renderToolbarHTML } from '../../core/toolbar.js';

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

const SCOPE = Storage.scope('chat');

export default async function init({ root, module }) {

  let manifest = { options: {} };
  try { manifest = await fetch('modules/chat/manifest.json').then(r => r.json()); } catch {}
  const opts = manifest.options || {};

  let prompts = {};
  try { prompts = await fetch('config/prompts.json').then(r => r.json()); } catch {}

  const state = {
    lang: SCOPE.get('lang', opts.defaultLanguageMode || 'english'),
    history: SCOPE.get('history', []),
    attachments: [],
    sending: false
  };

  const elStream  = $('#msg-stream', root);
  const elInput   = $('#composer-input', root);
  const elQuick   = $('#quick-chips', root);
  const elAttach  = $('#attach-bar', root);
  const elTbMount = $('#toolbar-mount', root);
  const elHistL   = root.querySelector('[data-bind="historyLine"]');
  const elModelL  = root.querySelector('[data-bind="modelLine"]');
  const elStatus  = root.querySelector('[data-bind="status"]');
  const elModNum  = root.querySelector('[data-bind="moduleNum"]');

  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  // Inject toolbar HTML into mount point
  elTbMount.innerHTML = renderToolbarHTML();

  // Mount toolbar with handlers
  const tb = mountToolbar(elTbMount, {
    textarea: elInput,
    voiceLang: state.lang === 'hindi' ? 'hi-IN' : 'en-IN',
    attachAccept: '.txt,.md,.json,.csv,image/*',
    onSend: () => send(),
    onAttach: (f) => addAttachment(f),
    onImprove: () => runQuick('quick_improve', 'Improving…'),
    onTranslate: () => quickTranslate()
  });

  /* ─── No-route helper ─── */
  function showNoRouteHelp() {
    const hasW = AI.hasWorker();
    const hasK = AI.hasAnyKey();
    openSheet(`
      <div class="kicker"><span>SETUP REQUIRED</span><span class="rust">● NO ROUTE</span></div>
      <div class="sheet-title">Connect an AI route</div>
      <div class="frame subtle output-box" style="padding:14px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="mono" style="font-size:12px;line-height:1.7;color:var(--text);">Grammar.AI needs at least one route to talk to an AI:</div>
        <div class="ticks" style="margin:12px 0 8px;">${'<i></i>'.repeat(28)}</div>
        <div class="mono" style="font-size:11px;line-height:1.8;letter-spacing:0.06em;">
          ${hasW ? '✓' : '○'} <span class="${hasW ? 'lime' : 'muted'}">Cloudflare Worker URL</span><br>
          ${hasK ? '✓' : '○'} <span class="${hasK ? 'lime' : 'muted'}">Or a free provider key (Groq is fastest)</span>
        </div>
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

  paintLang();
  paintQuickChips();
  refreshStatus();
  if (state.history.length === 0) paintWelcome();
  else paintHistory();

  /* Lang chips */
  $$('.chip[data-lang]', root).forEach(b => {
    b.addEventListener('click', () => {
      state.lang = b.dataset.lang;
      SCOPE.set('lang', state.lang);
      paintLang();
      refreshStatus();
    });
  });

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

  $('#chat-history-clear', root).addEventListener('click', () => {
    if (state.history.length === 0) { toast('No history to clear'); return; }
    if (!confirm('Clear the entire chat history?')) return;
    state.history = [];
    SCOPE.set('history', state.history);
    paintWelcome();
    refreshStatus();
    toast('History cleared', 'success');
  });

  $('#chat-export', root).addEventListener('click', () => {
    if (state.history.length === 0) { toast('No history to export'); return; }
    const v = '1.2.1';
    const d = new Date().toISOString().slice(0,10);
    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-inner">
        <div class="kicker"><span>SEND OUT</span><span class="lime">${state.history.length} MESSAGES</span></div>
        <div class="sheet-title">Share Chat</div>
        <div id="chat-sendout-mount"></div>
        <button class="btn mt-12" style="width:100%;" id="chat-so-close">CLOSE</button>
      </div>
    `);
    setTimeout(() => {
      const mount = document.getElementById('chat-sendout-mount');
      if (mount) {
        mountSendOut(
          mount,
          () => buildChatText(),
          () => `Grammar.AI_v${v}_Chat_${d}`
        );
      }
      document.getElementById('chat-so-close')?.addEventListener('click', closeSheet);
    }, 50);
  });

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
        <button class="bubble-act" data-act="copy">⧉ COPY</button>
        ${m.role === 'assistant' ? `<button class="bubble-act" data-act="reuse">↺ REUSE</button>` : ''}
        <button class="bubble-act" data-act="download">⬇ SAVE</button>
      </div>
    `;
    wrap.querySelector('[data-act="copy"]').addEventListener('click', () => copyToClipboard(m.content));
    const reuse = wrap.querySelector('[data-act="reuse"]');
    if (reuse) reuse.addEventListener('click', () => {
      elInput.value = m.content;
      elInput.focus();
      autoresize();
      // Scroll to composer
      const page = root.closest('.page');
      if (page) page.scrollTop = page.scrollHeight;
    });
    wrap.querySelector('[data-act="download"]').addEventListener('click', () => {
      const who  = m.role === 'user' ? 'You' : 'GrammarAI';
      const ts   = new Date(m.ts).toISOString().slice(0,19).replace(/[:T]/g,'-');
      const v    = '1.2.1';
      const d    = new Date().toISOString().slice(0,10);
      downloadFile(
        `Grammar.AI_v${v}_Chat-${who}_${d}.txt`,
        `[${new Date(m.ts).toISOString()}] ${who.toUpperCase()}:\n${m.content}`,
        'text/plain'
      );
    });
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
    const noRoute = !AI.hasAnyRoute();
    return `
      <div class="welcome frame subtle">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="kicker"><span>WELCOME</span><span class="${noRoute ? 'rust' : 'lime'}">● ${noRoute ? 'NEEDS SETUP' : 'READY'}</span></div>
        <div class="welcome-greet serif">Namaste Nik! 👋</div>
        <div class="welcome-tip mono">I am your Grammar AI Agent. Ask me anything in English or Hindi!</div>
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
      const page = root.closest('.page');
      if (page) page.scrollTop = page.scrollHeight;
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

  function buildChatText() {
    return state.history.map(m => {
      const who = m.role === 'user' ? 'YOU' : 'GRAMMAR.AI';
      const t = new Date(m.ts).toISOString();
      return `[${t}] ${who}:\n${m.content}\n`;
    }).join('\n');
  }

  return {
    onShow() { refreshStatus(); scrollBottom(); },
    onHide() {},
    destroy() { tb.destroy(); }
  };
}

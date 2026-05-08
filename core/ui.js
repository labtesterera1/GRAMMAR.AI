/* ────────────────────────────────────────────────────────────────
   UI HELPERS · toast, sheet, DOM utilities
   ──────────────────────────────────────────────────────────────── */

/** $ — querySelector shortcut. */
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/** Build a DOM element from { tag, cls, attrs, html, children }. */
export function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.cls) node.className = opts.cls;
  if (opts.html != null) node.innerHTML = opts.html;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (opts.on) for (const [k, v] of Object.entries(opts.on)) node.addEventListener(k, v);
  if (opts.children) for (const c of opts.children) if (c) node.appendChild(c);
  return node;
}

/** Escape HTML. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── TOAST ─────────────────────────────────────────────── */
let _toastEl = null;
let _toastTimer = null;

export function toast(msg, type = '') {
  if (!_toastEl) {
    _toastEl = el('div', { cls: 'toast' });
    document.body.appendChild(_toastEl);
  }
  _toastEl.textContent = msg;
  _toastEl.className = 'toast show ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    _toastEl.classList.remove('show');
  }, 2400);
}

/* ─── SHEET (bottom modal) ──────────────────────────────── */
let _sheetBackdrop = null;
let _sheetEl = null;

function ensureSheet() {
  if (_sheetEl) return;
  _sheetBackdrop = el('div', { cls: 'sheet-backdrop', on: { click: closeSheet } });
  _sheetEl = el('div', { cls: 'sheet' });
  document.body.appendChild(_sheetBackdrop);
  document.body.appendChild(_sheetEl);
}

export function openSheet(innerHTML) {
  ensureSheet();
  _sheetEl.innerHTML = `<div class="sheet-handle"></div><div class="sheet-inner">${innerHTML}</div>`;
  requestAnimationFrame(() => {
    _sheetBackdrop.classList.add('show');
    _sheetEl.classList.add('show');
  });
}

export function closeSheet() {
  if (!_sheetEl) return;
  _sheetBackdrop.classList.remove('show');
  _sheetEl.classList.remove('show');
}

/* ─── COPY / DOWNLOAD ─────────────────────────────────────── */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard', 'success');
    return true;
  } catch {
    // Fallback for older browsers
    const ta = el('textarea', { attrs: { style: 'position:fixed;opacity:0;' } });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Copied to clipboard', 'success'); }
    catch { toast('Copy failed', 'error'); return false; }
    finally { document.body.removeChild(ta); }
    return true;
  }
}

export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { attrs: { href: url, download: filename } });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  toast('Downloaded ' + filename, 'success');
}

export function pickFile(accept = '*/*') {
  return new Promise((resolve) => {
    const inp = el('input', { attrs: { type: 'file', accept } });
    inp.onchange = () => resolve(inp.files?.[0] || null);
    inp.click();
  });
}

export async function readFileAsText(file) {
  return await file.text();
}

/* ─── TIME UTILITIES ───────────────────────────────────── */
export function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)        return 'just now';
  if (s < 3600)      return Math.floor(s / 60) + 'm ago';
  if (s < 86400)     return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

export function uid() { return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

/* ─── OUTPUT COLOR PICKER ─────────────────────────────────────────
   mountOutputColorPicker(btn, outputEl)
   Applies colors to selected text in OUTPUT divs only.
   Input textareas are never touched. Colors are visual-only —
   stripped automatically on download/share via .innerText.
   ─────────────────────────────────────────────────────────────── */
const OUTPUT_COLORS = {
  highlight: [
    { key: 'hl-yellow', label: 'Yellow', bg: '#f5e642', fg: '#000' },
    { key: 'hl-blue',   label: 'Blue',   bg: '#42a8f5', fg: '#fff' },
    { key: 'hl-green',  label: 'Green',  bg: '#42f57e', fg: '#000' },
    { key: 'hl-pink',   label: 'Pink',   bg: '#f542b0', fg: '#fff' }
  ],
  text: [
    { key: 'tx-lime',   label: 'Lime',   color: '#d4ff3a' },
    { key: 'tx-red',    label: 'Red',    color: '#c97a5a' },
    { key: 'tx-blue',   label: 'Blue',   color: '#42a8f5' },
    { key: 'tx-muted',  label: 'Muted',  color: '#8a8479' }
  ]
};

export function mountOutputColorPicker(btn, outputEl) {
  if (!btn || !outputEl) return;
  btn.addEventListener('click', () => {
    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed;
    if (!hasSelection) {
      toast('Select text in the output box first, then tap 🎨');
      return;
    }
    const range = sel.getRangeAt(0);
    if (!outputEl.contains(range.commonAncestorContainer)) {
      toast('Select text inside the output box first');
      return;
    }
    // Save range BEFORE sheet opens — opening sheet clears selection
    const savedRange = range.cloneRange();

    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-inner">
        <div class="kicker"><span>COLOR</span><span class="lime">OUTPUT ONLY · INPUT STAYS CLEAN</span></div>
        <div class="sheet-title">Color picker</div>
        <div class="s-ttl" style="margin-top:0;"><span>HIGHLIGHT</span></div>
        <div class="color-swatches">
          ${OUTPUT_COLORS.highlight.map(c => `
            <button class="color-swatch" data-oc="hl" data-ockey="${esc(c.key)}"
              style="background:${esc(c.bg)};color:${esc(c.fg)};" title="${esc(c.label)}">
              ${esc(c.label)}
            </button>
          `).join('')}
        </div>
        <div class="s-ttl"><span>TEXT COLOR</span></div>
        <div class="color-swatches">
          ${OUTPUT_COLORS.text.map(c => `
            <button class="color-swatch color-swatch-text" data-oc="tx" data-ockey="${esc(c.key)}"
              style="border-color:${esc(c.color)};color:${esc(c.color)};" title="${esc(c.label)}">
              ${esc(c.label)}
            </button>
          `).join('')}
        </div>
        <button class="btn btn-rust mt-8" id="oc-clear" style="width:100%;">✕ CLEAR ALL COLORS</button>
        <button class="btn mt-8" style="width:100%;" id="oc-close">CLOSE</button>
        <div class="mono dim" style="font-size:9px;line-height:1.6;margin-top:8px;letter-spacing:0.06em;">
          Colors are visual only. Download and share always send clean text.
        </div>
      </div>
    `);

    setTimeout(() => {
      // Highlight
      document.querySelectorAll('[data-oc="hl"][data-ockey]').forEach(b => {
        b.addEventListener('click', () => {
          const col = OUTPUT_COLORS.highlight.find(c => c.key === b.dataset.ockey);
          if (col) {
            applyColorToRange(savedRange, `background:${col.bg};color:${col.fg};padding:0 2px;border-radius:2px;`);
          }
          closeSheet();
        });
      });
      // Text color
      document.querySelectorAll('[data-oc="tx"][data-ockey]').forEach(b => {
        b.addEventListener('click', () => {
          const col = OUTPUT_COLORS.text.find(c => c.key === b.dataset.ockey);
          if (col) {
            applyColorToRange(savedRange, `color:${col.color};font-weight:500;`);
          }
          closeSheet();
        });
      });
      document.getElementById('oc-clear')?.addEventListener('click', () => {
        clearOutputColors(outputEl);
        closeSheet();
        toast('Colors cleared');
      });
      document.getElementById('oc-close')?.addEventListener('click', closeSheet);
    }, 60);
  });
}

function applyColorToRange(range, style) {
  const span = document.createElement('span');
  span.style.cssText = style;
  span.className = 'output-color';
  try {
    range.surroundContents(span);
  } catch {
    // Selection crosses element boundaries — extract and wrap
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }
  window.getSelection()?.removeAllRanges();
}

function clearOutputColors(el) {
  el.querySelectorAll('.output-color').forEach(span => {
    const parent = span.parentNode;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  });
}

/* ─── Strip color tags before sending to AI ─────────────────────
   The AI shouldn't see [[hl-pink]]hello[[/]] — strip them.
   Bold/italic/highlight markdown also stripped to avoid AI treating
   them as part of grammar content.
   ─────────────────────────────────────────────────────── */
export function stripColorTags(s) {
  if (!s) return s;
  return s
    .replace(/\[\[(?:hl-\w+|tx-\w+)\]\]([\s\S]*?)\[\[\/\]\]/g, '$1')
    .replace(/\[\[\/\]\]/g, '');
}

/* ─── Shared markdown+color renderer (used by notes cards, chat, etc.) ─── */
export function renderMd(s) {
  let html = esc(s);
  html = html.replace(/\[\[hl-yellow\]\]([\s\S]*?)\[\[\/\]\]/g, '<mark style="background:#f5e642;color:#000;padding:0 3px;">$1</mark>');
  html = html.replace(/\[\[hl-blue\]\]([\s\S]*?)\[\[\/\]\]/g,   '<mark style="background:#42a8f5;color:#fff;padding:0 3px;">$1</mark>');
  html = html.replace(/\[\[hl-green\]\]([\s\S]*?)\[\[\/\]\]/g,  '<mark style="background:#42f57e;color:#000;padding:0 3px;">$1</mark>');
  html = html.replace(/\[\[hl-pink\]\]([\s\S]*?)\[\[\/\]\]/g,   '<mark style="background:#f542b0;color:#fff;padding:0 3px;">$1</mark>');
  html = html.replace(/\[\[tx-lime\]\]([\s\S]*?)\[\[\/\]\]/g,   '<span style="color:#d4ff3a;">$1</span>');
  html = html.replace(/\[\[tx-red\]\]([\s\S]*?)\[\[\/\]\]/g,    '<span style="color:#c97a5a;">$1</span>');
  html = html.replace(/\[\[tx-blue\]\]([\s\S]*?)\[\[\/\]\]/g,   '<span style="color:#42a8f5;">$1</span>');
  html = html.replace(/\[\[tx-muted\]\]([\s\S]*?)\[\[\/\]\]/g,  '<span style="color:#8a8479;">$1</span>');
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

/* ─── FILENAME GENERATOR ─────────────────────────────────────────
   G-{MODULE}-{CODE}{SEQ}-{D}-{MON}.txt
   SEQ resets to 01 each new day, per module, stored in localStorage.
   Every share/download/copy action increments the daily counter.
   ─────────────────────────────────────────────────────────────── */
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export function gFileName(module, code, ext = 'txt') {
  const now  = new Date();
  const day  = now.getDate();
  const mon  = MONTHS[now.getMonth()];
  const dateKey  = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const storeKey = `gai.fn.${module}.${dateKey}`;
  let seq = 1;
  try {
    const raw = localStorage.getItem(storeKey);
    seq = raw ? JSON.parse(raw) + 1 : 1;
    localStorage.setItem(storeKey, JSON.stringify(seq));
  } catch {}
  return `G-${module}-${code}${String(seq).padStart(2,'0')}-${day}-${mon}.${ext}`;
}

/* ─── SEND OUT ────────────────────────────────────────────────────
   mountSendOut(container, opts)

   opts = {
     module : 'EMAIL',         // for gFileName (uppercase)
     code   : 'EM',            // 2-letter code for gFileName
     items  : [                // 1 item = no selector shown
       { key:'corrected', label:'CORRECTED v1', getContent: () => '...' },
       { key:'polished',  label:'POLISHED v3',  getContent: () => '...', default: true }
     ]
   }

   Every action (SHARE FILE / WhatsApp / Email / Print / Copy)
   uses the currently selected item's content + gFileName for naming.
   ─────────────────────────────────────────────────────────────── */
export function mountSendOut(container, opts) {
  const items      = opts.items || [];
  const hasChoice  = items.length > 1;
  let selectedKey  = (items.find(i => i.default) || items[0])?.key || '';

  function getSelected() { return items.find(i => i.key === selectedKey) || items[0]; }
  function getContent()  { return getSelected()?.getContent?.() || ''; }
  function getFname()    { return gFileName(opts.module, opts.code); }

  container.innerHTML = `
    <div class="s-ttl"><span>SEND OUT</span></div>
    <div class="frame subtle send-out-box">
      <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
      ${hasChoice ? `
        <div class="lang-chips so-chips" style="margin-bottom:10px;">
          ${items.map(i => `
            <button class="chip ${i.key === selectedKey ? 'on' : ''}" data-sokey="${esc(i.key)}">${esc(i.label)}</button>
          `).join('')}
        </div>
      ` : ''}
      <button class="btn btn-primary send-out-share" style="width:100%;margin-bottom:10px;">
        📤 SHARE FILE
      </button>
      <div class="send-out-quick">
        <button class="send-out-btn" data-so="whatsapp"><span class="send-out-icn">💬</span><span>WHATSAPP</span></button>
        <button class="send-out-btn" data-so="email"><span class="send-out-icn">✉️</span><span>EMAIL</span></button>
        <button class="send-out-btn" data-so="print"><span class="send-out-icn">🖨️</span><span>PRINT</span></button>
        <button class="send-out-btn" data-so="copy"><span class="send-out-icn">⧉</span><span>COPY</span></button>
      </div>
      <div class="mono dim" style="font-size:9px;letter-spacing:0.06em;line-height:1.6;margin-top:8px;">
        SHARE FILE attaches the actual file via Android's share sheet.
        The 4 buttons send text directly to those apps.
      </div>
    </div>
  `;

  /* Selector chips */
  if (hasChoice) {
    container.querySelectorAll('[data-sokey]').forEach(b => {
      b.addEventListener('click', () => {
        selectedKey = b.dataset.sokey;
        container.querySelectorAll('[data-sokey]').forEach(x =>
          x.classList.toggle('on', x.dataset.sokey === selectedKey));
      });
    });
  }

  /* SHARE FILE */
  container.querySelector('.send-out-share').addEventListener('click', async () => {
    const text = getContent();
    if (!text) { toast('No content to share'); return; }
    const fname = getFname();
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([text], fname, { type: 'text/plain' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Grammar.AI', text: 'Export from Grammar.AI' });
          return;
        }
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    if (navigator.share) {
      try { await navigator.share({ title: 'Grammar.AI', text: text.slice(0,2000) }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    downloadFile(fname, text, 'text/plain');
    toast('Saved as file download');
  });

  /* Quick action buttons */
  container.querySelectorAll('[data-so]').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = getContent();
      if (!text) { toast('No content to share'); return; }
      const fname   = getFname();
      const snippet = text.slice(0, 1500);
      const action  = btn.dataset.so;
      if (action === 'whatsapp') {
        window.open('https://wa.me/?text=' + encodeURIComponent('*Grammar.AI*\n\n' + snippet), '_blank');
      } else if (action === 'email') {
        window.location.href = 'mailto:?subject=' + encodeURIComponent('Grammar.AI – ' + fname)
          + '&body=' + encodeURIComponent(snippet);
      } else if (action === 'print') {
        const win = window.open('', '_blank');
        if (!win) { toast('Allow pop-ups to print'); return; }
        win.document.write(`<html><head><title>${esc(fname)}</title><style>
          body{font-family:monospace;font-size:13px;line-height:1.7;padding:20px;white-space:pre-wrap;word-break:break-word;}
        </style></head><body>${esc(text)}</body></html>`);
        win.document.close();
        win.print();
      } else if (action === 'copy') {
        copyToClipboard(text);
      }
    });
  });

  return { destroy() { container.innerHTML = ''; } };
}

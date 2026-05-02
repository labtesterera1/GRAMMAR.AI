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

/* ────────────────────────────────────────────────────────────────
   TRANSLATOR MODULE · controller
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, copyToClipboard, downloadFile, openSheet, closeSheet, timeAgo, mountSendOut, gFileName, renderMd, stripColorTags, mountOutputColorPicker, mountModuleBackup } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';
import { go } from '../../core/router.js';
import { mountToolbar, renderToolbarHTML } from '../../core/toolbar.js';

const SCOPE = Storage.scope('translator');

export default async function init({ root, module }) {

  let manifest = { options: {} };
  try { manifest = await fetch('modules/translator/manifest.json').then(r => r.json()); } catch {}
  const opts = manifest.options || {};
  const directions = opts.directions || [];

  let prompts = {};
  try { prompts = await fetch('config/prompts.json').then(r => r.json()); } catch {}

  const state = {
    direction: SCOPE.get('direction', directions[0]?.key || 'en2hi'),
    modeByDir: SCOPE.get('modeByDir', {}),
    input: SCOPE.get('input', ''),
    output: SCOPE.get('output', ''),
    history: SCOPE.get('history', [])
  };

  const elDir          = $('#dir-chips', root);
  const elMode         = $('#tr-mode', root);
  const elInput        = $('#tr-input', root);
  const elDevaWrap     = $('#tr-deva-input', root);
  const elStdWrap      = $('#tr-standard-input', root);
  const elDevaInput    = $('#tr-deva', root);
  const elDevaPaste    = $('#tr-deva-paste', root);
  const elOutput       = $('#tr-output', root);
  const elGo           = $('#tr-go', root);
  const elClear        = $('#tr-clear', root);
  const elCopy         = $('#tr-copy', root);
  const elDl           = $('#tr-download', root);
  const elHist         = $('#tr-history', root);
  const elSpeak        = $('#tr-speak', root);
  const elColor        = $('#tr-color', root);
  const elSendOut      = $('#tr-sendout', root);
  const elTbMount      = $('#toolbar-mount', root);

  // Wire output color picker
  mountOutputColorPicker(elColor, elOutput);
  const elModNum  = root.querySelector('[data-bind="moduleNum"]');
  const elStatus  = root.querySelector('[data-bind="status"]');
  const elHL      = root.querySelector('[data-bind="historyLine"]');

  function showSendOut() {
    if (!state.output || !elSendOut) return;
    elSendOut.classList.remove('hide');
    mountSendOut(elSendOut, {
      module: 'TRANSLATOR',
      code: 'TR',
      items: [
        { key: 'input',  label: 'INPUT',  getContent: () => state.input },
        { key: 'output', label: 'OUTPUT', getContent: () => state.output, default: true }
      ]
    });
  }

  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  /* ─── Show/hide correct input section based on direction ─── */
  function paintInputUI() {
    const isDeva = state.direction === 'deva2en';
    elStdWrap?.classList.toggle('hide', isDeva);
    elDevaWrap?.classList.toggle('hide', !isDeva);
    // Toolbar only relevant for standard input
    if (elTbMount) elTbMount.style.display = isDeva ? 'none' : '';
  }

  // Direction chips
  elDir.innerHTML = directions.map(d =>
    `<button class="chip ${d.key === state.direction ? 'on' : ''}" data-dir="${esc(d.key)}">${esc(d.label)}</button>`
  ).join('');
  $$('.chip[data-dir]', elDir).forEach(b => {
    b.addEventListener('click', () => {
      state.direction = b.dataset.dir;
      SCOPE.set('direction', state.direction);
      $$('.chip[data-dir]', elDir).forEach(x => x.classList.toggle('on', x.dataset.dir === state.direction));
      paintModes();
      paintInputUI();
    });
  });

  paintModes();
  paintInputUI();
  elInput.value = state.input;
  // Restore Devanagari input if last direction was deva2en
  if (state.direction === 'deva2en') elDevaInput.value = state.input;
  if (state.output) {
    elOutput.innerHTML = renderMd(state.output);
    elOutput.classList.remove('placeholder');
    elColor?.classList.remove('hide');
    showSendOut();
  }
  refreshStatus();
  refreshHist();

  elTbMount.innerHTML = renderToolbarHTML();
  const tb = mountToolbar(elTbMount, {
    textarea: elInput,
    voiceLang: state.direction === 'hi2en' ? 'hi-IN' : 'en-IN',
    enterToSend: false,
    attachAccept: '.txt,.md',
    onAttach: async (file) => {
      const text = await file.text().catch(() => '');
      elInput.value = (elInput.value ? elInput.value + '\n\n' : '') + text;
      state.input = elInput.value;
      SCOPE.set('input', state.input);
      toast(`Attached: ${file.name}`, 'success');
    },
    onImprove: () => quickAction('quick_improve', 'Improving…'),
    onTranslate: () => translate(),
    onSend: () => translate()
  });

  elInput.addEventListener('input', () => { state.input = elInput.value; SCOPE.set('input', state.input); });

  // Devanagari input listeners
  elDevaInput?.addEventListener('input', () => {
    state.input = elDevaInput.value;
    SCOPE.set('input', state.input);
  });

  // Paste from clipboard — desktop helper
  elDevaPaste?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { toast('Clipboard is empty'); return; }
      elDevaInput.value = text;
      state.input = text;
      SCOPE.set('input', state.input);
      toast('Pasted from clipboard', 'success');
    } catch {
      toast('Clipboard access denied — paste manually (Ctrl+V)', 'error');
    }
  });

  elMode.addEventListener('change', () => {
    state.modeByDir[state.direction] = elMode.value;
    SCOPE.set('modeByDir', state.modeByDir);
  });

  elGo.addEventListener('click', translate);
  elClear.addEventListener('click', () => {
    if (!confirm('Clear input and output?')) return;
    elInput.value = '';
    elDevaInput.value = '';
    elOutput.textContent = 'Translation will appear here…';
    elOutput.classList.add('placeholder');
    elColor?.classList.add('hide');
    state.input = ''; state.output = '';
    SCOPE.set('input', ''); SCOPE.set('output', '');
    if (elSendOut) { elSendOut.classList.add('hide'); elSendOut.innerHTML = ''; }
  });

  // SPEAK
  if (elSpeak) elSpeak.addEventListener('click', () => {
    if (!state.output) { toast('Nothing to speak yet'); return; }
    if (!('speechSynthesis' in window)) { toast('TTS not supported', 'error'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(state.output);
    u.lang = state.direction === 'en2hi' ? 'hi-IN' : 'en-IN';
    u.rate = 0.92;
    speechSynthesis.speak(u);
    toast('Speaking…');
  });

  elCopy.addEventListener('click', () => {
    const text = elOutput.innerText || state.output || '';
    if (!text) { toast('Nothing to copy yet'); return; }
    copyToClipboard(text);
  });
  elDl.addEventListener('click', () => {
    const text = elOutput.innerText || state.output || '';
    if (!text) { toast('Nothing to download yet'); return; }
    downloadFile(gFileName('TRANSLATOR', 'TR'), text, 'text/plain');
  });

  elHist.addEventListener('click', () => {
    if (state.history.length === 0) { toast('No history yet'); return; }
    openHistorySheet();
  });

  function paintModes() {
    const dir = directions.find(d => d.key === state.direction);
    if (!dir) return;
    const cur = state.modeByDir[state.direction] || dir.default;
    // deva2en uses deva_modes from manifest
    const modeList = state.direction === 'deva2en'
      ? (opts.deva_modes || dir.modes || [])
      : (dir.modes || []);
    elMode.innerHTML = modeList.map(m =>
      `<option value="${esc(m.key)}" ${m.key === cur ? 'selected' : ''}>${esc(m.label)}</option>`
    ).join('');
  }

  function showNoRouteHelp() {
    openSheet(`
      <div class="kicker"><span>SETUP REQUIRED</span><span class="rust">● NO ROUTE</span></div>
      <div class="sheet-title">Connect an AI route</div>
      <div class="frame subtle output-box" style="padding:14px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="mono" style="font-size:12px;">Set a Worker URL or any provider key in Settings.</div>
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

  async function translate() {
    // Get text from correct input depending on direction
    const isDeva = state.direction === 'deva2en';
    const rawText = isDeva
      ? (elDevaInput?.value.trim() || '')
      : elInput.value.trim();

    if (!rawText) { toast('Enter text to translate first'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }

    const text = stripColorTags(rawText);

    const mode = elMode.value;
    let sys, modeText;

    if (isDeva) {
      // Devanagari → English
      sys      = prompts.translator_deva_system || 'You are a Hindi-to-English translator. Translate Devanagari script to natural English. Return ONLY the translation.';
      modeText = (prompts.translator_deva_modes || {})[mode] || '';
    } else if (state.direction === 'en2hi') {
      sys      = prompts.translator_en_system || '';
      modeText = (prompts.translator_en_modes || {})[mode] || '';
    } else {
      sys      = prompts.translator_hi_system || '';
      modeText = (prompts.translator_hi_modes || {})[mode] || '';
    }

    elGo.disabled = true;
    elGo.textContent = 'TRANSLATING…';
    elOutput.classList.remove('placeholder');
    elOutput.textContent = 'Working…';

    try {
      const r = await AI.chat([
        { role: 'system', content: (sys || '') + modeText },
        { role: 'user',   content: 'Translate:\n\n' + text }
      ], { temperature: 0.4, maxTokens: 1500 });

      elOutput.innerHTML = renderMd(r.text);
      state.input  = text;
      state.output = r.text;
      SCOPE.set('output', state.output);
      SCOPE.set('input',  state.input);
      elColor?.classList.remove('hide');
      showSendOut();

      // Push to history
      state.history.unshift({
        ts:        Date.now(),
        direction: state.direction,
        mode,
        input:     text,
        output:    r.text
      });
      const max = opts.historyMax || 20;
      if (state.history.length > max) state.history = state.history.slice(0, max);
      SCOPE.set('history', state.history);
      refreshHist();

      toast('Done · ' + r.route, 'success');
    } catch (e) {
      elOutput.textContent = 'Error: ' + (e.details?.[0] || e.message);
      toast('Failed', 'error');
    } finally {
      elGo.disabled = false;
      elGo.textContent = '▸ TRANSLATE';
    }
  }

  async function quickAction(promptKey, busyMsg) {
    const raw = elInput.value.trim();
    if (!raw) { toast('Type something first'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }
    const text = stripColorTags(raw);
    toast(busyMsg);
    try {
      const r = await AI.chat([
        { role: 'system', content: prompts[promptKey] || '' },
        { role: 'user',   content: text }
      ], { temperature: 0.3, maxTokens: 700 });
      elInput.value = r.text;
      state.input = r.text;
      SCOPE.set('input', state.input);
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      toast('Failed: ' + (e.details?.[0] || e.message), 'error');
    }
  }

  function openHistorySheet() {
    openSheet(`
      <div class="kicker"><span>HISTORY</span><span class="lime">${state.history.length}/${opts.historyMax || 20}</span></div>
      <div class="sheet-title">Translation history</div>
      <div class="col" style="gap:8px;max-height:50vh;overflow-y:auto;">
        ${state.history.map((h, i) => `
          <div class="frame subtle" style="padding:10px 12px;">
            <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
            <div class="row between mono" style="font-size:9px;color:var(--muted);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:6px;">
              <span>${esc(h.direction)} · ${esc(h.mode)}</span>
              <span>${esc(timeAgo(h.ts))}</span>
            </div>
            <div class="mono" style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:4px;">${esc(h.input).slice(0,140)}${h.input.length>140?'…':''}</div>
            <div class="mono lime" style="font-size:11px;line-height:1.5;">${esc(h.output).slice(0,140)}${h.output.length>140?'…':''}</div>
            <button class="btn-ghost mt-8" data-restore="${i}" style="font-size:9px;letter-spacing:0.16em;">↺ RESTORE</button>
          </div>
        `).join('')}
      </div>
      <div class="row gap-12 mt-12">
        <button class="btn btn-rust flex-1" id="hist-clear">CLEAR ALL</button>
        <button class="btn btn-primary flex-1" id="hist-close">CLOSE</button>
      </div>
    `);
    setTimeout(() => {
      $$('[data-restore]').forEach(b => b.addEventListener('click', () => {
        const h = state.history[Number(b.dataset.restore)];
        if (!h) return;
        state.direction = h.direction;
        SCOPE.set('direction', state.direction);
        $$('.chip[data-dir]', elDir).forEach(x => x.classList.toggle('on', x.dataset.dir === state.direction));
        paintModes();
        elMode.value = h.mode;
        elInput.value = h.input;
        elOutput.innerHTML = renderMd(h.output);
        elOutput.classList.remove('placeholder');
        state.input = h.input;
        state.output = h.output;
        SCOPE.set('input', h.input);
        SCOPE.set('output', h.output);
        closeSheet();
        toast('Restored', 'success');
      }));
      document.getElementById('hist-clear')?.addEventListener('click', () => {
        if (!confirm('Clear all translation history?')) return;
        state.history = [];
        SCOPE.set('history', []);
        refreshHist();
        closeSheet();
        toast('History cleared', 'success');
      });
      document.getElementById('hist-close')?.addEventListener('click', closeSheet);
    }, 50);
  }

  function refreshStatus() {
    if (!elStatus) return;
    if (!AI.hasAnyRoute()) { elStatus.textContent = '● NO ROUTE'; elStatus.className = 'rust'; }
    else { elStatus.textContent = '● READY'; elStatus.className = 'lime'; }
  }
  function refreshHist() {
    if (elHL) elHL.textContent = `HISTORY ${state.history.length}/${opts.historyMax || 20}`;
  }

  mountModuleBackup($('#tr-module-backup', root), {
    moduleId: 'translator', moduleCode: 'TR', scope: SCOPE
  });

  return {
    onShow() { refreshStatus(); },
    destroy() { tb.destroy(); }
  };
}

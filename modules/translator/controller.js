/* ────────────────────────────────────────────────────────────────
   TRANSLATOR MODULE · controller
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, copyToClipboard, downloadFile, openSheet, closeSheet, timeAgo, mountSendOut } from '../../core/ui.js';
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

  const elDir     = $('#dir-chips', root);
  const elMode    = $('#tr-mode', root);
  const elInput   = $('#tr-input', root);
  const elOutput  = $('#tr-output', root);
  const elGo      = $('#tr-go', root);
  const elClear   = $('#tr-clear', root);
  const elCopy    = $('#tr-copy', root);
  const elDl      = $('#tr-download', root);
  const elHist    = $('#tr-history', root);
  const elSpeak   = $('#tr-speak', root);
  const elSendOut = $('#tr-sendout', root);
  const elTbMount = $('#toolbar-mount', root);
  const elModNum  = root.querySelector('[data-bind="moduleNum"]');
  const elStatus  = root.querySelector('[data-bind="status"]');
  const elHL      = root.querySelector('[data-bind="historyLine"]');

  function showSendOut() {
    if (!state.output || !elSendOut) return;
    elSendOut.classList.remove('hide');
    const v = '1.2.1';
    const d = new Date().toISOString().slice(0,10);
    mountSendOut(
      elSendOut,
      () => state.output,
      () => `Grammar.AI_v${v}_Translator-${state.direction}_${d}`
    );
  }

  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

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
    });
  });

  paintModes();
  elInput.value = state.input;
  if (state.output) {
    elOutput.textContent = state.output;
    elOutput.classList.remove('placeholder');
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
  elMode.addEventListener('change', () => {
    state.modeByDir[state.direction] = elMode.value;
    SCOPE.set('modeByDir', state.modeByDir);
  });

  elGo.addEventListener('click', translate);
  elClear.addEventListener('click', () => {
    if (!confirm('Clear input and output?')) return;
    elInput.value = '';
    elOutput.textContent = 'Translation will appear here…';
    elOutput.classList.add('placeholder');
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
    if (!state.output) { toast('Nothing to copy yet'); return; }
    copyToClipboard(state.output);
  });
  elDl.addEventListener('click', () => {
    if (!state.output) { toast('Nothing to download yet'); return; }
    const ver = '1.2.3';
    const d   = new Date().toISOString().slice(0,10);
    downloadFile(`Grammar.AI_v${ver}_Translator-${state.direction}_${d}.txt`, state.output, 'text/plain');
  });

  elHist.addEventListener('click', () => {
    if (state.history.length === 0) { toast('No history yet'); return; }
    openHistorySheet();
  });

  function paintModes() {
    const dir = directions.find(d => d.key === state.direction);
    if (!dir) return;
    const cur = state.modeByDir[state.direction] || dir.default;
    elMode.innerHTML = (dir.modes || []).map(m =>
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
    const text = elInput.value.trim();
    if (!text) { toast('Type something to translate'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }

    const dir = directions.find(d => d.key === state.direction);
    const mode = elMode.value || dir.default;
    const sys = state.direction === 'en2hi' ? prompts.translator_en_system : prompts.translator_hi_system;
    const modes = state.direction === 'en2hi' ? prompts.translator_en_modes : prompts.translator_hi_modes;
    const modeText = modes?.[mode] || '';

    elGo.disabled = true;
    elGo.textContent = 'TRANSLATING…';
    elOutput.classList.remove('placeholder');
    elOutput.textContent = 'Working…';

    try {
      const r = await AI.chat([
        { role: 'system', content: (sys || '') + modeText },
        { role: 'user',   content: 'Translate:\n\n' + text }
      ], { temperature: 0.4, maxTokens: 1500 });
      elOutput.textContent = r.text;
      state.output = r.text;
      SCOPE.set('output', state.output);
      showSendOut();

      // Push to history
      state.history.unshift({
        ts: Date.now(),
        direction: state.direction,
        mode,
        input: text,
        output: r.text
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
    const text = elInput.value.trim();
    if (!text) { toast('Type something first'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }
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
        elOutput.textContent = h.output;
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

  return {
    onShow() { refreshStatus(); },
    destroy() { tb.destroy(); }
  };
}

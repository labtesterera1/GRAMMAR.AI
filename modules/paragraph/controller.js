/* ────────────────────────────────────────────────────────────────
   PARAGRAPH MODULE · controller
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, copyToClipboard, downloadFile, openSheet, closeSheet, mountSendOut, gFileName, renderMd, stripColorTags } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';
import { go } from '../../core/router.js';
import { mountToolbar, renderToolbarHTML } from '../../core/toolbar.js';

const SCOPE = Storage.scope('paragraph');

export default async function init({ root, module }) {

  let manifest = { options: {} };
  try { manifest = await fetch('modules/paragraph/manifest.json').then(r => r.json()); } catch {}
  const opts = manifest.options || {};

  let prompts = {};
  try { prompts = await fetch('config/prompts.json').then(r => r.json()); } catch {}

  const state = {
    mode: SCOPE.get('mode', opts.defaultMode || 'correct'),
    draft: SCOPE.get('draft', ''),
    lastOutput: SCOPE.get('lastOutput', '')
  };

  const elInput   = $('#para-input', root);
  const elOutput  = $('#para-output', root);
  const elMode    = $('#para-mode', root);
  const elGo      = $('#para-go', root);
  const elClear   = $('#para-clear', root);
  const elSpeak   = $('#para-speak', root);
  const elCopy    = $('#para-copy', root);
  const elDl      = $('#para-download', root);
  const elTbMount = $('#toolbar-mount', root);
  const elSendOut = $('#para-sendout', root);
  const elModNum  = root.querySelector('[data-bind="moduleNum"]');
  const elStatus  = root.querySelector('[data-bind="status"]');
  const elWC      = root.querySelector('[data-bind="wordCount"]');

  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  function showSendOut() {
    if (!state.lastOutput || !elSendOut) return;
    elSendOut.classList.remove('hide');
    mountSendOut(elSendOut, {
      module: 'PARAGRAPH',
      code: 'PA',
      items: [
        { key: 'input',  label: 'INPUT',  getContent: () => state.draft },
        { key: 'output', label: 'OUTPUT', getContent: () => state.lastOutput, default: true }
      ]
    });
  }

  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  // Populate modes
  elMode.innerHTML = (opts.modes || []).map(m =>
    `<option value="${esc(m.key)}" ${m.key === state.mode ? 'selected' : ''}>${esc(m.label)}</option>`
  ).join('');

  elInput.value = state.draft;
  if (state.lastOutput) {
    elOutput.innerHTML = renderMd(state.lastOutput);
    elOutput.classList.remove('placeholder');
    showSendOut();
  }
  refreshStatus();
  updateWC();

  // Inject toolbar
  elTbMount.innerHTML = renderToolbarHTML();
  const tb = mountToolbar(elTbMount, {
    textarea: elInput,
    voiceLang: 'en-IN',
    enterToSend: false,    // paragraph is multi-line; Enter shouldn't send
    onImprove: () => quickAction('quick_improve', 'Improving…'),
    onTranslate: () => quickTranslate(),
    onSend: () => correctParagraph()
  });

  elInput.addEventListener('input', () => {
    state.draft = elInput.value;
    SCOPE.set('draft', state.draft);
    updateWC();
  });

  elMode.addEventListener('change', () => {
    state.mode = elMode.value;
    SCOPE.set('mode', state.mode);
  });

  elGo.addEventListener('click', correctParagraph);
  elClear.addEventListener('click', () => {
    if (!confirm('Clear paragraph and output?')) return;
    elInput.value = '';
    elOutput.textContent = 'Corrected paragraph will appear here…';
    elOutput.classList.add('placeholder');
    state.draft = '';
    state.lastOutput = '';
    SCOPE.set('draft', '');
    SCOPE.set('lastOutput', '');
    updateWC();
  });

  elSpeak.addEventListener('click', () => {
    if (!state.lastOutput) { toast('Nothing to speak yet'); return; }
    if (!('speechSynthesis' in window)) { toast('TTS not supported here', 'error'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(state.lastOutput);
    u.lang = 'en-IN';
    u.rate = 0.95;
    speechSynthesis.speak(u);
    toast('Speaking…');
  });

  elCopy.addEventListener('click', () => {
    if (!state.lastOutput) { toast('Nothing to copy yet'); return; }
    copyToClipboard(state.lastOutput);
  });

  elDl.addEventListener('click', () => {
    if (!state.lastOutput) { toast('Nothing to download yet'); return; }
    downloadFile(gFileName('PARAGRAPH', 'PA'), state.lastOutput, 'text/plain');
  });

  function showNoRouteHelp() {
    openSheet(`
      <div class="kicker"><span>SETUP REQUIRED</span><span class="rust">● NO ROUTE</span></div>
      <div class="sheet-title">Connect an AI route</div>
      <div class="frame subtle output-box" style="padding:14px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="mono" style="font-size:12px;line-height:1.7;">Set a Worker URL or any provider key in Settings.</div>
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

  async function correctParagraph() {
    const raw = elInput.value.trim();
    if (!raw) { toast('Type or paste a paragraph first'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }

    // Strip color tags before sending to AI
    const text = stripColorTags(raw);

    const modes = prompts.paragraph_modes || {};
    const modeText = modes[state.mode] || modes.correct;

    elGo.disabled = true;
    elGo.textContent = 'CORRECTING…';
    elOutput.classList.remove('placeholder');
    elOutput.textContent = 'Working…';

    try {
      const r = await AI.chat([
        { role: 'system', content: prompts.paragraph_system || 'You are an expert grammar corrector.' },
        { role: 'user',   content: modeText + '\n\nParagraph:\n"' + text + '"' }
      ], { temperature: 0.5, maxTokens: 2500 });
      elOutput.innerHTML = renderMd(r.text);
      state.lastOutput = r.text;
      SCOPE.set('lastOutput', state.lastOutput);
      showSendOut();
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      elOutput.textContent = 'Error: ' + (e.details?.[0] || e.message);
      toast('Failed', 'error');
    } finally {
      elGo.disabled = false;
      elGo.textContent = '▸ CORRECT NOW';
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
      state.draft = r.text;
      SCOPE.set('draft', state.draft);
      updateWC();
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      toast('Failed: ' + (e.details?.[0] || e.message), 'error');
    }
  }

  function quickTranslate() {
    const raw = elInput.value.trim();
    if (!raw) { toast('Type something first'); return; }
    const text = stripColorTags(raw);
    const isHindi = /[\u0900-\u097F]/.test(text);
    quickAction(isHindi ? 'quick_translate_hi2en' : 'quick_translate_en2hi', isHindi ? 'Hindi → English…' : 'English → Hindi…');
  }

  function updateWC() {
    const t = elInput.value.trim();
    const n = t ? t.split(/\s+/).length : 0;
    if (elWC) elWC.textContent = n + ' WORD' + (n === 1 ? '' : 'S');
  }

  function refreshStatus() {
    if (!elStatus) return;
    if (!AI.hasAnyRoute()) { elStatus.textContent = '● NO ROUTE'; elStatus.className = 'rust'; }
    else { elStatus.textContent = '● READY'; elStatus.className = 'lime'; }
  }

  return {
    onShow() { refreshStatus(); },
    destroy() { tb.destroy(); }
  };
}

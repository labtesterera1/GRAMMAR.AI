/* ────────────────────────────────────────────────────────────────
   REWRITE MODULE · controller · v1.0.0
   5-card rewriter — Paragraph + Sentence mode
   Per-card: COPY / USE THIS / SPEAK
   READ MODE: full-screen clean reader with font/spacing controls + TTS
   SEND OUT: INPUT / individual / ALL selector + gFileName
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, copyToClipboard, downloadFile, openSheet, closeSheet, mountSendOut, gFileName } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';
import { go } from '../../core/router.js';
import { mountToolbar, renderToolbarHTML } from '../../core/toolbar.js';

const SCOPE = Storage.scope('rewrite');

/* ─── Mode hints ─── */
const MODE_HINTS = {
  paragraph: 'Paste a full paragraph — get 5 rewrites of the whole text.',
  sentence:  'Type or paste ONE sentence — get 5 quick alternatives. Faster results.'
};

/* ─── Rewrite definitions ─── */
const REWRITES = [
  { key: 'original', label: 'ORIGINAL STYLE', num: 'v1', color: 'lime',  prompt: 'Rewrite with correct grammar only. Keep the exact same tone, style, and meaning. Fix errors silently.' },
  { key: 'casual',   label: 'CASUAL',          num: 'v2', color: 'warn',  prompt: 'Rewrite in a friendly, casual, conversational tone. Use simple words. Keep the meaning.' },
  { key: 'formal',   label: 'FORMAL',           num: 'v3', color: 'text', prompt: 'Rewrite in a formal, professional tone suitable for business or academic use. Keep the meaning.' },
  { key: 'shorter',  label: 'SHORTER',          num: 'v4', color: 'text', prompt: 'Rewrite in fewer words. Remove filler, be concise and direct. Keep core meaning.' },
  { key: 'expanded', label: 'EXPANDED',         num: 'v5', color: 'text', prompt: 'Rewrite with more detail, richer vocabulary and deeper explanation. Keep the same meaning.' }
];

export default async function init({ root, module }) {

  let manifest = { options: {} };
  try { manifest = await fetch('modules/rewrite/manifest.json').then(r => r.json()); } catch {}

  let prompts = {};
  try { prompts = await fetch('config/prompts.json').then(r => r.json()); } catch {}

  /* ─── State ─── */
  const state = {
    mode:     SCOPE.get('mode', 'paragraph'),
    draft:    SCOPE.get('draft', ''),
    results:  SCOPE.get('results', null),  // { original, casual, formal, shorter, expanded }
    sending:  false
  };

  /* ─── Refs ─── */
  const elInput    = $('#rw-input', root);
  const elTbMount  = $('#toolbar-mount', root);
  const elGo       = $('#rw-go', root);
  const elRead     = $('#rw-read', root);
  const elClear    = $('#rw-clear', root);
  const elOutput   = $('#rw-output', root);
  const elCards    = $('#rw-cards', root);
  const elSendOut  = $('#rw-sendout', root);
  const elRoute    = $('#rw-route', root);
  const elDlAll    = $('#rw-dl-all', root);
  const elWC       = $('#rw-wc', root);
  const elModeHint = $('#rw-mode-hint', root);
  const elModNum   = root.querySelector('[data-bind="moduleNum"]');
  const elStatus   = root.querySelector('[data-bind="status"]');
  const elModeLabel= root.querySelector('[data-bind="modeLabel"]');

  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  /* ─── Restore state ─── */
  elInput.value = state.draft;
  updateWC();
  paintModeUI();
  refreshStatus();
  if (state.results) renderCards(state.results, '(restored)');

  /* ─── Download All ─── */
  if (elDlAll) {
    elDlAll.addEventListener('click', () => {
      if (!state.results) { toast('Generate rewrites first'); return; }
      downloadFile(gFileName('REWRITE', 'RW'), buildAllText(state.results), 'text/plain');
      toast('Downloaded', 'success');
    });
  }

  /* ─── Toolbar — no voice ─── */
  elTbMount.innerHTML = renderToolbarHTML();
  // Remove voice button from DOM
  const voiceBtn = elTbMount.querySelector('[data-tool="voice"]');
  if (voiceBtn) voiceBtn.remove();

  const tb = mountToolbar(elTbMount, {
    textarea: elInput,
    enterToSend: false,
    attachAccept: '.txt,.md',
    onAttach: async (file) => {
      const text = await file.text().catch(() => '');
      elInput.value = (elInput.value ? elInput.value + '\n\n' : '') + text;
      state.draft = elInput.value;
      SCOPE.set('draft', state.draft);
      updateWC();
      toast(`Attached: ${file.name}`, 'success');
    },
    onImprove:   () => runQuickAI('quick_improve', 'Improving…'),
    onTranslate: () => runQuickAI('quick_translate_en2hi', 'Translating…'),
    onSend:      () => generate()
  });

  /* ─── Mode toggle ─── */
  $$('.rw-mode-btn', root).forEach(b => {
    b.addEventListener('click', () => {
      state.mode = b.dataset.mode;
      SCOPE.set('mode', state.mode);
      paintModeUI();
    });
  });

  /* ─── Input ─── */
  elInput.addEventListener('input', () => {
    state.draft = elInput.value;
    SCOPE.set('draft', state.draft);
    updateWC();
  });

  /* ─── Main actions ─── */
  elGo.addEventListener('click', generate);
  elRead.addEventListener('click', openReadMode);
  elClear.addEventListener('click', () => {
    if (!confirm('Clear input and all rewrites?')) return;
    elInput.value = '';
    state.draft = ''; state.results = null;
    SCOPE.set('draft', ''); SCOPE.set('results', null);
    elOutput.classList.add('hide');
    elCards.innerHTML = '';
    if (elSendOut) { elSendOut.classList.add('hide'); elSendOut.innerHTML = ''; }
    updateWC();
    toast('Cleared', 'success');
  });

  /* ─── Generate ─── */
  async function generate() {
    const text = elInput.value.trim();
    if (!text) { toast('Type or paste some text first'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }

    const isSentence = state.mode === 'sentence';
    if (isSentence && text.split(/\s+/).length > 60) {
      toast('Sentence mode works best with 1 sentence. Switch to Paragraph mode for longer text.', 'error');
      return;
    }

    state.sending = true;
    refreshStatus();
    elGo.disabled = true;
    elGo.textContent = 'REWRITING…';
    elOutput.classList.add('hide');

    const sysprompt = `You are a professional writing assistant. Given a piece of text, produce exactly 5 rewrites as a JSON object. Each rewrite must preserve the CORE MEANING but differ in tone/style/length as instructed. Return ONLY valid JSON — no markdown, no explanation.

JSON format:
{
  "original": "...",
  "casual": "...",
  "formal": "...",
  "shorter": "...",
  "expanded": "..."
}`;

    const userPrompt = `${isSentence ? 'Rewrite this SENTENCE' : 'Rewrite this PARAGRAPH'} in 5 styles:

- original: correct grammar only, same tone
- casual: friendly conversational tone
- formal: professional/business tone  
- shorter: condensed, remove filler words
- expanded: richer, more detail and vocabulary

Text to rewrite:
"${text}"

Return ONLY the JSON object.`;

    try {
      const r = await AI.chat([
        { role: 'system', content: sysprompt },
        { role: 'user',   content: userPrompt }
      ], { temperature: 0.75, maxTokens: 2000 });

      const cleaned = r.text.replace(/```json|```/g, '').trim();
      const data = JSON.parse(cleaned);

      // Validate all 5 keys present
      const required = ['original','casual','formal','shorter','expanded'];
      for (const k of required) {
        if (!data[k]) throw new Error(`Missing key: ${k}`);
      }

      state.results = data;
      SCOPE.set('results', data);
      renderCards(data, r.route);
      toast('5 rewrites ready', 'success');
    } catch (e) {
      toast('Failed: ' + (e.details?.[0] || e.message), 'error');
      elOutput.classList.add('hide');
    } finally {
      state.sending = false;
      refreshStatus();
      elGo.disabled = false;
      elGo.textContent = '✍️ REWRITE × 5';
    }
  }

  /* ─── Render 5 cards ─── */
  function renderCards(data, route) {
    if (elRoute) elRoute.textContent = route ? route.toUpperCase() : '—';
    elOutput.classList.remove('hide');

    const colorMap = { original: 'lime', casual: 'warn', formal: 'muted', shorter: 'muted', expanded: 'muted' };
    const descMap  = {
      original: 'Grammar corrected · Same tone',
      casual:   'Friendly · Conversational',
      formal:   'Professional · Business ready',
      shorter:  'Condensed · No filler',
      expanded: 'Richer · More detail'
    };

    elCards.innerHTML = REWRITES.map(rw => `
      <div class="rw-card frame subtle" data-rw="${esc(rw.key)}">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="rw-card-head">
          <span class="rw-card-badge ${esc(colorMap[rw.key] || 'muted')}">${esc(rw.num)} · ${esc(rw.label)}</span>
          <span class="rw-card-desc mono">${esc(descMap[rw.key] || '')}</span>
        </div>
        <div class="rw-card-body" id="rwtext-${esc(rw.key)}">${esc(data[rw.key] || '')}</div>
        <div class="rw-card-actions">
          <button class="rw-act" data-act="copy"     data-key="${esc(rw.key)}">⧉ COPY</button>
          <button class="rw-act" data-act="use"      data-key="${esc(rw.key)}">↩ USE THIS</button>
          <button class="rw-act" data-act="download" data-key="${esc(rw.key)}">⬇ SAVE</button>
          <button class="rw-act" data-act="speak"    data-key="${esc(rw.key)}">🔊 SPEAK</button>
        </div>
      </div>
    `).join('');

    /* Wire card actions */
    $$('.rw-act[data-act="copy"]', elCards).forEach(b => {
      b.addEventListener('click', () => copyToClipboard(data[b.dataset.key] || ''));
    });
    $$('.rw-act[data-act="download"]', elCards).forEach(b => {
      b.addEventListener('click', () => {
        const text = data[b.dataset.key] || '';
        if (!text) return;
        const rw = REWRITES.find(r => r.key === b.dataset.key);
        downloadFile(gFileName('REWRITE', 'RW'), text, 'text/plain');
        toast('Downloaded', 'success');
      });
    });
    $$('.rw-act[data-act="use"]', elCards).forEach(b => {
      b.addEventListener('click', () => {
        const text = data[b.dataset.key] || '';
        elInput.value = text;
        state.draft = text;
        SCOPE.set('draft', text);
        updateWC();
        elInput.focus();
        // Scroll to top of page
        const page = root.closest('.page');
        if (page) page.scrollTop = 0;
        toast('Pasted into input — refine and rewrite again', 'success');
      });
    });
    $$('.rw-act[data-act="speak"]', elCards).forEach(b => {
      b.addEventListener('click', () => {
        const text = data[b.dataset.key] || '';
        if (!text) return;
        speak(text);
      });
    });

    /* SEND OUT */
    if (elSendOut) {
      elSendOut.classList.remove('hide');
      mountSendOut(elSendOut, {
        module: 'REWRITE',
        code: 'RW',
        items: [
          { key: 'input',    label: 'INPUT',         getContent: () => state.draft || elInput.value.trim() },
          { key: 'original', label: 'v1 ORIGINAL',   getContent: () => data.original || '' },
          { key: 'casual',   label: 'v2 CASUAL',     getContent: () => data.casual   || '' },
          { key: 'formal',   label: 'v3 FORMAL',     getContent: () => data.formal   || '' },
          { key: 'shorter',  label: 'v4 SHORTER',    getContent: () => data.shorter  || '' },
          { key: 'expanded', label: 'v5 EXPANDED',   getContent: () => data.expanded || '' },
          { key: 'all',      label: 'ALL 5',         getContent: () => buildAllText(data), default: true }
        ]
      });
    }
  }

  function buildAllText(data) {
    const input = state.draft || elInput.value.trim();
    const lines = [`ORIGINAL INPUT:\n${input}\n\n${'─'.repeat(40)}`];
    REWRITES.forEach((rw, i) => {
      lines.push(`\n${rw.num} ${rw.label}:\n${data[rw.key] || ''}`);
    });
    return lines.join('\n');
  }

  /* ─── READ MODE ─── */
  function openReadMode() {
    const text = elInput.value.trim();
    if (!text) { toast('Type or paste some text first'); return; }

    let fontSize = 16;
    let lineH    = 1.8;

    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-inner">
        <div class="kicker"><span>READ MODE</span><span class="lime">● FOCUSED</span></div>

        <!-- Controls -->
        <div class="row center gap-12" style="margin-bottom:14px;flex-wrap:wrap;">
          <div class="row gap-12 center">
            <button class="btn btn-icon" id="rd-fa-">A−</button>
            <span class="mono" style="font-size:11px;color:var(--muted);" id="rd-fsize">16px</span>
            <button class="btn btn-icon" id="rd-fa+">A+</button>
          </div>
          <div class="row gap-12 center">
            <button class="btn btn-icon" id="rd-lh-">≡−</button>
            <span class="mono" style="font-size:11px;color:var(--muted);" id="rd-lhval">1.8</span>
            <button class="btn btn-icon" id="rd-lh+">≡+</button>
          </div>
          <button class="btn flex-1" id="rd-speak">🔊 SPEAK</button>
        </div>

        <div class="ticks">${'<i></i>'.repeat(28)}</div>

        <!-- Reading area -->
        <div class="rw-read-body" id="rd-body" style="font-size:${fontSize}px;line-height:${lineH};">
          ${esc(text)}
        </div>

        <div class="ticks mt-12">${'<i></i>'.repeat(28)}</div>
        <button class="btn mt-12" style="width:100%;" id="rd-close">CLOSE</button>
      </div>
    `);

    setTimeout(() => {
      const rdBody  = document.getElementById('rd-body');
      const rdFsize = document.getElementById('rd-fsize');
      const rdLhval = document.getElementById('rd-lhval');

      function applyStyle() {
        if (rdBody)  { rdBody.style.fontSize = fontSize + 'px'; rdBody.style.lineHeight = lineH; }
        if (rdFsize)   rdFsize.textContent = fontSize + 'px';
        if (rdLhval)   rdLhval.textContent = lineH.toFixed(1);
      }

      document.getElementById('rd-fa-')?.addEventListener('click', () => {
        fontSize = Math.max(12, fontSize - 2); applyStyle();
      });
      document.getElementById('rd-fa+')?.addEventListener('click', () => {
        fontSize = Math.min(28, fontSize + 2); applyStyle();
      });
      document.getElementById('rd-lh-')?.addEventListener('click', () => {
        lineH = +(Math.max(1.2, lineH - 0.2)).toFixed(1); applyStyle();
      });
      document.getElementById('rd-lh+')?.addEventListener('click', () => {
        lineH = +(Math.min(3.0, lineH + 0.2)).toFixed(1); applyStyle();
      });
      document.getElementById('rd-speak')?.addEventListener('click', () => speak(text));
      document.getElementById('rd-close')?.addEventListener('click', closeSheet);
    }, 60);
  }

  /* ─── TTS ─── */
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('TTS not supported', 'error'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.rate = 0.92;
    speechSynthesis.speak(u);
    toast('Speaking…');
  }

  /* ─── Quick AI ─── */
  async function runQuickAI(promptKey, busyMsg) {
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
      state.draft = r.text;
      SCOPE.set('draft', state.draft);
      updateWC();
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      toast('Failed: ' + (e.details?.[0] || e.message), 'error');
    }
  }

  /* ─── No route helper ─── */
  function showNoRouteHelp() {
    openSheet(`
      <div class="sheet-handle"></div>
      <div class="sheet-inner">
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
      </div>
    `);
    setTimeout(() => {
      document.getElementById('nr-cancel')?.addEventListener('click', closeSheet);
      document.getElementById('nr-go')?.addEventListener('click', () => { closeSheet(); go('settings'); });
    }, 50);
  }

  /* ─── Helpers ─── */
  function paintModeUI() {
    $$('.rw-mode-btn', root).forEach(b => b.classList.toggle('on', b.dataset.mode === state.mode));
    if (elModeHint) elModeHint.textContent = MODE_HINTS[state.mode] || '';
    if (elModeLabel) elModeLabel.textContent = state.mode === 'sentence' ? 'SENTENCE MODE' : 'PARAGRAPH MODE';
    elInput.placeholder = state.mode === 'sentence'
      ? 'Type or paste ONE sentence here…'
      : 'Paste or type your paragraph here…';
  }

  function updateWC() {
    const t = elInput.value.trim();
    const n = t ? t.split(/\s+/).length : 0;
    if (elWC) elWC.textContent = n + ' WORD' + (n === 1 ? '' : 'S');
  }

  function refreshStatus() {
    if (!elStatus) return;
    if (state.sending) { elStatus.textContent = '● REWRITING'; elStatus.className = 'lime'; }
    else if (!AI.hasAnyRoute()) { elStatus.textContent = '● NO ROUTE'; elStatus.className = 'rust'; }
    else { elStatus.textContent = '● READY'; elStatus.className = 'lime'; }
  }

  return {
    onShow() { refreshStatus(); },
    destroy() { tb.destroy(); }
  };
}

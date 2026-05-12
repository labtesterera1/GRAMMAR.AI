/* ────────────────────────────────────────────────────────────────
   EMAIL MODULE · controller
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, copyToClipboard, downloadFile, openSheet, closeSheet, mountSendOut, gFileName, renderMd, stripColorTags, mountOutputColorPicker, mountModuleBackup } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';
import { go } from '../../core/router.js';
import { mountToolbar, renderToolbarHTML } from '../../core/toolbar.js';

const SCOPE = Storage.scope('email');

export default async function init({ root, module }) {

  let manifest = { options: {} };
  try { manifest = await fetch('modules/email/manifest.json').then(r => r.json()); } catch {}
  const opts = manifest.options || {};

  let prompts = {};
  try { prompts = await fetch('config/prompts.json').then(r => r.json()); } catch {}

  const state = {
    type: SCOPE.get('type', opts.defaultType || 'professional'),
    subject: SCOPE.get('subject', ''),
    body: SCOPE.get('body', ''),
    last: SCOPE.get('last', null)
  };

  const elTypes   = $('#email-types', root);
  const elSubject = $('#email-subject', root);
  const elBody    = $('#email-body', root);
  const elGo      = $('#email-go', root);
  const elClear   = $('#email-clear', root);
  const elResults = $('#email-results', root);
  const elSummary = $('#email-summary', root);
  const elCorrected = $('#email-corrected', root);
  const elImproved  = $('#email-improved', root);
  const elPolished  = $('#email-polished', root);
  const elSendOut = $('#email-sendout', root);
  const elTbMount = $('#toolbar-mount', root);
  const elModNum  = root.querySelector('[data-bind="moduleNum"]');
  const elStatus  = root.querySelector('[data-bind="status"]');
  const elWC      = root.querySelector('[data-bind="wordCount"]');

  function showSendOut() {
    if (!state.last?.polished || !elSendOut) return;
    elSendOut.classList.remove('hide');
    mountSendOut(elSendOut, {
      module: 'EMAIL',
      code: 'EM',
      items: [
        { key: 'input',     label: 'INPUT',          getContent: () => `Subject: ${state.subject || ''}\n\n${state.body || ''}` },
        { key: 'corrected', label: 'CORRECTED v1',   getContent: () => elCorrected.innerText || '' },
        { key: 'improved',  label: 'IMPROVED v2',    getContent: () => elImproved.innerText  || '' },
        { key: 'polished',  label: 'POLISHED v3',    getContent: () => elPolished.innerText  || '', default: true }
      ]
    });
  }

  // Wire output color pickers — output only, input stays clean
  mountOutputColorPicker($('#color-corrected', root), elCorrected);
  mountOutputColorPicker($('#color-improved',  root), elImproved);
  mountOutputColorPicker($('#color-polished',  root), elPolished);

  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  // Build type chips
  elTypes.innerHTML = (opts.types || []).map(t =>
    `<button class="chip ${t.key === state.type ? 'on' : ''}" data-type="${esc(t.key)}">${esc(t.label)}</button>`
  ).join('');
  $$('.chip[data-type]', elTypes).forEach(b => {
    b.addEventListener('click', () => {
      state.type = b.dataset.type;
      SCOPE.set('type', state.type);
      $$('.chip[data-type]', elTypes).forEach(x => x.classList.toggle('on', x.dataset.type === state.type));
    });
  });

  // Restore drafts
  elSubject.value = state.subject;
  elBody.value = state.body;

  // Restore last result if any
  if (state.last) {
    elSummary.innerHTML  = renderMd(state.last.summary   || '');
    elCorrected.innerHTML = renderMd(state.last.corrected || '');
    elImproved.innerHTML  = renderMd(state.last.improved  || '');
    elPolished.innerHTML  = renderMd(state.last.polished  || '');
    elResults.classList.remove('hide');
    $('#color-corrected', root)?.classList.remove('hide');
    $('#color-improved',  root)?.classList.remove('hide');
    $('#color-polished',  root)?.classList.remove('hide');
    showSendOut();
  }

  refreshStatus();
  updateWC();

  // Toolbar mounted on body textarea
  elTbMount.innerHTML = renderToolbarHTML();
  const tb = mountToolbar(elTbMount, {
    textarea: elBody,
    voiceLang: 'en-IN',
    enterToSend: false,
    attachAccept: '.txt,.md,.json,.csv',
    onAttach: async (file) => {
      const text = await file.text().catch(() => '');
      elBody.value = (elBody.value ? elBody.value + '\n\n' : '') + text;
      state.body = elBody.value;
      SCOPE.set('body', state.body);
      updateWC();
      toast(`Attached: ${file.name}`, 'success');
    },
    onImprove: () => quickAction('quick_improve', 'Improving…'),
    onTranslate: () => quickTranslate(),
    onSend: () => analyze()
  });

  elSubject.addEventListener('input', () => { state.subject = elSubject.value; SCOPE.set('subject', state.subject); });
  elBody.addEventListener('input', () => { state.body = elBody.value; SCOPE.set('body', state.body); updateWC(); });

  elGo.addEventListener('click', analyze);
  elClear.addEventListener('click', () => {
    if (!confirm('Clear email and all results?')) return;
    elSubject.value = ''; elBody.value = '';
    state.subject = ''; state.body = ''; state.last = null;
    SCOPE.set('subject', ''); SCOPE.set('body', ''); SCOPE.remove('last');
    elResults.classList.add('hide');
    updateWC();
  });

  // SPEAK per version
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('TTS not supported', 'error'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN'; u.rate = 0.95;
    speechSynthesis.speak(u);
    toast('Speaking…');
  }
  $('#speak-corrected', root)?.addEventListener('click', () => {
    if (!state.last?.corrected) { toast('Run analyze first'); return; }
    speak(state.last.corrected);
  });
  $('#speak-improved', root)?.addEventListener('click', () => {
    if (!state.last?.improved) { toast('Run analyze first'); return; }
    speak(state.last.improved);
  });
  $('#speak-polished', root)?.addEventListener('click', () => {
    if (!state.last?.polished) { toast('Run analyze first'); return; }
    speak(state.last.polished);
  });

  // Copy / download per version
  $$('[data-copy]', root).forEach(b => b.addEventListener('click', () => {
    const el = { corrected: elCorrected, improved: elImproved, polished: elPolished }[b.dataset.copy];
    const text = el?.innerText || state.last?.[b.dataset.copy] || '';
    if (!text) { toast('Run analyze first'); return; }
    copyToClipboard(text);
  }));
  $$('[data-dl]', root).forEach(b => b.addEventListener('click', () => {
    const el = { corrected: elCorrected, improved: elImproved, polished: elPolished }[b.dataset.dl];
    const text = el?.innerText || state.last?.[b.dataset.dl] || '';
    if (!text) { toast('Run analyze first'); return; }
    downloadFile(gFileName('EMAIL', 'EM'), `Subject: ${state.subject || ''}\n\n${text}`, 'text/plain');
  }));

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

  async function analyze() {
    const subjectRaw = elSubject.value.trim();
    const bodyRaw    = elBody.value.trim();
    if (!bodyRaw) { toast('Enter the email body first'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }

    // Strip color tags before sending to AI
    const subject = stripColorTags(subjectRaw);
    const body    = stripColorTags(bodyRaw);

    const types = prompts.email_types || {};
    const typeLabel = types[state.type] || 'professional email';

    elGo.disabled = true;
    elGo.textContent = 'ANALYZING…';
    elResults.classList.add('hide');

    try {
      const userPrompt = `Analyse and correct this ${typeLabel}. Subject: "${subject || 'N/A'}". Body: "${body}"

Return ONLY this JSON:
{
  "summary": "Grammar check summary: list all grammar errors found, punctuation issues, tone problems. Be specific.",
  "corrected": "Corrected version — fix ONLY grammar errors, keep original meaning and structure exactly.",
  "improved": "Improved version — fix grammar AND improve clarity, flow, and tone for ${typeLabel}.",
  "polished": "Polished version — make it perfectly professional, impactful, and compelling for ${typeLabel}."
}`;

      const r = await AI.chat([
        { role: 'system', content: prompts.email_system || 'Return ONLY valid JSON, no markdown.' },
        { role: 'user',   content: userPrompt }
      ], { temperature: 0.5, maxTokens: 3000 });

      const cleaned = r.text.replace(/```json|```/g, '').trim();
      const data = JSON.parse(cleaned);

      state.last = {
        summary:  data.summary  || '',
        corrected: data.corrected || '',
        improved:  data.improved  || '',
        polished:  data.polished  || ''
      };
      SCOPE.set('last', state.last);

      elSummary.innerHTML  = renderMd(state.last.summary);
      elCorrected.innerHTML = renderMd(state.last.corrected);
      elImproved.innerHTML  = renderMd(state.last.improved);
      elPolished.innerHTML  = renderMd(state.last.polished);
      elResults.classList.remove('hide');
      // Reveal color pickers now that output exists
      $('#color-corrected', root)?.classList.remove('hide');
      $('#color-improved',  root)?.classList.remove('hide');
      $('#color-polished',  root)?.classList.remove('hide');
      showSendOut();
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      toast('Failed: ' + (e.details?.[0] || e.message), 'error');
    } finally {
      elGo.disabled = false;
      elGo.textContent = '▸ ANALYZE & CORRECT';
    }
  }

  async function quickAction(promptKey, busyMsg) {
    const raw = elBody.value.trim();
    if (!raw) { toast('Type something first'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }
    const text = stripColorTags(raw);
    toast(busyMsg);
    try {
      const r = await AI.chat([
        { role: 'system', content: prompts[promptKey] || '' },
        { role: 'user',   content: text }
      ], { temperature: 0.3, maxTokens: 700 });
      elBody.value = r.text;
      state.body = r.text;
      SCOPE.set('body', state.body);
      updateWC();
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      toast('Failed: ' + (e.details?.[0] || e.message), 'error');
    }
  }

  function quickTranslate() {
    const raw = elBody.value.trim();
    if (!raw) { toast('Type something first'); return; }
    const text = stripColorTags(raw);
    const isHindi = /[\u0900-\u097F]/.test(text);
    quickAction(isHindi ? 'quick_translate_hi2en' : 'quick_translate_en2hi', isHindi ? 'Hindi → English…' : 'English → Hindi…');
  }

  function updateWC() {
    const t = elBody.value.trim();
    const n = t ? t.split(/\s+/).length : 0;
    if (elWC) elWC.textContent = n + ' WORD' + (n === 1 ? '' : 'S');
  }

  function refreshStatus() {
    if (!elStatus) return;
    if (!AI.hasAnyRoute()) { elStatus.textContent = '● NO ROUTE'; elStatus.className = 'rust'; }
    else { elStatus.textContent = '● READY'; elStatus.className = 'lime'; }
  }

  mountModuleBackup($('#email-module-backup', root), {
    moduleId: 'email', moduleCode: 'EM', scope: SCOPE
  });

  return {
    onShow() { refreshStatus(); },
    destroy() { tb.destroy(); }
  };
}

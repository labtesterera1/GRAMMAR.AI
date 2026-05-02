/* ────────────────────────────────────────────────────────────────
   EXERCISE MODULE · controller
   Sub-tabs: tense / flash / vocab / story
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast, copyToClipboard, downloadFile, openSheet, closeSheet, mountSendOut } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';
import { go } from '../../core/router.js';

const SCOPE = Storage.scope('exercise');

export default async function init({ root, module }) {

  let manifest = { options: {} };
  try { manifest = await fetch('modules/exercise/manifest.json').then(r => r.json()); } catch {}
  const opts = manifest.options || {};

  let prompts = {};
  try { prompts = await fetch('config/prompts.json').then(r => r.json()); } catch {}

  const state = {
    tab: SCOPE.get('tab', opts.defaultTab || 'tense'),

    // tense
    selectedTense: SCOPE.get('selectedTense', ''),
    tenseData: SCOPE.get('tenseData', null),
    tenseShowAns: false,

    // flash
    flashCards: SCOPE.get('flashCards', []),
    flashTopic: SCOPE.get('flashTopic', ''),
    flashIdx: 0,
    flashFlipped: false,
    flashKnown: SCOPE.get('flashKnown', 0),

    // vocab
    vocabData: SCOPE.get('vocabData', null),
    vocabLevel: SCOPE.get('vocabLevel', 'intermediate'),

    // story
    storyData: SCOPE.get('storyData', null),
    storyTopic: SCOPE.get('storyTopic', 'daily life')
  };

  const elModNum  = root.querySelector('[data-bind="moduleNum"]');
  const elStatus  = root.querySelector('[data-bind="status"]');
  const elSubInfo = root.querySelector('[data-bind="subInfo"]');
  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  /* ─── Sub-tabs ─── */
  const elTabs = $('#ex-tabs', root);
  elTabs.innerHTML = (opts.subTabs || []).map(t =>
    `<button class="chip ${t.key === state.tab ? 'on' : ''}" data-tab="${esc(t.key)}">${esc(t.label)}</button>`
  ).join('');
  $$('.chip[data-tab]', elTabs).forEach(b => {
    b.addEventListener('click', () => {
      state.tab = b.dataset.tab;
      SCOPE.set('tab', state.tab);
      paintTab();
    });
  });

  function paintTab() {
    $$('.chip[data-tab]', elTabs).forEach(x => x.classList.toggle('on', x.dataset.tab === state.tab));
    $$('.ex-sub', root).forEach(s => s.classList.toggle('hide', s.dataset.sub !== state.tab));
    if (elSubInfo) elSubInfo.textContent = state.tab.toUpperCase();
  }
  paintTab();
  refreshStatus();

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

  /* ════════════════════════════════════════
     TENSE EXERCISE
     ════════════════════════════════════════ */
  const elTGrid    = $('#tense-grid', root);
  const elTGo      = $('#tense-go', root);
  const elTToggle  = $('#tense-toggle-ans', root);
  const elTDl      = $('#tense-download', root);
  const elTQs      = $('#tense-questions', root);
  const elTAs      = $('#tense-answers', root);
  const elTQList   = $('#tense-q-list', root);
  const elTAList   = $('#tense-a-list', root);
  const elTQInfo   = $('#tense-q-info', root);

  elTGrid.innerHTML = (opts.tenses || []).map(t =>
    `<button class="tense-btn ${t === state.selectedTense ? 'sel' : ''}" data-tense="${esc(t)}">${esc(t)}</button>`
  ).join('');
  $$('[data-tense]', elTGrid).forEach(b => {
    b.addEventListener('click', () => {
      state.selectedTense = b.dataset.tense;
      SCOPE.set('selectedTense', state.selectedTense);
      $$('[data-tense]', elTGrid).forEach(x => x.classList.toggle('sel', x.dataset.tense === state.selectedTense));
      elTGo.disabled = false;
    });
  });

  if (state.tenseData) renderTenseData(state.tenseData);

  elTGo.addEventListener('click', genTenseExercise);
  elTToggle.addEventListener('click', () => {
    state.tenseShowAns = !state.tenseShowAns;
    elTAs.classList.toggle('hide', !state.tenseShowAns);
    elTToggle.textContent = state.tenseShowAns ? '🙈 HIDE ANSWERS' : '👁 ANSWERS';
  });
  elTDl.addEventListener('click', downloadTenseExercise);

  // Tense CLEAR
  $('#tense-clear', root)?.addEventListener('click', () => {
    if (!confirm('Clear tense exercise?')) return;
    state.selectedTense = ''; state.tenseData = null; state.tenseShowAns = false;
    SCOPE.set('selectedTense', ''); SCOPE.set('tenseData', null);
    $$('[data-tense]', elTGrid).forEach(x => x.classList.remove('sel'));
    elTGo.disabled = true; elTToggle.disabled = true; elTDl.disabled = true;
    elTQs.classList.add('hide'); elTAs.classList.add('hide');
    if (elTenseSendOut) { elTenseSendOut.classList.add('hide'); elTenseSendOut.innerHTML = ''; }
    toast('Cleared', 'success');
  });

  async function genTenseExercise() {
    if (!state.selectedTense) { toast('Select a tense first'); return; }
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }

    elTGo.disabled = true;
    elTGo.textContent = 'GENERATING…';

    const isPrep = state.selectedTense.toLowerCase().includes('preposition');
    const userPrompt = isPrep
      ? `Generate 15 preposition exercises for: "${state.selectedTense}". Seed: ${Math.floor(Math.random()*100000)}. Return ONLY: {"tense":"${state.selectedTense}","questions":[{"no":1,"sentence":"She arrived ___ Monday morning.","hint":"in / on / at"}],"answers":[{"no":1,"answer":"on","explanation":"Use 'on' for specific days of the week."}]} with 15 items each. Use real daily-life sentences. Each hint must show 2-3 preposition choices.`
      : `Generate 15 fill-in-the-blank sentences for: "${state.selectedTense}". Seed: ${Math.floor(Math.random()*100000)}. Return ONLY: {"tense":"${state.selectedTense}","questions":[{"no":1,"sentence":"She ___ (go) every day.","hint":"correct form"}],"answers":[{"no":1,"answer":"goes","explanation":"Third person singular needs -s."}]} with 15 items each. Unique daily-life sentences.`;

    try {
      const r = await AI.chat([
        { role: 'system', content: prompts.exercise_system || 'Return ONLY valid JSON.' },
        { role: 'user',   content: userPrompt }
      ], { temperature: 0.7, maxTokens: 3000 });
      const data = JSON.parse(r.text.replace(/```json|```/g, '').trim());
      state.tenseData = data;
      SCOPE.set('tenseData', data);
      renderTenseData(data);
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      toast('Failed: ' + (e.details?.[0] || e.message), 'error');
    } finally {
      elTGo.disabled = false;
      elTGo.textContent = '▸ GENERATE 15 Qs';
    }
  }

  function renderTenseData(d) {
    elTQs.classList.remove('hide');
    elTToggle.disabled = false;
    elTDl.disabled = false;
    elTQInfo.textContent = `${(d.questions || []).length} Qs`;
    elTQList.textContent = (d.questions || []).map(q => `${q.no}. ${q.sentence}\n   (${q.hint})`).join('\n\n');
    elTAList.textContent = (d.answers || []).map(a => `${a.no}. ${a.answer}\n   ${a.explanation}`).join('\n\n');
    if (elTenseSendOut) {
      elTenseSendOut.classList.remove('hide');
      const v = '1.2.1', dt = new Date().toISOString().slice(0,10);
      mountSendOut(elTenseSendOut,
        () => `EXERCISE — ${(d.tense||'').toUpperCase()}\n\nQUESTIONS:\n${elTQList.textContent}\n\nANSWERS:\n${elTAList.textContent}`,
        () => `Grammar.AI_v${v}_Exercise-${(d.tense||'').replace(/ /g,'-')}_${dt}`
      );
    }
  }

  function downloadTenseExercise() {
    if (!state.tenseData) return;
    const d = state.tenseData;
    let txt = `EXERCISE — ${(d.tense || '').toUpperCase()}\n${'='.repeat(50)}\n\nQUESTIONS:\n\n`;
    txt += (d.questions || []).map(q => `${q.no}. ${q.sentence}\n   (${q.hint})`).join('\n\n');
    txt += `\n\n${'-'.repeat(50)}\nANSWERS:\n\n`;
    txt += (d.answers || []).map(a => `${a.no}. ${a.answer}\n   ${a.explanation}`).join('\n\n');
    txt += `\n\nGrammar.AI · ${new Date().toLocaleDateString('en-IN')}`;
    downloadFile(`tense-${(d.tense || '').replace(/ /g, '-')}.txt`, txt, 'text/plain');
  }

  /* ════════════════════════════════════════
     FLASHCARDS
     ════════════════════════════════════════ */
  const elFTopic   = $('#flash-topic', root);
  const elFGo      = $('#flash-go', root);
  const elFArea    = $('#flash-area', root);
  const elFCard    = $('#flash-card', root);
  const elFQ       = $('#flash-q', root);
  const elFBack    = $('#flash-back', root);
  const elFA       = $('#flash-a', root);
  const elFExp     = $('#flash-exp', root);
  const elFCount   = $('#flash-counter', root);
  const elFScore   = $('#flash-score', root);
  const elFBar     = $('#flash-bar', root);
  const elFMarkRow = $('#flash-mark-row', root);
  const elFNo      = $('#flash-no', root);
  const elFYes     = $('#flash-yes', root);
  const elFPrev    = $('#flash-prev', root);
  const elFShuffle = $('#flash-shuffle', root);
  const elFNext    = $('#flash-next', root);
  const elFDl      = $('#flash-download', root);
  const elFSum     = $('#flash-summary', root);
  const elFSumText = $('#flash-sum-text', root);
  const elFRestart = $('#flash-restart', root);

  elFTopic.innerHTML = (opts.flashcardTopics || []).map(t =>
    `<option value="${esc(t)}" ${t === state.flashTopic ? 'selected' : ''}>${esc(t)}</option>`
  ).join('');

  if (state.flashCards.length > 0) {
    elFArea.classList.remove('hide');
    showFlash();
  }

  elFGo.addEventListener('click', genFlashcards);
  $('#flash-clear', root)?.addEventListener('click', () => {
    if (!confirm('Clear flashcards?')) return;
    state.flashCards = []; state.flashIdx = 0; state.flashFlipped = false; state.flashKnown = 0;
    SCOPE.set('flashCards', []); SCOPE.set('flashKnown', 0);
    elFArea.classList.add('hide');
    toast('Cleared', 'success');
  });
  elFCard.addEventListener('click', flipFlash);
  elFNo.addEventListener('click', () => markFlash(false));
  elFYes.addEventListener('click', () => markFlash(true));
  elFPrev.addEventListener('click', () => { state.flashFlipped = false; state.flashIdx = (state.flashIdx - 1 + state.flashCards.length) % state.flashCards.length; showFlash(); });
  elFNext.addEventListener('click', () => { state.flashFlipped = false; state.flashIdx = (state.flashIdx + 1) % state.flashCards.length; showFlash(); });
  elFShuffle.addEventListener('click', () => {
    for (let i = state.flashCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.flashCards[i], state.flashCards[j]] = [state.flashCards[j], state.flashCards[i]];
    }
    state.flashIdx = 0; state.flashFlipped = false;
    showFlash();
    toast('Shuffled');
  });
  elFDl.addEventListener('click', downloadFlash);
  elFRestart.addEventListener('click', () => {
    state.flashIdx = 0;
    state.flashKnown = 0;
    state.flashFlipped = false;
    SCOPE.set('flashKnown', 0);
    elFSum.classList.add('hide');
    showFlash();
  });

  async function genFlashcards() {
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }
    const topic = elFTopic.value;
    state.flashTopic = topic;
    SCOPE.set('flashTopic', topic);

    elFGo.disabled = true;
    elFGo.textContent = 'GENERATING…';
    elFArea.classList.add('hide');

    try {
      const r = await AI.chat([
        { role: 'system', content: prompts.flashcard_system || 'Return ONLY valid JSON.' },
        { role: 'user',   content: `Create 10 flashcards for: "${topic}". Seed: ${Math.floor(Math.random()*99999)}. Return ONLY: {"topic":"${topic}","cards":[{"id":1,"question":"Question?","answer":"Answer","explanation":"English tip or example","explanation_hindi":"हिंदी में स्पष्टीकरण — आसान भाषा में"}]} with 10 items. All unique, educational, and practical.` }
      ], { temperature: 0.7, maxTokens: 2500 });
      const data = JSON.parse(r.text.replace(/```json|```/g, '').trim());
      state.flashCards = data.cards || [];
      state.flashIdx = 0;
      state.flashFlipped = false;
      state.flashKnown = 0;
      SCOPE.set('flashCards', state.flashCards);
      SCOPE.set('flashKnown', 0);
      elFArea.classList.remove('hide');
      elFSum.classList.add('hide');
      showFlash();
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      toast('Failed: ' + (e.details?.[0] || e.message), 'error');
    } finally {
      elFGo.disabled = false;
      elFGo.textContent = '▸ GENERATE';
    }
  }

  function showFlash() {
    if (!state.flashCards.length) return;
    const c = state.flashCards[state.flashIdx];
    elFQ.textContent = c.question || '';
    elFA.textContent = c.answer || '';
    let exp = '';
    if (c.explanation) exp += c.explanation;
    if (c.explanation_hindi) exp += (exp ? '\n\n🇮🇳 ' : '🇮🇳 ') + c.explanation_hindi;
    elFExp.textContent = exp;
    elFCount.textContent = `CARD ${state.flashIdx+1} / ${state.flashCards.length}`;
    elFScore.textContent = `✓ ${state.flashKnown}`;
    elFBar.style.width = ((state.flashIdx+1)/state.flashCards.length*100) + '%';
    state.flashFlipped = false;
    elFBack.classList.add('hide');
    elFMarkRow.classList.add('hide');
  }

  function flipFlash() {
    if (!state.flashCards.length) return;
    state.flashFlipped = !state.flashFlipped;
    elFBack.classList.toggle('hide', !state.flashFlipped);
    elFMarkRow.classList.toggle('hide', !state.flashFlipped);
  }

  function markFlash(known) {
    if (known) state.flashKnown++;
    SCOPE.set('flashKnown', state.flashKnown);
    if (state.flashIdx === state.flashCards.length - 1) {
      // Round complete
      const total = state.flashCards.length;
      elFSumText.textContent = `${state.flashKnown} / ${total} known · ${Math.round(state.flashKnown/total*100)}% accuracy`;
      elFSum.classList.remove('hide');
    } else {
      state.flashIdx++;
      showFlash();
    }
  }

  function downloadFlash() {
    if (!state.flashCards.length) { toast('Generate cards first'); return; }
    let txt = `FLASHCARDS — ${state.flashTopic.toUpperCase()}\n${'='.repeat(50)}\n\n`;
    state.flashCards.forEach((c, i) => {
      txt += `${i+1}. ${c.question}\n   ANS: ${c.answer}\n   ${c.explanation || ''}\n   ${c.explanation_hindi || ''}\n\n`;
    });
    txt += `Grammar.AI · ${new Date().toLocaleDateString('en-IN')}`;
    downloadFile(`flashcards-${state.flashTopic.replace(/ /g, '-')}.txt`, txt, 'text/plain');
  }

  /* ════════════════════════════════════════
     VOCAB
     ════════════════════════════════════════ */
  const elVLevel = $('#vocab-level', root);
  const elVGo    = $('#vocab-go', root);
  const elVList  = $('#vocab-list', root);
  const elVDl    = $('#vocab-download', root);

  elVLevel.innerHTML = (opts.vocabLevels || []).map(l =>
    `<option value="${esc(l.key)}" ${l.key === state.vocabLevel ? 'selected' : ''}>${esc(l.label)}</option>`
  ).join('');
  if (state.vocabData) renderVocab(state.vocabData);

  elVGo.addEventListener('click', genVocab);
  $('#vocab-clear', root)?.addEventListener('click', () => {
    if (!confirm('Clear vocabulary list?')) return;
    state.vocabData = null; SCOPE.set('vocabData', null);
    elVList.innerHTML = ''; elVDl.disabled = true;
    toast('Cleared', 'success');
  });
  elVLevel.addEventListener('change', () => {
    state.vocabLevel = elVLevel.value;
    SCOPE.set('vocabLevel', state.vocabLevel);
  });
  elVDl.addEventListener('click', downloadVocab);

  async function genVocab() {
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }
    const level = state.vocabLevel;
    elVGo.disabled = true;
    elVGo.textContent = 'GENERATING…';
    elVList.innerHTML = '<div class="mono dim" style="padding:18px 0;text-align:center;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">Generating…</div>';

    try {
      const r = await AI.chat([
        { role: 'system', content: prompts.vocab_system || 'Return ONLY valid JSON.' },
        { role: 'user',   content: `Generate 10 unique ${level}-level English words. Seed: ${Math.floor(Math.random()*99999)}. Return: {"level":"${level}","words":[{"word":"accomplish","type":"verb","meaning":"to complete successfully","example1":"She accomplished her goal.","example2":"Hard work helps accomplish great things."}]} with 10 items.` }
      ], { temperature: 0.7, maxTokens: 2500 });
      const data = JSON.parse(r.text.replace(/```json|```/g, '').trim());
      state.vocabData = data;
      SCOPE.set('vocabData', data);
      renderVocab(data);
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      elVList.innerHTML = `<div class="rust mono" style="padding:18px 0;text-align:center;font-size:11px;">Error: ${esc(e.message)}</div>`;
    } finally {
      elVGo.disabled = false;
      elVGo.textContent = '▸ GENERATE';
    }
  }

  function renderVocab(d) {
    elVDl.disabled = false;
    elVList.innerHTML = (d.words || []).map(w => `
      <div class="frame subtle" style="padding:12px 14px;">
        <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
        <div class="row" style="align-items:baseline;gap:10px;">
          <span class="serif" style="font-size:22px;">${esc(w.word)}</span>
          <span class="mono lime" style="font-size:9px;letter-spacing:0.16em;text-transform:uppercase;">${esc(w.type || '')}</span>
        </div>
        <div class="mono mt-8" style="font-size:11px;color:var(--text);line-height:1.5;">${esc(w.meaning || '')}</div>
        <div class="mono mt-8" style="font-size:11px;color:var(--muted);line-height:1.7;">
          1. ${esc(w.example1 || '')}<br>
          2. ${esc(w.example2 || '')}
        </div>
      </div>
    `).join('');
  }

  function downloadVocab() {
    if (!state.vocabData) return;
    const d = state.vocabData;
    let t = `VOCABULARY — ${(d.level || '').toUpperCase()}\n${'='.repeat(40)}\n\n`;
    (d.words || []).forEach((w, i) => {
      t += `${i+1}. ${w.word} (${w.type})\n   ${w.meaning}\n   1. ${w.example1}\n   2. ${w.example2}\n\n`;
    });
    t += `Grammar.AI · ${new Date().toLocaleDateString('en-IN')}`;
    downloadFile(`vocab-${d.level}.txt`, t, 'text/plain');
  }

  /* ════════════════════════════════════════
     STORY
     ════════════════════════════════════════ */
  const elSTopic   = $('#story-topic', root);
  const elSGo      = $('#story-go', root);
  const elSDl      = $('#story-download', root);
  const elSCopy    = $('#story-copy', root);
  const elSCard    = $('#story-card', root);
  const elSTitle   = $('#story-title', root);
  const elSMeta    = $('#story-meta', root);
  const elSBody    = $('#story-body', root);
  const elSGrammar = $('#story-grammar', root);
  const elSLesson  = $('#story-lesson', root);
  const elStorySendOut = $('#story-sendout', root);
  const elTenseSendOut = $('#tense-sendout', root);

  elSTopic.innerHTML = (opts.storyTopics || []).map(t =>
    `<option value="${esc(t)}" ${t === state.storyTopic ? 'selected' : ''}>${esc(t)}</option>`
  ).join('');
  if (state.storyData) renderStory(state.storyData);

  elSGo.addEventListener('click', genStory);
  $('#story-clear', root)?.addEventListener('click', () => {
    if (!confirm('Clear story?')) return;
    state.storyData = null; SCOPE.set('storyData', null);
    elSCard.classList.add('hide'); elSDl.disabled = true; elSCopy.disabled = true;
    if (elStorySendOut) { elStorySendOut.classList.add('hide'); elStorySendOut.innerHTML = ''; }
    toast('Cleared', 'success');
  });
  elSTopic.addEventListener('change', () => {
    state.storyTopic = elSTopic.value;
    SCOPE.set('storyTopic', state.storyTopic);
  });
  elSDl.addEventListener('click', downloadStory);
  elSCopy.addEventListener('click', () => {
    if (!state.storyData) return;
    const d = state.storyData;
    copyToClipboard(`${d.title}\n\n${d.story}\n\nGrammar: ${d.grammarFocus}\nLesson: ${d.lesson}`);
  });

  async function genStory() {
    if (!AI.hasAnyRoute()) { showNoRouteHelp(); return; }
    const topic = state.storyTopic;
    elSGo.disabled = true;
    elSGo.textContent = 'GENERATING…';
    elSCard.classList.add('hide');

    try {
      const r = await AI.chat([
        { role: 'system', content: prompts.story_system || 'Return ONLY valid JSON.' },
        { role: 'user',   content: `Write a short story on: "${topic}". Seed: ${Math.floor(Math.random()*99999)}. Return: {"title":"Story Title","topic":"${topic}","level":"intermediate","readingTime":"3 min","story":"200-280 word story. Natural English, relatable to Indian readers, include dialogue.","grammarFocus":"Grammar demonstrated.","lesson":"Key lesson 1-2 sentences."}` }
      ], { temperature: 0.8, maxTokens: 2000 });
      const data = JSON.parse(r.text.replace(/```json|```/g, '').trim());
      state.storyData = data;
      SCOPE.set('storyData', data);
      renderStory(data);
      toast('Done · ' + r.route, 'success');
    } catch (e) {
      toast('Failed: ' + (e.details?.[0] || e.message), 'error');
    } finally {
      elSGo.disabled = false;
      elSGo.textContent = '▸ NEW STORY';
    }
  }

  function renderStory(d) {
    elSCard.classList.remove('hide');
    elSDl.disabled = false;
    elSCopy.disabled = false;
    elSTitle.textContent = d.title || '';
    elSMeta.textContent = `${d.topic || ''} · ${d.level || ''} · ${d.readingTime || ''}`;
    elSBody.textContent = d.story || '';
    elSGrammar.textContent = d.grammarFocus || '';
    elSLesson.textContent = d.lesson || '';
    if (elStorySendOut) {
      elStorySendOut.classList.remove('hide');
      const v = '1.2.1', dt = new Date().toISOString().slice(0,10);
      mountSendOut(elStorySendOut,
        () => `${d.title}\n\n${d.story}\n\nGrammar: ${d.grammarFocus}\nLesson: ${d.lesson}`,
        () => `Grammar.AI_v${v}_Story-${(d.topic||'').replace(/ /g,'-')}_${dt}`
      );
    }
  }

  function downloadStory() {
    if (!state.storyData) return;
    const d = state.storyData;
    const t = `${d.title}\n${'='.repeat((d.title || '').length)}\n${d.topic} | ${d.readingTime}\n\n${d.story}\n\n${'-'.repeat(30)}\nGrammar: ${d.grammarFocus}\nLesson: ${d.lesson}\n\nGrammar.AI · ${new Date().toLocaleDateString('en-IN')}`;
    downloadFile(`story-${(d.topic || '').replace(/ /g, '-')}.txt`, t, 'text/plain');
  }

  /* ─── Status ─── */
  function refreshStatus() {
    if (!elStatus) return;
    if (!AI.hasAnyRoute()) { elStatus.textContent = '● NO ROUTE'; elStatus.className = 'rust'; }
    else { elStatus.textContent = '● READY'; elStatus.className = 'lime'; }
  }

  return {
    onShow() { refreshStatus(); }
  };
}

/* ════════════════════════════════════════════════════════════════
   GUTS · Get Up To Speed · controller.js · v1.0.0
   Grammar.AI module — MOD 09
   Features:
   · 6-digit PIN lock (SHA-256, 3-attempt lockout)
   · Upload: PDF (PDF.js) · DOCX · PPTX · TXT · VTT · SRT · any
   · AI PDF cleanup (column/raw fix) via cascade
   · Client-side text processor → lesson chunks
   · Lesson reader: word tap, read aloud, drill mode, comprehension
   · WORD BANK: 3 sections (WORD / EN-SIMILAR / HI-Devanagari) via AI
   · Notes: Pages, rich text (B/H/◑/👁/aA/📎), Read Aloud
   · Knowledge base: persistent word memory
   · Export / Import JSON
   · AI cascade: Groq → Cerebras → Gemini → Mistral (via AI.chat)
   ════════════════════════════════════════════════════════════════ */

import { $, $$, esc, toast, uid, downloadFile, pickFile } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';

const MODULE_VERSION = '1.0.0';
const SCOPE = Storage.scope('guts');

/* ── AI Prompts ─────────────────────────────────────────────── */
const P_WORD = `You are an English vocabulary expert for Indian learners.
For the word given return ONLY valid JSON (no markdown, no explanation):
{"synonyms":["word1","word2","word3"],"sentences":["Sentence using word1.","Sentence using word2."],"devanagari":["देवनागरी1","देवनागरी2","देवनागरी3"]}
devanagari = phonetic Devanagari script of each English synonym (how it sounds, not translation).
Return ONLY the JSON object.`;

const P_PDF = `You are a text reconstruction expert.
This text was extracted from a PDF and may have column artifacts, broken lines, merged words, page numbers, headers, footers.
Reconstruct it as clean, readable prose exactly as the original author intended.
Preserve all meaning and order. Return ONLY the clean text — no labels, no explanation.`;

const P_QUIZ = `You are an English comprehension teacher for Indian learners.
Generate 3 multiple-choice questions from the given text.
Return ONLY valid JSON array (no markdown):
[{"q":"Question?","options":["a","b","c","d"],"answer":"a","explain":"Brief reason."}]`;

/* ── Crypto ─────────────────────────────────────────────────── */
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ── Helpers ────────────────────────────────────────────────── */
function fmtDate(ts) {
  return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'2-digit'}).format(new Date(ts));
}
function gid() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function safeJSON(text) {
  try { return JSON.parse(text.replace(/```json|```/g,'').trim()); } catch { return null; }
}

/* ── Speech ─────────────────────────────────────────────────── */
let _spk=false, _pau=false, _rate=1.0, _sents=[], _idx=0, _spkCb=null;

function speakText(text, rate=1.0, onSentence=null) {
  if (!('speechSynthesis' in window)) { toast('Speech not supported'); return; }
  stopSpeech();
  const sents = tokenizeSentences(stripHTML(text));
  if (!sents.length) return;
  _sents=sents; _idx=0; _spk=true; _pau=false; _rate=rate; _spkCb=onSentence;
  _speakNext();
}
function _speakNext() {
  if (!_spk || _idx>=_sents.length) { _spk=false; if(_spkCb)_spkCb(-1); _updateRA(); return; }
  if (_spkCb) _spkCb(_idx);
  const u = new SpeechSynthesisUtterance(_sents[_idx]);
  u.rate=_rate; u.lang='en-US';
  u.onend=()=>{ _idx++; _speakNext(); };
  u.onerror=()=>{ _idx++; _speakNext(); };
  window.speechSynthesis.speak(u);
  _updateRA();
}
function stopSpeech() {
  _spk=false; _pau=false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (_spkCb) { _spkCb(-1); _spkCb=null; }
  _updateRA();
}
function _updateRA() {
  const play=document.getElementById('guts-ra-play'),
        pause=document.getElementById('guts-ra-pause'),
        stop=document.getElementById('guts-ra-stop');
  if (!play) return;
  play.disabled=_spk&&!_pau; pause.disabled=!_spk||_pau; stop.disabled=!_spk;
  play.textContent=_pau?'▶ Resume':'▶';
}
function stripHTML(h) { const d=document.createElement('div'); d.innerHTML=h; return d.innerText||d.textContent||''; }

/* ── File readers ───────────────────────────────────────────── */
async function readFile(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf'))  return readPdf(file);
  if (n.endsWith('.docx')) return readDocx(file);
  if (n.endsWith('.pptx')) return readPptx(file);
  if (n.endsWith('.vtt'))  return readVtt(await file.text());
  if (n.endsWith('.srt'))  return readSrt(await file.text());
  try { return await file.text(); }
  catch { throw new Error(`Cannot read ${file.name} as text`); }
}

async function readPdf(file) {
  const lib = window.pdfjsLib;
  if (!lib) throw new Error('PDF.js not loaded — reload the page (needs internet first load)');
  lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buf = await file.arrayBuffer();
  const pdf = await lib.getDocument({data:buf}).promise;
  const pageTexts = [];
  for (let i=1; i<=pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Use x-coordinate for column detection
    const items = content.items.filter(it=>it.str.trim());
    if (!items.length) continue;
    const xs = items.map(it=>it.transform[4]);
    const midX = (Math.min(...xs)+Math.max(...xs))/2;
    const left  = items.filter(it=>it.transform[4]<midX).map(it=>it.str).join(' ');
    const right = items.filter(it=>it.transform[4]>=midX).map(it=>it.str).join(' ');
    // Heuristic: if left+right both non-trivial → 2-column
    const isColumn = left.length>50 && right.length>50;
    pageTexts.push(isColumn ? left+'\n\n'+right : items.map(it=>it.str).join(' '));
  }
  return pageTexts.join('\n\n').trim();
}

async function readDocx(file) {
  const Z = window.JSZip;
  if (!Z) throw new Error('JSZip not loaded');
  const zip = await Z.loadAsync(file);
  const xml = await zip.file('word/document.xml').async('text');
  return xml.replace(/<w:br[^>]*>/gi,'\n').replace(/<\/w:p>/gi,'\n')
    .replace(/<[^>]+>/g,'')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/\n{3,}/g,'\n\n').trim();
}

async function readPptx(file) {
  const Z = window.JSZip;
  if (!Z) throw new Error('JSZip not loaded');
  const zip = await Z.loadAsync(file);
  const slides = Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();
  let text='';
  for (const s of slides) {
    const xml = await zip.files[s].async('text');
    const t = xml.replace(/<a:t>/g,' ').replace(/<a:p[^>]*>/g,'\n').replace(/<[^>]+>/g,'')
      .replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
    if (t) text+=t+'\n\n';
  }
  return text.trim();
}

function readVtt(raw) {
  return raw.split('\n').filter(l=>!l.match(/^WEBVTT|^\d+$|-->/)).join(' ')
    .replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
}
function readSrt(raw) {
  return raw.replace(/^\d+\s*$/gm,'')
    .replace(/\d{2}:\d{2}:\d{2},\d+\s*-->\s*\d{2}:\d{2}:\d{2},\d+/g,'')
    .replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
}

/* ── AI: PDF cleanup ────────────────────────────────────────── */
async function aiCleanPdf(text) {
  if (!AI.hasAnyRoute()) return text;
  // Detect if cleanup needed (many short lines = column artifact)
  const lines = text.split('\n').filter(l=>l.trim().length>0);
  const shortRatio = lines.filter(l=>l.trim().length<45).length / Math.max(lines.length,1);
  if (shortRatio < 0.55) return text; // looks fine
  try {
    const chunks = [];
    const words = text.split(/\s+/);
    for (let i=0; i<words.length; i+=300) chunks.push(words.slice(i,i+300).join(' '));
    const cleaned = [];
    for (const ch of chunks) {
      const { text: t } = await AI.chat([
        {role:'system',content:P_PDF},
        {role:'user',content:ch}
      ], {maxTokens:600});
      cleaned.push(t);
    }
    return cleaned.join('\n\n');
  } catch { return text; } // silent fallback
}

/* ── AI: Word enrichment ────────────────────────────────────── */
async function enrichWord(word) {
  const cacheKey = 'wc.' + word.toLowerCase();
  const cached = SCOPE.get(cacheKey, null);
  if (cached) return cached;
  if (!AI.hasAnyRoute()) return null;
  try {
    const { text } = await AI.chat([
      {role:'system',content:P_WORD},
      {role:'user',content:word}
    ], {maxTokens:300});
    const data = safeJSON(text);
    if (data && data.synonyms) {
      SCOPE.set(cacheKey, data);
      return data;
    }
    return null;
  } catch { return null; }
}

/* ── AI: Comprehension questions ────────────────────────────── */
async function aiQuestions(lessonText) {
  if (!AI.hasAnyRoute()) return genQuestionsStatic(lessonText);
  try {
    const { text } = await AI.chat([
      {role:'system',content:P_QUIZ},
      {role:'user',content:lessonText.slice(0,2000)}
    ], {maxTokens:700});
    const qs = safeJSON(text);
    if (Array.isArray(qs) && qs.length) return qs;
    return genQuestionsStatic(lessonText);
  } catch { return genQuestionsStatic(lessonText); }
}

function genQuestionsStatic(text) {
  const vocab = [...new Set((text.match(/\b[a-zA-Z]{7,}\b/g)||[])
    .filter(w=>!CW.has(w.toLowerCase())).map(w=>w.toLowerCase()))].slice(0,8);
  const sents = tokenizeSentences(text);
  const qs = [];
  for (const sent of sents) {
    const word = vocab.find(w=>sent.toLowerCase().includes(w));
    if (word && (sent.match(/\b\w+\b/g)||[]).length>=6 && qs.length<3) {
      const blanked = sent.replace(new RegExp(`\\b${word}\\b`,'gi'),'_____');
      const wrong = vocab.filter(w=>w!==word).slice(0,3);
      if (wrong.length<1) continue;
      const opts = [...[word,...wrong]].sort(()=>Math.random()-.5).slice(0,4);
      qs.push({q:blanked, options:opts, answer:word, explain:`"${word}" fits the context.`});
    }
  }
  return qs;
}

/* ── Text processor ─────────────────────────────────────────── */
function processText(raw, title) {
  const clean = cleanText(raw);
  const chunks = chunkText(clean).map(analyzeChunk);
  return buildLesson(chunks, title || autoTitle(clean));
}

function cleanText(raw) {
  return raw
    .replace(/\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/g,'')
    .replace(/^[A-Z][A-Za-z\s]{0,25}:\s*/gm,'')
    .replace(/<[^>]+>/g,' ')
    .replace(/[ \t]+/g,' ')
    .replace(/\r\n/g,'\n').replace(/\n{3,}/g,'\n\n')
    .trim();
}

function chunkText(text) {
  const paras = text.split(/\n\n+/).map(p=>p.replace(/\n/g,' ').trim()).filter(p=>p.length>30);
  if (paras.length>=2) return paras;
  const sents = tokenizeSentences(text);
  const out=[];
  for (let i=0; i<sents.length; i+=3) {
    const c = sents.slice(i,i+3).join(' ').trim();
    if (c.length>20) out.push(c);
  }
  return out.length ? out : [text];
}

function tokenizeSentences(text) {
  return text.replace(/([.!?])\s+(?=[A-Z"'])/g,'$1|||')
    .split('|||').map(s=>s.trim()).filter(s=>s.length>8);
}

function analyzeChunk(text) {
  const sentences = tokenizeSentences(text);
  const words = text.match(/\b[a-zA-Z]+\b/g)||[];
  const patterns = sentences.filter(s=>(s.match(/\b\w+\b/g)||[]).length>=12);
  const vocab = [...new Set(
    words.filter(w=>w.length>=7&&!CW.has(w.toLowerCase())).map(w=>w.toLowerCase())
  )].slice(0,10);
  const lower = text.toLowerCase();
  const phrases = CP.filter(p=>lower.includes(p));
  return {text, sentences, patterns, vocab, phrases};
}

function buildLesson(chunks, title) {
  const id='les_'+gid(), now=Date.now();
  return {
    id, title, createdAt:now, status:'unread',
    chunks,
    allVocab:[...new Set(chunks.flatMap(c=>c.vocab))],
    allPhrases:[...new Set(chunks.flatMap(c=>c.phrases))],
    allPatterns:chunks.flatMap(c=>c.patterns),
    questions:[],
  };
}

function autoTitle(text) {
  const f=tokenizeSentences(text)[0]||text;
  return f.slice(0,60).trim()+(f.length>60?'…':'');
}

/* ── Knowledge base ─────────────────────────────────────────── */
function updateKnowledge(words, sourceId) {
  const k = SCOPE.get('knowledge', {});
  const now = Date.now();
  for (const word of words) {
    const key = word.toLowerCase();
    const prev = k[key]||{word:key,count:0,sourceIds:[],firstSeen:now,lastSeen:now};
    k[key] = {...prev, count:prev.count+1, lastSeen:now,
      sourceIds:[...new Set([...(prev.sourceIds||[]),sourceId])]};
  }
  SCOPE.set('knowledge', k);
  return k;
}

/* ── Data helpers ───────────────────────────────────────────── */
function getLessons() { return SCOPE.get('lessons', []); }
function getWordbank() { return SCOPE.get('wordbank', []); }
function getNotes()   { return SCOPE.get('notes', []); }
function getKnow()    { return SCOPE.get('knowledge', {}); }

function saveLesson(l) {
  const arr = getLessons().filter(x=>x.id!==l.id);
  SCOPE.set('lessons', [l,...arr]);
}
function deleteLesson(id) { SCOPE.set('lessons', getLessons().filter(l=>l.id!==id)); }
function saveWord(w) {
  const arr = getWordbank().filter(x=>x.id!==w.id);
  SCOPE.set('wordbank', [w,...arr]);
}
function deleteWord(id) { SCOPE.set('wordbank', getWordbank().filter(w=>w.id!==id)); }
function saveNote(n) {
  const arr = getNotes().filter(x=>x.id!==n.id);
  SCOPE.set('notes', [...arr, n].sort((a,b)=>a.pageNum-b.pageNum));
}
function deleteNote(id) { SCOPE.set('notes', getNotes().filter(n=>n.id!==id)); }

/* ═══════════════════════════════════════════════════════════════
   MAIN INIT
   ═══════════════════════════════════════════════════════════════ */
export default async function init({ root, module }) {

  const elGate    = $('#guts-gate', root);
  const elMain    = $('#guts-main', root);
  const elContent = $('#guts-content', root);
  const elAiDot   = $('#guts-ai-status', root);

  let state = {
    unlocked: false,
    tab: SCOPE.get('tab','home'),
    lessonId: null,
    noteId: null,
    drillMode: false,
    saveTimer: null,
  };

  /* ── AI status dot ────────────────────────────────────────── */
  function refreshAiDot() {
    if (!elAiDot) return;
    const on = AI.hasAnyRoute();
    elAiDot.textContent = on ? '● AI ON' : '● AI OFF';
    elAiDot.classList.toggle('guts-ai-on', on);
    elAiDot.classList.toggle('guts-ai-off', !on);
  }

  /* ══════════════════════════════════════════════════════
     PIN GATE  (identical pattern to Notes module)
     ══════════════════════════════════════════════════════ */
  let pinEntry='', pinAttempts=0, pinLocked=false;
  const storedHash = ()=>SCOPE.get('pinHash',null);
  const hasPin     = ()=>!!storedHash();
  let pinMode = hasPin()?'verify':'setup-1';
  let setup1Hash='';

  function initGate() {
    pinEntry='';
    const label   = $('#guts-gate-label', root);
    const sub     = $('#guts-gate-sub',   root);
    const resetRow= $('#guts-pin-reset-row', root);
    if (!hasPin()) {
      pinMode='setup-1';
      label.textContent='SET A 6-DIGIT PASSWORD';
      sub.textContent='FIRST TIME SETUP';
      resetRow.classList.add('hide');
    } else {
      pinMode='verify';
      label.textContent='ENTER 6-DIGIT PASSWORD';
      sub.textContent='ENTER PASSWORD';
      resetRow.classList.remove('hide');
    }
    updateDots();
  }

  function updateDots() {
    root.querySelectorAll('#guts-pin-dots .pin-dot').forEach((d, i) => {
      d.classList.toggle('filled', i < pinEntry.length);
      d.classList.toggle('active', i === pinEntry.length);
    });
  }

  async function handleDigit(n) {
    if (pinLocked || pinEntry.length>=6) return;
    const err = $('#guts-pin-error', root);
    if (err) err.textContent='';
    pinEntry += n;
    updateDots();
    if (pinEntry.length===6) await checkPin();
  }

  async function checkPin() {
    const err = $('#guts-pin-error', root);
    const hash = await sha256(pinEntry);

    if (pinMode==='setup-1') {
      setup1Hash=hash;
      pinMode='setup-2';
      $('#guts-gate-label',root).textContent='CONFIRM YOUR PASSWORD';
      pinEntry=''; updateDots(); return;
    }
    if (pinMode==='setup-2') {
      if (hash!==setup1Hash) {
        if(err) err.textContent='Passwords do not match — try again';
        pinEntry=''; updateDots(); return;
      }
      SCOPE.set('pinHash', hash);
      unlock(); return;
    }
    // verify mode
    if (hash===storedHash()) {
      pinAttempts=0; unlock();
    } else {
      pinAttempts++;
      pinEntry=''; updateDots();
      if (pinAttempts>=3) {
        pinLocked=true;
        if(err) err.textContent='Too many attempts — wait 30s';
        setTimeout(()=>{ pinLocked=false; pinAttempts=0; if(err)err.textContent=''; },30000);
      } else {
        if(err) err.textContent=`Wrong password (${3-pinAttempts} left)`;
      }
    }
  }

  function unlock() {
    state.unlocked=true;
    elGate.classList.add('hide');
    elMain.classList.remove('hide');
    refreshAiDot();
    route(state.tab);
  }

  function lock() {
    stopSpeech();
    state.unlocked=false;
    elMain.classList.add('hide');
    elGate.classList.remove('hide');
    pinEntry=''; pinAttempts=0;
    initGate();
  }

  // Bind PIN numpad
  root.querySelectorAll('#guts-numpad .num-btn[data-n]').forEach(btn=>{
    btn.addEventListener('click',()=>handleDigit(btn.dataset.n));
  });
  const okBtn = $('#guts-pin-ok', root);
  if (okBtn) okBtn.addEventListener('click', async ()=>{ if(pinEntry.length===6) await checkPin(); });
  const clrBtn = $('#guts-pin-clear', root);
  if (clrBtn) clrBtn.addEventListener('click',()=>{ pinEntry=pinEntry.slice(0,-1); updateDots(); });
  const rstBtn = $('#guts-pin-reset', root);
  if (rstBtn) rstBtn.addEventListener('click',()=>{
    if (!confirm('Reset password? All GUTS data will be cleared.')) return;
    SCOPE.remove('pinHash'); SCOPE.remove('lessons'); SCOPE.remove('wordbank');
    SCOPE.remove('notes'); SCOPE.remove('knowledge');
    setTimeout(()=>{ initGate(); toast('Password reset — all data cleared'); },100);
  });

  // Lock button
  const lockBtn = $('#guts-lock-btn', root);
  if (lockBtn) lockBtn.addEventListener('click', lock);

  // Tab clicks
  root.querySelectorAll('.guts-tab').forEach(btn=>{
    btn.addEventListener('click',()=>route(btn.dataset.tab));
  });

  initGate();

  /* ══════════════════════════════════════════════════════
     ROUTING
     ══════════════════════════════════════════════════════ */
  function route(tab) {
    state.tab=tab;
    SCOPE.set('tab',tab);
    stopSpeech();
    root.querySelectorAll('.guts-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    switch(tab) {
      case 'upload':   renderUpload();   break;
      case 'library':  renderLibrary();  break;
      case 'lesson':   renderLesson();   break;
      case 'words':    renderWords();    break;
      case 'notes':    renderNotes();    break;
      case 'transfer': renderTransfer(); break;
      default:         renderHome();
    }
  }

  /* ══════════════════════════════════════════════════════
     HOME
     ══════════════════════════════════════════════════════ */
  function renderHome() {
    const lessons=getLessons(), wb=getWordbank();
    const unread=lessons.filter(l=>l.status==='unread').length;
    const done=lessons.filter(l=>l.status==='done').length;
    const sevenD=7*24*60*60*1000;
    const reviewWds=wb.filter(w=>(Date.now()-(w.lastReviewed||w.savedAt))>sevenD);
    const latest=lessons.find(l=>l.status!=='done')||lessons[0];

    elContent.innerHTML=`
<div class="guts-stats">
  <div class="guts-stat"><span class="guts-stat__n">${lessons.length}</span><span class="guts-stat__l">Lessons</span></div>
  <div class="guts-stat"><span class="guts-stat__n">${unread}</span><span class="guts-stat__l">Unread</span></div>
  <div class="guts-stat"><span class="guts-stat__n">${done}</span><span class="guts-stat__l">Done</span></div>
  <div class="guts-stat"><span class="guts-stat__n">${wb.length}</span><span class="guts-stat__l">Words</span></div>
</div>
${reviewWds.length?`<div class="guts-review-banner" id="home-review">
  <span>🔁</span>
  <span><strong>${reviewWds.length} word${reviewWds.length>1?'s':''}</strong> ready for review — not seen in 7+ days</span>
  <span class="guts-review-banner__arrow">→</span>
</div>`:''}
${latest?`<div class="guts-section">Continue reading</div>
<div class="guts-lesson-card featured" id="home-latest">
  <div class="guts-lesson-card__status ${sClass(latest.status)}">${sLabel(latest.status)}</div>
  <div class="guts-lesson-card__title">${esc(latest.title)}</div>
  <div class="guts-lesson-card__meta">${latest.chunks.length} chunks · ${latest.allVocab.length} vocab · ${fmtDate(latest.createdAt)}</div>
  <div class="guts-lesson-card__arrow">→</div>
</div>`:`<div class="guts-empty"><div class="guts-empty__icon">📖</div>No lessons yet — upload some material</div>`}
<div class="guts-section" style="margin-top:20px">Quick actions</div>
<div class="guts-actions">
  <button class="guts-action-btn" data-go="upload"><span class="guts-action-btn__icon">⬆</span>Upload</button>
  <button class="guts-action-btn" data-go="library"><span class="guts-action-btn__icon">📚</span>Library</button>
  <button class="guts-action-btn" data-go="words"><span class="guts-action-btn__icon">💡</span>Word Bank</button>
  <button class="guts-action-btn" data-go="notes"><span class="guts-action-btn__icon">📝</span>Notes</button>
</div>`;
    elContent.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>route(b.dataset.go)));
    const rl=elContent.querySelector('#home-review');
    if(rl) rl.addEventListener('click',()=>route('words'));
    const ll=elContent.querySelector('#home-latest');
    if(ll) ll.addEventListener('click',()=>{ state.lessonId=latest.id; route('lesson'); });
  }

  /* ══════════════════════════════════════════════════════
     UPLOAD
     ══════════════════════════════════════════════════════ */
  function renderUpload() {
    elContent.innerHTML=`
<label class="guts-label">Lesson title (optional)</label>
<input type="text" id="guts-ul-title" class="guts-input" placeholder="Leave blank to auto-generate" maxlength="80">
<div class="guts-upload-tabs">
  <button class="guts-upload-tab active" id="ut-paste">✏ Paste</button>
  <button class="guts-upload-tab" id="ut-file">📁 File</button>
</div>
<div id="up-paste-panel">
  <label class="guts-label">Paste any English text<span>article · transcript · story · any content</span></label>
  <textarea class="guts-textarea" id="guts-paste" rows="9" placeholder="Paste your text here…"></textarea>
  <div class="guts-row">
    <button class="btn btn-primary" id="guts-proc-paste">⚡ Process &amp; Save</button>
    <span style="font-size:9px;color:var(--dim);align-self:center" id="guts-paste-cc">0 chars</span>
  </div>
</div>
<div id="up-file-panel" class="hide">
  <label class="guts-label">Pick any file<span>PDF · DOCX · PPTX · TXT · VTT · SRT · any</span></label>
  <div class="guts-dropzone" id="guts-dropzone">
    <span style="font-size:32px">📄</span>
    <span class="guts-dropzone__label">Tap to pick a file</span>
    <span class="guts-dropzone__hint">No format restrictions</span>
  </div>
  <div id="guts-file-preview" class="hide"></div>
  <button class="btn btn-primary" id="guts-proc-file" disabled>⚡ Process &amp; Save</button>
</div>
<div id="guts-proc-msg" class="hide" style="margin-top:10px;font-size:11px;color:var(--lime);display:flex;align-items:center;gap:8px">
  <span class="guts-spinner">◐</span>
  <span id="guts-proc-msg-text">Processing…</span>
</div>`;
    bindUpload();
  }

  function bindUpload() {
    const ta=elContent.querySelector('#guts-paste');
    const cc=elContent.querySelector('#guts-paste-cc');
    if(ta) ta.addEventListener('input',()=>cc.textContent=ta.value.length.toLocaleString()+' chars');

    // Tab switch
    elContent.querySelector('#ut-paste').addEventListener('click',e=>{
      e.currentTarget.classList.add('active');
      elContent.querySelector('#ut-file').classList.remove('active');
      elContent.querySelector('#up-paste-panel').classList.remove('hide');
      elContent.querySelector('#up-file-panel').classList.add('hide');
    });
    elContent.querySelector('#ut-file').addEventListener('click',e=>{
      e.currentTarget.classList.add('active');
      elContent.querySelector('#ut-paste').classList.remove('active');
      elContent.querySelector('#up-file-panel').classList.remove('hide');
      elContent.querySelector('#up-paste-panel').classList.add('hide');
    });

    // Paste → process
    elContent.querySelector('#guts-proc-paste').addEventListener('click',async()=>{
      const text=(ta?.value||'').trim();
      const title=elContent.querySelector('#guts-ul-title')?.value.trim()||'';
      if(text.length<30){toast('Paste at least 30 characters','warn');return;}
      await runProcessor(text,title);
    });

    // File picker
    let _fileText='';
    const dz=elContent.querySelector('#guts-dropzone');
    const fp=elContent.querySelector('#guts-file-preview');
    const procBtn=elContent.querySelector('#guts-proc-file');

    dz.addEventListener('click',async()=>{
      const file=await pickFile('*/*');
      if(!file)return;
      setMsg(true,'Reading file…');
      try {
        let raw=await readFile(file);
        if(file.name.toLowerCase().endsWith('.pdf')){
          setMsg(true,'Cleaning PDF structure…');
          raw=await aiCleanPdf(raw);
        }
        _fileText=raw;
        fp.classList.remove('hide');
        fp.innerHTML=`<div class="guts-file-preview"><div class="guts-file-preview__name">${esc(file.name)}</div><div class="guts-file-preview__meta">${raw.length.toLocaleString()} chars extracted</div><pre class="guts-file-preview__peek">${esc(raw.slice(0,300))}${raw.length>300?'…':''}</pre></div>`;
        procBtn.disabled=false;
      } catch(e){ toast('Read error: '+e.message,''); }
      finally{ setMsg(false); }
    });

    procBtn.addEventListener('click',async()=>{
      if(!_fileText)return;
      const title=elContent.querySelector('#guts-ul-title')?.value.trim()||'';
      await runProcessor(_fileText,title);
    });
  }

  function setMsg(on, msg='Processing…') {
    const el=elContent.querySelector('#guts-proc-msg');
    const tx=elContent.querySelector('#guts-proc-msg-text');
    if(el) el.classList.toggle('hide',!on);
    if(tx&&msg) tx.textContent=msg;
  }

  async function runProcessor(text, title) {
    setMsg(true,'Analysing text…');
    await tick();
    try {
      const lesson = processText(text, title);
      setMsg(true,'Generating comprehension questions…');
      lesson.questions = await aiQuestions(lesson.chunks.map(c=>c.text).join(' '));
      setMsg(true,'Updating knowledge base…');
      updateKnowledge(lesson.allVocab, lesson.id);
      saveLesson(lesson);
      toast(`✓ Saved — ${lesson.chunks.length} chunks · ${lesson.allVocab.length} vocab`);
      state.lessonId=lesson.id;
      route('lesson');
    } catch(e){ toast('Failed: '+e.message); }
    finally{ setMsg(false); }
  }
  const tick=()=>new Promise(r=>setTimeout(r,20));

  /* ══════════════════════════════════════════════════════
     LIBRARY
     ══════════════════════════════════════════════════════ */
  function renderLibrary() {
    const lessons=getLessons();
    elContent.innerHTML=`<div class="guts-section">${lessons.length} LESSON${lessons.length!==1?'S':''}</div>${
      lessons.length===0?`<div class="guts-empty"><div class="guts-empty__icon">📚</div>No lessons yet</div>`:
      lessons.map(l=>`<div class="guts-lesson-card" data-id="${esc(l.id)}">
        <div class="guts-lesson-card__status ${sClass(l.status)}">${sLabel(l.status)}</div>
        <div class="guts-lesson-card__title">${esc(l.title)}</div>
        <div class="guts-lesson-card__meta">${l.chunks.length} chunks · ${l.allVocab.length} vocab · ${fmtDate(l.createdAt)}</div>
        <div class="guts-lesson-card__arrow">→</div>
      </div>`).join('')}`;
    elContent.querySelectorAll('.guts-lesson-card').forEach(c=>{
      c.addEventListener('click',()=>{ state.lessonId=c.dataset.id; route('lesson'); });
    });
  }

  /* ══════════════════════════════════════════════════════
     LESSON READER
     ══════════════════════════════════════════════════════ */
  function renderLesson() {
    const lesson=getLessons().find(l=>l.id===state.lessonId);
    if(!lesson){route('library');return;}
    const wb=new Set(getWordbank().map(w=>w.word));
    const know=getKnow();

    elContent.innerHTML=`
<div style="background:var(--surface);border:0.5px solid var(--border);padding:12px 14px;margin-bottom:10px">
  <div class="guts-lesson-card__status ${sClass(lesson.status)}">${sLabel(lesson.status)}</div>
  <div style="font-family:var(--serif);font-size:20px;margin-bottom:4px">${esc(lesson.title)}</div>
  <div style="font-size:9px;color:var(--muted);margin-bottom:10px">${lesson.chunks.length} chunks · ${lesson.allVocab.length} vocab · ${fmtDate(lesson.createdAt)}</div>
  <div class="guts-row">
    <button class="btn ${lesson.status==='done'?'btn-primary':''}" id="les-mark">${lesson.status==='done'?'✓ Done':'○ Mark done'}</button>
    <button class="btn btn-rust" id="les-del">✕ Delete</button>
    <button class="btn btn-ghost" id="les-back">← Library</button>
  </div>
</div>

<div class="guts-ra-bar">
  <button class="guts-ra-btn" id="guts-ra-play">▶</button>
  <button class="guts-ra-btn" id="guts-ra-pause" disabled>⏸</button>
  <button class="guts-ra-btn" id="guts-ra-stop"  disabled>⏹</button>
  <div class="guts-ra-speeds">
    ${[0.75,1,1.25,1.5].map(s=>`<button class="guts-ra-speed${_rate===s?' active':''}" data-rate="${s}">${s}×</button>`).join('')}
  </div>
</div>

<div class="guts-section">Story</div>
<div id="les-chunks">
  ${lesson.chunks.map((c,i)=>`<div class="guts-chunk" id="chunk-${i}">
    <div class="guts-chunk__num">§${i+1}</div>
    <div class="guts-chunk__text">${renderWords(c.text,wb,know)}</div>
    ${c.phrases.length?`<div class="guts-chunk__phrases">${c.phrases.map(p=>`<span class="guts-badge">${esc(p)}</span>`).join('')}</div>`:''}
  </div>`).join('')}
</div>

${lesson.allVocab.length?`<div class="guts-section">Key vocabulary</div>
<div class="guts-vocab-grid">${lesson.allVocab.map(w=>{
  const hi=HD[w]||'',kn=know[w],sv=wb.has(w);
  return `<button class="guts-vocab-chip${sv?' saved':''}" data-word="${esc(w)}">
    ${esc(w)}
    ${hi?`<span class="guts-vocab-chip__hi">${esc(hi.split('(')[0].trim())}</span>`:''}
    ${kn&&kn.count>1?`<span class="guts-vocab-chip__freq">${kn.count}×</span>`:''}
  </button>`;}).join('')}</div>`:''}

${lesson.allPatterns.length?`<div class="guts-section">Long patterns
  <button class="guts-mini-btn" id="les-drill">◈ Drill</button>
</div>
<div id="les-patterns">${lesson.allPatterns.map((p,i)=>`<div class="guts-pattern" id="pat-${i}">
  <span style="color:var(--lime-dim);flex-shrink:0">◈</span>
  <span class="guts-pattern__text">${esc(p)}</span>
  <button class="guts-pattern__listen" data-text="${esc(p)}">▶</button>
</div>`).join('')}</div>`:''}

${lesson.allPhrases.length?`<div class="guts-section">Key phrases</div>
<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">${lesson.allPhrases.map(p=>`<span class="guts-badge">${esc(p)}</span>`).join('')}</div>`:''}

${lesson.questions&&lesson.questions.length?`<div class="guts-section">Comprehension check</div><div id="les-quiz"></div>`:''}`;

    bindLesson(lesson,wb);
    if(lesson.questions&&lesson.questions.length) renderQuiz(lesson.questions);
  }

  function renderWords(text,wb,know) {
    return text.replace(/\b([a-zA-Z]+)\b/g,(m)=>{
      const k=m.toLowerCase(),hi=HD[k],sv=wb.has(k),kn=know[k];
      return `<span class="gw${hi?' known':''}${sv?' saved':''}${kn&&kn.count>2?' freq':''}" data-word="${k}">${esc(m)}</span>`;
    });
  }

  function bindLesson(lesson, wb) {
    elContent.querySelector('#les-back').addEventListener('click',()=>route('library'));
    elContent.querySelector('#les-del').addEventListener('click',async()=>{
      if(!confirm(`Delete "${lesson.title}"?`))return;
      deleteLesson(lesson.id);
      toast('Lesson deleted — vocabulary stays in knowledge base');
      route('library');
    });
    elContent.querySelector('#les-mark').addEventListener('click',()=>{
      lesson.status=lesson.status==='done'?'reading':'done';
      saveLesson(lesson); renderLesson();
    });

    // Word tap → popup
    elContent.querySelector('#les-chunks').addEventListener('click',e=>{
      const w=e.target.closest('.gw');
      if(w) showWordPopup(w.dataset.word,lesson,wb);
      else   closeWordPopup();
    });
    elContent.querySelectorAll('.guts-vocab-chip').forEach(c=>
      c.addEventListener('click',()=>showWordPopup(c.dataset.word,lesson,wb)));

    // Pattern listen
    elContent.querySelectorAll('.guts-pattern__listen').forEach(b=>
      b.addEventListener('click',e=>{ e.stopPropagation(); speakText(b.dataset.text,_rate); }));

    // Drill mode
    const drillBtn=elContent.querySelector('#les-drill');
    if(drillBtn) drillBtn.addEventListener('click',()=>toggleDrill());

    // Read aloud
    const sents=lesson.chunks.flatMap(c=>tokenizeSentences(c.text));
    bindRA(sents,elContent);
  }

  function toggleDrill() {
    state.drillMode=!state.drillMode;
    const btn=elContent.querySelector('#les-drill');
    elContent.querySelectorAll('#les-patterns .guts-pattern').forEach((p,i)=>{
      const span=p.querySelector('.guts-pattern__text');
      if(state.drillMode){
        span.dataset.orig=span.textContent;
        span.innerHTML=`<span class="guts-drill-hidden">Tap to reveal</span>`;
        span.addEventListener('click',function f(){span.textContent=span.dataset.orig;span.removeEventListener('click',f);},{once:true});
      } else { if(span.dataset.orig)span.textContent=span.dataset.orig; }
    });
    if(btn)btn.textContent=state.drillMode?'✕ Exit drill':'◈ Drill';
  }

  function renderQuiz(questions) {
    const el=elContent.querySelector('#les-quiz');
    if(!el)return;
    el.innerHTML=questions.map((q,i)=>`<div class="guts-quiz-q">
      <div class="guts-quiz-sent">${esc(q.q||q.sentence||'')}</div>
      <div class="guts-quiz-opts">${(q.options||[]).map(o=>`
        <button class="guts-quiz-opt" data-q="${i}" data-opt="${esc(o)}" data-ans="${esc(q.answer)}">${esc(o)}</button>`).join('')}
      </div>
      <div class="guts-quiz-result" id="qr-${i}"></div>
    </div>`).join('');
    el.querySelectorAll('.guts-quiz-opt').forEach(btn=>btn.addEventListener('click',()=>{
      const qi=btn.dataset.q,correct=btn.dataset.opt===btn.dataset.ans;
      elContent.querySelectorAll(`.guts-quiz-opt[data-q="${qi}"]`).forEach(b=>{
        b.disabled=true;
        if(b.dataset.opt===btn.dataset.ans)b.classList.add('correct');
        else if(b===btn)b.classList.add('wrong');
      });
      const res=elContent.querySelector(`#qr-${qi}`);
      if(res){ res.textContent=correct?'✓ Correct!':'✗ Answer: '+btn.dataset.ans;
        res.style.color=correct?'var(--lime)':'var(--rust)'; }
    }));
  }

  /* ── Word popup ─────────────────────────────────────────────── */
  const popup = $('#guts-word-popup', root);

  function showWordPopup(word, lesson, wb) {
    if(!popup)return;
    const hindi=HD[word]||'', know=getKnow(), kn=know[word], saved=wb.has(word);
    $('#gwp-word',root).textContent=word;
    $('#gwp-word',root).dataset.word=word;
    $('#gwp-hindi',root).textContent=hindi||'— not in dictionary yet';
    $('#gwp-hindi',root).style.color=hindi?'var(--lime)':'var(--dim)';
    $('#gwp-freq',root).textContent=kn?`Seen ${kn.count}× across ${kn.sourceIds.length} source${kn.sourceIds.length>1?'s':''}`:'First time';
    const ex=findExample(lesson,word);
    $('#gwp-ex',root).textContent=ex?`"${ex}"` :'';
    $('#gwp-save',root).textContent=saved?'✓ Saved':'+ Words';
    $('#gwp-save',root).disabled=saved;
    // Reset enrich section
    $('#gwp-synonyms',root).textContent='—';
    $('#gwp-deva',root).textContent='—';
    $('#guts-word-popup',root).classList.remove('hide');
  }

  function closeWordPopup() {
    if(popup) popup.classList.add('hide');
  }

  function findExample(lesson, word) {
    const re=new RegExp(`\\b${word}\\b`,'i');
    for(const c of (lesson?.chunks||[])){
      const m=c.sentences.find(s=>re.test(s));
      if(m)return m.slice(0,100)+(m.length>100?'…':'');
    }
    return '';
  }

  // Bind popup buttons
  if(popup) {
    $('#gwp-close',root).addEventListener('click',closeWordPopup);
    $('#gwp-listen',root).addEventListener('click',()=>{
      const w=$('#gwp-word',root).dataset.word;
      if(w) speakText(w,_rate);
    });
    $('#gwp-save',root).addEventListener('click',()=>{
      const w=$('#gwp-word',root).dataset.word;
      if(!w)return;
      const lessons=getLessons();
      const lesson=lessons.find(l=>l.id===state.lessonId);
      saveWord({id:'w_'+gid(),word:w,hindi:HD[w]||'',example:findExample(lesson,w),
        savedAt:Date.now(),lastReviewed:Date.now()});
      $('#gwp-save',root).textContent='✓ Saved';
      $('#gwp-save',root).disabled=true;
      toast('✓ Saved to word bank');
    });
    $('#gwp-enrich-btn',root).addEventListener('click',async()=>{
      const w=$('#gwp-word',root).dataset.word;
      if(!w)return;
      const btn=$('#gwp-enrich-btn',root);
      btn.textContent='⏳'; btn.disabled=true;
      const data=await enrichWord(w);
      if(data){
        $('#gwp-synonyms',root).innerHTML=
          `<div>${data.synonyms.join(' · ')}</div>` +
          data.sentences.map(s=>`<div style="color:var(--muted);font-size:10px;margin-top:3px;font-style:italic">${esc(s)}</div>`).join('');
        $('#gwp-deva',root).textContent=data.devanagari.join(' · ');
        btn.textContent='✓ Done';
      } else {
        btn.textContent='No AI route';
      }
    });
  }

  /* ══════════════════════════════════════════════════════
     WORDS (WORD BANK)
     ══════════════════════════════════════════════════════ */
  function renderWords() {
    const wb=getWordbank().sort((a,b)=>b.savedAt-a.savedAt);
    const sevenD=7*24*60*60*1000;
    elContent.innerHTML=`<div class="guts-section">${wb.length} SAVED WORD${wb.length!==1?'S':''}</div>${
      wb.length===0?`<div class="guts-empty"><div class="guts-empty__icon">💡</div>No words saved yet<br><span style="font-size:10px">Tap any word while reading a lesson</span></div>`:
      wb.map(w=>{
        const review=(Date.now()-(w.lastReviewed||w.savedAt))>sevenD;
        const cached=SCOPE.get('wc.'+w.word,null);
        return `<div class="guts-wb-card${review?' review':''}" data-wid="${esc(w.id)}">
          <div class="guts-wb-section-a">
            <div style="flex:1">
              ${review?'<div class="guts-wb-review-badge">🔁 Review</div>':'' }
              <div class="guts-wb-word">${esc(w.word)}</div>
              ${w.hindi?`<div class="guts-wb-hindi">${esc(w.hindi)}</div>`:''}
              ${w.example?`<div style="font-size:10px;color:var(--muted);font-style:italic;margin-top:3px">"${esc(w.example)}"</div>`:''}
              <div style="font-size:8px;color:var(--dim);margin-top:4px">${fmtDate(w.savedAt)}</div>
            </div>
            <div class="guts-wb-actions">
              <button class="guts-wb-btn wb-listen" data-word="${esc(w.word)}">▶</button>
              <button class="guts-wb-btn del wb-del" data-id="${esc(w.id)}">✕</button>
            </div>
          </div>
          <div class="guts-wb-section-b">
            <div class="guts-wb-section-label">EN · SIMILAR</div>
            ${cached?`<div class="guts-wb-synonyms">${esc(cached.synonyms.join(' · '))}</div>
              ${cached.sentences.map(s=>`<div class="guts-wb-example">${esc(s)}</div>`).join('')}`:
              `<button class="guts-enrich-trigger wb-enrich" data-word="${esc(w.word)}">✨ Tap to enrich</button>`}
          </div>
          <div class="guts-wb-section-c">
            <div class="guts-wb-section-label" style="font-family:var(--mono)">HI · DEVANAGARI</div>
            ${cached&&cached.devanagari?cached.devanagari.join(' · '):'<span style="color:var(--dim);font-family:var(--mono);font-size:10px">— enrich to see</span>'}
          </div>
        </div>`;
      }).join('')}`;

    elContent.querySelectorAll('.wb-del').forEach(btn=>btn.addEventListener('click',e=>{
      e.stopPropagation();
      deleteWord(btn.dataset.id);
      toast('Word removed');
      renderWords();
    }));
    elContent.querySelectorAll('.wb-listen').forEach(btn=>btn.addEventListener('click',e=>{
      e.stopPropagation();
      const w=getWordbank().find(x=>x.word===btn.dataset.word);
      speakText(`${btn.dataset.word}. ${w?.hindi||''} ${w?.example||''}`,_rate);
      if(w){ w.lastReviewed=Date.now(); saveWord(w); }
    }));
    elContent.querySelectorAll('.wb-enrich').forEach(btn=>btn.addEventListener('click',async e=>{
      e.stopPropagation();
      btn.textContent='⏳ Loading…'; btn.disabled=true;
      const data=await enrichWord(btn.dataset.word);
      if(data){
        toast('✓ Enriched — reloading');
        renderWords();
      } else {
        btn.textContent='No AI route'; btn.disabled=false;
        toast('Connect an AI provider in Settings','');
      }
    }));
  }

  /* ══════════════════════════════════════════════════════
     NOTES
     ══════════════════════════════════════════════════════ */
  function renderNotes() {
    const notes=getNotes();
    const active=state.noteId?notes.find(n=>n.id===state.noteId):notes[0];
    elContent.innerHTML=`
<div class="guts-pages-nav">
  ${notes.map((n,i)=>`<button class="guts-page-btn${active&&n.id===active.id?' active':''}" data-nid="${esc(n.id)}">Page ${i+1}</button>`).join('')}
  <button class="guts-page-btn add" id="note-add">+</button>
</div>
${active?`<input type="text" class="guts-note-title" id="note-title" value="${esc(active.title)}" placeholder="Page title…" maxlength="60">
<div class="guts-rte-toolbar">
  <button class="guts-rte-btn" data-cmd="bold"><strong>B</strong></button>
  <button class="guts-rte-btn" data-cmd="heading">H</button>
  <button class="guts-rte-btn" data-cmd="highlight">◑</button>
  <button class="guts-rte-btn" data-cmd="preview" id="rte-preview">👁</button>
  <button class="guts-rte-btn" data-cmd="fontsize">aA</button>
  <label class="guts-rte-btn" style="cursor:pointer" title="Attach image">📎<input type="file" id="rte-attach" accept="image/*" hidden></label>
  <div style="flex:1"></div>
  <button class="guts-rte-btn ra" id="rte-ra">▶ Read</button>
  <button class="guts-rte-btn del" id="rte-del">✕</button>
</div>
<div class="guts-rte" id="guts-rte" contenteditable="true" data-placeholder="Start writing your story or notes here…">${active.content||''}</div>
<div class="guts-note-footer">
  <span id="note-save-status" style="font-size:9px;color:var(--dim)">Auto-saved</span>
  <span style="font-size:9px;color:var(--dim)">Updated ${fmtDate(active.updatedAt||active.createdAt)}</span>
</div>`:`<div class="guts-empty"><div class="guts-empty__icon">📝</div>No pages yet — tap + to create one</div>`}`;
    bindNotes(active, notes);
  }

  let _noteFs=1;
  function bindNotes(active, notes) {
    elContent.querySelectorAll('.guts-page-btn[data-nid]').forEach(btn=>
      btn.addEventListener('click',()=>{ state.noteId=btn.dataset.nid; renderNotes(); }));
    elContent.querySelector('#note-add').addEventListener('click',async()=>{
      const n={id:'note_'+gid(),pageNum:notes.length+1,title:`Page ${notes.length+1}`,content:'',createdAt:Date.now(),updatedAt:Date.now()};
      saveNote(n); state.noteId=n.id; renderNotes();
    });
    if(!active)return;

    const rte=elContent.querySelector('#guts-rte');
    const titleEl=elContent.querySelector('#note-title');
    const status=elContent.querySelector('#note-save-status');

    const autoSave=()=>{
      active.content=rte.innerHTML;
      active.title=titleEl.value||`Page ${notes.indexOf(active)+1}`;
      active.updatedAt=Date.now();
      saveNote(active);
      if(status)status.textContent='Saved ✓';
      setTimeout(()=>{ if(status)status.textContent='Auto-saved'; },1500);
      // update knowledge base from notes
      const words=[...new Set((rte.innerText.match(/\b[a-zA-Z]{7,}\b/g)||[])
        .filter(w=>!CW.has(w.toLowerCase())).map(w=>w.toLowerCase()))];
      if(words.length>0) updateKnowledge(words, active.id);
    };

    rte.addEventListener('input',()=>{
      if(status)status.textContent='Unsaved…';
      clearTimeout(state.saveTimer);
      state.saveTimer=setTimeout(autoSave,1500);
    });
    titleEl.addEventListener('blur',autoSave);

    let _prevMode=false;
    const fsSizes=['12px','14px','18px'];
    elContent.querySelectorAll('.guts-rte-btn[data-cmd]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        rte.focus();
        const cmd=btn.dataset.cmd;
        if(cmd==='bold')      document.execCommand('bold',false,null);
        else if(cmd==='heading') document.execCommand('formatBlock',false,'h3');
        else if(cmd==='highlight') document.execCommand('hiliteColor',false,'rgba(212,255,58,0.22)');
        else if(cmd==='preview'){
          _prevMode=!_prevMode;
          rte.contentEditable=_prevMode?'false':'true';
          rte.style.background=_prevMode?'var(--surface)':'';
          btn.classList.toggle('active',_prevMode);
        }
        else if(cmd==='fontsize'){
          _noteFs=(_noteFs+1)%3;
          rte.style.fontSize=fsSizes[_noteFs];
        }
      });
    });

    elContent.querySelector('#rte-attach').addEventListener('change',e=>{
      const file=e.target.files[0]; if(!file)return;
      const r=new FileReader();
      r.onload=()=>{ rte.focus(); document.execCommand('insertHTML',false,`<img src="${r.result}" style="max-width:100%;margin:4px 0">`); };
      r.readAsDataURL(file); e.target.value='';
    });

    elContent.querySelector('#rte-del').addEventListener('click',()=>{
      if(!confirm(`Delete "${active.title}"?`))return;
      deleteNote(active.id); state.noteId=null; toast('Page deleted'); renderNotes();
    });

    elContent.querySelector('#rte-ra').addEventListener('click',()=>{
      const text=rte.innerText||'';
      if(!text.trim()){toast('Nothing to read','');return;}
      speakText(text,_rate);
    });
  }

  /* ══════════════════════════════════════════════════════
     READ ALOUD BAR binding
     ══════════════════════════════════════════════════════ */
  function bindRA(sentences, ctx) {
    const play=ctx.querySelector('#guts-ra-play');
    const pause=ctx.querySelector('#guts-ra-pause');
    const stop=ctx.querySelector('#guts-ra-stop');
    if(!play)return;
    play.addEventListener('click',()=>{
      if(_pau){_pau=false;window.speechSynthesis.resume();_updateRA();return;}
      speakText(sentences.join(' '),_rate,(idx)=>{
        ctx.querySelectorAll('.guts-chunk').forEach(c=>c.classList.remove('speaking'));
        if(idx>=0){ const c=ctx.querySelector(`#chunk-${Math.floor(idx/3)}`); if(c)c.classList.add('speaking'); }
      });
    });
    pause.addEventListener('click',()=>{
      if(_pau){_pau=false;window.speechSynthesis.resume();}
      else{_pau=true;window.speechSynthesis.pause();}
      _updateRA();
    });
    stop.addEventListener('click',()=>{
      stopSpeech();
      ctx.querySelectorAll('.guts-chunk').forEach(c=>c.classList.remove('speaking'));
    });
    ctx.querySelectorAll('.guts-ra-speed').forEach(btn=>btn.addEventListener('click',()=>{
      _rate=parseFloat(btn.dataset.rate);
      ctx.querySelectorAll('.guts-ra-speed').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      if(_spk){stopSpeech();setTimeout(()=>speakText(sentences.join(' '),_rate),100);}
    }));
    _updateRA();
  }

  /* ══════════════════════════════════════════════════════
     TRANSFER (Export / Import / Version / AI Status)
     ══════════════════════════════════════════════════════ */
  function renderTransfer() {
    const lessons=getLessons(), wb=getWordbank(), notes=getNotes(), know=getKnow();
    const aiOn=AI.hasAnyRoute();
    const providers=AI.getProviders()||{};
    const order=AI.getFallbackOrder()||[];

    elContent.innerHTML=`
<div class="guts-section">Version</div>
<div class="frame subtle" style="padding:12px 14px;margin-bottom:12px">
  <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
  <div class="guts-info-row"><span class="guts-info-row__k">MODULE</span><span class="guts-info-row__v">Get Up To Speed</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">VERSION</span><span class="guts-info-row__v">v${MODULE_VERSION}</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">MODULE NO.</span><span class="guts-info-row__v">MOD 09</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">GRAMMAR.AI</span><span class="guts-info-row__v">v1.4.4 → v1.4.5</span></div>
</div>

<div class="guts-section">AI Route Status</div>
<div class="frame subtle" style="padding:10px 14px;margin-bottom:12px">
  <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
  <div class="guts-info-row"><span class="guts-info-row__k">STATUS</span>
    <span class="${aiOn?'guts-ai-on':'guts-ai-off'}" style="font-size:12px">${aiOn?'● READY':'○ NO KEY'}</span>
  </div>
  ${order.map(id=>{const p=providers[id]||{},hasKey=!!AI.getKey(id);return `<div class="guts-info-row"><span class="guts-info-row__k">${esc(p.icon||'')}&nbsp;${esc(p.label||id)}</span><span style="font-size:11px;color:${hasKey?'var(--lime)':'var(--dim)'}">${hasKey?'✓ Key set':'— no key'}</span></div>`;}).join('')}
  <div style="margin-top:6px;font-size:9px;color:var(--dim)">Configure keys in ⚙ Settings → API Keys</div>
</div>

<div class="guts-section">Data</div>
<div class="frame subtle" style="padding:10px 14px;margin-bottom:12px">
  <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
  <div class="guts-info-row"><span class="guts-info-row__k">LESSONS</span><span class="guts-info-row__v">${lessons.length}</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">WORD BANK</span><span class="guts-info-row__v">${wb.length} words</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">NOTES</span><span class="guts-info-row__v">${notes.length} pages</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">KNOWLEDGE</span><span class="guts-info-row__v">${Object.keys(know).length} words learned</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">WORD CACHE</span><span class="guts-info-row__v">${SCOPE.keys().filter(k=>k.startsWith('wc.')).length} cached</span></div>
</div>

<div class="guts-row" style="margin-bottom:8px">
  <button class="btn btn-primary" id="guts-export">⬇ Export backup</button>
  <button class="btn" id="guts-import">⬆ Import backup</button>
</div>

<div class="guts-section" style="margin-top:16px">Security</div>
<div class="frame subtle" style="padding:10px 14px">
  <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
  <div class="guts-info-row"><span class="guts-info-row__k">LOCK</span><span class="guts-info-row__v">6-digit PIN · SHA-256</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">AUTO-LOCK</span><span class="guts-info-row__v">On module exit</span></div>
  <div style="margin-top:8px;display:flex;gap:6px">
    <button class="btn btn-ghost btn-icon" id="tf-changepin" style="font-size:10px">⚙ Change PIN</button>
    <button class="btn btn-rust btn-icon" id="tf-lock" style="font-size:10px">🔒 Lock now</button>
  </div>
</div>`;

    elContent.querySelector('#guts-export').addEventListener('click',doExport);
    elContent.querySelector('#guts-import').addEventListener('click',doImport);
    elContent.querySelector('#tf-lock').addEventListener('click',lock);
    elContent.querySelector('#tf-changepin').addEventListener('click',()=>{
      if(!confirm('Change PIN? You will be locked out and need to set a new one.'))return;
      SCOPE.remove('pinHash'); lock(); toast('PIN cleared — set a new one');
    });
  }

  function doExport() {
    if(!getLessons().length&&!getWordbank().length&&!getNotes().length){
      toast('Nothing to export yet',''); return;
    }
    const data={
      _meta:{module:'Get Up To Speed',version:MODULE_VERSION,exportedAt:new Date().toISOString()},
      lessons:getLessons(), wordbank:getWordbank(), notes:getNotes(), knowledge:getKnow()
    };
    downloadFile(`guts-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),'application/json');
    toast('✓ Export downloaded');
  }

  async function doImport() {
    const file=await pickFile('.json,application/json');
    if(!file)return;
    try {
      const raw=await file.text();
      const data=JSON.parse(raw);
      if(!data.lessons)throw new Error('Invalid GUTS backup');
      (data.lessons||[]).forEach(l=>saveLesson(l));
      (data.wordbank||[]).forEach(w=>saveWord(w));
      (data.notes||[]).forEach(n=>saveNote(n));
      if(data.knowledge) SCOPE.set('knowledge',data.knowledge);
      toast(`✓ Imported ${data.lessons.length} lessons · ${(data.wordbank||[]).length} words · ${(data.notes||[]).length} notes`);
      renderTransfer();
    } catch(e){ toast('Import failed: '+e.message,''); }
  }

  /* ── Statics ────────────────────────────────────────────────── */
  function sClass(s){return s==='done'?'s-done':s==='reading'?'s-reading':'s-unread';}
  function sLabel(s){return s==='done'?'✓ Done':s==='reading'?'▶ Reading':'○ Unread';}

  /* ═══════════════════════════════════════════════════════
     HINDI DICTIONARY  500+
     ═══════════════════════════════════════════════════════ */
  const HD={
    fluency:'प्रवाह',fluent:'धाराप्रवाह',vocabulary:'शब्द भंडार',grammar:'व्याकरण',
    pronunciation:'उच्चारण',communicate:'संवाद करना',conversation:'बातचीत',
    expression:'अभिव्यक्ति',language:'भाषा',understand:'समझना',practice:'अभ्यास',
    improve:'सुधारना',learning:'सीखना',knowledge:'ज्ञान',lesson:'पाठ',
    sentence:'वाक्य',meaning:'अर्थ',translate:'अनुवाद करना',comprehend:'समझना',
    articulate:'स्पष्ट बोलना',eloquent:'वाक्पटु',bilingual:'द्विभाषी',
    interpret:'व्याख्या करना',narrate:'वर्णन करना',describe:'वर्णन करना',
    explain:'समझाना',define:'परिभाषित करना',clarify:'स्पष्ट करना',
    emphasize:'जोर देना',summarize:'सारांश देना',elaborate:'विस्तार करना',
    illustrate:'चित्रित करना',simplify:'सरल करना',paraphrase:'दूसरे शब्दों में',
    transcript:'लिखित प्रति',
    confidence:'आत्मविश्वास',motivation:'प्रेरणा',resilience:'लचीलापन',
    perspective:'दृष्टिकोण',imagination:'कल्पना',creativity:'रचनात्मकता',
    awareness:'जागरूकता',mindset:'मानसिकता',potential:'क्षमता',discipline:'अनुशासन',
    patience:'धैर्य',commitment:'प्रतिबद्धता',consistent:'लगातार',progress:'प्रगति',
    achievement:'उपलब्धि',success:'सफलता',failure:'विफलता',challenge:'चुनौती',
    opportunity:'अवसर',experience:'अनुभव',wisdom:'बुद्धिमानी',intelligence:'बुद्धि',
    intuition:'अंतर्ज्ञान',perception:'अनुभूति',curiosity:'जिज्ञासा',
    determination:'दृढ़ संकल्प',perseverance:'दृढ़ता',ambition:'महत्वाकांक्षा',
    aspiration:'आकांक्षा',inspiration:'प्रेरणा',transformation:'परिवर्तन',
    evolution:'विकास',adaptation:'अनुकूलन',innovation:'नवाचार',
    breakthrough:'सफलता',overcome:'पार करना',accomplish:'प्राप्त करना',
    strive:'प्रयास करना',pursue:'अनुसरण करना',dedicate:'समर्पित करना',
    focus:'ध्यान केंद्रित',concentrate:'केंद्रित करना',reflect:'विचार करना',
    contemplate:'चिंतन करना',analyze:'विश्लेषण करना',evaluate:'मूल्यांकन करना',
    prioritize:'प्राथमिकता देना',organize:'व्यवस्थित करना',
    philosophy:'दर्शनशास्त्र',psychology:'मनोविज्ञान',spirituality:'आध्यात्मिकता',
    principle:'सिद्धांत',strategy:'रणनीति',process:'प्रक्रिया',effective:'प्रभावी',
    efficient:'कुशल',essential:'आवश्यक',important:'महत्वपूर्ण',valuable:'मूल्यवान',
    meaningful:'सार्थक',significant:'महत्वपूर्ण',fundamental:'मूलभूत',
    determine:'निर्धारित करना',establish:'स्थापित करना',demonstrate:'प्रदर्शित करना',
    recognize:'पहचानना',appreciate:'सराहना करना',theory:'सिद्धांत',concept:'अवधारणा',
    hypothesis:'परिकल्पना',argument:'तर्क',evidence:'प्रमाण',analysis:'विश्लेषण',
    interpretation:'व्याख्या',conclusion:'निष्कर्ष',assumption:'धारणा',
    consequence:'परिणाम',pattern:'पैटर्न',structure:'संरचना',framework:'ढांचा',
    mechanism:'तंत्र',phenomenon:'घटना',paradigm:'प्रतिमान',complexity:'जटिलता',
    diversity:'विविधता',inclusion:'समावेश',sustainability:'स्थिरता',integrity:'ईमानदारी',
    happiness:'खुशी',sadness:'दुख',excitement:'उत्साह',enthusiasm:'उत्साह',
    passion:'जुनून',compassion:'करुणा',empathy:'सहानुभूति',sympathy:'सहानुभूति',
    gratitude:'कृतज्ञता',forgiveness:'क्षमा',hope:'आशा',loneliness:'अकेलापन',
    contentment:'संतोष',frustration:'निराशा',disappointment:'निराशा',
    satisfaction:'संतुष्टि',pride:'गर्व',shame:'शर्म',guilt:'दोष',jealousy:'ईर्ष्या',
    admiration:'प्रशंसा',respect:'सम्मान',trust:'विश्वास',doubt:'संदेह',
    confusion:'भ्रम',surprise:'आश्चर्य',wonder:'आश्चर्य',nostalgia:'पुरानी यादें',
    melancholy:'उदासी',serenity:'शांति',tranquility:'शांति',overwhelmed:'अभिभूत',
    motivated:'प्रेरित',curious:'जिज्ञासु',nervous:'घबराया',grateful:'कृतज्ञ',
    anxious:'चिंतित',joyful:'आनंदित',peaceful:'शांतिपूर्ण',restless:'बेचैन',
    achieve:'प्राप्त करना',believe:'विश्वास करना',consider:'विचार करना',
    develop:'विकसित करना',encourage:'प्रोत्साहित करना',facilitate:'सुगम करना',
    generate:'उत्पन्न करना',implement:'लागू करना',investigate:'जांच करना',
    justify:'उचित ठहराना',maintain:'बनाए रखना',negotiate:'बातचीत करना',
    observe:'देखना',participate:'भाग लेना',respond:'जवाब देना',support:'समर्थन करना',
    utilize:'उपयोग करना',validate:'मान्य करना',acquire:'प्राप्त करना',
    collaborate:'सहयोग करना',contribute:'योगदान देना',coordinate:'समन्वय करना',
    create:'बनाना',debate:'बहस करना',examine:'जांच करना',explore:'खोज करना',
    identify:'पहचानना',integrate:'एकीकृत करना',manage:'प्रबंधन करना',
    monitor:'निगरानी करना',motivate:'प्रेरित करना',perform:'प्रदर्शन करना',
    promote:'बढ़ावा देना',publish:'प्रकाशित करना',suggest:'सुझाना',
    teach:'सिखाना',transform:'बदलना',verify:'सत्यापित करना',
    accurate:'सटीक',authentic:'प्रामाणिक',brilliant:'शानदार',capable:'सक्षम',
    decisive:'निर्णायक',dedicated:'समर्पित',flexible:'लचीला',focused:'केंद्रित',
    generous:'उदार',genuine:'वास्तविक',graceful:'कृपाशील',humble:'विनम्र',
    innovative:'अभिनव',insightful:'अंतर्दृष्टिपूर्ण',intentional:'जानबूझकर',
    logical:'तार्किक',methodical:'व्यवस्थित',objective:'वस्तुनिष्ठ',
    optimistic:'आशावादी',organized:'व्यवस्थित',persistent:'दृढ़',
    practical:'व्यावहारिक',proactive:'सक्रिय',productive:'उत्पादक',
    professional:'पेशेवर',reliable:'विश्वसनीय',resourceful:'साधन-संपन्न',
    responsible:'जिम्मेदार',sensitive:'संवेदनशील',sincere:'ईमानदार',skilled:'कुशल',
    strategic:'रणनीतिक',structured:'संरचित',systematic:'व्यवस्थित',
    thoughtful:'विचारशील',thorough:'संपूर्ण',versatile:'बहुमुखी',vibrant:'जीवंत',
    visionary:'दूरदर्शी',adaptive:'अनुकूलनीय',analytical:'विश्लेषणात्मक',
    collaborative:'सहयोगी',comprehensive:'व्यापक',constructive:'रचनात्मक',
    dynamic:'गतिशील',ethical:'नैतिक',
    moment:'पल',duration:'अवधि',century:'सदी',sequence:'क्रम',
    frequency:'आवृत्ति',interval:'अंतराल',distance:'दूरी',location:'स्थान',
    position:'स्थिति',direction:'दिशा',boundary:'सीमा',horizon:'क्षितिज',
    landscape:'परिदृश्य',territory:'क्षेत्र',surrounding:'आसपास',
    atmosphere:'वातावरण',circumstance:'परिस्थिति',situation:'स्थिति',
    background:'पृष्ठभूमि',foundation:'नींव',origin:'उत्पत्ति',destination:'मंजिल',
    transition:'परिवर्तन',momentum:'गति',trajectory:'प्रक्षेपवक्र',
    ecosystem:'पारिस्थितिकी',biodiversity:'जैव विविधता',conservation:'संरक्षण',
    climate:'जलवायु',geography:'भूगोल',wilderness:'जंगल',vegetation:'वनस्पति',
    mountain:'पर्वत',river:'नदी',ocean:'महासागर',forest:'वन',season:'मौसम',
    rainfall:'वर्षा',temperature:'तापमान',organic:'जैविक',renewable:'नवीकरणीय',
    profession:'पेशा',career:'करियर',industry:'उद्योग',organization:'संगठन',
    management:'प्रबंधन',leadership:'नेतृत्व',productivity:'उत्पादकता',
    efficiency:'दक्षता',revenue:'राजस्व',investment:'निवेश',
    entrepreneurship:'उद्यमिता',infrastructure:'बुनियादी ढांचा',
    technology:'प्रौद्योगिकी',marketing:'विपणन',partnership:'साझेदारी',
    stakeholder:'हितधारक',deadline:'समय सीमा',milestone:'मील का पत्थर',
    feedback:'प्रतिक्रिया',performance:'प्रदर्शन',accountability:'जवाबदेही',
    transparency:'पारदर्शिता',governance:'शासन',compliance:'अनुपालन',
    implementation:'कार्यान्वयन',recommendation:'सिफारिश',
    wellness:'स्वास्थ्य',nutrition:'पोषण',meditation:'ध्यान',mindfulness:'सजगता',
    therapy:'चिकित्सा',diagnosis:'निदान',treatment:'उपचार',prevention:'रोकथाम',
    recovery:'स्वास्थ्य लाभ',immunity:'प्रतिरक्षा',metabolism:'चयापचय',
    consciousness:'चेतना',relaxation:'विश्राम',vitality:'जीवन शक्ति',
    stamina:'सहनशक्ति',endurance:'धीरज',strength:'शक्ति',balance:'संतुलन',
    coordination:'समन्वय',breathing:'श्वास',rehabilitation:'पुनर्वास',
    healing:'उपचार',longevity:'दीर्घायु',lifestyle:'जीवन शैली',
    relationship:'संबंध',friendship:'मित्रता',community:'समुदाय',
    society:'समाज',culture:'संस्कृति',tradition:'परंपरा',heritage:'विरासत',
    equality:'समानता',justice:'न्याय',democracy:'लोकतंत्र',freedom:'स्वतंत्रता',
    responsibility:'जिम्मेदारी',mentorship:'मार्गदर्शन',cooperation:'सहयोग',
    tolerance:'सहिष्णुता',celebration:'उत्सव',recognition:'पहचान',
    encouragement:'प्रोत्साहन',guidance:'मार्गदर्शन',empowering:'सशक्त बनाना',
  };

  /* ── Common words (excluded from vocab) ─────────────────────── */
  const CW=new Set(['the','be','to','of','and','a','in','that','have','it','for','not','on','with','he','as','you','do','at','this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there','their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no','just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then','now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first','well','way','even','new','want','because','any','these','give','day','most','need','large','often','hand','high','place','hold','turn','help','start','never','next','hard','open','seem','always','both','show','feel','long','those','old','face','tell','keep','every','find','much','still','though','should','where','does','around','three','small','set','put','end','another','right','big','too','many','before','must','through','under','little','being','while','become','already','against','without','same','different','however','between','might','going','great','here','were','been','used','said','each','more','very','made','such','once','away','down']);

  /* ── Common phrases ──────────────────────────────────────────── */
  const CP=['get up to speed','bear in mind','keep in mind','on the other hand','in other words','as a result','for example','for instance','in addition','at the same time','in fact','as well as','more than ever','look forward to','take for granted','point of view','make a difference','come up with','put up with','at least','in order to','as long as','even though','in spite of','due to','according to','in terms of','take part in','make sure','find out','figure out','right away','after all','all of a sudden','once in a while','sooner or later','on the whole','as far as','in general','at first','to begin with','on top of that','as a matter of fact','in the long run','at the end of the day','when it comes to','in my opinion','based on','in contrast','get rid of','keep in touch','run out of','look up to','carry on','catch up','give up','move on','stand out','work out'];

  /* ── Lifecycle ──────────────────────────────────────────────── */
  return {
    onShow() { if (state.unlocked) refreshAiDot(); },
    cleanup() { stopSpeech(); lock(); clearTimeout(state.saveTimer); }
  };
}

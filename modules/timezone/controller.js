/* ────────────────────────────────────────────────────────────────
   TIMEZONE MODULE · v1.2.1
   Sub-tabs: CONVERT | WORLD ↔ IST | WORLD CLOCK
   Uses sv-SE locale trick for reliable offset calculation
   across all browsers and server environments.
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';

const SCOPE = Storage.scope('timezone');

/* ─── Reliable UTC offset in minutes for any zone at a given Date
   sv-SE formats "YYYY-MM-DD HH:MM:SS" — no ambiguity, no locale quirks.
   offset > 0 means zone is ahead of UTC (e.g. IST = +330).
   ─────────────────────────────────────────────────────────────── */
function getOffsetMin(date, zone) {
  const sv = d => d.toLocaleString('sv-SE', { timeZone: zone });
  const toMs = s => new Date(s.replace(' ', 'T') + 'Z').getTime();
  return Math.round((toMs(sv(date)) - toMs(date.toLocaleString('sv-SE', { timeZone: 'UTC' }))) / 60000);
}

/* ─── Timezone abbreviation + offset string ─── */
function getTzMeta(date, zone) {
  const abbr = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, timeZoneName: 'short'
  }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value || zone;

  const long = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, timeZoneName: 'long'
  }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value || '';

  const offMin = getOffsetMin(date, zone);
  const sign   = offMin >= 0 ? '+' : '-';
  const ah     = Math.floor(Math.abs(offMin) / 60);
  const am     = Math.abs(offMin) % 60;
  const offStr = `UTC${sign}${ah}:${String(am).padStart(2, '0')}`;

  return { abbr, long, offStr, offMin };
}

/* ─── Convert local input (dateStr, timeStr) in zone → UTC Date ───
   Step 1: Treat input as UTC to get approximate epoch.
   Step 2: Get zone offset at that approximate UTC.
   Step 3: Real UTC = approxUTC − offset.
   One iteration is enough for all practical zones (offset rarely
   changes between approxUTC and realUTC for a 30‑60 min window).
   ─────────────────────────────────────────────────────────────── */
function localToUtc(dateStr, timeStr, zone) {
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const [hr, mi]     = timeStr.split(':').map(Number);
  const approxUtc = new Date(Date.UTC(yr, mo - 1, dy, hr, mi));
  const offMin    = getOffsetMin(approxUtc, zone);
  return new Date(Date.UTC(yr, mo - 1, dy, hr, mi) - offMin * 60000);
}

/* ─── Format helpers ─── */
const T_OPTS = { hour: '2-digit', minute: '2-digit', hour12: true };
const D_OPTS = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
const fmtTime = (d, z) => new Intl.DateTimeFormat('en-IN', { ...T_OPTS, timeZone: z }).format(d);
const fmtDate = (d, z) => new Intl.DateTimeFormat('en-IN', { ...D_OPTS, timeZone: z }).format(d);

/* ─── Build full result object from a UTC Date ─── */
function buildResult(utcDate, fromZone, toZone, direction) {
  const fm = getTzMeta(utcDate, fromZone);
  const tm = getTzMeta(utcDate, toZone);
  return {
    fromTime:    fmtTime(utcDate, fromZone),
    fromDate:    fmtDate(utcDate, fromZone),
    fromLabel:   `${fm.abbr} (${fm.offStr})`,
    toTime:      fmtTime(utcDate, toZone),
    toDate:      fmtDate(utcDate, toZone),
    toLabel:     `${tm.abbr} (${tm.offStr})`,
    tzNote:      `${fm.abbr} · ${fm.long} · ${fm.offStr}`,
    fromHeading: direction === 'world2ist' ? 'FROM — WORLD' : 'FROM — INDIA (IST)',
    toHeading:   direction === 'world2ist'
      ? 'TO — INDIA (IST · UTC+5:30)'
      : `TO — ${tm.abbr} (${tm.offStr})`
  };
}

/* ══════════════════════════════════════════════════════════════ */

export default async function init({ root, module }) {

  let manifest = { options: {} };
  try { manifest = await fetch('modules/timezone/manifest.json').then(r => r.json()); } catch {}
  const opts = manifest.options || {};

  const state = {
    tab:   SCOPE.get('tab',   'convert'),
    from:  SCOPE.get('from',  'Asia/Kolkata'),
    to:    SCOPE.get('to',    'UTC'),
    wDir:  SCOPE.get('wDir',  'world2ist'),
    wMode: SCOPE.get('wMode', 'select'),
    wCity: SCOPE.get('wCity', 'America/Chicago')
  };

  const elModNum   = root.querySelector('[data-bind="moduleNum"]');
  const elLocalNow = $('#tz-localnow', root);
  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  let liveIv = null;
  let clockIv = null;

  /* ─── Sub-tab switching ─── */
  function paintTabs() {
    $$('.chip[data-tztab]', root).forEach(b =>
      b.classList.toggle('on', b.dataset.tztab === state.tab));
    $$('.tz-sub', root).forEach(s =>
      s.classList.toggle('hide', s.dataset.tzsub !== state.tab));
    if (state.tab !== 'world') stopLive();
    else if (state.wMode === 'live') startLive();
  }
  $$('.chip[data-tztab]', root).forEach(b => {
    b.addEventListener('click', () => {
      state.tab = b.dataset.tztab;
      SCOPE.set('tab', state.tab);
      paintTabs();
    });
  });
  paintTabs();

  /* ════════════════════════════════════════════════════════════
     SUB 1 — CONVERT (general any→any)
     ════════════════════════════════════════════════════════════ */
  const elFrom      = $('#tz-from', root);
  const elTo        = $('#tz-to', root);
  const elDt        = $('#tz-datetime', root);
  const elSwap      = $('#tz-swap', root);
  const elNow       = $('#tz-now', root);
  const elFromTime  = $('#tz-from-time', root);
  const elFromDate  = $('#tz-from-date', root);
  const elFromLabel = $('#tz-from-label', root);
  const elToTime    = $('#tz-to-time', root);
  const elToDate    = $('#tz-to-date', root);
  const elToLabel   = $('#tz-to-label', root);

  const zoneOpts = (opts.zones || []).map(z =>
    `<option value="${esc(z.value)}">${esc(z.label)}</option>`).join('');
  elFrom.innerHTML = zoneOpts;
  elTo.innerHTML   = zoneOpts;
  elFrom.value = state.from;
  elTo.value   = state.to;
  setNow();

  elFrom.addEventListener('change', () => { state.from = elFrom.value; SCOPE.set('from', state.from); doConvert(); });
  elTo.addEventListener('change',   () => { state.to   = elTo.value;   SCOPE.set('to',   state.to);   doConvert(); });
  elDt.addEventListener('change', doConvert);
  elSwap.addEventListener('click', () => {
    [state.from, state.to] = [state.to, state.from];
    elFrom.value = state.from; elTo.value = state.to;
    SCOPE.set('from', state.from); SCOPE.set('to', state.to);
    doConvert();
  });
  elNow.addEventListener('click', setNow);

  function setNow() {
    const n = new Date();
    elDt.value = new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    doConvert();
  }
  function doConvert() {
    if (!elDt.value) return;
    try {
      const dt = new Date(elDt.value);
      elFromLabel.textContent = elFrom.options[elFrom.selectedIndex]?.text || elFrom.value;
      elToLabel.textContent   = elTo.options[elTo.selectedIndex]?.text     || elTo.value;
      elFromTime.textContent  = fmtTime(dt, elFrom.value);
      elFromDate.textContent  = fmtDate(dt, elFrom.value);
      elToTime.textContent    = fmtTime(dt, elTo.value);
      elToDate.textContent    = fmtDate(dt, elTo.value);
    } catch { elFromTime.textContent = 'ERR'; elToTime.textContent = 'ERR'; }
  }

  /* ════════════════════════════════════════════════════════════
     SUB 2 — WORLD ↔ IST
     ════════════════════════════════════════════════════════════ */
  const elWDir       = $$('[data-wdir]', root);
  const elWMode      = $$('[data-wmode]', root);
  const elWCity      = $('#w-city', root);
  const elWCityNote  = $('#w-city-note', root);
  const elWCdtCards  = $('#w-cdt-cards', root);
  const elWLiveInd   = $('#w-live-indicator', root);
  const elWSelInputs = $('#w-select-inputs', root);
  const elWDate      = $('#w-date', root);
  const elWTime      = $('#w-time', root);
  const elWNow       = $('#w-now', root);
  const elDirHint    = $('#w-dir-hint', root);
  const elWFromTime  = $('#w-from-time', root);
  const elWFromLabel = $('#w-from-label', root);
  const elWFromDate  = $('#w-from-date', root);
  const elWFromHd    = $('#w-from-heading', root);
  const elWTzNote    = $('#w-tz-note', root);
  const elWToTime    = $('#w-to-time', root);
  const elWToLabel   = $('#w-to-label', root);
  const elWToDate    = $('#w-to-date', root);
  const elWToHd      = $('#w-to-heading', root);

  const IST = 'Asia/Kolkata';

  /* Build grouped city dropdown */
  elWCity.innerHTML = (opts.worldCities || []).map(grp => `
    <optgroup label="${esc(grp.group)}">
      ${grp.cities.map(c =>
        `<option value="${esc(c.zone)}"
          data-note="${esc(c.note || '')}"
          data-central="${c.zone === 'America/Chicago' || c.zone === 'America/Winnipeg' ? '1' : ''}">
          ${esc(c.name)} · ${esc(c.country)}
        </option>`
      ).join('')}
    </optgroup>`
  ).join('');
  elWCity.value = state.wCity;
  updateCityInfo();

  /* Direction */
  function paintDir() {
    elWDir.forEach(b => b.classList.toggle('on', b.dataset.wdir === state.wDir));
    if (elDirHint) elDirHint.textContent = state.wDir === 'world2ist'
      ? "Enter the time in the other city's timezone — result shows India (IST) time."
      : "Enter India (IST) time — result shows the selected city's local time.";
  }
  elWDir.forEach(b => b.addEventListener('click', () => {
    state.wDir = b.dataset.wdir;
    SCOPE.set('wDir', state.wDir);
    paintDir();
    doWorldConvert();
  }));
  paintDir();

  /* Mode */
  function paintMode() {
    elWMode.forEach(b => b.classList.toggle('on', b.dataset.wmode === state.wMode));
    const live = state.wMode === 'live';
    elWLiveInd?.classList.toggle('hide', !live);
    elWSelInputs?.classList.toggle('hide', live);
    if (live) startLive(); else stopLive();
  }
  elWMode.forEach(b => b.addEventListener('click', () => {
    state.wMode = b.dataset.wmode;
    SCOPE.set('wMode', state.wMode);
    paintMode();
    if (state.wMode === 'select') doWorldConvert();
  }));
  paintMode();

  /* City */
  elWCity.addEventListener('change', () => {
    state.wCity = elWCity.value;
    SCOPE.set('wCity', state.wCity);
    updateCityInfo();
    doWorldConvert();
  });
  function updateCityInfo() {
    const sel = elWCity.options[elWCity.selectedIndex];
    const note     = sel?.dataset.note     || '';
    const isCentral= sel?.dataset.central  === '1';
    if (elWCityNote) elWCityNote.textContent = note ? '⚠ ' + note : '';
    if (elWCdtCards) elWCdtCards.classList.toggle('hide', !isCentral);
  }

  /* Date/time defaults */
  const nd = new Date();
  elWDate.value = nd.toISOString().slice(0, 10);
  elWTime.value = nd.toTimeString().slice(0, 5);
  elWDate.addEventListener('change', doWorldConvert);
  elWTime.addEventListener('change', doWorldConvert);
  elWNow?.addEventListener('click', () => {
    const n = new Date();
    elWDate.value = n.toISOString().slice(0, 10);
    elWTime.value = n.toTimeString().slice(0, 5);
    doWorldConvert();
  });

  /* Conversion */
  function doWorldConvert(utcOverride) {
    const zone = elWCity.value;
    if (!zone) return;
    let utcDate;
    if (utcOverride) {
      utcDate = utcOverride;
    } else {
      const ds = elWDate.value, ts = elWTime.value;
      if (!ds || !ts) return;
      const inputZone = state.wDir === 'world2ist' ? zone : IST;
      utcDate = localToUtc(ds, ts, inputZone);
    }
    if (!utcDate || isNaN(utcDate)) return;

    const fromZone = state.wDir === 'world2ist' ? zone : IST;
    const toZone   = state.wDir === 'world2ist' ? IST  : zone;
    const r = buildResult(utcDate, fromZone, toZone, state.wDir);

    if (elWFromTime)  elWFromTime.textContent  = r.fromTime;
    if (elWFromLabel) elWFromLabel.textContent = r.fromLabel;
    if (elWFromDate)  elWFromDate.textContent  = r.fromDate;
    if (elWFromHd)    elWFromHd.textContent    = r.fromHeading;
    if (elWTzNote)    elWTzNote.textContent    = r.tzNote;
    if (elWToTime)    elWToTime.textContent    = r.toTime;
    if (elWToLabel)   elWToLabel.textContent   = r.toLabel;
    if (elWToDate)    elWToDate.textContent    = r.toDate;
    if (elWToHd)      elWToHd.textContent      = r.toHeading;
  }

  function startLive() {
    stopLive();
    doWorldConvert(new Date());
    liveIv = setInterval(() => doWorldConvert(new Date()), 1000);
  }
  function stopLive() {
    if (liveIv) { clearInterval(liveIv); liveIv = null; }
  }

  doWorldConvert();

  /* ════════════════════════════════════════════════════════════
     SUB 3 — WORLD CLOCK (live tick)
     ════════════════════════════════════════════════════════════ */
  const elClock = $('#world-clock', root);
  function paintClock() {
    const now = new Date();
    if (elClock) {
      elClock.innerHTML = (opts.worldClock || []).map(z => {
        const time = fmtTime(now, z.zone);
        const date = new Intl.DateTimeFormat('en-IN', {
          weekday:'short', day:'numeric', month:'short', timeZone: z.zone
        }).format(now);
        return `
          <div class="frame subtle world-cell">
            <span class="c tl"></span><span class="c tr"></span>
            <span class="c bl"></span><span class="c br"></span>
            <div class="world-flag">${esc(z.flag)}</div>
            <div class="world-name">${esc(z.name)}</div>
            <div class="serif world-time">${esc(time)}</div>
            <div class="mono world-date">${esc(date)}</div>
          </div>`;
      }).join('');
    }
    if (elLocalNow) {
      elLocalNow.textContent = 'LOCAL · ' + new Intl.DateTimeFormat('en-IN', {
        hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false
      }).format(now);
    }
  }
  paintClock();
  clockIv = setInterval(paintClock, 1000);

  return {
    onShow()  { doConvert(); doWorldConvert(); paintClock(); },
    onHide()  { stopLive(); },
    destroy() { stopLive(); if (clockIv) clearInterval(clockIv); }
  };
}

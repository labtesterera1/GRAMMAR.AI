/* ────────────────────────────────────────────────────────────────
   TIMEZONE MODULE · controller · v1.1.0
   Sub-tabs: CONVERT | CDT/CST ↔ IST | WORLD CLOCK
   ──────────────────────────────────────────────────────────────── */

import { $, $$, esc, toast } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';

const SCOPE = Storage.scope('timezone');

/* ─── CDT/CST offset detection ─────────────────────────────────
   Given a date string + IANA zone, returns the UTC offset in hours
   and whether DST is active (CDT) or not (CST).
   ─────────────────────────────────────────────────────────────── */
function detectCdtCst(dateStr, timeStr, zone) {
  const dt = new Date(`${dateStr}T${timeStr || '12:00'}:00`);
  if (isNaN(dt)) return null;

  // Get UTC offset for this zone on this date
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'short'
  });
  const parts = fmt.formatToParts(dt);
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';

  // Detect CDT vs CST from the abbreviated name
  const isCDT = tzName === 'CDT';
  const isCST = tzName === 'CST';

  // Get the numeric offset using another trick
  const utcStr = dt.toLocaleString('en-US', { timeZone: 'UTC', hour12: false, hour:'2-digit', minute:'2-digit' });
  const locStr = dt.toLocaleString('en-US', { timeZone: zone, hour12: false, hour:'2-digit', minute:'2-digit' });

  return { isCDT, isCST, tzName, offset: isCDT ? -5 : isCST ? -6 : null };
}

/* ─── Convert CDT/CST → IST or IST → CDT/CST ─── */
function convertCdtIst(dateStr, timeStr, zone, direction) {
  if (!dateStr || !timeStr) return null;

  const timeOptsFull = { hour: '2-digit', minute: '2-digit', hour12: true };
  const dateOptsFull = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };

  // Detect CDT/CST abbreviation for the given date
  const refDt = new Date(`${dateStr}T${timeStr}:00Z`); // treat as UTC for detection
  const info = detectCdtCst(dateStr, timeStr, zone);
  const tzAbbr  = info?.tzName || 'CT';
  const isDST   = info?.isCDT;
  const isYearRoundCST = !info?.isCDT && !info?.isCST;
  const cdtOffset = isDST ? -5 : -6; // hours from UTC

  let fromTime, fromDate, fromLabel, toTime, toDate, toLabel, toHeading;

  if (direction === 'cdt2ist') {
    // User enters time in CDT/CST zone → find IST equivalent
    // Step 1: interpret input as CDT/CST time → get UTC
    const [h, m] = timeStr.split(':').map(Number);
    const [yr, mo, dy] = dateStr.split('-').map(Number);
    // UTC = local_time - zone_offset
    const utcMs = Date.UTC(yr, mo-1, dy, h - cdtOffset, m);
    const fromDt = new Date(utcMs + cdtOffset * 3600000); // CDT/CST local
    const toDt   = new Date(utcMs + 5.5 * 3600000);       // IST = UTC+5:30

    fromTime  = new Intl.DateTimeFormat('en-IN', { ...timeOptsFull }).format(fromDt);
    fromDate  = new Intl.DateTimeFormat('en-IN', { ...dateOptsFull }).format(fromDt);
    fromLabel = `${tzAbbr} (UTC${cdtOffset}:00)`;
    toTime    = new Intl.DateTimeFormat('en-IN', { ...timeOptsFull }).format(toDt);
    toDate    = new Intl.DateTimeFormat('en-IN', { ...dateOptsFull }).format(toDt);
    toLabel   = 'India Standard Time (UTC+5:30)';
    toHeading = 'TO — INDIA (IST · UTC+5:30)';
  } else {
    // User enters IST time → find CDT/CST equivalent
    const [h, m] = timeStr.split(':').map(Number);
    const [yr, mo, dy] = dateStr.split('-').map(Number);
    // UTC = IST - 5:30
    const utcMs = Date.UTC(yr, mo-1, dy, h - 5, m - 30);
    const fromDt = new Date(utcMs + 5.5 * 3600000);        // IST local
    const toDt   = new Date(utcMs + cdtOffset * 3600000);   // CDT/CST local

    fromTime  = new Intl.DateTimeFormat('en-IN', { ...timeOptsFull }).format(fromDt);
    fromDate  = new Intl.DateTimeFormat('en-IN', { ...dateOptsFull }).format(fromDt);
    fromLabel = 'India Standard Time (UTC+5:30)';
    toTime    = new Intl.DateTimeFormat('en-IN', { ...timeOptsFull }).format(toDt);
    toDate    = new Intl.DateTimeFormat('en-IN', { ...dateOptsFull }).format(toDt);
    toLabel   = `${tzAbbr} (UTC${cdtOffset}:00)`;
    toHeading = `TO — CENTRAL TIME (${tzAbbr})`;
  }

  // Active note
  let activeNote;
  if (isYearRoundCST) {
    activeNote = '● CST year-round — no daylight saving in this country';
  } else if (isDST) {
    activeNote = '● CDT active on this date — US Summer (clocks forward)';
  } else {
    activeNote = '● CST active on this date — US Winter (clocks back)';
  }

  return { fromTime, fromDate, fromLabel, toTime, toDate, toLabel, toHeading, activeNote, tzAbbr };
}

export default async function init({ root, module }) {

  let manifest = { options: {} };
  try { manifest = await fetch('modules/timezone/manifest.json').then(r => r.json()); } catch {}
  const opts = manifest.options || {};

  const state = {
    tab:      SCOPE.get('tab', 'convert'),
    from:     SCOPE.get('from', 'Asia/Kolkata'),
    to:       SCOPE.get('to', 'UTC'),
    cdtDir:   SCOPE.get('cdtDir', 'cdt2ist'),
    cdtCity:  SCOPE.get('cdtCity', 'America/Chicago')
  };

  const elModNum   = root.querySelector('[data-bind="moduleNum"]');
  const elLocalNow = $('#tz-localnow', root);

  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  /* ─── Sub-tab switching ─── */
  function paintTabs() {
    $$('.chip[data-tztab]', root).forEach(b =>
      b.classList.toggle('on', b.dataset.tztab === state.tab));
    $$('.tz-sub', root).forEach(s =>
      s.classList.toggle('hide', s.dataset.tzsub !== state.tab));
  }
  $$('.chip[data-tztab]', root).forEach(b => {
    b.addEventListener('click', () => {
      state.tab = b.dataset.tztab;
      SCOPE.set('tab', state.tab);
      paintTabs();
    });
  });
  paintTabs();

  /* ────────────────────────────────────────────────────────────
     SUB 1: CONVERT
     ──────────────────────────────────────────────────────────── */
  const elFrom = $('#tz-from', root);
  const elTo   = $('#tz-to', root);
  const elDt   = $('#tz-datetime', root);
  const elSwap = $('#tz-swap', root);
  const elNow  = $('#tz-now', root);
  const elFromTime  = $('#tz-from-time', root);
  const elFromDate  = $('#tz-from-date', root);
  const elFromLabel = $('#tz-from-label', root);
  const elToTime    = $('#tz-to-time', root);
  const elToDate    = $('#tz-to-date', root);
  const elToLabel   = $('#tz-to-label', root);

  const optsHtml = (opts.zones || []).map(z =>
    `<option value="${esc(z.value)}">${esc(z.label)}</option>`
  ).join('');
  elFrom.innerHTML = optsHtml;
  elTo.innerHTML   = optsHtml;
  elFrom.value = state.from;
  elTo.value   = state.to;
  setNow();

  elFrom.addEventListener('change', () => { state.from = elFrom.value; SCOPE.set('from', state.from); convert(); });
  elTo.addEventListener('change',   () => { state.to   = elTo.value;   SCOPE.set('to',   state.to);   convert(); });
  elDt.addEventListener('change', convert);
  elSwap.addEventListener('click', () => {
    [state.from, state.to] = [state.to, state.from];
    elFrom.value = state.from; elTo.value = state.to;
    SCOPE.set('from', state.from); SCOPE.set('to', state.to);
    convert();
  });
  elNow.addEventListener('click', setNow);

  function setNow() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    elDt.value = local;
    convert();
  }

  function convert() {
    const dtVal = elDt.value;
    const fromZone = elFrom.value;
    const toZone   = elTo.value;
    elFromLabel.textContent = elFrom.options[elFrom.selectedIndex]?.text || fromZone;
    elToLabel.textContent   = elTo.options[elTo.selectedIndex]?.text || toZone;
    if (!dtVal) { elFromTime.textContent = '—:—'; elToTime.textContent = '—:—'; return; }
    try {
      const dt = new Date(dtVal);
      const tOpts = { hour:'2-digit', minute:'2-digit', hour12:true };
      const dOpts = { weekday:'short', day:'numeric', month:'short', year:'numeric' };
      elFromTime.textContent = new Intl.DateTimeFormat('en-IN', { ...tOpts, timeZone: fromZone }).format(dt);
      elFromDate.textContent = new Intl.DateTimeFormat('en-IN', { ...dOpts, timeZone: fromZone }).format(dt);
      elToTime.textContent   = new Intl.DateTimeFormat('en-IN', { ...tOpts, timeZone: toZone }).format(dt);
      elToDate.textContent   = new Intl.DateTimeFormat('en-IN', { ...dOpts, timeZone: toZone }).format(dt);
    } catch { elFromTime.textContent = 'ERR'; elToTime.textContent = 'ERR'; }
  }

  /* ────────────────────────────────────────────────────────────
     SUB 2: CDT/CST ↔ IST
     ──────────────────────────────────────────────────────────── */
  const elCdtCity      = $('#cdt-city', root);
  const elCdtCityNote  = $('#cdt-city-note', root);
  const elCdtDate      = $('#cdt-date', root);
  const elCdtTime      = $('#cdt-time', root);
  const elCdtNow       = $('#cdt-now', root);
  const elCdtFromTime  = $('#cdt-from-time', root);
  const elCdtFromLabel = $('#cdt-from-label', root);
  const elCdtFromDate  = $('#cdt-from-date', root);
  const elCdtActiveNote= $('#cdt-active-note', root);
  const elCdtToTime    = $('#cdt-to-time', root);
  const elCdtToLabel   = $('#cdt-to-label', root);
  const elCdtToDate    = $('#cdt-to-date', root);
  const elCdtToHeading = $('#cdt-to-heading', root);

  /* Build grouped city dropdown */
  const cities = opts.cdtCstCities || [];
  elCdtCity.innerHTML = cities.map(grp => `
    <optgroup label="${esc(grp.group)}">
      ${grp.cities.map(c =>
        `<option value="${esc(c.zone)}" data-note="${esc(c.note || '')}" data-city="${esc(c.name)}">
          ${esc(c.name)} · ${esc(c.country)}
        </option>`
      ).join('')}
    </optgroup>
  `).join('');
  elCdtCity.value = state.cdtCity;

  /* Direction buttons */
  $$('[data-cdtdir]', root).forEach(b => {
    b.classList.toggle('on', b.dataset.cdtdir === state.cdtDir);
    b.addEventListener('click', () => {
      state.cdtDir = b.dataset.cdtdir;
      SCOPE.set('cdtDir', state.cdtDir);
      $$('[data-cdtdir]', root).forEach(x => x.classList.toggle('on', x.dataset.cdtdir === state.cdtDir));
      updateCdtFromTo();
      convertCdt();
    });
  });

  /* Update FROM/TO headings when direction changes */
  function updateCdtFromTo() {
    if (state.cdtDir === 'cdt2ist') {
      if (elCdtToHeading) elCdtToHeading.textContent = 'TO — INDIA (IST · UTC+5:30)';
    } else {
      const tzAbbr = detectCdtCst(
        elCdtDate.value || new Date().toISOString().slice(0,10),
        elCdtTime.value || '12:00',
        elCdtCity.value
      )?.tzName || 'CT';
      if (elCdtToHeading) elCdtToHeading.textContent = `TO — CENTRAL TIME (${tzAbbr})`;
    }
  }

  elCdtCity.addEventListener('change', () => {
    state.cdtCity = elCdtCity.value;
    SCOPE.set('cdtCity', state.cdtCity);
    // Show note for year-round CST cities
    const sel = elCdtCity.options[elCdtCity.selectedIndex];
    const note = sel?.dataset.note || '';
    if (elCdtCityNote) elCdtCityNote.textContent = note ? '⚠ ' + note : '';
    convertCdt();
  });

  elCdtDate.addEventListener('change', convertCdt);
  elCdtTime.addEventListener('change', convertCdt);

  elCdtNow.addEventListener('click', () => {
    const now = new Date();
    elCdtDate.value = now.toISOString().slice(0, 10);
    elCdtTime.value = now.toTimeString().slice(0, 5);
    convertCdt();
  });

  /* Set now as default */
  const nowD = new Date();
  elCdtDate.value = nowD.toISOString().slice(0, 10);
  elCdtTime.value = nowD.toTimeString().slice(0, 5);

  function convertCdt() {
    const dateStr = elCdtDate.value;
    const timeStr = elCdtTime.value;
    const zone    = elCdtCity.value;
    if (!dateStr || !timeStr || !zone) return;

    const res = convertCdtIst(dateStr, timeStr, zone, state.cdtDir);
    if (!res) { toast('Invalid date or time', 'error'); return; }

    if (elCdtFromTime)   elCdtFromTime.textContent   = res.fromTime;
    if (elCdtFromLabel)  elCdtFromLabel.textContent   = res.fromLabel;
    if (elCdtFromDate)   elCdtFromDate.textContent    = res.fromDate;
    if (elCdtActiveNote) {
      elCdtActiveNote.textContent = res.activeNote;
      elCdtActiveNote.style.color = res.activeNote.includes('CDT') ? 'var(--lime)' : 'var(--muted)';
    }
    if (elCdtToTime)    elCdtToTime.textContent    = res.toTime;
    if (elCdtToLabel)   elCdtToLabel.textContent   = res.toLabel;
    if (elCdtToDate)    elCdtToDate.textContent    = res.toDate;
    if (elCdtToHeading) elCdtToHeading.textContent = res.toHeading;
  }

  convertCdt(); // initial conversion

  /* ────────────────────────────────────────────────────────────
     SUB 3: WORLD CLOCK
     ──────────────────────────────────────────────────────────── */
  const elClock = $('#world-clock', root);

  function paintClock() {
    const now = new Date();
    if (elClock) {
      elClock.innerHTML = (opts.worldClock || []).map(z => {
        const time = new Intl.DateTimeFormat('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true, timeZone: z.zone }).format(now);
        const date = new Intl.DateTimeFormat('en-IN', { weekday:'short', day:'numeric', month:'short', timeZone: z.zone }).format(now);
        return `
          <div class="frame subtle world-cell">
            <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
            <div class="world-flag">${esc(z.flag)}</div>
            <div class="world-name">${esc(z.name)}</div>
            <div class="serif world-time">${esc(time)}</div>
            <div class="mono world-date">${esc(date)}</div>
          </div>
        `;
      }).join('');
    }
    if (elLocalNow) {
      const t = new Intl.DateTimeFormat('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(now);
      elLocalNow.textContent = 'LOCAL · ' + t;
    }
  }
  paintClock();
  const tick = setInterval(paintClock, 1000);

  return {
    onShow() { convert(); convertCdt(); paintClock(); },
    onHide() {},
    destroy() { clearInterval(tick); }
  };
}

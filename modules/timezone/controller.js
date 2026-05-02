/* ────────────────────────────────────────────────────────────────
   TIMEZONE MODULE · controller
   ──────────────────────────────────────────────────────────────── */

import { $, esc } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';

const SCOPE = Storage.scope('timezone');

export default async function init({ root, module }) {

  let manifest = { options: {} };
  try { manifest = await fetch('modules/timezone/manifest.json').then(r => r.json()); } catch {}
  const opts = manifest.options || {};

  const state = {
    from: SCOPE.get('from', 'Asia/Kolkata'),
    to:   SCOPE.get('to',   'UTC')
  };

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
  const elClock     = $('#world-clock', root);
  const elLocalNow  = $('#tz-localnow', root);
  const elModNum    = root.querySelector('[data-bind="moduleNum"]');

  if (elModNum) elModNum.textContent = `MOD ${module.num} / ${module.name.toUpperCase()}`;

  // Populate selects
  const optsHtml = (opts.zones || []).map(z =>
    `<option value="${esc(z.value)}">${esc(z.label)}</option>`
  ).join('');
  elFrom.innerHTML = optsHtml;
  elTo.innerHTML   = optsHtml;
  elFrom.value = state.from;
  elTo.value   = state.to;

  // Default to "now" on first open
  setNow();

  elFrom.addEventListener('change', () => { state.from = elFrom.value; SCOPE.set('from', state.from); convert(); });
  elTo.addEventListener('change',   () => { state.to   = elTo.value;   SCOPE.set('to',   state.to);   convert(); });
  elDt.addEventListener('change', convert);
  elSwap.addEventListener('click', () => {
    const tmp = state.from; state.from = state.to; state.to = tmp;
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
    const fromLbl = elFrom.options[elFrom.selectedIndex]?.text || fromZone;
    const toLbl   = elTo.options[elTo.selectedIndex]?.text || toZone;

    elFromLabel.textContent = fromLbl;
    elToLabel.textContent   = toLbl;

    if (!dtVal) { elFromTime.textContent = '—:—'; elToTime.textContent = '—:—'; return; }

    try {
      const dt = new Date(dtVal);
      const timeOpts = { hour:'2-digit', minute:'2-digit', hour12:true };
      const dateOpts = { weekday:'short', day:'numeric', month:'short', year:'numeric' };

      elFromTime.textContent = new Intl.DateTimeFormat('en-IN', { ...timeOpts, timeZone: fromZone }).format(dt);
      elFromDate.textContent = new Intl.DateTimeFormat('en-IN', { ...dateOpts, timeZone: fromZone }).format(dt);
      elToTime.textContent   = new Intl.DateTimeFormat('en-IN', { ...timeOpts, timeZone: toZone }).format(dt);
      elToDate.textContent   = new Intl.DateTimeFormat('en-IN', { ...dateOpts, timeZone: toZone }).format(dt);
    } catch (e) {
      elFromTime.textContent = 'ERR';
      elToTime.textContent = 'ERR';
    }
  }

  function paintClock() {
    const now = new Date();
    elClock.innerHTML = (opts.worldClock || []).map(z => {
      const time = new Intl.DateTimeFormat('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true, timeZone: z.zone }).format(now);
      const date = new Intl.DateTimeFormat('en-IN', { weekday:'short', day:'numeric', month:'short', timeZone: z.zone }).format(now);
      return `
        <div class="frame subtle world-cell">
          <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
          <div class="world-flag">${esc(z.flag)}</div>
          <div class="mono world-name">${esc(z.name)}</div>
          <div class="serif world-time">${esc(time)}</div>
          <div class="mono world-date">${esc(date)}</div>
        </div>
      `;
    }).join('');
    if (elLocalNow) {
      const t = new Intl.DateTimeFormat('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(now);
      elLocalNow.textContent = 'LOCAL · ' + t;
    }
  }
  paintClock();
  const tick = setInterval(paintClock, 1000);

  return {
    onShow() { paintClock(); convert(); },
    onHide() {},
    destroy() { clearInterval(tick); }
  };
}

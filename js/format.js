/* Közös (főfolyamat + felület) formázók: idő, dátum, állapot, értékek. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NB1Format = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TZ = 'Europe/Budapest';

  const fTime = new Intl.DateTimeFormat('hu-HU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const fParts = new Intl.DateTimeFormat('hu-HU', { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const fShort = new Intl.DateTimeFormat('hu-HU', { timeZone: TZ, month: 'short', day: 'numeric' });

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const d = (ts) => new Date(ts * 1000);

  function hhmm(ts) { return fTime.format(d(ts)); }
  function dayKey(ts) { return fDay.format(d(ts)); } // 2026-10-10
  function parts(ts) {
    const o = {};
    fParts.formatToParts(d(ts)).forEach((p) => { o[p.type] = p.value; });
    return o;
  }
  // "Szombat, október 10."
  function dayHead(ts) {
    const p = parts(ts);
    return cap(p.weekday) + ', ' + p.month + ' ' + p.day + '.';
  }
  // "2026. október 10., szombat"
  function dateLong(ts) {
    const p = parts(ts);
    return p.year + '. ' + p.month + ' ' + p.day + '., ' + p.weekday;
  }
  // "okt. 10."
  function dateShort(ts) { return fShort.format(d(ts)).replace(/\s+/g, ' '); }

  const DESC = {
    '1st half': '1. félidő', '2nd half': '2. félidő', Halftime: 'Félidő', Ended: 'Vége',
    'Extra time': 'Hosszabbítás', Penalties: 'Tizenegyesek', AET: 'Hosszabbítás után', AP: 'Tizenegyesekkel',
    Postponed: 'Elhalasztva', Canceled: 'Törölve', Interrupted: 'Megszakítva', Suspended: 'Felfüggesztve',
    Delayed: 'Késik', Abandoned: 'Félbeszakadt', 'Not started': '',
  };

  function liveMinute(ev, nowSec) {
    const t = ev.time || {};
    if (!t.cps) return null;
    const el = Math.floor((nowSec - t.cps) / 60) + Math.floor((t.initial || 0) / 60) + 1;
    return el > 0 && el < 140 ? el : null;
  }

  // {kind, label}: kind = scheduled | live | finished | postponed | canceled | other
  function statusInfo(ev, nowSec) {
    nowSec = nowSec || Math.floor(Date.now() / 1000);
    switch (ev.status) {
      case 'notstarted': return { kind: 'scheduled', label: '' };
      case 'finished': return { kind: 'finished', label: 'Vége' };
      case 'inprogress': {
        const m = liveMinute(ev, nowSec);
        const desc = DESC[ev.desc];
        if (ev.desc === 'Halftime') return { kind: 'live', label: 'Félidő' };
        return { kind: 'live', label: m ? m + '’' : (desc || 'Élő') };
      }
      case 'postponed': return { kind: 'postponed', label: 'Elhalasztva' };
      case 'canceled': return { kind: 'canceled', label: 'Törölve' };
      default: return { kind: 'other', label: DESC[ev.desc] || ev.desc || '' };
    }
  }

  // tizedespont -> tizedesvessző
  const hu = (s) => String(s == null ? '' : s).replace(/(\d)\.(\d)/g, '$1,$2');

  // Sofascore megjelenített érték: "54%", "88/146 (60%)", "100.1 km", "1.21", "9"
  function parseDisplay(s) {
    s = String(s == null ? '' : s).trim();
    let m = s.match(/^(\d+)\/(\d+)\s*\((\d+)%\)$/);
    if (m) return { main: m[1] + '/' + m[2], sub: m[3] + '%', pct: +m[3] };
    m = s.match(/^(-?[\d.,]+)\s*%$/);
    if (m) return { main: hu(m[1]) + '%', sub: '', pct: parseFloat(m[1].replace(',', '.')) };
    return { main: hu(s), sub: '', pct: null };
  }

  // A két oldal aránya (0..1 a hazai oldalra) a sávhoz.
  function ratio(h, a, hv, av) {
    let x; let y;
    if (h.pct != null && a.pct != null) { x = h.pct; y = a.pct; } else { x = Number(hv); y = Number(av); }
    if (!isFinite(x) || !isFinite(y) || x + y <= 0) return 0.5;
    return x / (x + y);
  }

  function ascii(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  return { TZ, hhmm, dayKey, dayHead, dateLong, dateShort, statusInfo, hu, parseDisplay, ratio, ascii, liveMinute };
});

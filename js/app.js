/* NB1 Kártya – mobil webapp ("A · Klasszikus lista" kinézet).
 * Fülek: Meccsek (forduló-lista + meccs adatlap), Kártya (előnézet, adatválasztó, mentés), Beállítások.
 * Gesztusok: a listát oldalra húzva fordulót váltasz; az adatlapon a bal szélről jobbra húzva visszalépsz.
 * Az adatok a data.js-ben vannak (window.NB1_DATA), a kártyát a card.js rajzolja. Hálózatot nem használ.
 */
(function () {
  'use strict';
  const F = window.NB1Format;
  const CAT = window.NB1Catalog;
  const COL = window.NB1Colors;
  const CARD = window.NB1Card;
  let D = window.NB1_DATA;   // a beépített adatok; egy betöltött adatcsomag felülírja (lásd lent)
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- böngészőtár (ha nem elérhető, a program akkor is működik) ----------
  const mem = {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] == null ? null : mem[k]; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } },
  };

  // ---------- adatcsomag (titkosított, tömörített .nb1 fájl; a tools/adatcsomag.rb készíti) ----------
  // Szerkezet: "NB1ADAT1" | 16 bájt IV | AES-256-CBC titkosított gzip-JSON | 32 bájt HMAC-SHA256.
  // A kulcsok az adatcsomag-készítő scriptben is szerepelnek: csak együtt cserélhetők.
  const PKG_KEY = '4/YRV2gLeuTRtx0KPjlF9SUF4AnFBy4KA5legs0tNbY=';
  const PKG_MAC = 'GnengwWDfRKulQ2MXu2eAht0WQTJsi+NfpEOsfIej38=';
  const PKG_MAGIC = 'NB1ADAT1';
  const PKG_STORE = 'nb1.pkg';
  function storedPackage() {
    try {
      const j = JSON.parse(store.get(PKG_STORE) || 'null');
      if (j && j.data && Array.isArray(j.data.matches) && j.data.teams && j.data.stats) return j;
    } catch (e) { /* sérült tár: beépített adatok */ }
    return null;
  }
  const PKG = storedPackage();
  if (PKG) D = PKG.data;

  // ---------- adatok ----------
  const TEAMS = {};
  Object.keys(D.teams).forEach((id) => { TEAMS[id] = Object.assign({ id: Number(id) }, D.teams[id]); });
  const MATCHES = D.matches.map((m) => Object.assign({}, m, { h: TEAMS[m.home], a: TEAMS[m.away] }));
  const ROUNDS = [...new Set(MATCHES.map((m) => m.round))].sort((a, b) => a - b);
  const nowSec = () => Math.floor(Date.now() / 1000);
  const LEAGUE = 'NB1';          // a liga neve mindenhol (jogi okokból nem a szponzori név)
  const APP_VERSION = '0.8beta';

  function currentRound() {
    const now = nowSec();
    const up = MATCHES.filter((m) => m.status !== 'postponed' && m.status !== 'canceled' && m.status !== 'finished' && m.ts >= now - 4 * 3600).sort((a, b) => a.ts - b.ts)[0];
    if (up) return up.round;
    const played = MATCHES.filter((m) => m.status === 'finished').sort((a, b) => b.ts - a.ts)[0];
    return played ? played.round : ROUNDS[ROUNDS.length - 1];
  }

  // ---------- állapot ----------
  let tab = 'matches';
  let view = currentRound();
  let current = null;     // az adatlapon nyitott meccs
  let cardMatch = null;   // a Kártya fül meccse
  let seg = 'sum';
  let order = CAT.defaultOrder();
  let sel = new Set(CAT.DEFAULT_SELECTED);

  const SEL_KEY = 'nb1.selection.v1';
  (function loadSel() {
    try {
      const j = JSON.parse(store.get(SEL_KEY) || 'null');
      if (j && Array.isArray(j.order)) {
        const known = j.order.filter((k) => CAT.byKey[k]);
        order = known.concat(CAT.ITEMS.map((i) => i.key).filter((k) => known.indexOf(k) < 0));
        sel = new Set((j.sel || []).filter((k) => CAT.byKey[k]));
      }
    } catch (e) { /* alapértelmezés marad */ }
  })();
  const saveSel = () => store.set(SEL_KEY, JSON.stringify({ order, sel: [...sel] }));

  // ---------- címerek ----------
  const crestImgs = new Map();
  const domCache = new Map();
  const crestKey = (id) => 'nb1.crest.' + id;
  function loadCrests() {
    return Promise.all(Object.keys(TEAMS).map((id) => new Promise((res) => {
      const u = store.get(crestKey(id));
      if (!u) return res();
      const i = new Image();
      i.onload = () => { crestImgs.set(Number(id), i); res(); };
      i.onerror = () => res();
      i.src = u;
    })));
  }

  // ---------- színek ----------
  function pickTeamColor(t) {
    const cands = [t.color, t.color2].filter(Boolean);
    for (const c of cands) {
      const h = COL.hexToHsl(c);
      if (h && h[1] >= 0.25 && h[2] > 0.12 && h[2] < 0.9) return c;
    }
    return cands[0] || null;
  }
  function dominant(team) {
    const img = crestImgs.get(team.id);
    if (!img) return null;
    if (!domCache.has(team.id)) domCache.set(team.id, COL.dominantFromImage(img));
    return domCache.get(team.id);
  }
  const teamTone = (t) => COL.tone(dominant(t) || pickTeamColor(t) || '#4a5568') || '#4a5568';
  function colorsFor(m) {
    const fx = COL.fixPair(teamTone(m.h), teamTone(m.a), m.a.color2 || m.a.color);
    return { l: fx[0], r: fx[1] };
  }
  function badge(team, cls, color) {
    const img = crestImgs.get(team.id);
    if (img) return '<span class="badge has-img ' + (cls || '') + '"><img src="' + esc(img.src) + '" alt=""></span>';
    return '<span class="badge ' + (cls || '') + '" style="background:' + esc(color || teamTone(team)) + '">' + esc(team.code) + '</span>';
  }

  // ---------- téma, áttetszőség ----------
  const root = document.documentElement;
  const themePref = () => store.get('nb1.theme') || 'system';
  function applyTheme() {
    const p = themePref();
    if (p === 'system') delete root.dataset.theme; else root.dataset.theme = p;
    document.querySelectorAll('#themeSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themePick === p)));
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg));
  }
  function setTheme(p) { if (p === 'system') store.del('nb1.theme'); else store.set('nb1.theme', p); applyTheme(); }

  // ---------- fülek ----------
  const TABS = ['matches', 'card', 'settings'];
  function setTab(t) {
    tab = t;
    TABS.forEach((name) => { $('#tab-' + name).hidden = name !== t; });
    document.querySelectorAll('.tabbar button').forEach((b) => {
      if (b.dataset.go === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('#lens').style.transform = 'translateX(' + (TABS.indexOf(t) * 100) + '%)';
    if (t === 'card') renderCardTab();
    if (t === 'settings') renderSettings();
  }

  // ---------- forduló-lista ----------
  const matchesOf = (r) => MATCHES.filter((m) => m.round === r).sort((a, b) => (a.ts - b.ts) || a.h.name.localeCompare(b.h.name, 'hu'));

  function timeCell(m) {
    const st = F.statusInfo(m);
    if (st.kind === 'postponed' || st.kind === 'canceled') return '<span class="warn">' + esc(st.label) + '</span>';
    if (st.kind === 'finished') return '<span>' + esc(F.hhmm(m.ts)) + '</span><b>Vége</b>';
    return '<b>' + esc(F.hhmm(m.ts)) + '</b>';
  }
  function rowHTML(m) {
    const st = F.statusInfo(m);
    const done = st.kind === 'finished' && m.hs != null;
    const hc = done ? (m.hs > m.as ? 'win' : m.hs < m.as ? 'lose' : '') : '';
    const ac = done ? (m.as > m.hs ? 'win' : m.as < m.hs ? 'lose' : '') : '';
    const label = m.h.name + ' – ' + m.a.name + (done ? ', ' + m.hs + '–' + m.as : ', ' + F.hhmm(m.ts));
    return '<button class="match" type="button" data-id="' + m.id + '" aria-label="' + esc(label) + '">' +
      '<span class="m-time">' + timeCell(m) + '</span><span class="m-sep"></span>' +
      '<span class="m-teams">' +
        '<span class="m-team ' + hc + '">' + badge(m.h) + '<span>' + esc(m.h.name) + '</span></span>' +
        '<span class="m-team ' + ac + '">' + badge(m.a) + '<span>' + esc(m.a.name) + '</span></span>' +
      '</span>' +
      '<span class="m-scores">' + (done ? '<span class="' + hc + '">' + m.hs + '</span><span class="' + ac + '">' + m.as + '</span>' : '') + '</span>' +
    '</button>';
  }
  function renderList() {
    const ms = matchesOf(view);
    let html = ''; let cur = null; let open = false;
    ms.forEach((m) => {
      const k = F.dayKey(m.ts);
      if (k !== cur) {
        if (open) html += '</div>';
        cur = k;
        html += '<div class="day-title">' + esc(F.dayHead(m.ts)) + '</div><div class="group">';
        open = true;
      }
      html += rowHTML(m);
    });
    if (open) html += '</div>';
    if (!ms.length) html = '<p class="empty-msg">Ehhez a fordulóhoz nincs meccs a menetrendben.</p>';
    $('#days').innerHTML = html;
    $('#roundNum').textContent = view + '.';
    $('#rangeLine').textContent = ms.length ? (F.dayKey(ms[0].ts) === F.dayKey(ms[ms.length - 1].ts) ? F.dateShort(ms[0].ts) : F.dateShort(ms[0].ts) + ' – ' + F.dateShort(ms[ms.length - 1].ts)) : '';
    $('#prev').disabled = view <= ROUNDS[0];
    $('#next').disabled = view >= ROUNDS[ROUNDS.length - 1];
    $('#btnNow').hidden = view === currentRound();
  }

  let slideTimer = null;
  function goto(n, animate) {
    n = Math.max(ROUNDS[0], Math.min(ROUNDS[ROUNDS.length - 1], n));
    const inner = $('#listInner');
    if (n === view) { inner.style.transition = 'transform 0.38s var(--ease)'; inner.style.transform = ''; return; }
    const dir = n > view ? 1 : -1;
    view = n;
    renderList();
    $('#listScroll').scrollTop = 0;
    if (animate === false) { inner.style.transition = 'none'; inner.style.transform = ''; return; }
    inner.style.transition = 'none';
    inner.style.transform = 'translateX(' + (dir * 100) + '%)';
    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => {
      inner.style.transition = 'transform 0.38s var(--ease)';
      inner.style.transform = '';
    }, 20);
  }

  function openPop() {
    const now = currentRound();
    $('#pgrid').innerHTML = ROUNDS.map((n) => '<button type="button" data-round="' + n + '" class="' + (n === view ? 'on ' : '') + (n === now ? 'cur' : '') + '">' + n + '</button>').join('');
    $('#popover').hidden = false; $('#scrim').hidden = false;
  }
  function closePop() { $('#popover').hidden = true; $('#scrim').hidden = true; }

  // ---------- meccs adatlap ----------
  function statRows(m) {
    const st = D.stats[m.id];
    if (!st) return [];
    return CAT.ITEMS.filter((i) => !i.special && st[i.key]).map((i) => {
      const s = st[i.key];
      const hd = F.parseDisplay(s[0]); const ad = F.parseDisplay(s[1]);
      let r = F.ratio(hd, ad, s[2], s[3]);
      if (Number(s[2]) === 0 && Number(s[3]) === 0 && hd.pct == null) r = 0.5;
      return { label: i.label, h: hd.main, a: ad.main, r };
    });
  }

  function renderDetail() {
    const m = current;
    if (!m) return;
    const st = F.statusInfo(m);
    const c = colorsFor(m);
    const done = st.kind === 'finished' && m.hs != null;
    $('#detailTitle').textContent = m.h.code + ' – ' + m.a.code;
    $('#hBadge').outerHTML = badge(m.h, 'big', c.l).replace('class="badge', 'id="hBadge" class="badge');
    $('#aBadge').outerHTML = badge(m.a, 'big', c.r).replace('class="badge', 'id="aBadge" class="badge');
    $('#hName').textContent = m.h.name;
    $('#aName').textContent = m.a.name;
    const big = $('#mBig');
    big.classList.toggle('time', !done);
    if (done) { big.textContent = m.hs + ' – ' + m.as; $('#mSmall').textContent = 'Vége'; }
    else if (st.kind === 'postponed' || st.kind === 'canceled') { big.textContent = '–'; $('#mSmall').textContent = st.label; }
    else { big.textContent = F.hhmm(m.ts); $('#mSmall').textContent = F.dayHead(m.ts); }
    const venue = [m.h.venue, m.h.city].filter(Boolean).join(', ');
    $('#meta').textContent = LEAGUE + ' · ' + m.round + '. forduló · ' + F.dateLong(m.ts) + (venue ? ' · ' + venue : '');

    // összegzés: gólok + kártya gomb
    const goals = D.goals[m.id];
    let sum = '';
    if (!done) {
      sum = '<div class="panel"><p class="empty-msg">' + (st.kind === 'postponed' ? 'A meccset elhalasztották, ezért nincs adat.' : m.ts > nowSec() ? 'A meccs még nem kezdődött el. Az adatok a lefújás után kerülnek a csomagba.' : 'Ennek a meccsnek még nincs eredménye a beépített adatcsomagban.') + '</p></div>';
    } else {
      sum += '<div class="panel"><div class="panel-label">Gólok</div>';
      if (goals && goals.length) {
        sum += goals.map((g) => {
          const tag = g[3] === 'penalty' ? ' <small>(11-es)</small>' : g[3] === 'own' ? ' <small>(öngól)</small>' : '';
          return '<div class="goal"><span class="h">' + (g[0] === 'home' ? esc(g[1]) + tag : '') + '</span><span class="min">' + esc(g[2]) + '</span><span>' + (g[0] === 'away' ? esc(g[1]) + tag : '') + '</span></div>';
        }).join('');
      } else sum += '<p class="empty-msg">' + (goals ? 'Gól nélküli döntetlen.' : 'Gól-adat nincs a csomagban.') + '</p>';
      sum += '<div style="height:8px"></div></div>';
      if (D.stats[m.id]) sum += '<div class="panel" style="padding-top:12px"><button class="btn-primary" type="button" id="btnMakeCard"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 15h7M8.5 18h4M9 9.5l2 2 4-4"/></svg>Kártya készítése</button></div>';
    }
    $('#segSum').innerHTML = sum;

    // statisztika
    const rows = statRows(m);
    $('#segStat').innerHTML = rows.length ? '<div class="panel stats">' + rows.map((r) => {
      const hl = r.r > 0.5; const al = r.r < 0.5;
      return '<div class="stat"><div class="stat-top">' +
        '<span class="pill' + (hl ? ' lead' : '') + '" style="' + (hl ? 'background:' + c.l : '') + '">' + esc(r.h) + '</span>' +
        '<span class="lbl">' + esc(r.label) + '</span>' +
        '<span class="pill' + (al ? ' lead' : '') + '" style="' + (al ? 'background:' + c.r : '') + '">' + esc(r.a) + '</span></div>' +
        '<div class="bars"><span><i style="width:' + Math.round(r.r * 100) + '%;' + (hl ? 'background:' + c.l : '') + '"></i></span>' +
        '<span><i style="width:' + Math.round((1 - r.r) * 100) + '%;' + (al ? 'background:' + c.r : '') + '"></i></span></div></div>';
    }).join('') + '</div>' : '<div class="panel"><p class="empty-msg">Ehhez a meccshez nincs statisztika a beépített adatcsomagban.</p></div>';
    setSeg(seg);
  }

  function setSeg(s) {
    seg = s;
    $('#seg').classList.toggle('right', s === 'stat');
    document.querySelectorAll('#seg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.seg === s)));
    $('#segSum').hidden = s !== 'sum';
    $('#segStat').hidden = s !== 'stat';
  }

  function openMatch(id) {
    const m = MATCHES.find((x) => x.id === id);
    if (!m) return;
    current = m;
    if (D.stats[m.id]) cardMatch = m;
    seg = 'sum';
    renderDetail();
    $('#detailScroll').scrollTop = 0;
    setDetailOpen(true);
    try { history.pushState({ detail: id }, ''); } catch (e) { /* nem baj */ }
  }
  function setDetailOpen(open) {
    const det = $('#detail'); const list = $('#listScreen'); const dim = $('#listDim');
    det.style.transition = ''; det.style.transform = '';
    list.style.transition = ''; dim.style.transition = '';
    det.classList.toggle('open', open);
    det.setAttribute('aria-hidden', String(!open));
    list.style.transform = open ? 'translateX(-30%)' : '';
    dim.style.opacity = open ? '1' : '0';
  }
  function closeDetail() {
    if (history.state && history.state.detail) { history.back(); return; }
    setDetailOpen(false);
  }
  window.addEventListener('popstate', () => { if ($('#detail').classList.contains('open')) setDetailOpen(false); });

  // ---------- kártya ----------
  function availableFor(m, k) {
    if (!m || !D.stats[m.id]) return true;
    if (k === 'scorers') return !!D.goals[m.id];
    return !!D.stats[m.id][k];
  }
  function buildPayload(m) {
    const st = D.stats[m.id] || {};
    const gl = D.goals[m.id];
    const rows = []; const missing = [];
    let scorers = null;
    order.filter((k) => sel.has(k)).forEach((k) => {
      const it = CAT.byKey[k];
      if (!it) return;
      if (it.special === 'scorers') {
        if (gl && gl.length) scorers = gl.map((g) => ({ side: g[0], name: g[1], minute: g[2], kind: g[3] }));
        else if (!gl) missing.push(it.label);
        return;
      }
      const s = st[k];
      if (s) rows.push({ key: k, label: it.label, home: s[0], away: s[1], homeValue: s[2], awayValue: s[3] });
      else missing.push(it.label);
    });
    return {
      missing,
      payload: {
        title: LEAGUE + ' · ' + m.round + '. forduló',
        dateText: F.dateLong(m.ts) + ' · ' + F.hhmm(m.ts),
        venue: [m.h.venue, m.h.city].filter(Boolean).join(', '),
        home: { name: m.h.name, code: m.h.code, img: crestImgs.get(m.h.id) || null },
        away: { name: m.a.name, code: m.a.code, img: crestImgs.get(m.a.id) || null },
        score: { h: m.hs, a: m.as, label: 'Végeredmény' },
        colors: colorsFor(m),
        scorers,
        rows,
        note: rows.some((r) => r.key === 'expectedGoals') ? 'xG = várható gól: a kialakított helyzetek minősége alapján azt mutatja, mennyi gólt „érdemelt” a csapat.' : '',
      },
    };
  }
  const fileName = (m) => 'NB1_' + F.ascii(m.h.name) + '-' + F.ascii(m.a.name) + '_' + m.round + '-ford_' + F.dayKey(m.ts).replace(/-/g, '') + '.jpg';

  let lastBlob = null; let seq = 0; let pvTimer = null;
  function showPv(msg) { $('#pvMsg').textContent = msg; $('#pvMsg').hidden = false; $('#preview').hidden = true; }
  function schedulePreview() { clearTimeout(pvTimer); pvTimer = setTimeout(renderPreview, 80); }
  async function renderPreview() {
    const my = ++seq;
    const m = cardMatch;
    lastBlob = null;
    $('#btnSave').disabled = true;
    $('#missing').textContent = '';
    if (!m) return;
    if (!sel.size) { showPv('Jelölj ki legalább egy adatot lent.'); return; }
    const b = buildPayload(m);
    if (!b.payload.rows.length && !b.payload.scorers) { showPv('Egyik kiválasztott adat sem érhető el ehhez a meccshez.'); return; }
    try {
      const off = document.createElement('canvas');
      await CARD.render(off, b.payload);
      if (my !== seq) return;
      const pv = $('#preview');
      pv.width = off.width; pv.height = off.height;
      pv.getContext('2d').drawImage(off, 0, 0);
      pv.hidden = false; $('#pvMsg').hidden = true;
      $('#missing').textContent = b.missing.length ? 'Ennél a meccsnél nem érhető el: ' + b.missing.join(', ') + '.' : '';
      off.toBlob((blob) => {
        if (my !== seq || !blob) return;
        lastBlob = blob;
        $('#btnSave').disabled = false;
      }, 'image/jpeg', 0.95);
    } catch (e) {
      showPv('Nem sikerült megrajzolni a kártyát: ' + (e && e.message || e));
    }
  }
  async function saveCard() {
    if (!lastBlob || !cardMatch) return;
    const name = fileName(cardMatch);
    const file = new File([lastBlob], name, { type: 'image/jpeg' });
    const label = $('#saveLabel');
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        label.textContent = 'Kész';
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(lastBlob);
        a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        label.textContent = 'Letöltve';
      }
    } catch (e) {
      label.textContent = e && e.name === 'AbortError' ? 'Mentés megszakítva' : 'A mentés nem sikerült';
    }
    setTimeout(() => { label.textContent = 'Mentés a Fotókba'; }, 1800);
  }

  const GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg>';
  function renderStatPick() {
    let n = 0;
    $('#statList').innerHTML = order.map((k) => {
      const it = CAT.byKey[k];
      const on = sel.has(k);
      if (on) n += 1;
      const na = !availableFor(cardMatch, k);
      return '<li data-k="' + k + '" class="' + (on ? 'sel' : '') + (na ? ' na' : '') + '" role="checkbox" aria-checked="' + on + '" tabindex="0">' +
        '<span class="chk">' + (on ? n : '') + '</span><span class="lbl">' + esc(it.label) + '</span>' +
        '<span class="grp">' + esc(CAT.GROUPS[it.group] || '') + '</span>' +
        '<span class="grip">' + GRIP + '</span></li>';
    }).join('');
    $('#cSel').textContent = String(sel.size);
  }
  function selChanged() { saveSel(); renderStatPick(); schedulePreview(); }

  function renderCardTab() {
    const m = cardMatch;
    $('#cardEmpty').hidden = !!m;
    $('#cardWork').hidden = !m;
    if (!m) { $('#cardSub').textContent = 'Nincs kiválasztott meccs.'; return; }
    $('#cardSub').textContent = m.h.name + ' – ' + m.a.name + ' · ' + m.round + '. forduló';
    renderStatPick();
    schedulePreview();
  }

  // ---------- beállítások ----------
  function renderSettings() {
    applyTheme();
    renderPkg();
    $('#crestList').innerHTML = Object.values(TEAMS).sort((a, b) => a.name.localeCompare(b.name, 'hu')).map((t) =>
      '<li>' + badge(t) + '<span class="name">' + esc(t.name) + '</span><span class="acts">' +
      (crestImgs.has(t.id) ? '<button class="btn-small" type="button" data-crest-del="' + t.id + '">Törlés</button>' : '') +
      '<button class="btn-small" type="button" data-crest="' + t.id + '">' + (crestImgs.has(t.id) ? 'Csere' : 'Kép') + '</button></span></li>').join('');
    const at = Math.floor(new Date(D.updated).getTime() / 1000);
    $('#dataInfo').textContent = (PKG ? 'Használt adatok: ' : 'Beépített adatok: ') + LEAGUE + ' 20' + D.season + ', ' + MATCHES.length + ' meccs menetrendje és ' + Object.keys(D.stats).length + ' lejátszott meccs statisztikája. Állapot: ' + F.dateLong(at) + '.';
    $('#appVersion').textContent = 'Verzió: ' + APP_VERSION;
    if (!$('#diag').hidden) $('#diag').textContent = diagText();
  }
  let crestTarget = null;
  // ---------- kijelző-adatok (hibakereséshez: a verzióra koppintva jelenik meg) ----------
  function diagText() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px) 0';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const top = Math.round(parseFloat(cs.paddingTop)); const bottom = Math.round(parseFloat(cs.paddingBottom));
    probe.remove();
    const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    const app = $('.app').getBoundingClientRect();
    const screenH = Math.max(screen.width, screen.height);
    const ok = Math.round(app.bottom) >= screenH - 1;
    return 'Mód: ' + (standalone ? 'kezdőképernyős webapp' : 'böngésző') +
      '\nKépernyő: ' + Math.min(screen.width, screen.height) + ' × ' + screenH + ' pont' +
      '\nAblak (innerHeight): ' + window.innerHeight + ' · oldal: ' + document.documentElement.getBoundingClientRect().height +
      '\nApp alja: ' + Math.round(app.bottom) + (standalone ? (ok ? ' (a kijelző aljáig ér)' : ' (RÖVIDEBB a kijelzőnél)') : '') +
      '\nBiztonsági sáv fent / lent: ' + top + ' / ' + bottom +
      '\n' + navigator.userAgent.replace(/^.*?\((.*?)\).*$/, '$1');
  }
  $('#appVersion').onclick = () => {
    const d = $('#diag');
    d.hidden = !d.hidden;
    if (!d.hidden) d.textContent = diagText();
  };

  // ---------- adatcsomag betöltése ----------
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const stamp = (iso) => { const t = Math.floor(new Date(iso).getTime() / 1000); return isFinite(t) ? F.dateLong(t) + ', ' + F.hhmm(t) : '–'; };
  async function openPackage(buf) {
    const u8 = new Uint8Array(buf);
    if (u8.length < 8 + 16 + 16 + 32 || String.fromCharCode(...u8.slice(0, 8)) !== PKG_MAGIC) throw new Error('Ez a fájl nem NB1 adatcsomag.');
    if (!window.crypto || !crypto.subtle || typeof DecompressionStream === 'undefined') throw new Error('Ez a böngésző nem tudja megnyitni az adatcsomagot. Frissítsd az iOS-t.');
    const body = u8.slice(0, u8.length - 32); const mac = u8.slice(u8.length - 32);
    const mk = await crypto.subtle.importKey('raw', b64(PKG_MAC), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify('HMAC', mk, mac, body))) throw new Error('A fájl sérült, vagy nem ehhez az apphoz készült.');
    const ek = await crypto.subtle.importKey('raw', b64(PKG_KEY), { name: 'AES-CBC' }, false, ['decrypt']);
    const gz = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: body.slice(8, 24) }, ek, body.slice(24));
    const text = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const j = JSON.parse(text);
    const d = j && j.data;
    if (!j || j.format !== 'nb1-adatcsomag' || !d || !Array.isArray(d.matches) || !d.matches.length || !d.teams || !d.stats || !d.goals || !d.updated) throw new Error('Az adatcsomag tartalma hiányos.');
    return j;
  }
  function renderPkg() {
    const st = $('#pkgStatus');
    st.classList.toggle('ok', !!PKG);
    st.textContent = PKG
      ? PKG.name + ' betöltve: ' + stamp(PKG.loaded) + '\nAdatok állapota: ' + stamp(PKG.data.updated)
      : 'Nincs betöltött adatcsomag, a beépített adatokat használja az app.';
    $('#btnPkgReset').hidden = !PKG;
  }
  $('#btnPkg').onclick = () => { const f = $('#pkgFile'); f.value = ''; f.click(); };
  $('#pkgFile').addEventListener('change', async () => {
    const file = $('#pkgFile').files[0];
    if (!file) return;
    const st = $('#pkgStatus');
    st.classList.remove('ok', 'err');
    st.textContent = 'Betöltés…';
    try {
      const j = await openPackage(await file.arrayBuffer());
      const rec = { name: j.name || file.name.replace(/\.[^.]+$/, ''), created: j.created, loaded: new Date().toISOString(), data: j.data };
      try { localStorage.setItem(PKG_STORE, JSON.stringify(rec)); } catch (e) { throw new Error('Nincs elég hely a telefon tárhelyén az adatok mentéséhez.'); }
      store.set('nb1.pkgJustLoaded', '1');
      location.reload();
    } catch (e) {
      st.classList.add('err');
      st.textContent = (e && e.message) || 'Az adatcsomag betöltése nem sikerült.';
    }
  });
  $('#btnPkgReset').onclick = () => { store.del(PKG_STORE); store.set('nb1.pkgJustLoaded', '1'); location.reload(); };

  $('#crestFile').addEventListener('change', () => {
    const file = $('#crestFile').files[0];
    if (!file || !crestTarget) return;
    const team = crestTarget;
    const rd = new FileReader();
    rd.onload = () => {
      const src = new Image();
      src.onload = () => {
        const S = 256;
        const c = document.createElement('canvas'); c.width = c.height = S;
        const k = Math.min(S / src.width, S / src.height);
        c.getContext('2d').drawImage(src, (S - src.width * k) / 2, (S - src.height * k) / 2, src.width * k, src.height * k);
        const url = c.toDataURL('image/png');
        store.set(crestKey(team.id), url);
        const i = new Image();
        i.onload = () => { crestImgs.set(team.id, i); domCache.delete(team.id); afterCrestChange(); };
        i.src = url;
      };
      src.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
  function afterCrestChange() { renderSettings(); renderList(); if (current) renderDetail(); if (tab === 'card') renderCardTab(); }

  // ---------- gesztusok ----------
  // forduló-váltás: a lista az ujjat követi
  (function roundSwipe() {
    const el = $('#listScroll'); const inner = $('#listInner');
    let d = null;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; d = { x: e.clientX, y: e.clientY, mode: null, w: el.clientWidth }; });
    el.addEventListener('pointermove', (e) => {
      if (!d) return;
      const dx = e.clientX - d.x; const dy = e.clientY - d.y;
      if (!d.mode) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) { d.mode = 'x'; try { el.setPointerCapture(e.pointerId); } catch (err) { /* nem baj */ } }
        else if (Math.abs(dy) > 10) { d = null; return; }
      }
      if (d.mode === 'x') {
        const edge = (dx > 0 && view <= ROUNDS[0]) || (dx < 0 && view >= ROUNDS[ROUNDS.length - 1]);
        inner.style.transition = 'none';
        inner.style.transform = 'translateX(' + (edge ? dx * 0.28 : dx) + 'px)';
      }
    });
    const end = (e) => {
      if (!d) return;
      const dx = e.clientX - d.x;
      if (d.mode === 'x') {
        swallowClick();
        if (dx < -60) goto(view + 1); else if (dx > 60) goto(view - 1); else goto(view);
      }
      d = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (e) => { if (d && d.mode === 'x') goto(view); d = null; });
  })();

  // vissza: a bal szélről jobbra húzva az adatlap az ujjat követi
  (function edgeBack() {
    const det = $('#detail'); const list = $('#listScreen'); const dim = $('#listDim');
    let d = null;
    det.addEventListener('pointerdown', (e) => {
      const r = det.getBoundingClientRect();
      if (e.clientX - r.left > 30) return;
      d = { x: e.clientX, y: e.clientY, mode: null, w: r.width };
    });
    det.addEventListener('pointermove', (e) => {
      if (!d) return;
      const dx = Math.max(0, e.clientX - d.x); const dy = e.clientY - d.y;
      if (!d.mode) {
        if (dx > 8 && dx > Math.abs(dy)) { d.mode = 'back'; try { det.setPointerCapture(e.pointerId); } catch (err) { /* nem baj */ } }
        else if (Math.abs(dy) > 10) { d = null; return; }
      }
      if (d.mode === 'back') {
        const p = Math.min(1, dx / d.w);
        det.style.transition = 'none'; list.style.transition = 'none'; dim.style.transition = 'none';
        det.style.transform = 'translateX(' + dx + 'px)';
        list.style.transform = 'translateX(' + (-30 + 30 * p) + '%)';
        dim.style.opacity = String(1 - p);
      }
    });
    const end = (e) => {
      if (!d) return;
      const dx = e.clientX - d.x;
      if (d.mode === 'back') {
        swallowClick();
        if (dx > d.w * 0.3) { det.style.transition = ''; det.style.transform = 'translateX(100%)'; list.style.transition = ''; list.style.transform = ''; dim.style.transition = ''; dim.style.opacity = '0'; closeDetail(); }
        else setDetailOpen(true);
      }
      d = null;
    };
    det.addEventListener('pointerup', end);
    det.addEventListener('pointercancel', () => { if (d && d.mode === 'back') setDetailOpen(true); d = null; });
  })();

  // húzás után ne nyíljon meg véletlenül egy meccs
  let swallowUntil = 0;
  function swallowClick() { swallowUntil = Date.now() + 350; }
  document.addEventListener('click', (e) => { if (Date.now() < swallowUntil) { e.stopPropagation(); e.preventDefault(); } }, true);

  // adatok sorrendje: hosszan nyomva a sor "felemelkedik", és oda húzható, ahová kell
  (function dragReorder() {
    const list = $('#statList');
    const scroller = $('#tab-card');
    const HOLD = 380;      // ms: ennyi ideig kell nyomva tartani
    const SLOP = 8;       // px: ennél nagyobb mozgás a nyomás alatt görgetésnek számít
    let p = null;         // nyomás, még nincs húzás
    let d = null;         // folyamatban lévő húzás
    let raf = 0;

    function start() {
      const li = p.li;
      const items = [...list.children];
      const lr = list.getBoundingClientRect();
      const tops = items.map((x) => x.getBoundingClientRect().top - lr.top);
      const from = items.indexOf(li);
      d = {
        li, key: li.dataset.k, from, to: from, items, tops, hs: items.map((x) => x.offsetHeight),
        grab: p.y - lr.top - tops[from], y: p.y, id: p.id,
      };
      li.classList.add('dragging');
      list.classList.add('reordering');
      p = null;
      swallowClick();
      layout();
    }
    function layout() {
      const lr = list.getBoundingClientRect();
      const y = d.y - lr.top - d.grab;                 // a felemelt sor teteje a lista koordinátáiban
      const mid = y + d.hs[d.from] / 2;
      let to = 0;
      d.items.forEach((x, i) => { if (i !== d.from && d.tops[i] + d.hs[i] / 2 < mid) to += 1; });
      d.to = to;
      const h = d.hs[d.from];
      d.items.forEach((x, i) => {
        if (i === d.from) { x.style.transform = 'translateY(' + (y - d.tops[i]) + 'px) scale(1.02)'; return; }
        let s = 0;
        if (d.from < d.to && i > d.from && i <= d.to) s = -h;
        if (d.from > d.to && i >= d.to && i < d.from) s = h;
        x.style.transform = s ? 'translateY(' + s + 'px)' : '';
      });
    }
    function autoscroll() {
      if (!d) return;
      const r = scroller.getBoundingClientRect();
      const edge = 90;
      let v = 0;
      if (d.y < r.top + edge) v = -Math.ceil((r.top + edge - d.y) / 8);
      else if (d.y > r.bottom - edge - 80) v = Math.ceil((d.y - (r.bottom - edge - 80)) / 8);
      if (v) { scroller.scrollTop += v; layout(); }
      raf = requestAnimationFrame(autoscroll);
    }
    function finish() {
      cancelAnimationFrame(raf);
      if (!d) return;
      const { key, from, to } = d;
      d.items.forEach((x) => { x.style.transform = ''; });
      d.li.classList.remove('dragging');
      list.classList.remove('reordering');
      d = null;
      swallowClick();
      if (from !== to) { order.splice(order.indexOf(key), 1); order.splice(to, 0, key); selChanged(); }
    }

    list.addEventListener('pointerdown', (e) => {
      const li = e.target.closest('li[data-k]');
      if (!li || (e.pointerType === 'mouse' && e.button !== 0)) return;
      p = { li, x: e.clientX, y: e.clientY, id: e.pointerId, t: setTimeout(() => { if (p) { start(); raf = requestAnimationFrame(autoscroll); } }, HOLD) };
    });
    window.addEventListener('pointermove', (e) => {
      if (p && (Math.abs(e.clientX - p.x) > SLOP || Math.abs(e.clientY - p.y) > SLOP)) { clearTimeout(p.t); p = null; }
      if (d && e.pointerId === d.id) { d.y = e.clientY; layout(); }
    });
    const up = () => { if (p) { clearTimeout(p.t); p = null; } finish(); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    // húzás közben ne görgessen az oldal (iOS)
    list.addEventListener('touchmove', (e) => { if (d) e.preventDefault(); }, { passive: false });
    list.addEventListener('contextmenu', (e) => { if (p || d) e.preventDefault(); });
  })();

  // ---------- események ----------
  $('#days').addEventListener('click', (e) => {
    const b = e.target.closest('.match');
    if (b) openMatch(Number(b.dataset.id));
  });
  $('#prev').onclick = () => goto(view - 1);
  $('#next').onclick = () => goto(view + 1);
  $('#roundLabel').onclick = openPop;
  $('#scrim').onclick = closePop;
  $('#pgrid').addEventListener('click', (e) => { const b = e.target.closest('button[data-round]'); if (b) { closePop(); goto(Number(b.dataset.round)); } });
  $('#btnNow').onclick = () => goto(currentRound());
  $('#btnBack').onclick = closeDetail;
  $('#seg').addEventListener('click', (e) => { const b = e.target.closest('button[data-seg]'); if (b) setSeg(b.dataset.seg); });
  $('#segSum').addEventListener('click', (e) => { if (e.target.closest('#btnMakeCard')) { cardMatch = current; setTab('card'); } });
  document.querySelectorAll('.tabbar button').forEach((b) => { b.onclick = () => setTab(b.dataset.go); });
  $('#btnToMatches').onclick = () => setTab('matches');
  $('#btnSave').onclick = saveCard;
  $('#pBase').onclick = () => { sel = new Set(CAT.DEFAULT_SELECTED); order = CAT.DEFAULT_SELECTED.concat(order.filter((k) => CAT.DEFAULT_SELECTED.indexOf(k) < 0)); selChanged(); };
  $('#pAll').onclick = () => { sel = new Set(order); selChanged(); };
  $('#pNone').onclick = () => { sel = new Set(); selChanged(); };
  $('#statList').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-k]');
    if (!li) return;
    const k = li.dataset.k;
    if (sel.has(k)) sel.delete(k); else sel.add(k);
    selChanged();
  });
  $('#statList').addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && e.target.matches('li[data-k]')) { e.preventDefault(); e.target.click(); } });
  $('#themeSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-theme-pick]'); if (b) setTheme(b.dataset.themePick); });
  $('#crestList').addEventListener('click', (e) => {
    const del = e.target.closest('[data-crest-del]');
    if (del) { const id = Number(del.dataset.crestDel); store.del(crestKey(id)); crestImgs.delete(id); domCache.delete(id); afterCrestChange(); return; }
    const b = e.target.closest('[data-crest]');
    if (b) { crestTarget = TEAMS[b.dataset.crest]; const f = $('#crestFile'); f.value = ''; f.click(); }
  });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('#popover').hidden) closePop(); else if ($('#detail').classList.contains('open')) closeDetail(); }
  });

  // ---------- indulás ----------
  $('#seasonLine').textContent = 'Magyarország · 20' + D.season;
  const played = Object.keys(D.stats).length;
  $('#dataNote').textContent = 'Húzd oldalra a listát a fordulók közti lépéshez. Beépített adatok: ' + MATCHES.length + ' meccs, ' + played + ' lejátszott meccs statisztikája.';
  applyTheme();
  // adatcsomag betöltése után a Beállításokban marad, és ott látszik az eredmény
  const justLoaded = store.get('nb1.pkgJustLoaded') === '1';
  store.del('nb1.pkgJustLoaded');
  setTab(justLoaded ? 'settings' : 'matches');
  renderList();
  loadCrests().then(() => { renderList(); });
  window.NB1App = { openMatch, goto, setTab, setTheme, get view() { return view; } };

  // offline működés + frissítés: a kezdőképernyőről indított app minden előtérbe kerüléskor rákérdez az új változatra,
  // és ha jött, egyszer újratölti magát
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      const check = () => { reg.update().catch(() => { /* nincs net */ }); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      window.addEventListener('pageshow', check);
    }).catch(() => { /* offline mód nélkül is működik */ });
  }
})();

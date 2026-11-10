/* NB1 Kártya – mobil webapp ("A · Klasszikus lista" kinézet).
 * Fülek: Meccsek (forduló-lista + meccs adatlap), Játékos (player.js), Tabella, Csapat (team.js), Beállítások.
 * Gesztusok: a listát oldalra húzva fordulót váltasz; az adatlapon a bal szélről jobbra húzva visszalépsz.
 * Beépített adatok (mind Opta): data.js (Adatcsomag1, window.NB1_DATA), teamdata.js (Adatcsomag2, window.NB1_TEAMDATA)
 * és playerdata.js (Adatcsomag3, window.NB1_PLAYERDATA, játékosstatisztikák);
 * ezek az app frissítésével érkeznek. Hálózatot nem használ.
 */
(function () {
  'use strict';
  const F = window.NB1Format;
  const CAT = window.NB1Catalog;
  const COL = window.NB1Colors;
  const D = window.NB1_DATA;   // a beépített meccsadatok (data.js)
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- böngészőtár (ha nem elérhető, a program akkor is működik) ----------
  const mem = {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] == null ? null : mem[k]; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } },
  };

  // ---------- adatok: csak a beépítettek (data.js, teamdata.js, playerdata.js), az app frissítésével érkeznek ----------
  // A kézi adatcsomag-betöltés megszűnt; a korábban betöltött, tárolt csomagokat töröljük, hogy ne írják felül a friss adatot.
  ['nb1.pkg', 'nb1.pkg2', 'nb1.pkg3', 'nb1.pkgJustLoaded'].forEach((k) => store.del(k));
  const TDATA = window.NB1_TEAMDATA;
  const PDATA = window.NB1_PLAYERDATA;
  const TSRC = 'Opta';
  // az utolsó adatbázis-frissítés: a három adatfájl közül a legfrissebb állapot
  const LAST_UPDATE = Math.max(...[D, TDATA, PDATA].filter(Boolean).map((x) => Date.parse(x.updated)).filter(isFinite));

  // ---------- adatok ----------
  const TEAMS = {};
  Object.keys(D.teams).forEach((id) => { TEAMS[id] = Object.assign({ id: Number(id) }, D.teams[id]); });
  const MATCHES = D.matches.map((m) => Object.assign({}, m, { h: TEAMS[m.home], a: TEAMS[m.away] }));
  const ROUNDS = [...new Set(MATCHES.map((m) => m.round))].sort((a, b) => a - b);
  const nowSec = () => Math.floor(Date.now() / 1000);
  const LEAGUE = 'NB1';          // a liga neve mindenhol (jogi okokból nem a szponzori név)
  const APP_VERSION = '0.9beta';

  // Az aktuális forduló a legutóbb lejátszott: a legmagasabb sorszámú forduló, amelyben már van eredmény
  // (egy később pótolt, korábbi fordulós meccs nem húzza vissza). Ha még nincs eredmény, a legelső forduló.
  function currentRound() {
    const played = MATCHES.filter((m) => m.status === 'finished').map((m) => m.round);
    return played.length ? Math.max(...played) : ROUNDS[0];
  }

  // ---------- állapot ----------
  let tab = 'matches';
  let view = currentRound();
  let current = null;     // az adatlapon nyitott meccs
  let TEAM = null;        // a Csapat fül (team.js), az indulásnál jön létre
  let PLAYER = null;      // a Játékos fül (player.js), az indulásnál jön létre
  // ---------- logók (beépítve, a footylogos.com NB1-oldaláról, változtatás nélkül) ----------
  // A Vasas és a Kispest Honvéd logóját a felhasználó adta (az oldalon nincs): átlátszó háttérrel, 320×320-ra igazítva.
  const LOGOS = {
    1921: 'debrecen', 1925: 'ferencvaros-tc', 1923: 'gyor', 25397: 'kisvarda', 1915: 'mtk-budapest',
    5124: 'nyiregyhaza-spartacus', 6059: 'paksi', 25596: 'puskas-akademia', 1924: 'ujpest', 1922: 'zte-zalaegerszeg',
    1919: 'vasas', 1916: 'kispest-honved',
  };
  const crestImgs = new Map();
  const domCache = new Map();
  const leagueImg = new Image();
  leagueImg.src = 'logos/nb1.svg';
  // korábbi, kézzel betöltött címerek takarítása (ez a funkció megszűnt)
  try { Object.keys(localStorage).filter((k) => k.indexOf('nb1.crest.') === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* nem baj */ }
  function loadCrests() {
    const one = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    return Promise.all([
      ...Object.keys(LOGOS).map((id) => one('logos/' + LOGOS[id] + '.webp').then((i) => { if (i) crestImgs.set(Number(id), i); })),
      leagueImg.complete ? null : new Promise((res) => { leagueImg.onload = res; leagueImg.onerror = res; }),
    ]);
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
    if (tab === 'table') renderTable();   // a zónavonalak színe témától függ
    if (tab === 'team' && TEAM) TEAM.render();   // a csapatszínek is
    if (tab === 'player' && PLAYER) PLAYER.render();
  }
  function setTheme(p) { if (p === 'system') store.del('nb1.theme'); else store.set('nb1.theme', p); applyTheme(); }

  // ---------- fülek ----------
  const TABS = ['matches', 'player', 'table', 'team', 'settings'];
  // ---------- összecsukódó alsó sáv (mint az FM27 Pozíciókalauzban) ----------
  // Lefelé görgetve összemegy (csak ikonok), felfelé görgetve vagy a lap tetején kinyílik (felirattal).
  // Kis ugrálásra nem reagál: egy irányban legalább 12 px görgetés kell a váltáshoz.
  let compact = false;
  const scrollSt = new WeakMap();
  function setCompact(c) {
    if (c === compact) return;
    compact = c;
    $('#tabbar').classList.toggle('compact', c);
  }
  document.addEventListener('scroll', (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('scroll')) return;
    const y = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    const s = scrollSt.get(el) || { y: 0, acc: 0 };
    const dy = y - s.y;
    s.y = y;
    if (y > max - 2 && dy < 0) { scrollSt.set(el, s); return; }   // az alján az iOS visszarugózása ne nyissa ki
    s.acc = (dy > 0) === (s.acc > 0) ? s.acc + dy : dy;
    scrollSt.set(el, s);
    if (y < 30) setCompact(false);
    else if (s.acc > 12) setCompact(true);
    else if (s.acc < -12) setCompact(false);
  }, { capture: true, passive: true });
  // az éppen látható görgethető lap (az aktív fülre koppintva ezt görgetjük a tetejére)
  function visibleScroller() {
    if (tab === 'matches') return $('#detail').classList.contains('open') ? $('#detailScroll') : $('#listScroll');
    if (tab === 'team' && TEAM) return $('#tp' + TEAM.page);
    if (tab === 'player' && PLAYER) return $('#pp' + PLAYER.page);
    return $('#tab-' + tab);
  }

  function setTab(t) {
    tab = t;
    setCompact(false);
    TABS.forEach((name) => { $('#tab-' + name).hidden = name !== t; });
    document.querySelectorAll('.tabbar button').forEach((b) => {
      if (b.dataset.go === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('#lens').style.transform = 'translateX(' + (TABS.indexOf(t) * 100) + '%)';
    if (t === 'table') renderTable();
    if (t === 'team' && TEAM) TEAM.render();
    if (t === 'player' && PLAYER) PLAYER.render();
    if (t === 'settings') renderSettings();
  }

  // ---------- tabella (a betöltött meccseredményekből számolva) ----------
  // Az MLSZ NB1-sorrendje azonos pontszámnál: 1) több győzelem, 2) jobb gólkülönbség, 3) több rúgott gól,
  // 4) egymás elleni pontok, 5) egymás elleni gólkülönbség, 6) egymás elleni idegenben lőtt gól, 7) fair play, 8) sorsolás.
  // A 7–8. ponthoz nincs adat: ott név szerint marad a sorrend.
  let tableKind = 'total';
  const TABLE_NAMES = { 25596: 'P. Akadémia' };          // rövidebb név a tabellában
  // zónák az összesített tabellában: az UEFA indulási rendje (access list) a magyar bajnokságra, a 2027/28-as kupákra:
  // bajnok → BL 2. selejtezőkör; 2. és 3. hely → KL 2. selejtezőkör (az EL-helyet a Magyar Kupa győztese kapja, nem helyezés).
  // A vonal az adott zóna utolsó helye alatt van; csak a bajnoki hely van jelölve (színe a BL hivatalos logójából).
  const ZONES = [
    { after: 1, label: 'Bajnok', title: 'Bajnok, Bajnokok Ligája 2. selejtezőkör', light: '#0e2050', dark: '#6f8cf0' },
    { after: 10, label: 'Rájátszás', title: 'osztályozó az NB II 2. helyezettje ellen', light: '#e8820c', dark: '#f59b2e' },
    { after: 11, label: 'Kieső', title: 'kiesés az NB II-be', light: '#d6322c', dark: '#f0524c' },
  ];
  const playedIn = (m) => m.status === 'finished' && m.hs != null && m.as != null;
  function computeTable(kind) {
    const rows = {};
    Object.values(TEAMS).forEach((t) => { rows[t.id] = { team: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; });
    const sidesOf = (m) => {
      const s = [];
      if (kind !== 'away') s.push([m.h.id, m.hs, m.as, false]);
      if (kind !== 'home') s.push([m.a.id, m.as, m.hs, true]);
      return s;
    };
    MATCHES.forEach((m) => {
      if (!playedIn(m)) return;
      sidesOf(m).forEach(([id, gf, ga]) => {
        const r = rows[id];
        if (!r) return;
        r.mp += 1; r.gf += gf; r.ga += ga;
        if (gf > ga) { r.w += 1; r.pts += 3; } else if (gf === ga) { r.d += 1; r.pts += 1; } else r.l += 1;
      });
    });
    const base = (a, b) => (b.pts - a.pts) || (b.w - a.w) || ((b.gf - b.ga) - (a.gf - a.ga)) || (b.gf - a.gf);
    const list = Object.values(rows).sort((a, b) => base(a, b) || a.team.name.localeCompare(b.team.name, 'hu'));
    // egymás elleni eredmények a még mindig holtversenyben lévő csoportokon belül
    const out = [];
    for (let i = 0; i < list.length;) {
      let j = i + 1;
      while (j < list.length && base(list[i], list[j]) === 0) j++;
      const grp = list.slice(i, j);
      if (grp.length > 1) {
        const ids = new Set(grp.map((r) => r.team.id));
        const h2h = {};
        grp.forEach((r) => { h2h[r.team.id] = { pts: 0, gd: 0, away: 0 }; });
        MATCHES.forEach((m) => {
          if (!playedIn(m) || !ids.has(m.h.id) || !ids.has(m.a.id)) return;
          sidesOf(m).forEach(([id, gf, ga, isAway]) => {
            const x = h2h[id];
            x.pts += gf > ga ? 3 : gf === ga ? 1 : 0; x.gd += gf - ga; if (isAway) x.away += gf;
          });
        });
        grp.sort((a, b) => {
          const x = h2h[a.team.id]; const y = h2h[b.team.id];
          return (y.pts - x.pts) || (y.gd - x.gd) || (y.away - x.away) || a.team.name.localeCompare(b.team.name, 'hu');
        });
      }
      out.push(...grp);
      i = j;
    }
    return out;
  }
  function renderTable() {
    const done = MATCHES.filter((m) => playedIn(m));
    const lastRound = done.length ? Math.max(...done.map((m) => m.round)) : 0;
    $('#tableSub').textContent = LEAGUE + ' · 20' + D.season + (lastRound ? ' · ' + lastRound + '. forduló' : '');
    document.querySelectorAll('#tableSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.table === tableKind)));
    const dark = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && !!window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    const rows = computeTable(tableKind);
    const head = '<div class="st-row st-head" aria-hidden="true"><span class="st-pos"></span><span class="st-team">Csapat</span>' +
      '<span>M</span><span>GY</span><span>D</span><span>V</span><span>Gól</span><span class="st-pts">P</span></div>';
    $('#tableBox').innerHTML = head + rows.map((r, i) => {
      const pos = i + 1;
      const name = TABLE_NAMES[r.team.id] || r.team.name;
      // zónavonal a sor fölött (az előző helyezés alatt) – csak az összesített tabellában
      const z = tableKind === 'total' ? ZONES.find((x) => x.after === i) : null;
      const sep = z ? '<div class="st-sep" role="separator" aria-label="' + esc(z.title) + '" style="--zc:' + (dark ? z.dark : z.light) + '"><i></i><b>' + esc(z.label) + '</b><i></i></div>' : '';
      const label = pos + '. ' + r.team.name + ': ' + r.mp + ' meccs, ' + r.w + ' győzelem, ' + r.d + ' döntetlen, ' + r.l + ' vereség, gólok ' + r.gf + '–' + r.ga + ', ' + r.pts + ' pont';
      return sep + '<div class="st-row' + (z ? ' after-sep' : '') + '" role="row" aria-label="' + esc(label) + '">' +
        '<span class="st-pos">' + pos + '</span>' +
        '<span class="st-team">' + badge(r.team) + '<span class="st-name">' + esc(name) + '</span></span>' +
        '<span>' + r.mp + '</span><span>' + r.w + '</span><span>' + r.d + '</span><span>' + r.l + '</span>' +
        '<span class="st-goals">' + r.gf + ':' + r.ga + '</span>' +
        '<span class="st-pts">' + r.pts + '</span></div>';
    }).join('');
  }

  // ---------- forduló-lista ----------
  const matchesOf = (r) => MATCHES.filter((m) => m.round === r).sort((a, b) => (a.ts - b.ts) || a.h.name.localeCompare(b.h.name, 'hu'));

  function timeCell(m) {
    const st = F.statusInfo(m);
    if (st.kind === 'postponed' || st.kind === 'canceled') return '<span class="warn">' + esc(st.label) + '</span>';
    if (st.kind === 'finished') return '<span>' + esc(F.hhmm(m.ts)) + '</span><b>Vége</b>';
    return '<b>' + esc(m.tbd ? '–:–' : F.hhmm(m.ts)) + '</b>';   // tbd: a napot már kiírták, a kezdési időt még nem
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
    $('#hBadge').outerHTML = badge(m.h, 'big', c.l).replace('class="badge', 'id="hBadge" class="badge');
    $('#aBadge').outerHTML = badge(m.a, 'big', c.r).replace('class="badge', 'id="aBadge" class="badge');
    $('#hName').textContent = m.h.name;
    $('#aName').textContent = m.a.name;
    const big = $('#mBig');
    big.classList.toggle('time', !done);
    if (done) { big.textContent = m.hs + ' – ' + m.as; $('#mSmall').textContent = 'Vége'; }
    else if (st.kind === 'postponed' || st.kind === 'canceled') { big.textContent = '–'; $('#mSmall').textContent = st.label; }
    else { big.textContent = m.tbd ? '–:–' : F.hhmm(m.ts); $('#mSmall').textContent = F.dayHead(m.ts) + (m.tbd ? ' · időpont később' : ''); }
    const venue = [m.h.venue, m.h.city].filter(Boolean).join(', ');
    $('#meta').textContent = LEAGUE + ' · ' + m.round + '. forduló · ' + F.dateLong(m.ts) + (venue ? ' · ' + venue : '');

    // gólszerzők: hazai balra, vendég jobbra, középen labda; legutóbbi gól felül
    const goals = D.goals[m.id];
    let sum = '';
    if (!done) {
      sum = '<div class="panel"><p class="empty-msg">' + (st.kind === 'postponed' ? 'A meccset elhalasztották, ezért nincs adat.' : m.ts > nowSec() ? 'A meccs még nem kezdődött el. Az adatok a lefújás után kerülnek a csomagba.' : 'Ennek a meccsnek még nincs eredménye a beépített adatcsomagban.') + '</p></div>';
    } else if (goals && goals.length) {
      // "Szendrei Á." -> "Á. Szendrei", "Dénes Cs. V." -> "Cs. V. Dénes"
      const flip = (n) => { const p = String(n).split(' '); const i = p.findIndex((x) => /\.$/.test(x)); return i > 0 ? p.slice(i).concat(p.slice(0, i)).join(' ') : n; };
      const side = (s) => goals.filter((g) => g[0] === s).sort((a, b) => parseInt(b[2], 10) - parseInt(a[2], 10)).map((g) => {
        const tag = g[3] === 'penalty' ? ' <small>(11-es)</small>' : g[3] === 'own' ? ' <small>(ö.g.)</small>' : '';
        return '<li><b>' + esc(flip(g[1])) + '</b>' + tag + ' ' + esc(g[2]) + '</li>';
      }).join('');
      sum = '<div class="scorers"><ul class="h">' + side('home') + '</ul>' +
        '<svg class="ball" viewBox="0 0 24 24" aria-label="Gólok"><circle cx="12" cy="12" r="9"/><path d="M12 7l4.5 3.2-1.7 5.3H9.2L7.5 10.2z"/><path d="M12 7V3M16.5 10.2l3.9-1.4M14.8 15.5l2.4 3.4M9.2 15.5l-2.4 3.4M7.5 10.2L3.6 8.8"/></svg>' +
        '<ul>' + side('away') + '</ul></div>';
    } else sum = '<p class="scorers-none">' + (goals ? 'Gól nélküli döntetlen' : 'Gól-adat nincs a csomagban') + '</p>';
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
    }).join('') + '</div>' : (done ? '<div class="panel"><p class="empty-msg">Ehhez a meccshez nincs statisztika a beépített adatcsomagban.</p></div>' : '');
  }

  function openMatch(id) {
    const m = MATCHES.find((x) => x.id === id);
    if (!m) return;
    current = m;
    renderDetail();
    $('#detailScroll').scrollTop = 0;
    setCompact(false);
    setDetailOpen(true);
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
  // Nincs böngésző-előzmény (pushState): különben az iOS saját vissza-gesztusa is elindulna a miénkkel együtt,
  // ami "szellemképet" és ugrást okozott. A visszalépés csak a saját húzásunkkal és a vissza gombbal megy.
  function closeDetail() { setDetailOpen(false); }

  // ---------- beállítások ----------
  function renderSettings() {
    applyTheme();
    $('#lastUpdate').textContent = isFinite(LAST_UPDATE) ? F.dateLong(Math.floor(LAST_UPDATE / 1000)) : '–';
    $('#appVersion').textContent = 'Verzió: ' + APP_VERSION;
    if (!$('#diag').hidden) $('#diag').textContent = diagText();
  }
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
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.go !== tab) { setTab(b.dataset.go); return; }
      // az aktív fülre koppintva a lap a tetejére görget
      const el = visibleScroller();
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
      setCompact(false);
    };
  });
  $('#tableSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-table]'); if (b) { tableKind = b.dataset.table; renderTable(); } });
  $('#themeSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-theme-pick]'); if (b) setTheme(b.dataset.themePick); });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (PLAYER && !$('#playerPop').hidden) PLAYER.closePick(); else if (!$('#popover').hidden) closePop(); else if ($('#detail').classList.contains('open')) closeDetail(); }
  });

  // ---------- indulás ----------
  $('#seasonLine').textContent = 'Magyarország · 20' + D.season;
  const played = Object.keys(D.stats).length;
  $('#dataNote').textContent = 'Húzd oldalra a listát a fordulók közti lépéshez. Adatok (Opta): ' + MATCHES.length + ' meccs, ' + played + ' lejátszott meccs statisztikája.';
  // Csapat fül (team.js)
  TEAM = window.NB1Team && TDATA ? window.NB1Team.init({
    TEAMS, MATCHES, store, esc, badge, swallowClick, swallowed: () => Date.now() < swallowUntil,
    teamData: () => TDATA, teamSource: () => TSRC,
    short: (id) => TABLE_NAMES[id] || TEAMS[id].name,
    table: (kind) => computeTable(kind),
    pairColors: (a, b) => { const fx = COL.fixPair(teamTone(a), teamTone(b), b.color2 || b.color); return { a: fx[0], b: fx[1] }; },
  }) : null;
  // Játékos fül (player.js); egy meccsre koppintva a Meccsek fülön nyílik meg az adatlap
  PLAYER = window.NB1Player && PDATA ? window.NB1Player.init({
    TEAMS, store, esc, badge, swallowClick, swallowed: () => Date.now() < swallowUntil,
    playerData: () => PDATA,
    short: (id) => TABLE_NAMES[id] || TEAMS[id].name,
    table: () => computeTable('total'),
    tone: (id) => teamTone(TEAMS[id]),
    pairColors: (a, b) => { const fx = COL.fixPair(teamTone(a), teamTone(b), b.color2 || b.color); return { a: fx[0], b: fx[1] }; },
    openMatch: (id) => { const m = MATCHES.find((x) => x.id === id); if (!m) return; setTab('matches'); goto(m.round, false); openMatch(id); },
  }) : null;
  applyTheme();
  setTab('matches');
  renderList();
  // indulóképernyő: az animáció (css) végén kivesszük
  setTimeout(() => { const sp = document.getElementById('splash'); if (sp) sp.remove(); }, 1500);
  loadCrests().then(() => { renderList(); if (current) renderDetail(); if (tab === 'team' && TEAM) TEAM.render(); if (tab === 'player' && PLAYER) PLAYER.render(); });
  window.NB1App = { openMatch, goto, setTab, setTheme, get view() { return view; }, playerData: () => PDATA };

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

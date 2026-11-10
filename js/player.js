/* NB1 Kártya – Játékos fül: négy lap (Profil, Ranglista, Párhuzam, Meccsek), oldalra húzva vagy a fenti gombokkal váltható.
 * Az adatok a játékosstatisztika-csomagból jönnek (Adatcsomag3: window.NB1_PLAYERDATA vagy egy betöltött csomag, Opta).
 * Használat: const P = NB1Player.init(ctx); P.render();  – a ctx-et az app.js adja (lásd ott).
 */
(function () {
  'use strict';

  const MINQ = 450;   // a 90 percre vetített és az arány/átlag mutatóknál, valamint a százalékos összevetésnél ennyi játékperc kell
  const GROUP_OF = {
    Kapus: 'gk', 'Középső védő': 'def', Hátvéd: 'def', 'Szélső védő': 'def', Védő: 'def',
    Középpályás: 'mid', 'Támadó középpályás': 'mid', Szélső: 'att', Csatár: 'att',
  };
  const GROUP_NAME = { gk: 'kapusok', def: 'védők', mid: 'középpályások', att: 'támadók' };
  const PAGES = ['Profil', 'Ranglista', 'Párhuzam', 'Meccsek'];

  // ---------- mutatók ----------
  // l: név, s: rövid név (gomb), k: mező (összeg), ratio: [sikeres, összes] -> százalék, avg: átlag (értékelés),
  // d: tizedesek, low: a kevesebb a jobb, noPer: nincs 90 percre vetítve
  const M = {
    g: { l: 'Gól', k: 'g' }, a: { l: 'Gólpassz', k: 'a' }, ga: { l: 'Gól + gólpassz', s: 'G+GP', f: (r) => r.g + r.a },
    xg: { l: 'Várható gól (xG)', s: 'xG', k: 'xg', d: 2 }, xgot: { l: 'Kaput találó xG (xGOT)', s: 'xGOT', k: 'xgot', d: 2 },
    xa: { l: 'Várható gólpassz (xA)', s: 'xA', k: 'xa', d: 2 },
    sh: { l: 'Lövés', k: 'sh' }, sot: { l: 'Kaput eltaláló lövés', s: 'Kapura', k: 'sot' }, head: { l: 'Fejes', k: 'head' },
    kp: { l: 'Kulcspassz', k: 'kp' }, bcc: { l: 'Létrehozott nagy helyzet', s: 'Nagy helyzet', k: 'bcc' },
    bcm: { l: 'Kihagyott nagy helyzet', k: 'bcm', low: true }, drbW: { l: 'Sikeres csel', s: 'Csel', k: 'drbW' },
    tib: { l: 'Érintés az ellenfél 16-osában', s: '16-os érintés', k: 'tib' }, tch: { l: 'Labdaérintés', k: 'tch' },
    pasA: { l: 'Pontos passz', k: 'pasA' }, pasP: { l: 'Passzpontosság', s: 'Passz %', ratio: ['pasA', 'pasT'] },
    f3A: { l: 'Pontos passz az utolsó harmadban', s: 'Utolsó harmad', k: 'f3A' },
    lngP: { l: 'Pontos hosszú passz', ratio: ['lngA', 'lngT'] }, crsP: { l: 'Pontos beívelés', ratio: ['crsA', 'crsT'] },
    duelW: { l: 'Megnyert párharc', s: 'Párharc', k: 'duelW' }, duelP: { l: 'Megnyert párharc', s: 'Párharc %', ratio: ['duelW', 'duelT'] },
    aerP: { l: 'Megnyert légi párharc', ratio: ['aerW', 'aerT'] }, gndP: { l: 'Megnyert földi párharc', ratio: ['gndW', 'gndT'] },
    tckW: { l: 'Sikeres szerelés', s: 'Szerelés', k: 'tckW' }, int: { l: 'Labdaszerzés', k: 'int' }, clr: { l: 'Tisztázás', k: 'clr' },
    errS: { l: 'Lövéshez vezető hiba', k: 'errS', low: true }, errG: { l: 'Gólhoz vezető hiba', k: 'errG', low: true },
    fou: { l: 'Elkövetett szabálytalanság', s: 'Szabálytalanság', k: 'fou', low: true },
    fouled: { l: 'Kiharcolt szabálytalanság', k: 'fouled' },
    yc: { l: 'Sárga lap', k: 'yc', low: true, noPer: true }, rc: { l: 'Piros lap', k: 'rc', low: true, noPer: true },
    sav: { l: 'Védés', k: 'sav' }, gc: { l: 'Kapott gól', k: 'gc', low: true }, gp: { l: 'Megelőzött gól', k: 'gp', d: 2 },
    xgotF: { l: 'Kapott xGOT', k: 'xgotF', d: 2 }, pun: { l: 'Öklözés', k: 'pun' }, swp: { l: 'Söprögetőként', k: 'swp' },
    thr: { l: 'Kidobás', k: 'thr' },
    rating: { l: 'Értékelés', avg: true, f: (r) => r.rating, d: 2 },
    min: { l: 'Játékperc', s: 'Perc', k: 'min', noPer: true },
  };
  const val = (r, key) => { const m = M[key]; if (m.ratio) return r[m.ratio[1]] ? 100 * r[m.ratio[0]] / r[m.ratio[1]] : null; return m.f ? m.f(r) : r[m.k]; };
  const isRate = (key) => !!(M[key].ratio || M[key].avg);
  // összevethető érték: arány/átlag maga, különben 90 percre vetítve
  const cmpVal = (r, key) => (isRate(key) || M[key].noPer ? val(r, key) : (r.min ? val(r, key) * 90 / r.min : null));
  const dec = (key) => (M[key].ratio ? 1 : M[key].d || 0);

  const LB_KEYS = ['g', 'a', 'ga', 'xg', 'xa', 'sh', 'kp', 'bcc', 'drbW', 'tib', 'pasP', 'duelP', 'tckW', 'int', 'clr', 'rating', 'sav', 'gp', 'yc', 'min'];
  const SECTIONS = {
    att: [['TÁMADÁS', ['sh', 'sot', 'xg', 'xgot', 'bcm', 'tib', 'head']], ['JÁTÉKSZERVEZÉS', ['kp', 'bcc', 'xa', 'drbW', 'tch']],
      ['PASSZOK', ['pasP', 'f3A', 'lngP', 'crsP']], ['PÁRHARC, VÉDEKEZÉS', ['duelP', 'aerP', 'gndP', 'tckW', 'int']], ['FEGYELEM', ['fou', 'fouled', 'yc', 'rc']]],
    mid: [['JÁTÉKSZERVEZÉS', ['kp', 'bcc', 'xa', 'drbW', 'tch']], ['PASSZOK', ['pasP', 'f3A', 'lngP', 'crsP']],
      ['TÁMADÁS', ['sh', 'sot', 'xg', 'xgot', 'tib']], ['PÁRHARC, VÉDEKEZÉS', ['duelP', 'aerP', 'gndP', 'tckW', 'int', 'clr', 'errS']], ['FEGYELEM', ['fou', 'fouled', 'yc', 'rc']]],
    def: [['PÁRHARC, VÉDEKEZÉS', ['duelP', 'aerP', 'gndP', 'tckW', 'int', 'clr', 'errS', 'errG']], ['PASSZOK', ['pasP', 'f3A', 'lngP', 'crsP']],
      ['TÁMADÁS, JÁTÉKSZERVEZÉS', ['kp', 'xa', 'bcc', 'sh', 'xg', 'drbW']], ['FEGYELEM', ['fou', 'yc', 'rc']]],
    gk: [['KAPUS', ['sav', 'gc', 'xgotF', 'gp', 'pun', 'swp', 'thr']], ['PASSZOK', ['pasP', 'lngP', 'pasA']], ['FEGYELEM', ['errG', 'errS', 'yc', 'rc']]],
  };
  const TILES = { gk: ['sav', 'gp', 'gc', 'xgotF'], def: ['tckW', 'int', 'clr', 'duelP'], mid: ['g', 'a', 'kp', 'xa'], att: ['g', 'a', 'kp', 'drbW'] };
  const RADAR = {
    att: ['g', 'xg', 'xa', 'kp', 'drbW', 'duelP'], mid: ['xa', 'kp', 'pasP', 'drbW', 'tckW', 'int'],
    def: ['duelP', 'aerP', 'tckW', 'int', 'clr', 'pasP'], gk: ['sav', 'gp', 'pasP', 'lngP', 'pun', 'swp'],
  };
  const CMP = {
    att: ['g', 'xg', 'a', 'xa', 'sh', 'kp', 'drbW', 'tib', 'duelP', 'rating'], mid: ['g', 'a', 'xa', 'kp', 'bcc', 'pasP', 'drbW', 'tckW', 'int', 'rating'],
    def: ['duelP', 'aerP', 'tckW', 'int', 'clr', 'pasP', 'kp', 'errS', 'rating'], gk: ['sav', 'gc', 'gp', 'xgotF', 'pasP', 'lngP', 'pun', 'rating'],
  };
  const POS_FILTER = [['all', 'Poszt: mind'], ['att', 'Támadók'], ['mid', 'Középpályások'], ['def', 'Védők'], ['gk', 'Kapusok']];

  const fmt = (v, d) => (v == null || !isFinite(v)) ? '–' : Number(v).toFixed(d || 0).replace('.', ',').replace('-', '−');
  const rcls = (x) => (x == null ? 'rn' : x >= 8 ? 'r8' : x >= 7 ? 'r7' : x >= 6.5 ? 'r65' : x >= 6 ? 'r6' : 'r5');
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---------- az adatcsomag előkészítése (csomagonként egyszer) ----------
  let cache = null;
  function prep(PD) {
    if (cache && cache.src === PD) return cache;
    const rows = {}; const log = {};
    Object.keys(PD.seasonTotals).forEach((id) => {
      const v = PD.seasonTotals[id]; const p = PD.players[id]; const r = { id, name: p.name, team: p.team, pos: p.pos, grp: GROUP_OF[p.pos] || 'mid' };
      PD.seasonFields.forEach((k, i) => { r[k] = v[i]; });
      rows[id] = r;
    });
    PD.matches.forEach((m) => m.players.forEach((row) => {
      const r = { side: row[1], match: m };
      PD.fields.forEach((k, i) => { r[k] = row[2 + i]; });
      (log[row[0]] = log[row[0]] || []).push(r);
    }));
    Object.keys(log).forEach((id) => log[id].sort((a, b) => a.match.ts - b.match.ts));
    cache = { src: PD, rows, log, ids: Object.keys(rows) };
    return cache;
  }

  function init(ctx) {
    const $ = (s) => document.querySelector(s);
    const esc = ctx.esc;
    const st = {
      page: 0, player: ctx.store.get('nb1.player'), other: ctx.store.get('nb1.player2'), squad: null,
      lb: 'g', lbMode: 'tot', lbPos: 'all', lbTeam: 'all', pick: null,
    };
    const D = () => prep(ctx.playerData());
    const R = (id) => D().rows[id];
    const qual = (r) => r.min >= MINQ;
    const teamName = (id) => ctx.short(id);
    const crest = (id, cls) => ctx.badge(ctx.TEAMS[id], cls);
    const initials = (name) => name.replace(/\./g, '').split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase();
    const avatar = (r, cls) => '<span class="pl-av ' + (cls || '') + '" style="--tc:' + esc(ctx.tone(r.team)) + '">' + esc(initials(r.name)) + crest(r.team, 'pl-av-crest') + '</span>';
    const rchip = (x, d) => '<span class="pl-rt ' + rcls(x) + '">' + fmt(x, d == null ? 1 : d) + '</span>';

    function ensure() {
      const d = D();
      const byMin = d.ids.slice().sort((a, b) => d.rows[b].min - d.rows[a].min);
      if (!d.rows[st.player]) st.player = d.ids.slice().sort((a, b) => (d.rows[b].g - d.rows[a].g) || (d.rows[b].min - d.rows[a].min))[0];
      if (!d.rows[st.other] || st.other === st.player) {
        const me = R(st.player);
        st.other = byMin.find((id) => id !== st.player && d.rows[id].grp === me.grp) || byMin.find((id) => id !== st.player);
      }
      if (!st.squad || !ctx.TEAMS[st.squad]) st.squad = R(st.player).team;
    }
    function setPlayer(id, page) {
      st.player = id; st.squad = R(id).team; ctx.store.set('nb1.player', id);
      if (st.other === id) st.other = null;
      render();
      if (page != null) setPage(page);
    }
    // helyezés: összegnél mindenki között, aránynál/átlagnál a legalább MINQ percet játszók között
    function rankOf(r, key) {
      const m = M[key]; const pool = D().ids.map(R).filter((x) => !isRate(key) || qual(x));
      if (isRate(key) && !qual(r)) return null;
      const mine = val(r, key);
      if (mine == null) return null;
      return 1 + pool.filter((x) => { const v = val(x, key); return v != null && (m.low ? v < mine : v > mine); }).length;
    }
    // százalékos hely a saját posztcsoportban (90 percre vetítve / arány), csak elég játékperccel
    function pctile(r, key, grp) {
      if (!qual(r)) return null;
      const pool = D().ids.map(R).filter((x) => qual(x) && x.grp === (grp || r.grp));
      const mine = cmpVal(r, key);
      if (mine == null || !pool.length) return null;
      return pool.filter((x) => { const v = cmpVal(x, key); return v != null && (M[key].low ? v >= mine : v <= mine); }).length / pool.length;
    }

    // ---------- 1. Profil ----------
    function renderProfil() {
      const r = R(st.player); const d = D(); const games = d.log[r.id] || [];
      const squad = d.ids.map(R).filter((x) => x.team === Number(st.squad)).sort((a, b) => b.min - a.min);
      const teams = ctx.table().map((t) => t.team.id);
      const rr = rankOf(r, 'rating');
      const tile = (key) => {
        const v = val(r, key); const k = rankOf(r, key); const n = d.ids.length;
        const sub = key === 'g' ? 'gól · xG ' + fmt(r.xg, 2) : key === 'a' ? 'gólpassz · xA ' + fmt(r.xa, 2) : M[key].l.charAt(0).toLowerCase() + M[key].l.slice(1);
        return '<div class="tm-tile"><b>' + fmt(v, dec(key)) + (M[key].ratio ? '%' : '') + '</b><span>' + esc(sub) + '</span>' +
          (k ? '<em class="tm-rk ' + (k <= 3 ? 'g' : k <= n / 10 ? 'b' : '') + '">' + k + '.</em>' : '') + '</div>';
      };
      const row = (key) => {
        const m = M[key]; const p = pctile(r, key);
        const tot = m.ratio ? fmt(r[m.ratio[0]]) + '/' + fmt(r[m.ratio[1]]) : fmt(val(r, key), dec(key));
        const sec = m.ratio ? fmt(val(r, key), 1) + '%' : m.noPer || !r.min ? '' : fmt(val(r, key) * 90 / r.min, m.d ? 2 : 1);
        return '<div class="tm-row pl-row"><span class="k">' + esc(m.l) +
          (p != null ? '<i class="pl-pct"><u class="' + (p >= 0.8 ? 'g' : p < 0.25 ? 'r' : '') + '" style="width:' + Math.max(3, p * 100).toFixed(0) + '%"></u></i>' : '') +
          '</span><span class="v">' + tot + '</span><span class="s">' + sec + '</span></div>';
      };
      return '<button type="button" class="pl-search" data-search="main"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span>Játékos keresése</span></button>' +
        '<div class="tm-picker hscroll" role="listbox" aria-label="Csapat keret">' + teams.map((id) =>
          '<button type="button" role="option" data-squad="' + id + '" aria-selected="' + (id === Number(st.squad)) + '" aria-label="' + esc(ctx.TEAMS[id].name) + '">' + crest(id) + '</button>').join('') + '</div>' +
        '<div class="tm-chips hscroll pl-squad">' + squad.map((x) =>
          '<button type="button" data-player="' + x.id + '" aria-selected="' + (x.id === r.id) + '">' + esc(x.name) + '</button>').join('') + '</div>' +
        '<div class="group pl-hero">' + avatar(r) +
          '<div class="pl-hero-txt"><h2>' + esc(r.name) + '</h2><p>' + esc(teamName(r.team)) + ' · ' + esc(r.pos || '–') + '</p>' +
          '<p>' + r.apps + ' meccs · ' + r.min + ' perc</p><div class="pl-form">' + games.slice(-5).map((g) => rchip(g.rating)).join('') + '</div></div>' +
          '<div class="pl-hero-rt">' + rchip(r.rating, 2) + '<small>értékelés<br>' + (rr ? rr + '. a ligában' : 'kevés játékperc') + '</small></div></div>' +
        '<div class="tm-tiles">' + TILES[r.grp].map(tile).join('') + '</div>' +
        SECTIONS[r.grp].map(([name, keys]) => '<div class="tm-ghead"><span>' + name + '</span><span>összesen · 90 percre</span></div>' +
          '<div class="group">' + keys.map(row).join('') + '</div>').join('') +
        '<p class="hint tm-note">A csík azt mutatja, hány %-át előzi meg a ' + GROUP_NAME[r.grp] + ' közül (90 percre vetítve, legalább ' + MINQ + ' játékperccel; ' +
          'kevesebb percnél nincs csík). Az arányoknál a második oszlop a százalék. Forrás: Opta.</p>';
    }

    // ---------- 2. Ranglista ----------
    function renderRanglista() {
      const key = st.lb; const m = M[key]; const rate = isRate(key) || m.noPer;
      const mode = rate ? 'tot' : st.lbMode;
      const f = (r) => (mode === 'p90' ? (r.min ? val(r, key) * 90 / r.min : null) : val(r, key));
      const needQ = isRate(key) || mode === 'p90';
      const list = D().ids.map(R).filter((r) => (st.lbPos === 'all' || r.grp === st.lbPos) && (st.lbTeam === 'all' || r.team === Number(st.lbTeam)) &&
        (!needQ || qual(r)) && f(r) != null)
        .sort((a, b) => (f(b) - f(a)) || (a.min - b.min));
      const d = mode === 'p90' ? Math.max(2, dec(key)) : dec(key);
      const mx = Math.max(...list.map(f).filter((x) => x > 0), 1);
      const sel = (name, opts, cur, dis) => '<select data-lb="' + name + '"' + (dis ? ' disabled' : '') + '>' + opts.map(([v, l]) => '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
      const extra = (r) => (key === 'g' ? 'xG ' + fmt(r.xg, 2) : key === 'a' ? 'xA ' + fmt(r.xa, 2) : key === 'sav' ? r.gc + ' kapott' : '');
      let pos = 0; let prev = null;
      const line = (r, i) => {
        const v = f(r); if (v !== prev) { pos = i + 1; prev = v; }
        return '<button type="button" class="pl-lb' + (r.id === st.player ? ' me' : '') + '" data-player="' + r.id + '"><span class="n">' + pos + '</span>' + crest(r.team) +
          '<span class="nm"><b>' + esc(r.name) + '</b><small>' + esc(teamName(r.team)) + ' · ' + esc(r.pos || '–') + ' · ' + r.min + ' perc</small>' +
          '<i style="width:' + Math.max(2, 100 * Math.max(0, v) / mx).toFixed(1) + '%"></i></span>' +
          '<span class="val">' + fmt(v, d) + (m.ratio ? '%' : '') + (extra(r) ? '<small>' + esc(extra(r)) + '</small>' : '') + '</span></button>';
      };
      const top = list.slice(0, 30);
      let html = top.map(line).join('');
      const meIdx = list.findIndex((r) => r.id === st.player);
      if (meIdx >= 30) { pos = 0; prev = null; list.slice(0, meIdx).forEach((r, i) => { const v = f(r); if (v !== prev) { pos = i + 1; prev = v; } }); html += '<div class="tm-avgline"><span>…</span></div>' + line(list[meIdx], meIdx); }
      const teams = ctx.table().map((t) => [t.team.id, teamName(t.team.id)]);
      return '<div class="tm-chips hscroll" role="tablist">' + LB_KEYS.map((k) => '<button type="button" data-lbkey="' + k + '" aria-selected="' + (k === key) + '">' + esc(M[k].s || M[k].l) + '</button>').join('') + '</div>' +
        '<div class="pl-filters">' + sel('mode', rate ? [['tot', isRate(key) ? 'Átlag / arány' : 'Összesen']] : [['tot', 'Összesen'], ['p90', '90 percre']], mode, rate) +
          sel('pos', POS_FILTER, st.lbPos) + sel('team', [['all', 'Csapat: mind']].concat(teams), st.lbTeam) + '</div>' +
        '<div class="group pl-lb-box"><div class="tm-statsel"><b>' + esc(m.l) + (mode === 'p90' ? ' / 90 perc' : '') + '</b><span class="pl-count">' + list.length + ' játékos</span></div>' +
          (html || '<p class="hint" style="margin:0 16px 14px">Nincs a szűrésnek megfelelő játékos.</p>') + '</div>' +
        '<p class="hint tm-note">' + (needQ ? 'Csak a legalább ' + MINQ + ' percet játszók szerepelnek. ' : '') +
          'Holtversenyben a kevesebb játékperc áll elöl. Koppints egy játékosra a profiljához.</p>';
    }

    // ---------- 3. Párhuzam ----------
    function renderParhuzam() {
      const A = R(st.player); const B = R(st.other);
      const grp = A.grp === 'gk' && B.grp === 'gk' ? 'gk' : A.grp === 'gk' ? (B.grp) : A.grp;
      const col = ctx.pairColors(ctx.TEAMS[A.team], ctx.TEAMS[B.team]);
      const axes = RADAR[grp];
      const R0 = 84; const cx = 150; const cy = 112; const n = axes.length;
      const pt = (k, r) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
      const pv = (r, key) => { const p = pctile(Object.assign({}, r, { min: Math.max(r.min, MINQ) }), key, grp); return p == null ? 0 : p; };
      const poly = (vals) => vals.map((v, k) => pt(k, (0.12 + 0.88 * v) * R0).map((x) => x.toFixed(1)).join(',')).join(' ');
      let svg = '<svg class="tm-radar" viewBox="0 0 300 228" role="img" aria-label="Profil-összevetés">';
      [0.25, 0.5, 0.75, 1].forEach((g) => { svg += '<polygon points="' + axes.map((_, k) => pt(k, g * R0).map((x) => x.toFixed(1)).join(',')).join(' ') + '" fill="none" stroke="var(--line)"/>'; });
      axes.forEach((key, k) => {
        const [x, y] = pt(k, R0); const [lx, ly] = pt(k, R0 + 18);
        svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="var(--line)"/>' +
          '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle">' + esc(M[key].s || M[key].l) + '</text>';
      });
      svg += '<polygon points="' + poly(axes.map((k) => pv(B, k))) + '" fill="' + col.b + '" fill-opacity=".16" stroke="' + col.b + '" stroke-width="2" stroke-linejoin="round"/>';
      svg += '<polygon points="' + poly(axes.map((k) => pv(A, k))) + '" fill="' + col.a + '" fill-opacity=".22" stroke="' + col.a + '" stroke-width="2" stroke-linejoin="round"/></svg>';
      const cmp = (key) => {
        const m = M[key]; const a = cmpVal(A, key); const b = cmpVal(B, key);
        const d = isRate(key) ? dec(key) : Math.max(2, dec(key)); const mx = Math.max(Math.abs(a || 0), Math.abs(b || 0)) || 1;
        const aw = a != null && (b == null || (m.low ? a <= b : a >= b)); const bw = b != null && (a == null || (m.low ? b <= a : b >= a));
        const u = m.ratio ? '%' : '';
        return '<div class="tm-cmp"><div class="tm-cmp-top"><b>' + fmt(a, d) + u + '</b><span>' + esc(m.l) + '</span><b>' + fmt(b, d) + u + '</b></div>' +
          '<div class="bars"><span><i style="width:' + (100 * Math.max(0, a || 0) / mx).toFixed(1) + '%;background:' + (aw ? col.a : 'var(--fg2)') + '"></i></span>' +
          '<span><i style="width:' + (100 * Math.max(0, b || 0) / mx).toFixed(1) + '%;background:' + (bw ? col.b : 'var(--fg2)') + '"></i></span></div></div>';
      };
      const head = (r, side) => '<button type="button" class="pl-vs-p" data-pick="' + side + '">' + avatar(r, 'sm') + '<b>' + esc(r.name) + '</b><small>' +
        esc(teamName(r.team)) + ' · ' + esc(r.pos || '–') + '<br>' + r.min + ' perc</small></button>';
      return '<div class="group pl-vs">' + head(A, 'a') + '<span class="x">vs</span>' + head(B, 'b') + '</div>' +
        '<div class="group"><div class="tm-radar-box">' + svg + '</div><div class="tm-legend"><span><i style="background:' + col.a + '"></i>' + esc(A.name) + '</span><span><i style="background:' + col.b + '"></i>' + esc(B.name) + '</span></div></div>' +
        '<div class="tm-ghead"><span>90 PERCRE VETÍTVE</span><span>arányok, értékelés: átlag</span></div>' +
        '<div class="group">' + CMP[grp].map(cmp).join('') + '</div>' +
        '<p class="hint tm-note">A játékosra koppintva cserélheted. A radar azt mutatja, hány %-át előzik meg a ' + GROUP_NAME[grp] + ' közül (legalább ' + MINQ + ' játékperccel).</p>';
    }

    // ---------- 4. Meccsek ----------
    function renderMeccsek() {
      const r = R(st.player); const games = D().log[r.id] || [];
      const W = 320; const H = 96; const pad = 14;
      const xs = (i) => pad + i * (W - 2 * pad) / Math.max(1, games.length - 1);
      const ys = (v) => H - 12 - (Math.min(9.5, Math.max(5.5, v)) - 5.5) / 4 * (H - 26);
      let svg = '<svg class="pl-spark" viewBox="0 0 ' + W + ' ' + (H + 14) + '" role="img" aria-label="Értékelés meccsenként">';
      if (r.rating != null) svg += '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + ys(r.rating).toFixed(1) + '" y2="' + ys(r.rating).toFixed(1) + '" stroke="var(--fg2)" stroke-opacity=".5" stroke-dasharray="3 4"/>';
      const pts = games.map((g, i) => (g.rating != null ? xs(i).toFixed(1) + ',' + ys(g.rating).toFixed(1) : null)).filter(Boolean);
      svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--fg2)" stroke-width="1.6" stroke-opacity=".7"/>';
      games.forEach((g, i) => {
        if (g.rating != null) svg += '<circle class="' + rcls(g.rating) + '" cx="' + xs(i).toFixed(1) + '" cy="' + ys(g.rating).toFixed(1) + '" r="5" stroke="var(--surface)" stroke-width="1.5"/>';
        svg += '<text x="' + xs(i).toFixed(1) + '" y="' + (H + 11) + '" text-anchor="middle">' + g.match.round + '.</text>';
      });
      svg += '</svg>';
      const rows = games.slice().reverse().map((g) => {
        const m = g.match; const home = g.side === 'H'; const opp = home ? m.away : m.home;
        const gf = home ? m.hs : m.as; const ga = home ? m.as : m.hs; const res = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
        const ev = [g.g ? '<span class="gl">GÓL ' + g.g + '</span>' : '', g.a ? '<span>GP ' + g.a + '</span>' : '', g.og ? '<span>ÖG</span>' : '',
          g.yc ? '<span class="yc"></span>' : '', g.rc ? '<span class="rc"></span>' : '', g.xg ? '<span>xG ' + fmt(g.xg, 2) + '</span>' : ''].join('');
        return '<button type="button" class="pl-ml" data-match="' + m.id + '"><span class="rd">' + m.round + '.<small>' + (home ? 'hazai' : 'vendég') + '</small></span>' + crest(opp) +
          '<span class="op"><b>' + esc(teamName(opp)) + '</b><small><i class="res ' + res + '">' + { W: 'GY', D: 'D', L: 'V' }[res] + '</i>' + gf + '–' + ga + ' · ' + g.min + ' perc</small></span>' +
          '<span class="ev">' + ev + '</span>' + rchip(g.rating) + '</button>';
      }).join('');
      return '<div class="group pl-mini">' + avatar(r, 'sm') + '<div><h3>' + esc(r.name) + '</h3><p>' + esc(teamName(r.team)) + ' · ' + esc(r.pos || '–') + ' · ' + r.g + ' gól, ' + r.a + ' gólpassz</p></div></div>' +
        '<div class="group pl-spark-box"><div class="pl-spark-head"><span>Értékelés meccsenként</span><span>átlag ' + fmt(r.rating, 2) + '</span></div>' + svg + '</div>' +
        '<div class="tm-ghead"><span>MECCSEK (' + games.length + ')</span><span>értékelés</span></div>' +
        '<div class="group">' + (rows || '<p class="hint" style="margin:12px 16px">Nincs meccs.</p>') + '</div>' +
        '<p class="hint tm-note">Koppints egy meccsre az adatlapjához.</p>';
    }

    // ---------- játékosválasztó (kereső) ----------
    function openPick(side) {
      st.pick = side;
      $('#playerPopTitle').textContent = side === 'b' ? 'Második játékos' : side === 'a' ? 'Első játékos' : 'Játékos keresése';
      const q = $('#playerPopQ'); q.value = '';
      fillPick();
      $('#playerPop').hidden = false; $('#playerScrim').hidden = false;
      setTimeout(() => q.focus(), 50);
    }
    function closePick() { $('#playerPop').hidden = true; $('#playerScrim').hidden = true; $('#playerPopQ').blur(); }
    function fillPick() {
      const q = norm($('#playerPopQ').value.trim()); const ban = st.pick === 'b' ? st.player : st.pick === 'a' ? st.other : null;
      const list = D().ids.map(R).filter((r) => r.id !== ban && (!q || norm(r.name + ' ' + teamName(r.team) + ' ' + ctx.TEAMS[r.team].name + ' ' + r.pos).indexOf(q) >= 0))
        .sort((a, b) => b.min - a.min).slice(0, 40);
      $('#playerPopList').innerHTML = list.map((r) => '<button type="button" data-player="' + r.id + '">' + crest(r.team) + '<span><b>' + esc(r.name) + '</b><small>' +
        esc(teamName(r.team)) + ' · ' + esc(r.pos || '–') + ' · ' + r.min + ' perc</small></span></button>').join('') || '<p class="hint tight">Nincs találat.</p>';
    }
    $('#playerPopQ').addEventListener('input', fillPick);
    $('#playerScrim').onclick = closePick;
    $('#playerPopList').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-player]');
      if (!b) return;
      const id = b.dataset.player; closePick();
      if (st.pick === 'b') { st.other = id; ctx.store.set('nb1.player2', id); renderPage(2); } else setPlayer(id);
    });

    // ---------- lapozás ----------
    const RENDER = [renderProfil, renderRanglista, renderParhuzam, renderMeccsek];
    function render() {
      const PD = ctx.playerData();
      if (!PD || !PD.players || !Object.keys(PD.players).length) { $('#pp0').innerHTML = '<p class="hint">Nincs játékosstatisztika.</p>'; return; }
      ensure();
      RENDER.forEach((fn, i) => { const el = $('#pp' + i); const top = el.scrollTop; el.innerHTML = fn(); el.scrollTop = top; });
      setPage(st.page, false);
      showSelected();
    }
    // a kiválasztott csapat és játékos látszódjon a vízszintes sorokban
    function showSelected() {
      ['#pp0 .tm-picker', '#pp0 .pl-squad'].forEach((sel) => {
        const row = $(sel); const b = row && row.querySelector('[aria-selected="true"]');
        if (b && (b.offsetLeft < row.scrollLeft || b.offsetLeft + b.offsetWidth > row.scrollLeft + row.clientWidth)) row.scrollLeft = b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2;
      });
    }
    function renderPage(i) { const el = $('#pp' + i); const top = el.scrollTop; el.innerHTML = RENDER[i](); el.scrollTop = top; }
    function keepScroll(sel, fn) { const el = $(sel); const sc = el ? el.scrollLeft : 0; fn(); const el2 = $(sel); if (el2) el2.scrollLeft = sc; }
    function setPage(i, animate) {
      st.page = Math.max(0, Math.min(PAGES.length - 1, i));
      const tr = $('#playerTrack'); const th = $('#playerThumb');
      tr.style.transition = animate === false ? 'none' : ''; th.style.transition = animate === false ? 'none' : '';
      tr.style.transform = 'translateX(' + (-st.page * 25) + '%)';
      th.style.transform = 'translateX(' + (st.page * 100) + '%)';
      document.querySelectorAll('#playerSeg button').forEach((b, k) => b.setAttribute('aria-selected', String(k === st.page)));
      document.querySelectorAll('#playerTrack .tm-pg').forEach((p, k) => { p.setAttribute('aria-hidden', String(k !== st.page)); p.inert = k !== st.page; });
    }

    $('#playerSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-page]'); if (b) setPage(Number(b.dataset.page)); });
    $('#playerPager').addEventListener('click', (e) => {
      if (ctx.swallowed()) return;
      const t = e.target; let b;
      if ((b = t.closest('[data-search]'))) { openPick(null); return; }
      if ((b = t.closest('button[data-squad]'))) { keepScroll('#pp0 .tm-picker', () => { st.squad = Number(b.dataset.squad); renderPage(0); }); return; }
      if ((b = t.closest('.pl-squad button[data-player]'))) { const sc = $('#pp0 .pl-squad').scrollLeft; const pk = $('#pp0 .tm-picker').scrollLeft; setPlayer(b.dataset.player); $('#pp0 .pl-squad').scrollLeft = sc; $('#pp0 .tm-picker').scrollLeft = pk; return; }
      if ((b = t.closest('button[data-lbkey]'))) { keepScroll('#pp1 .tm-chips', () => { st.lb = b.dataset.lbkey; renderPage(1); }); return; }
      if ((b = t.closest('.pl-lb[data-player]'))) { setPlayer(b.dataset.player, 0); return; }
      if ((b = t.closest('button[data-pick]'))) { openPick(b.dataset.pick); return; }
      if ((b = t.closest('button[data-match]'))) { ctx.openMatch(Number(b.dataset.match)); }
    });
    $('#playerPager').addEventListener('change', (e) => {
      const s = e.target.closest('select[data-lb]');
      if (!s) return;
      if (s.dataset.lb === 'mode') st.lbMode = s.value; else if (s.dataset.lb === 'pos') st.lbPos = s.value; else st.lbTeam = s.value;
      keepScroll('#pp1 .tm-chips', () => renderPage(1));
    });

    // oldalra húzás: a lapok az ujjat követik, a fenti kijelölés is vele mozog
    (function swipe() {
      const pager = $('#playerPager'); const tr = $('#playerTrack'); const th = $('#playerThumb');
      let d = null;
      pager.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target.closest('.hscroll, select')) return;
        d = { x: e.clientX, y: e.clientY, t: Date.now(), mode: null, w: pager.clientWidth };
      });
      pager.addEventListener('pointermove', (e) => {
        if (!d) return;
        const dx = e.clientX - d.x; const dy = e.clientY - d.y;
        if (!d.mode) {
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) { d.mode = 'x'; try { pager.setPointerCapture(e.pointerId); } catch (err) { /* nem baj */ } }
          else if (Math.abs(dy) > 10) { d = null; return; }
        }
        if (d.mode === 'x') {
          const edge = (dx > 0 && st.page === 0) || (dx < 0 && st.page === PAGES.length - 1);
          const off = edge ? dx * 0.28 : dx;
          tr.style.transition = 'none'; th.style.transition = 'none';
          tr.style.transform = 'translateX(calc(' + (-st.page * 25) + '% + ' + off + 'px))';
          th.style.transform = 'translateX(' + (Math.max(0, Math.min(PAGES.length - 1, st.page - off / d.w)) * 100) + '%)';
        }
      });
      const end = (e) => {
        if (!d) return;
        if (d.mode === 'x') {
          ctx.swallowClick();
          const dx = e.clientX - d.x; const fast = Date.now() - d.t < 260 && Math.abs(dx) > 30;
          if (dx < -d.w * 0.22 || (fast && dx < 0)) setPage(st.page + 1);
          else if (dx > d.w * 0.22 || (fast && dx > 0)) setPage(st.page - 1);
          else setPage(st.page);
        }
        d = null;
      };
      pager.addEventListener('pointerup', end);
      pager.addEventListener('pointercancel', () => { if (d && d.mode === 'x') setPage(st.page); d = null; });
    })();

    return { render, setPage, closePick, get page() { return st.page; } };
  }

  window.NB1Player = { init, PAGES, M };
})();

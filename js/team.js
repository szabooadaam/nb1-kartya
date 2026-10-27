/* NB1 Kártya – Csapat fül: négy lap (Profil, Rangsor, Párhuzam, Stat), oldalra húzva vagy a fenti gombokkal váltható.
 * Az adatok a csapatstatisztika-csomagból jönnek (Adatcsomag2: window.NB1_TEAMDATA vagy egy betöltött csomag),
 * a helyezés és a forma a meccsadatokból (ugyanúgy, mint a Tabella fülön).
 * Használat: const T = NB1Team.init(ctx); T.render();  – a ctx-et az app.js adja (lásd ott).
 */
(function () {
  'use strict';

  // ---------- a 120 szezonmutató, csoportosítva ----------
  // k: kulcs (darabszám: összesen + meccsenként), avg: már átlag (pct: százalék), ratio: [sikeres, összes, százalék-kulcs], low: a kevesebb a jobb
  const GROUPS = [
    { id: 'att', name: 'Támadás', rows: [
      { l: 'Lőtt gól', k: 'goalsScored' }, { l: 'Várható gól (xG)', k: 'expectedGoals', d: 1 }, { l: 'Gólpassz', k: 'assists' },
      { l: 'Lövés', k: 'shots' }, { l: 'Kaput eltaláló lövés', k: 'shotsOnTarget' }, { l: 'Kaput elkerülő lövés', k: 'shotsOffTarget' },
      { l: 'Blokkolt lövés', k: 'blockedScoringAttempt' }, { l: 'Lövés a 16-oson belülről', k: 'shotsFromInsideTheBox' },
      { l: 'Lövés a 16-oson kívülről', k: 'shotsFromOutsideTheBox' }, { l: 'Gól a 16-oson belülről', k: 'goalsFromInsideTheBox' },
      { l: 'Gól a 16-oson kívülről', k: 'goalsFromOutsideTheBox' }, { l: 'Fejes gól', k: 'headedGoals' }, { l: 'Bal lábas gól', k: 'leftFootGoals' },
      { l: 'Jobb lábas gól', k: 'rightFootGoals' }, { l: 'Nagy helyzet', k: 'bigChances' }, { l: 'Kialakított nagy helyzet', k: 'bigChancesCreated' },
      { l: 'Kihagyott nagy helyzet', k: 'bigChancesMissed' }, { l: 'Kapufa, léc', k: 'hitWoodwork' },
      { l: 'Büntetőgól / büntető', ratio: ['penaltyGoals', 'penaltiesTaken'] }, { l: 'Szabadrúgásgól / lövés', ratio: ['freeKickGoals', 'freeKickShots'] },
      { l: 'Kontratámadás', k: 'fastBreaks' }, { l: 'Lövés kontrából', k: 'fastBreakShots' }, { l: 'Gól kontrából', k: 'fastBreakGoals' },
      { l: 'Sikeres csel', ratio: ['successfulDribbles', 'dribbleAttempts'] }, { l: 'Kulcspassz', k: 'keyPasses' }, { l: 'Szöglet', k: 'corners' },
      { l: 'Les', k: 'offsides' }, { l: 'Labdaérintés', k: 'touches' },
    ] },
    { id: 'pass', name: 'Passzok', rows: [
      { l: 'Labdabirtoklás', avg: 'averageBallPossession', pct: true },
      { l: 'Pontos passz', ratio: ['accuratePasses', 'totalPasses', 'accuratePassesPercentage'] },
      { l: 'Pontos passz a saját térfélen', ratio: ['accurateOwnHalfPasses', 'totalOwnHalfPasses', 'accurateOwnHalfPassesPercentage'] },
      { l: 'Pontos passz az ellenfél térfelén', ratio: ['accurateOppositionHalfPasses', 'totalOppositionHalfPasses', 'accurateOppositionHalfPassesPercentage'] },
      { l: 'Pontos hosszú labda', ratio: ['accurateLongBalls', 'totalLongBalls', 'accurateLongBallsPercentage'] },
      { l: 'Pontos beadás', ratio: ['accurateCrosses', 'totalCrosses', 'accurateCrossesPercentage'] },
    ] },
    { id: 'def', name: 'Védekezés', rows: [
      { l: 'Kapott gól', k: 'goalsConceded', low: true }, { l: 'Kapott gól nélküli meccs', k: 'cleanSheets', noPer: true },
      { l: 'Szerelés', k: 'tackles' }, { l: 'Elfogott passz', k: 'interceptions' }, { l: 'Felszabadítás', k: 'clearances' },
      { l: 'Mentés a gólvonalról', k: 'clearancesOffLine' }, { l: 'Szerelés utolsó emberként', k: 'lastManTackles' },
      { l: 'Visszaszerzett labda', k: 'ballRecovery' }, { l: 'Védekező közreműködés', k: 'defensiveContributions' }, { l: 'Kapusvédés', k: 'saves' },
      { l: 'Hiba, amiből lövés lett', k: 'errorsLeadingToShot', low: true }, { l: 'Hiba, amiből gól lett', k: 'errorsLeadingToGoal', low: true },
      { l: 'Okozott büntető', k: 'penaltiesCommited', low: true }, { l: 'Kapott gól büntetőből', k: 'penaltyGoalsConceded', low: true },
      { l: 'Öngól', k: 'ownGoals', low: true },
    ] },
    { id: 'duel', name: 'Párharcok', rows: [
      { l: 'Megnyert párharc', ratio: ['duelsWon', 'totalDuels', 'duelsWonPercentage'] },
      { l: 'Megnyert földi párharc', ratio: ['groundDuelsWon', 'totalGroundDuels', 'groundDuelsWonPercentage'] },
      { l: 'Megnyert légi párharc', ratio: ['aerialDuelsWon', 'totalAerialDuels', 'aerialDuelsWonPercentage'] },
      { l: 'Labdavesztés', k: 'possessionLost', low: true },
    ] },
    { id: 'disc', name: 'Fegyelem', rows: [
      { l: 'Szabálytalanság', k: 'fouls', low: true }, { l: 'Sárga lap', k: 'yellowCards', low: true },
      { l: 'Kiállítás két sárgával', k: 'yellowRedCards', low: true }, { l: 'Piros lap', k: 'redCards', low: true },
    ] },
    { id: 'opp', name: 'Ellenfelek ellene', rows: [
      { l: 'Lövés', k: 'shotsAgainst', low: true }, { l: 'Kaput eltaláló lövés', k: 'shotsOnTargetAgainst', low: true },
      { l: 'Kaput elkerülő lövés', k: 'shotsOffTargetAgainst' }, { l: 'Blokkolt lövés', k: 'blockedScoringAttemptAgainst' },
      { l: 'Blokkolt lövés (másik számlálás)', k: 'shotsBlockedAgainst' },
      { l: 'Lövés a 16-oson belülről', k: 'shotsFromInsideTheBoxAgainst', low: true }, { l: 'Lövés a 16-oson kívülről', k: 'shotsFromOutsideTheBoxAgainst' },
      { l: 'Nagy helyzet', k: 'bigChancesAgainst', low: true }, { l: 'Kialakított nagy helyzet', k: 'bigChancesCreatedAgainst', low: true },
      { l: 'Kihagyott nagy helyzet', k: 'bigChancesMissedAgainst' }, { l: 'Kapufa, léc', k: 'hitWoodworkAgainst' },
      { l: 'Kulcspassz', k: 'keyPassesAgainst', low: true }, { l: 'Szöglet', k: 'cornersAgainst', low: true }, { l: 'Les', k: 'offsidesAgainst' },
      { l: 'Pontos passz', ratio: ['accuratePassesAgainst', 'totalPassesAgainst'] },
      { l: 'Pontos passz a saját térfelükön', ratio: ['accurateOwnHalfPassesAgainst', 'ownHalfPassesTotalAgainst'] },
      { l: 'Pontos passz a csapat térfelén', ratio: ['accurateOppositionHalfPassesAgainst', 'oppositionHalfPassesTotalAgainst'] },
      { l: 'Pontos passz az utolsó harmadban', ratio: ['accurateFinalThirdPassesAgainst', 'totalFinalThirdPassesAgainst'] },
      { l: 'Pontos hosszú labda', ratio: ['longBallsSuccessfulAgainst', 'longBallsTotalAgainst'] },
      { l: 'Pontos beadás', ratio: ['crossesSuccessfulAgainst', 'crossesTotalAgainst'] },
      { l: 'Sikeres csel', ratio: ['dribbleAttemptsWonAgainst', 'dribbleAttemptsTotalAgainst'] },
      { l: 'Szerelés', k: 'tacklesAgainst' }, { l: 'Elfogott passz', k: 'interceptionsAgainst' }, { l: 'Felszabadítás', k: 'clearancesAgainst' },
      { l: 'Hiba, amiből lövés lett', k: 'errorsLeadingToShotAgainst' }, { l: 'Hiba, amiből gól lett', k: 'errorsLeadingToGoalAgainst' },
      { l: 'Sárga lap', k: 'yellowCardsAgainst' }, { l: 'Piros lap', k: 'redCardsAgainst' },
    ] },
    { id: 'misc', name: 'Egyéb', rows: [
      { l: 'Átlagos értékelés', avg: 'avgRating', d: 2 }, { l: 'Bedobás', k: 'throwIns' }, { l: 'Kirúgás', k: 'goalKicks' },
      { l: 'Szabadrúgás', k: 'freeKicks' },
      { l: 'Lefutott táv (km)', k: 'kilometersCovered', per: 'kilometersCoveredPerGame', d: 1 },
      { l: 'Sprint', k: 'numberOfSprints', per: 'numberOfSprintsPerGame' },
    ] },
  ];
  // (a 'matches' mező a csapatlap fejlécében szerepel)

  // ---------- mutatók a rangsorhoz, a ranglistához és az összevetéshez ----------
  // v(o): az érték egy csapat szezonösszesítőjéből; d: tizedesek; u: mértékegység; low: a kevesebb a jobb; tot: összesítve is mutatható
  const per = (k) => (o) => o[k] / o.matches;
  const M = {
    goals: { l: 'Gól / meccs', s: 'Gól', v: per('goalsScored'), d: 2, tot: 'goalsScored' },
    xg: { l: 'Várható gól (xG) / meccs', s: 'xG', v: per('expectedGoals'), d: 2, tot: 'expectedGoals' },
    shots: { l: 'Lövés / meccs', s: 'Lövés', v: per('shots'), d: 1, tot: 'shots' },
    sot: { l: 'Kaput eltaláló lövés / meccs', s: 'Kapura', v: per('shotsOnTarget'), d: 1, tot: 'shotsOnTarget' },
    big: { l: 'Nagy helyzet / meccs', s: 'Nagy helyzet', v: per('bigChances'), d: 1, tot: 'bigChances' },
    drib: { l: 'Sikeres csel / meccs', s: 'Csel', v: per('successfulDribbles'), d: 1, tot: 'successfulDribbles' },
    corners: { l: 'Szöglet / meccs', s: 'Szöglet', v: per('corners'), d: 1, tot: 'corners' },
    keyp: { l: 'Kulcspassz / meccs', s: 'Kulcspassz', v: per('keyPasses'), d: 1, tot: 'keyPasses' },
    poss: { l: 'Labdabirtoklás', s: 'Labdabirtoklás', v: (o) => o.averageBallPossession, d: 1, u: '%' },
    passp: { l: 'Pontos passz', s: 'Passz %', v: (o) => o.accuratePassesPercentage, d: 1, u: '%' },
    passes: { l: 'Pontos passz / meccs', s: 'Passz', v: per('accuratePasses'), d: 0, tot: 'accuratePasses' },
    opph: { l: 'Pontos passz az ellenfél térfelén', s: 'Passz elöl', v: (o) => o.accurateOppositionHalfPassesPercentage, d: 1, u: '%' },
    longb: { l: 'Pontos hosszú labda', s: 'Hosszú labda', v: (o) => o.accurateLongBallsPercentage, d: 1, u: '%' },
    cross: { l: 'Pontos beadás', s: 'Beadás', v: (o) => o.accurateCrossesPercentage, d: 1, u: '%' },
    conc: { l: 'Kapott gól / meccs', s: 'Kapott gól', v: per('goalsConceded'), d: 2, low: true, tot: 'goalsConceded' },
    clean: { l: 'Kapott gól nélküli meccs', s: 'Kapott gól nélkül', v: (o) => o.cleanSheets, d: 0 },
    tack: { l: 'Szerelés / meccs', s: 'Szerelés', v: per('tackles'), d: 1, tot: 'tackles' },
    inter: { l: 'Elfogott passz / meccs', s: 'Elfogott passz', v: per('interceptions'), d: 1, tot: 'interceptions' },
    clear: { l: 'Felszabadítás / meccs', s: 'Felszabadítás', v: per('clearances'), d: 1, tot: 'clearances' },
    recov: { l: 'Visszaszerzett labda / meccs', s: 'Labdaszerzés', v: per('ballRecovery'), d: 1, tot: 'ballRecovery' },
    saves: { l: 'Kapusvédés / meccs', s: 'Védés', v: per('saves'), d: 1, tot: 'saves' },
    shAg: { l: 'Engedett lövés / meccs', s: 'Engedett lövés', v: per('shotsAgainst'), d: 1, low: true, tot: 'shotsAgainst' },
    bigAg: { l: 'Engedett nagy helyzet / meccs', s: 'Engedett helyzet', v: per('bigChancesAgainst'), d: 1, low: true, tot: 'bigChancesAgainst' },
    errs: { l: 'Hiba, amiből lövés lett', s: 'Hiba', v: (o) => o.errorsLeadingToShot, d: 0, low: true },
    duels: { l: 'Megnyert párharc', s: 'Párharc %', v: (o) => o.duelsWonPercentage, d: 1, u: '%' },
    ground: { l: 'Megnyert földi párharc', s: 'Földi párharc', v: (o) => o.groundDuelsWonPercentage, d: 1, u: '%' },
    aerial: { l: 'Megnyert légi párharc', s: 'Légi párharc', v: (o) => o.aerialDuelsWonPercentage, d: 1, u: '%' },
    duelsN: { l: 'Megnyert párharc / meccs', s: 'Párharc', v: per('duelsWon'), d: 1, tot: 'duelsWon' },
    lost: { l: 'Labdavesztés / meccs', s: 'Labdavesztés', v: per('possessionLost'), d: 1, low: true, tot: 'possessionLost' },
    fouls: { l: 'Szabálytalanság / meccs', s: 'Szabálytalanság', v: per('fouls'), d: 1, low: true, tot: 'fouls' },
    yellow: { l: 'Sárga lap / meccs', s: 'Sárga lap', v: per('yellowCards'), d: 2, low: true, tot: 'yellowCards' },
    red: { l: 'Kiállítás (piros + két sárga)', s: 'Kiállítás', v: (o) => o.redCards + o.yellowRedCards, d: 0, low: true },
    pens: { l: 'Okozott büntető', s: 'Okozott 11-es', v: (o) => o.penaltiesCommited, d: 0, low: true },
    rating: { l: 'Átlagos értékelés', s: 'Értékelés', v: (o) => o.avgRating, d: 2 },
    km: { l: 'Lefutott táv / meccs (km)', s: 'Lefutott táv', v: (o) => o.kilometersCoveredPerGame, d: 1 },
    sprint: { l: 'Sprint / meccs', s: 'Sprint', v: (o) => o.numberOfSprintsPerGame, d: 0 },
  };
  const RANK_CATS = [
    { name: 'Támadás', keys: ['goals', 'xg', 'shots', 'sot', 'big', 'drib', 'corners', 'keyp'] },
    { name: 'Passzok', keys: ['poss', 'passp', 'passes', 'opph', 'longb', 'cross'] },
    { name: 'Védekezés', keys: ['conc', 'clean', 'tack', 'inter', 'clear', 'recov', 'saves', 'shAg', 'bigAg', 'errs'] },
    { name: 'Párharcok', keys: ['duels', 'ground', 'aerial', 'duelsN', 'lost'] },
    { name: 'Fegyelem', keys: ['fouls', 'yellow', 'red', 'pens'] },
    { name: 'Egyéb', keys: ['rating', 'km', 'sprint'] },
  ];
  const STAT_KEYS = ['goals', 'xg', 'shots', 'sot', 'big', 'corners', 'poss', 'passp', 'conc', 'clean', 'tack', 'duels', 'fouls', 'yellow', 'rating', 'km'];
  const CMP_KEYS = ['goals', 'xg', 'shots', 'sot', 'big', 'poss', 'passp', 'corners', 'conc', 'shAg', 'tack', 'duels', 'fouls', 'yellow'];
  const RADAR = [
    ['Gólerő', (o) => o.goalsScored / o.matches], ['Lövések', (o) => o.shots / o.matches], ['Passzjáték', (o) => o.accuratePassesPercentage],
    ['Labdabirtoklás', (o) => o.averageBallPossession], ['Párharcok', (o) => o.duelsWonPercentage], ['Védekezés', (o) => -o.goalsConceded / o.matches],
  ];
  const PAGES = ['Profil', 'Rangsor', 'Párhuzam', 'Stat'];

  const fmt = (v, d) => (v == null || !isFinite(v)) ? '–' : Number(v).toFixed(d == null ? 0 : d).replace('.', ',').replace('-', '−');

  function init(ctx) {
    const $ = (s) => document.querySelector(s);
    const esc = ctx.esc;
    const st = {
      page: 0,
      team: Number(ctx.store.get('nb1.team')) || null,
      other: null,
      cat: 0,
      stat: 'xg',
      total: false,   // Stat lap: összesítve (true) vagy meccsenként
      pick: null,     // Párhuzam: melyik oldal csapatát választjuk ('a' / 'b')
    };
    const TD = () => ctx.teamData();
    const O = (id) => TD().overall[String(id)];
    const ids = () => Object.keys(TD().overall).map(Number).filter((id) => ctx.TEAMS[id]);
    const name = (id) => ctx.short(id);
    const crest = (id, cls) => ctx.badge(ctx.TEAMS[id], cls);
    const table = () => ctx.table('total');
    const posOf = (id) => table().findIndex((r) => r.team.id === id) + 1;
    const rowOf = (kind, id) => ctx.table(kind).find((r) => r.team.id === id);
    function rank(id, f, low) {
      const v = ids().map((i) => [i, f(O(i))]).sort((a, b) => low ? a[1] - b[1] : b[1] - a[1]);
      const mine = f(O(id));
      return v.filter((x) => (low ? x[1] < mine : x[1] > mine)).length + 1;   // holtversenyben azonos helyezés
    }
    const avg = (f) => { const a = ids().map((i) => f(O(i))); return a.reduce((s, x) => s + x, 0) / a.length; };
    const tier = (r, n) => (r <= 3 ? 'g' : r > n - 3 ? 'r' : 'm');
    function ensureTeams() {
      const all = ids();
      if (!all.includes(st.team)) st.team = (table()[0] && table()[0].team.id) || all[0];
      if (!all.includes(st.other) || st.other === st.team) {
        const t = table().map((r) => r.team.id).filter((i) => i !== st.team && all.includes(i));
        st.other = t[0];
      }
    }
    function form(id) {
      return ctx.MATCHES.filter((m) => m.status === 'finished' && m.hs != null && (m.h.id === id || m.a.id === id))
        .sort((a, b) => b.ts - a.ts).slice(0, 5).reverse().map((m) => {
          const home = m.h.id === id; const f = home ? m.hs : m.as; const a = home ? m.as : m.hs;
          const c = f > a ? 'W' : f === a ? 'D' : 'L';
          return '<i class="' + c + '" title="' + esc(m.h.name + ' ' + m.hs + '–' + m.as + ' ' + m.a.name) + '">' + { W: 'GY', D: 'D', L: 'V' }[c] + '</i>';
        }).join('');
    }
    const picker = () => '<div class="tm-picker hscroll" role="listbox" aria-label="Csapat kiválasztása">' + table().filter((r) => O(r.team.id)).map((r) =>
      '<button type="button" role="option" data-team="' + r.team.id + '" aria-selected="' + (r.team.id === st.team) + '" aria-label="' + esc(r.team.name) + '">' + crest(r.team.id) + '</button>').join('') + '</div>';

    // ---------- 1. Profil ----------
    function rowHTML(o, r) {
      let v; let s = '';
      if (r.ratio) {
        const a = o[r.ratio[0]]; const b = o[r.ratio[1]];
        v = fmt(a) + ' / ' + fmt(b);
        const p = r.ratio[2] ? o[r.ratio[2]] : (b ? 100 * a / b : null);
        s = b ? fmt(p, 1) + '%' : '';
      } else if (r.avg) {
        v = fmt(o[r.avg], r.d != null ? r.d : 1) + (r.pct ? '%' : '');
      } else {
        v = fmt(o[r.k], r.d && !Number.isInteger(o[r.k]) ? r.d : 0);
        if (!r.noPer) s = fmt(r.per ? o[r.per] : o[r.k] / o.matches, r.per && r.k === 'numberOfSprints' ? 0 : 1);
      }
      return '<div class="tm-row"><span class="k">' + esc(r.l) + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>';
    }
    function haRows(id) {
      const sp = (TD().split || {})[String(id)] || {};
      const h = rowOf('home', id); const a = rowOf('away', id);
      const pm = (side, k, d) => { const x = sp[side] && sp[side].for && sp[side].for[k]; return x && x.perMatch != null ? fmt(x.perMatch, d) : '–'; };
      const pp = (side, k) => { const x = sp[side] && sp[side].for && sp[side].for[k]; return x && x.avgPct != null ? fmt(x.avgPct, 1) + '%' : '–'; };
      const acc = (side) => { const f = sp[side] && sp[side].for; return f && f.accuratePasses && f.passes && f.passes.sum ? fmt(100 * f.accuratePasses.sum / f.passes.sum, 1) + '%' : '–'; };
      const line = (l, x, y) => '<div class="tm-ha"><span class="k">' + l + '</span><span>' + x + '</span><span>' + y + '</span></div>';
      return '<div class="tm-ha tm-ha-head"><span></span><span>Hazai</span><span>Vendég</span></div>' +
        line('Meccs', h ? h.mp : '–', a ? a.mp : '–') +
        line('Gy – D – V', h ? h.w + ' – ' + h.d + ' – ' + h.l : '–', a ? a.w + ' – ' + a.d + ' – ' + a.l : '–') +
        line('Gólok', h ? h.gf + ':' + h.ga : '–', a ? a.gf + ':' + a.ga : '–') +
        line('Pont', h ? h.pts : '–', a ? a.pts : '–') +
        line('Labdabirtoklás', pp('home', 'ballPossession'), pp('away', 'ballPossession')) +
        line('Lövés / meccs', pm('home', 'totalShotsOnGoal', 1), pm('away', 'totalShotsOnGoal', 1)) +
        line('xG / meccs', pm('home', 'expectedGoals', 2), pm('away', 'expectedGoals', 2)) +
        line('Szöglet / meccs', pm('home', 'cornerKicks', 1), pm('away', 'cornerKicks', 1)) +
        line('Pontos passz', acc('home'), acc('away'));
    }
    function renderProfil() {
      const id = st.team; const o = O(id); const t = ctx.TEAMS[id]; const n = ids().length;
      const tile = (key) => {
        const m = M[key]; const r = rank(id, m.v, m.low);
        return '<div class="tm-tile"><em class="tm-rk ' + tier(r, n) + '">' + r + '.</em><b>' + fmt(m.v(o), m.d) + (m.u || '') + '</b><span>' + esc(m.l.charAt(0).toLowerCase() + m.l.slice(1)) + '</span></div>';
      };
      const tr = table().find((r) => r.team.id === id);
      return picker() +
        '<div class="group tm-hero">' + crest(id, 'tm-hero-badge') + '<div class="tm-hero-txt"><h2>' + esc(t.name) + '</h2>' +
        '<p>' + posOf(id) + '. hely · ' + (tr ? tr.pts : 0) + ' pont · ' + o.matches + ' meccs</p><div class="tm-form">' + form(id) + '</div></div></div>' +
        '<div class="tm-tiles">' + tile('goals') + tile('conc') + tile('poss') + tile('xg') + '</div>' +
        '<div class="tm-ghead"><span>HAZAI / VENDÉG</span></div><div class="group tm-ha-box">' + haRows(id) + '</div>' +
        GROUPS.map((g) => '<div class="tm-ghead"><span>' + esc(g.name.toUpperCase()) + '</span><span>' + (g.id === 'pass' || g.id === 'duel' ? 'arány' : 'meccsenként') + '</span></div>' +
          '<div class="group">' + g.rows.map((r) => rowHTML(o, r)).join('') + '</div>').join('') +
        '<p class="hint tm-note">Forrás: ' + esc(ctx.teamSource()) + ' (' + esc((TD().rounds || []).join('–')) + '. forduló).</p>';
    }

    // ---------- 2. Rangsor ----------
    function renderRangsor() {
      const id = st.team; const n = ids().length;
      const card = (key) => {
        const m = M[key]; const vals = ids().map((i) => m.v(O(i)));
        const mn = Math.min(...vals); const mx = Math.max(...vals); const v = m.v(O(id)); const r = rank(id, m.v, m.low); const a = avg(m.v);
        // a sáv mindig a „jobb” irányba nő: ahol a kevesebb a jobb, ott fordítva
        const pos = (x) => 4 + 96 * (m.low ? (mx - x) : (x - mn)) / ((mx - mn) || 1);
        return '<div class="tm-rk-row"><div class="tm-rk-top"><span class="k">' + esc(m.l) + '</span><span class="v">' + fmt(v, m.d) + (m.u || '') + '</span>' +
          '<span class="tm-rk ' + tier(r, n) + '">' + r + '.</span></div>' +
          '<div class="tm-track"><span class="fill ' + tier(r, n) + '" style="width:' + pos(v).toFixed(1) + '%"></span><span class="avg" style="left:' + pos(a).toFixed(1) + '%"></span></div>' +
          '<div class="tm-scale"><span>' + fmt(m.low ? mx : mn, m.d) + '</span><span>liga átlag ' + fmt(a, m.d) + '</span><span>' + fmt(m.low ? mn : mx, m.d) + '</span></div></div>';
      };
      return picker() +
        '<div class="tm-chips hscroll" role="tablist">' + RANK_CATS.map((c, i) => '<button type="button" data-cat="' + i + '" aria-selected="' + (i === st.cat) + '">' + c.name + '</button>').join('') + '</div>' +
        '<div class="group">' + RANK_CATS[st.cat].keys.map(card).join('') + '</div>' +
        '<p class="hint tm-note">A szám a csapat helyezése a 12 csapat között. A sáv bal széle a liga leggyengébb, jobb széle a legjobb értéke; a kis jel a liga átlaga.</p>';
    }

    // ---------- 3. Párhuzam ----------
    function renderParhuzam() {
      const A = st.team; const B = st.other; const oa = O(A); const ob = O(B);
      const col = ctx.pairColors(ctx.TEAMS[A], ctx.TEAMS[B]);
      const norm = (f, o) => { const v = ids().map((i) => f(O(i))); const mn = Math.min(...v); const mx = Math.max(...v); return 0.18 + 0.82 * (f(o) - mn) / ((mx - mn) || 1); };
      const R = 84; const cx = 150; const cy = 112; const n = RADAR.length;
      const pt = (k, r) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
      const poly = (vals) => vals.map((v, k) => pt(k, v * R).map((x) => x.toFixed(1)).join(',')).join(' ');
      let svg = '<svg class="tm-radar" viewBox="0 0 300 228" role="img" aria-label="Stílusprofil: ' + esc(name(A)) + ' és ' + esc(name(B)) + '">';
      [0.25, 0.5, 0.75, 1].forEach((g) => { svg += '<polygon points="' + poly(RADAR.map(() => g)) + '" fill="none" stroke="var(--line)"/>'; });
      RADAR.forEach((d, k) => {
        const [x, y] = pt(k, R); const [lx, ly] = pt(k, R + 18);
        svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="var(--line)"/>' +
          '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle">' + d[0] + '</text>';
      });
      svg += '<polygon points="' + poly(RADAR.map((d) => norm(d[1], ob))) + '" fill="' + col.b + '" fill-opacity=".16" stroke="' + col.b + '" stroke-width="2" stroke-linejoin="round"/>';
      svg += '<polygon points="' + poly(RADAR.map((d) => norm(d[1], oa))) + '" fill="' + col.a + '" fill-opacity=".22" stroke="' + col.a + '" stroke-width="2" stroke-linejoin="round"/></svg>';
      const cmp = (key) => {
        const m = M[key]; const a = m.v(oa); const b = m.v(ob); const mx = Math.max(a, b) || 1;
        const aw = m.low ? a <= b : a >= b; const bw = m.low ? b <= a : b >= a;
        return '<div class="tm-cmp"><div class="tm-cmp-top"><b>' + fmt(a, m.d) + (m.u || '') + '</b><span>' + esc(m.l.replace(' / meccs', '')) + '</span><b>' + fmt(b, m.d) + (m.u || '') + '</b></div>' +
          '<div class="bars"><span><i style="width:' + (100 * a / mx).toFixed(1) + '%;background:' + (aw ? col.a : 'var(--fg2)') + '"></i></span>' +
          '<span><i style="width:' + (100 * b / mx).toFixed(1) + '%;background:' + (bw ? col.b : 'var(--fg2)') + '"></i></span></div></div>';
      };
      const ta = table().find((r) => r.team.id === A); const tb = table().find((r) => r.team.id === B);
      return '<div class="group tm-vs"><button type="button" class="t" data-pick="a">' + crest(A) + '<span>' + esc(name(A)) + '</span></button><span class="x">vs</span>' +
        '<button type="button" class="t" data-pick="b"><span>' + esc(name(B)) + '</span>' + crest(B) + '</button></div>' +
        '<div class="group"><div class="tm-radar-box">' + svg + '</div><div class="tm-legend"><span><i style="background:' + col.a + '"></i>' + esc(name(A)) + '</span><span><i style="background:' + col.b + '"></i>' + esc(name(B)) + '</span></div></div>' +
        '<div class="group">' +
          '<div class="tm-cmp"><div class="tm-cmp-top"><b>' + posOf(A) + '.</b><span>Helyezés</span><b>' + posOf(B) + '.</b></div></div>' +
          '<div class="tm-cmp"><div class="tm-cmp-top"><b>' + (ta ? ta.pts : 0) + '</b><span>Pont</span><b>' + (tb ? tb.pts : 0) + '</b></div></div>' +
          CMP_KEYS.map(cmp).join('') + '</div>' +
        '<p class="hint tm-note">Meccsenkénti átlagok. A csapatot a nevére koppintva cserélheted. A radar a liga legjobb és leggyengébb értékéhez méri a két csapatot.</p>';
    }

    // ---------- 4. Stat ----------
    function renderStat() {
      const m = M[st.stat]; const canTot = !!m.tot; const total = canTot && st.total;
      const f = total ? (o) => o[m.tot] : m.v; const d = total ? (m.tot === 'expectedGoals' ? 1 : 0) : m.d;
      const list = ids().sort((a, b) => (m.low ? f(O(a)) - f(O(b)) : f(O(b)) - f(O(a))));
      const mx = Math.max(...list.map((i) => f(O(i)))) || 1; const av = avg(f);
      let html = ''; let done = false;
      list.forEach((id, k) => {
        const v = f(O(id));
        if (!done && (m.low ? v > av : v < av)) { html += '<div class="tm-avgline"><span>liga átlag ' + fmt(av, d) + (m.u || '') + '</span></div>'; done = true; }
        const r = k === 0 || f(O(list[k - 1])) !== v ? k + 1 : null;
        html += '<button type="button" class="tm-lb' + (id === st.team ? ' me' : '') + '" data-team="' + id + '"><span class="n">' + (r || '') + '</span>' + crest(id) +
          '<span class="nm"><span>' + esc(name(id)) + '</span><i style="width:' + Math.max(2, 100 * v / mx).toFixed(1) + '%"></i></span><span class="val">' + fmt(v, d) + (m.u || '') + '</span></button>';
      });
      const label = total ? m.l.replace(' / meccs', ' (összesen)') : m.l;
      return '<div class="tm-chips hscroll" role="tablist">' + STAT_KEYS.map((k) => '<button type="button" data-stat="' + k + '" aria-selected="' + (k === st.stat) + '">' + M[k].s + '</button>').join('') + '</div>' +
        '<div class="group tm-statsel"><b>' + esc(label) + '</b>' + (canTot ? '<button type="button" id="tmTotal">' + (total ? 'Összesen' : 'Meccsenként') + ' ▾</button>' : '') + '</div>' +
        '<div class="group tm-lb-box">' + html + '</div>' +
        (m.low ? '<p class="hint tm-note">Ennél a mutatónál a kevesebb a jobb, ezért a legkisebb érték áll elöl.</p>' : '');
    }

    // ---------- lapozás ----------
    const RENDER = [renderProfil, renderRangsor, renderParhuzam, renderStat];
    function render() {
      if (!TD() || !TD().overall) { $('#tp0').innerHTML = '<p class="hint">Nincs csapatstatisztika. Tölts be egy csapatstatisztika-csomagot a Beállítások › Adatok résznél.</p>'; return; }
      ensureTeams();
      RENDER.forEach((fn, i) => { const el = $('#tp' + i); const top = el.scrollTop; el.innerHTML = fn(); el.scrollTop = top; });
      setPage(st.page, false);
    }
    function renderPage(i) { const el = $('#tp' + i); const top = el.scrollTop; el.innerHTML = RENDER[i](); el.scrollTop = top; }
    function setPage(i, animate) {
      st.page = Math.max(0, Math.min(PAGES.length - 1, i));
      const tr = $('#teamTrack'); const th = $('#teamThumb');
      tr.style.transition = animate === false ? 'none' : ''; th.style.transition = animate === false ? 'none' : '';
      tr.style.transform = 'translateX(' + (-st.page * 25) + '%)';
      th.style.transform = 'translateX(' + (st.page * 100) + '%)';
      document.querySelectorAll('#teamSeg button').forEach((b, k) => b.setAttribute('aria-selected', String(k === st.page)));
      document.querySelectorAll('.tm-pg').forEach((p, k) => { p.setAttribute('aria-hidden', String(k !== st.page)); p.inert = k !== st.page; });
    }
    function setTeam(id) { st.team = id; ctx.store.set('nb1.team', String(id)); if (st.other === id) st.other = null; render(); }

    // gombok és koppintások (eseménydelegálás: a lapok tartalma újrarajzolódik)
    $('#teamSeg').addEventListener('click', (e) => { const b = e.target.closest('button[data-page]'); if (b) setPage(Number(b.dataset.page)); });
    $('#teamPager').addEventListener('click', (e) => {
      if (ctx.swallowed()) return;
      const t = e.target;
      let b;
      if ((b = t.closest('.tm-picker button[data-team]'))) { const sc = b.parentElement.scrollLeft; setTeam(Number(b.dataset.team)); document.querySelectorAll('.tm-picker').forEach((p) => { p.scrollLeft = sc; }); return; }
      if ((b = t.closest('button[data-cat]'))) { const sc = b.parentElement.scrollLeft; st.cat = Number(b.dataset.cat); renderPage(1); $('#tp1 .tm-chips').scrollLeft = sc; return; }
      if ((b = t.closest('button[data-stat]'))) { const sc = b.parentElement.scrollLeft; st.stat = b.dataset.stat; renderPage(3); $('#tp3 .tm-chips').scrollLeft = sc; return; }
      if (t.closest('#tmTotal')) { st.total = !st.total; const sc = $('#tp3 .tm-chips').scrollLeft; renderPage(3); $('#tp3 .tm-chips').scrollLeft = sc; return; }
      if ((b = t.closest('.tm-lb[data-team]'))) { setTeam(Number(b.dataset.team)); return; }
      if ((b = t.closest('button[data-pick]'))) { openPick(b.dataset.pick); }
    });
    // Párhuzam: csapatválasztó
    function openPick(side) {
      st.pick = side;
      const cur = side === 'a' ? st.team : st.other; const ban = side === 'a' ? st.other : st.team;
      $('#teamPopTitle').textContent = side === 'a' ? 'Első csapat' : 'Második csapat';
      $('#teamPopGrid').innerHTML = table().filter((r) => O(r.team.id)).map((r) => '<button type="button" data-team="' + r.team.id + '"' + (r.team.id === cur ? ' aria-current="true"' : '') + (r.team.id === ban ? ' disabled' : '') + '>' +
        crest(r.team.id) + '<span>' + esc(name(r.team.id)) + '</span></button>').join('');
      $('#teamPop').hidden = false; $('#teamScrim').hidden = false;
    }
    function closePick() { $('#teamPop').hidden = true; $('#teamScrim').hidden = true; }
    $('#teamScrim').onclick = closePick;
    $('#teamPopGrid').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-team]');
      if (!b || b.disabled) return;
      const id = Number(b.dataset.team);
      closePick();
      if (st.pick === 'a') setTeam(id); else { st.other = id; renderPage(2); }
    });

    // oldalra húzás: a lapok az ujjat követik, a fenti kijelölés is vele mozog
    (function swipe() {
      const pager = $('#teamPager'); const tr = $('#teamTrack'); const th = $('#teamThumb');
      let d = null;
      pager.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target.closest('.hscroll')) return;   // a vízszintesen görgethető sorok (címerek, kategóriák) maradnak a sajátjuk
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
          const p = Math.max(0, Math.min(PAGES.length - 1, st.page - off / d.w));
          th.style.transform = 'translateX(' + (p * 100) + '%)';
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

    return { render, setPage, get page() { return st.page; }, GROUPS };
  }

  window.NB1Team = { init, GROUPS, PAGES };
})();

/* Az NB I meccsstatisztika mutatóinak katalógusa. Az adatok kizárólag Opta-adatok (eredmenyek.com, 2026.11.02-től):
 * a csapatstatisztika fülről, illetve a játékosstatisztikák meccsenkénti összegéből (Opta/tools: Opta-kutatas/csomagok.py).
 * A kulcsok (key) a korábbi formátum nevei maradtak, hogy a mentett kártyaválasztások megmaradjanak; az en az angol név.
 * A futásadatok (megtett táv, sprintek) és néhány más mutató az Opta-oldalon nem érhető el, ezért kikerültek.
 * A katalógus statikus: a meccs adatlapján az értékek sosem töltődnek be, csak a megnevezések látszanak.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NB1Catalog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const GROUPS = {
    overview: 'Összefoglaló',
    shots: 'Lövések',
    attack: 'Támadás',
    passes: 'Passzolás',
    duels: 'Párharcok',
    defending: 'Védekezés',
    goalkeeping: 'Kapus',
    other: 'Egyéb',
  };

  const ITEMS = [
    { key: 'scorers', label: 'Gólszerzők', en: 'Goals', group: 'other', special: 'scorers' },

    { key: 'ballPossession', label: 'Labdabirtoklás', en: 'Ball possession', group: 'overview' },
    { key: 'expectedGoals', label: 'Várható gól (xG)', en: 'Expected goals', group: 'overview' },
    { key: 'expectedGoalsOnTarget', label: 'Kaput találó xG (xGOT)', en: 'xG on target', group: 'overview' },
    { key: 'expectedAssists', label: 'Várható gólpassz (xA)', en: 'Expected assists', group: 'overview' },
    { key: 'bigChanceCreated', label: 'Nagy helyzetek', en: 'Big chances', group: 'overview' },
    { key: 'totalShotsOnGoal', label: 'Lövések', en: 'Total shots', group: 'overview' },
    { key: 'goalkeeperSaves', label: 'Kapusvédések', en: 'Goalkeeper saves', group: 'overview' },
    { key: 'cornerKicks', label: 'Szögletek', en: 'Corner kicks', group: 'overview' },
    { key: 'fouls', label: 'Szabálytalanságok', en: 'Fouls', group: 'overview' },
    { key: 'passes', label: 'Passzok', en: 'Passes', group: 'overview' },
    { key: 'totalTackle', label: 'Szerelések', en: 'Tackles', group: 'overview' },
    { key: 'freeKicks', label: 'Szabadrúgások', en: 'Free kicks', group: 'overview' },
    { key: 'yellowCards', label: 'Sárga lapok', en: 'Yellow cards', group: 'overview' },
    { key: 'redCards', label: 'Piros lapok', en: 'Red cards', group: 'overview' },
    { key: 'avgRating', label: 'Átlagos értékelés', en: 'Average rating', group: 'overview' },

    { key: 'shotsOnGoal', label: 'Kapura lövések', en: 'Shots on target', group: 'shots' },
    { key: 'shotsOffGoal', label: 'Mellé lövések', en: 'Shots off target', group: 'shots' },
    { key: 'blockedScoringAttempt', label: 'Blokkolt lövések', en: 'Blocked shots', group: 'shots' },
    { key: 'totalShotsInsideBox', label: 'Lövések a 16-oson belülről', en: 'Shots inside box', group: 'shots' },
    { key: 'totalShotsOutsideBox', label: 'Lövések a 16-oson kívülről', en: 'Shots outside box', group: 'shots' },
    { key: 'hitWoodwork', label: 'Kapufa / léc', en: 'Hit woodwork', group: 'shots' },
    { key: 'headedShots', label: 'Fejesek', en: 'Headed shots', group: 'shots' },

    { key: 'bigChanceScored', label: 'Értékesített nagy helyzetek', en: 'Big chances scored', group: 'attack' },
    { key: 'bigChanceMissed', label: 'Kihagyott nagy helyzetek', en: 'Big chances missed', group: 'attack' },
    { key: 'keyPasses', label: 'Kulcspasszok', en: 'Key passes', group: 'attack' },
    { key: 'accurateThroughBall', label: 'Mélységi passzok', en: 'Through balls', group: 'attack' },
    { key: 'touchesInOppBox', label: 'Érintések az ellenfél 16-osán', en: 'Touches in penalty area', group: 'attack' },
    { key: 'touches', label: 'Labdaérintések', en: 'Touches', group: 'attack' },
    { key: 'offsides', label: 'Lesek', en: 'Offsides', group: 'attack' },

    { key: 'accuratePasses', label: 'Pontos passzok', en: 'Accurate passes', group: 'passes' },
    { key: 'throwIns', label: 'Bedobások', en: 'Throw-ins', group: 'passes' },
    { key: 'finalThirdPhaseStatistic', label: 'Passzok a támadó harmadban', en: 'Final third phase', group: 'passes' },
    { key: 'accurateLongBalls', label: 'Pontos hosszú indítások', en: 'Long balls', group: 'passes' },
    { key: 'accurateCross', label: 'Pontos beadások', en: 'Crosses', group: 'passes' },

    { key: 'duelWonPercent', label: 'Megnyert párharcok', en: 'Duels', group: 'duels' },
    { key: 'groundDuelsPercentage', label: 'Földi párharcok', en: 'Ground duels', group: 'duels' },
    { key: 'aerialDuelsPercentage', label: 'Légi párharcok', en: 'Aerial duels', group: 'duels' },
    { key: 'dribblesPercentage', label: 'Sikeres cselek', en: 'Dribbles', group: 'duels' },

    { key: 'wonTacklePercent', label: 'Sikeres szerelések', en: 'Tackles won', group: 'defending' },
    { key: 'interceptionWon', label: 'Labdaszerzések', en: 'Interceptions', group: 'defending' },
    { key: 'totalClearance', label: 'Tisztázások', en: 'Clearances', group: 'defending' },
    { key: 'errorsLeadToShot', label: 'Lövéshez vezető hibák', en: 'Errors lead to a shot', group: 'defending' },
    { key: 'errorsLeadToGoal', label: 'Gólhoz vezető hibák', en: 'Errors lead to a goal', group: 'defending' },

    { key: 'goalsPrevented', label: 'Megelőzött gólok', en: 'Goals prevented', group: 'goalkeeping' },
    { key: 'punches', label: 'Kapus öklözések', en: 'Punches', group: 'goalkeeping' },
    { key: 'goalKicks', label: 'Kapuskirúgások', en: 'Goal kicks', group: 'goalkeeping' },
  ];

  // Az "Alap" választás: amit az Apple Sports-stílusú kártyán alapból mutatunk (sorrend is ez).
  const DEFAULT_SELECTED = [
    'scorers', 'expectedGoals', 'totalShotsOnGoal', 'shotsOnGoal', 'ballPossession',
    'passes', 'accuratePasses', 'fouls', 'cornerKicks',
  ];

  const byKey = {};
  ITEMS.forEach((it) => { byKey[it.key] = it; });

  function defaultOrder() {
    const rest = ITEMS.map((i) => i.key).filter((k) => DEFAULT_SELECTED.indexOf(k) < 0);
    return DEFAULT_SELECTED.concat(rest);
  }

  return { GROUPS, ITEMS, DEFAULT_SELECTED, byKey, defaultOrder };
});

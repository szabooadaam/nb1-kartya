/* A meccskártya rajzolása canvasra (1080 px széles, a magassága a tartalomtól függ, legalább 1350 px).
 * Ugyanazt az elrendezést adja, mint az Electronos program kártyája: Apple Sports-stílus, a két csapat színével.
 *
 * NB1Card.render(canvas, p) -> Promise<{width, height}>
 *   p = {
 *     title, dateText, venue,                       // fejléc
 *     home: {name, code, img}, away: {name, code, img},   // img: betöltött Image vagy null (akkor rövidítés-jelvény)
 *     score: {h, a, label},                         // label pl. "Végeredmény"
 *     colors: {l, r},                               // bal / jobb oldali szín (#rrggbb)
 *     scorers: [{side:'home'|'away', name, minute, kind}] | null,
 *     rows: [{label, home, away, homeValue, awayValue}],   // statisztikasorok a kívánt sorrendben
 *     note                                           // lábjegyzet (pl. xG magyarázat) vagy ''
 *   }
 */
(function (root) {
  'use strict';
  const COL = root.NB1Colors;
  const F = root.NB1Format;

  const W = 1080;
  const MIN_H = 1350;
  const PAD_X = 64;
  const FONT = '"Inter Variable","Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,sans-serif';
  const font = (weight, px) => weight + ' ' + px + 'px ' + FONT;
  // az Inter betűtípus méretei (a CSS sormagasság-számításhoz)
  const ASC = 0.96875;
  const CONTENT = 1.2119;
  const baselineIn = (top, lineH, px) => top + (lineH - CONTENT * px) / 2 + ASC * px;

  // ---------- segédek ----------
  const rgba = (r, g, b, a) => 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  const white = (a) => rgba(255, 255, 255, a);

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // kiegyensúlyozott sortörés (mint a CSS text-wrap: balance): a legkevesebb sor, azon belül a legkeskenyebb leghosszabb sor
  function wrapBalanced(ctx, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    if (ctx.measureText(words.join(' ')).width <= maxW) return [words.join(' ')];
    let best = null;
    for (let n = 2; n <= Math.min(4, words.length) && !best; n++) {
      (function rec(start, left, acc) {
        if (left === 1) {
          const line = words.slice(start).join(' ');
          const lines = acc.concat([line]);
          const mx = Math.max.apply(null, lines.map((l) => ctx.measureText(l).width));
          if (mx <= maxW && (!best || mx < best.mx)) best = { mx, lines };
          return;
        }
        for (let i = start + 1; i <= words.length - (left - 1); i++) rec(i, left - 1, acc.concat([words.slice(start, i).join(' ')]));
      })(0, n, []);
    }
    return best ? best.lines : words;
  }

  // betűköz (letter-spacing) kézzel, hogy minden böngészőben egyformán működjön
  function spacedWidth(ctx, text, sp) { return ctx.measureText(text).width + sp * Math.max(0, text.length - 1); }
  function drawSpaced(ctx, text, cx, y, sp) {
    const w = spacedWidth(ctx, text, sp);
    let x = cx - w / 2;
    ctx.textAlign = 'left';
    for (const ch of text) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + sp; }
  }

  // ---------- háttér ----------
  let noiseTile = null;
  function noise() {
    if (noiseTile) return noiseTile;
    const c = document.createElement('canvas');
    c.width = c.height = 220;
    const x = c.getContext('2d');
    const id = x.createImageData(220, 220);
    let s = 1234567;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.max(0, Math.min(255, 128 + (rnd() + rnd() + rnd() - 1.5) * 150));
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    noiseTile = c;
    return c;
  }
  let dotTile = null;
  function dots() {
    if (dotTile) return dotTile;
    const c = document.createElement('canvas');
    c.width = c.height = 6;
    const x = c.getContext('2d');
    x.fillStyle = white(0.15); x.beginPath(); x.arc(1.5, 1.5, 1, 0, 7); x.fill();
    x.fillStyle = white(0.09); x.beginPath(); x.arc(4.5, 4.5, 1, 0, 7); x.fill();
    dotTile = c;
    return c;
  }

  function background(ctx, H, colors) {
    const l = colors.l; const r = colors.r;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, l); g.addColorStop(0.5, COL.mix(l, r, 0.5)); g.addColorStop(1, r);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const f = ctx.createLinearGradient(0, 0, 0, H);
    f.addColorStop(0, 'rgba(7,8,16,0)'); f.addColorStop(0.3, 'rgba(7,8,16,0.3)'); f.addColorStop(1, 'rgba(7,8,16,0.86)');
    ctx.fillStyle = f; ctx.fillRect(0, 0, W, H);

    // felülről érkező fény (ellipszis)
    ctx.save();
    ctx.translate(W / 2, 0);
    ctx.scale(1, (0.3 * H) / (0.7 * W));
    const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.7 * W);
    lg.addColorStop(0, white(0.17)); lg.addColorStop(0.72, white(0));
    ctx.fillStyle = lg;
    ctx.fillRect(-W / 2, 0, W, H * (0.7 * W) / (0.3 * H));
    ctx.restore();

    // pöttyös textúra, lefelé halványodva
    const t = document.createElement('canvas');
    t.width = W; t.height = H;
    const tx = t.getContext('2d');
    tx.fillStyle = tx.createPattern(dots(), 'repeat'); tx.fillRect(0, 0, W, H);
    tx.globalCompositeOperation = 'destination-in';
    const mg = tx.createLinearGradient(0, 0, 0, H);
    mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(1, 'rgba(0,0,0,0.4)');
    tx.fillStyle = mg; tx.fillRect(0, 0, W, H);
    ctx.drawImage(t, 0, 0);

    // finom szemcézettség
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = ctx.createPattern(noise(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ---------- méretezés ----------
  function measure(ctx, p) {
    const m = { top: 54 };
    m.header = 38 + 8 + 32 + (p.venue ? 8 + 29 : 0);
    ctx.font = font(750, 40);
    m.hLines = wrapBalanced(ctx, p.home.name, 311);
    m.aLines = wrapBalanced(ctx, p.away.name, 311);
    const nameH = Math.max(m.hLines.length, m.aLines.length) * 40 * 1.14;
    m.teams = Math.max(176 + 22 + nameH, 24 + 29 + 4 + 132 * 1.02);
    const left = (p.scorers || []).filter((g) => g.side === 'home').length;
    const right = (p.scorers || []).filter((g) => g.side === 'away').length;
    m.scorerLines = Math.max(left, right);
    m.scorers = m.scorerLines ? m.scorerLines * 28 * 1.38 : 0;
    m.rowH = 42 * 1.1 + 9 + 12;
    m.rowGap = 20;
    const n = p.rows.length;
    m.rowsH = n ? n * m.rowH + (n - 1) * m.rowGap : 0;
    m.panel = n ? 30 + 36 + 24 + m.rowsH + 36 : 0;
    ctx.font = font(400, 22);
    m.noteLines = p.note ? wrapBalanced2(ctx, p.note, 680) : [];
    m.foot = Math.max(m.noteLines.length * 22 * 1.35, 26);
    m.gaps = 22;
    m.bottom = 40;
    let h = m.top + m.header + m.gaps + m.teams;
    if (m.scorers) h += m.gaps + m.scorers;
    if (m.panel) h += m.gaps + m.panel;
    h += m.gaps + m.foot + m.bottom;
    m.natural = h;
    m.H = Math.max(MIN_H, Math.ceil(h));
    return m;
  }
  // a lábjegyzet: szokásos (mohó) sortörés
  function wrapBalanced2(ctx, text, maxW) {
    const words = String(text).split(/\s+/); const lines = []; let cur = '';
    words.forEach((w) => {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------- rajzolás ----------
  function crest(ctx, cx, top, team) {
    const cy = top + 88;
    if (team.img && team.img.width) {
      const s = Math.min(176 / team.img.width, 176 / team.img.height);
      const w = team.img.width * s; const h = team.img.height * s;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 16;
      ctx.drawImage(team.img, cx - w / 2, cy - h / 2, w, h);
      ctx.restore();
      return;
    }
    ctx.beginPath(); ctx.arc(cx, cy, 75, 0, Math.PI * 2);
    ctx.fillStyle = white(0.16); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 73.5, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = white(0.3); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = font(800, 48); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(team.code || '?', cx, baselineIn(cy - 24.2, 48 * 1.21, 48) + 0);
  }

  function drawScorers(ctx, p, y0) {
    const colW = (W - 2 * PAD_X - 54) / 2;
    const leftEdge = PAD_X + colW; const rightEdge = PAD_X + colW + 54;
    const lh = 28 * 1.38;
    let li = 0; let ri = 0;
    p.scorers.forEach((g) => {
      const tag = g.kind === 'penalty' ? '(11-es)' : g.kind === 'own' ? '(öngól)' : '';
      const side = g.side === 'home';
      const top = y0 + (side ? li++ : ri++) * lh;
      const by = baselineIn(top, lh, 28);
      const parts = [];
      const name = { t: g.name, f: font(600, 28), c: white(0.92), m: 0 };
      const min = { t: g.minute, f: font(500, 23), c: white(0.7), m: 0.35 * 23 };
      const tg = tag ? { t: tag, f: font(500, 22), c: white(0.66), m: 0 } : null;
      if (side) { parts.push(name, min); if (tg) parts.push(tg); } else { if (tg) parts.push(tg); parts.push(min, name); }
      let total = 0;
      parts.forEach((q) => { ctx.font = q.f; q.w = ctx.measureText(q.t).width; total += q.w + 2 * q.m; });
      let x = side ? leftEdge - total : rightEdge;
      parts.forEach((q) => {
        ctx.font = q.f; ctx.fillStyle = q.c; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(q.t, x + q.m, by); x += q.w + 2 * q.m;
      });
    });
  }

  function drawPanel(ctx, p, m, y, h, colors) {
    const x = PAD_X; const w = W - 2 * PAD_X;
    // háttér + külső árnyék
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
    rrect(ctx, x, y, w, h, 48); ctx.fillStyle = 'rgba(10,10,20,0.36)'; ctx.fill();
    ctx.restore();
    rrect(ctx, x, y, w, h, 48); ctx.fillStyle = 'rgba(10,10,20,0.36)'; ctx.fill();
    // belső keret és felső fény
    ctx.save();
    rrect(ctx, x, y, w, h, 48); ctx.clip();
    rrect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 47.25); ctx.lineWidth = 1.5; ctx.strokeStyle = white(0.18); ctx.stroke();
    ctx.fillStyle = white(0.16); ctx.fillRect(x + 24, y, w - 48, 1);
    ctx.restore();

    ctx.fillStyle = white(0.92); ctx.font = font(700, 30); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('Statisztika', W / 2, baselineIn(y + 30, 36, 30));

    const n = p.rows.length;
    const areaTop = y + 30 + 36 + 24;
    const areaH = h - 30 - 36 - 24 - 36;
    const free = Math.max(0, areaH - m.rowsH);
    const slot = free / (n + 1);
    const cx0 = x + 44; const cx1 = x + w - 44; const barW = cx1 - cx0;
    const barL = COL.mix(colors.l, '#ffffff', 0.34); const barR = COL.mix(colors.r, '#ffffff', 0.34);
    p.rows.forEach((row, i) => {
      const top = areaTop + slot * (i + 1) + i * (m.rowH + m.rowGap);
      const by = baselineIn(top, 42 * 1.1, 42);
      const hd = F.parseDisplay(row.home); const ad = F.parseDisplay(row.away);
      const hv = hd.pct != null ? hd.pct : Number(row.homeValue);
      const av = ad.pct != null ? ad.pct : Number(row.awayValue);
      const zero = Number(row.homeValue) === 0 && Number(row.awayValue) === 0 && hd.pct == null;
      let ratio = F.ratio(hd, ad, row.homeValue, row.awayValue);
      if (zero) ratio = 0.5;
      ctx.textBaseline = 'alphabetic';
      // bal érték
      ctx.textAlign = 'left';
      ctx.font = font(hv < av ? 600 : 700, 42); ctx.fillStyle = hv < av ? white(0.8) : '#fff';
      ctx.fillText(hd.main, cx0, by);
      if (hd.sub) { const wv = ctx.measureText(hd.main).width; ctx.font = font(500, 23); ctx.fillStyle = white(0.74); ctx.fillText(hd.sub, cx0 + wv + 12, by); }
      // jobb érték
      ctx.textAlign = 'right';
      ctx.font = font(av < hv ? 600 : 700, 42); ctx.fillStyle = av < hv ? white(0.8) : '#fff';
      ctx.fillText(ad.main, cx1, by);
      if (ad.sub) { const wv = ctx.measureText(ad.main).width; ctx.font = font(500, 23); ctx.fillStyle = white(0.74); ctx.fillText(ad.sub, cx1 - wv - 12, by); }
      // megnevezés középen
      ctx.textAlign = 'center'; ctx.font = font(500, 27); ctx.fillStyle = white(0.88);
      ctx.fillText(row.label, W / 2, by);
      // sáv
      const bt = top + 42 * 1.1 + 9;
      const avail = barW - 8;
      const wl = ratio <= 0.0001 ? 0 : (ratio >= 0.9999 ? barW : avail * ratio);
      const wr = ratio >= 0.9999 ? 0 : (ratio <= 0.0001 ? barW : avail * (1 - ratio));
      if (wl > 0) { rrect(ctx, cx0, bt, wl, 12, 6); ctx.fillStyle = zero ? white(0.25) : barL; ctx.fill(); }
      if (wr > 0) { rrect(ctx, cx1 - wr, bt, wr, 12, 6); ctx.fillStyle = zero ? white(0.25) : barR; ctx.fill(); }
    });
  }

  async function ensureFonts() {
    const sample = 'AÁÉÍÓÖŐÚÜŰaáéíóöőúüű0123456789%/–';
    const specs = [[400, 22], [500, 23], [500, 27], [600, 28], [700, 42], [750, 40], [800, 48]];
    try {
      await Promise.all(specs.map((s) => document.fonts.load(font(s[0], s[1]), sample)));
      await document.fonts.ready;
    } catch (e) { /* a tartalék betű is megteszi */ }
  }

  async function render(canvas, p) {
    await ensureFonts();
    const probe = document.createElement('canvas').getContext('2d');
    const m = measure(probe, p);
    canvas.width = W; canvas.height = m.H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, m.H);
    background(ctx, m.H, p.colors);

    // a bajnokság logója a bal felső sarokban (ha betöltődött)
    if (p.league && p.league.naturalWidth) {
      const L = 88;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      ctx.drawImage(p.league, PAD_X - 18, m.top - 18, L, L);
      ctx.restore();
    }

    // fejléc
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let y = m.top;
    ctx.font = font(700, 31); ctx.fillStyle = white(0.88); ctx.fillText(p.title, W / 2, baselineIn(y, 38, 31)); y += 38 + 8;
    ctx.font = font(500, 26); ctx.fillStyle = white(0.78); ctx.fillText(p.dateText, W / 2, baselineIn(y, 32, 26)); y += 32;
    if (p.venue) { y += 8; ctx.font = font(500, 24); ctx.fillStyle = white(0.6); ctx.fillText(p.venue, W / 2, baselineIn(y, 29, 24)); y += 29; }
    y += m.gaps;

    // csapatok és eredmény
    const colW = 311;
    const hx = PAD_X + colW / 2; const ax = W - PAD_X - colW / 2;
    crest(ctx, hx, y, p.home); crest(ctx, ax, y, p.away);
    ctx.font = font(750, 40); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    const nameTop = y + 176 + 22;
    m.hLines.forEach((t, i) => ctx.fillText(t, hx, baselineIn(nameTop + i * 40 * 1.14, 40 * 1.14, 40)));
    m.aLines.forEach((t, i) => ctx.fillText(t, ax, baselineIn(nameTop + i * 40 * 1.14, 40 * 1.14, 40)));
    ctx.font = font(700, 24); ctx.fillStyle = white(0.8);
    drawSpaced(ctx, String(p.score.label || 'Végeredmény').toUpperCase(), W / 2, baselineIn(y + 24, 29, 24), 24 * 0.14);
    ctx.textAlign = 'center'; ctx.font = font(800, 132); ctx.fillStyle = '#fff';
    const sc = p.score.h != null && p.score.a != null ? p.score.h + ' – ' + p.score.a : '–';
    ctx.fillText(sc, W / 2, baselineIn(y + 24 + 29 + 4, 132 * 1.02, 132));
    y += m.teams + m.gaps;

    // gólszerzők
    if (m.scorers) { drawScorers(ctx, p, y); y += m.scorers + m.gaps; }

    // statisztika-panel: a fennmaradó hely
    const footTop = m.H - m.bottom - m.foot;
    if (m.panel) {
      const panelH = footTop - m.gaps - y;
      drawPanel(ctx, p, m, y, panelH, p.colors);
    }

    // lábléc
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(400, 22); ctx.fillStyle = white(0.72); ctx.textAlign = 'left';
    m.noteLines.forEach((t, i) => ctx.fillText(t, PAD_X, baselineIn(footTop + i * 22 * 1.35, 22 * 1.35, 22)));
    ctx.font = font(600, 22); ctx.textAlign = 'right';
    ctx.fillText('Forrás: Sofascore', W - PAD_X, baselineIn(m.H - m.bottom - 26.6, 26.6, 22));
    return { width: W, height: m.H };
  }

  root.NB1Card = { render, W };
})(typeof self !== 'undefined' ? self : this);

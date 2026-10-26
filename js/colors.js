/* Színek: a címerből a domináns szín kinyerése (böngészőben, canvas-szal) és a kártyához igazítása. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NB1Colors = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function hexToRgb(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
    let h = 0; let s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) { const v = l * 255; return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const hexToHsl = (hex) => { const c = hexToRgb(hex); return c ? rgbToHsl(c[0], c[1], c[2]) : null; };
  const hslToHex = (h, s, l) => { const c = hslToRgb(h, s, l); return rgbToHex(c[0], c[1], c[2]); };

  // Domináns, élénk szín egy képből (a szürkéket, fehéret, feketét és az átlátszót kihagyja).
  function dominantFromImage(img) {
    const S = 56;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, S, S);
    const px = x.getImageData(0, 0, S, S).data;
    const bins = {};
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 200) continue;
      const hsl = rgbToHsl(px[i], px[i + 1], px[i + 2]);
      const l = hsl[2]; const s = hsl[1];
      if (l > 0.93 || l < 0.1 || s < 0.28) continue;
      const k = Math.floor(hsl[0] / 15);
      const b = bins[k] || (bins[k] = { w: 0, r: 0, g: 0, b: 0, n: 0 });
      const w = s * (1 - Math.abs(2 * l - 1) * 0.6);
      b.w += w; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2]; b.n += 1;
    }
    let best = null;
    Object.keys(bins).forEach((k) => { if (!best || bins[k].w > best.w) best = bins[k]; });
    if (!best || best.n < 12) return null;
    return rgbToHex(best.r / best.n, best.g / best.n, best.b / best.n);
  }

  // Kártyára/háttérnek alkalmas tónus: szép telítettség, a fehér szöveghez elég sötét.
  function tone(hex) {
    const hsl = hexToHsl(hex);
    if (!hsl) return null;
    const s = Math.max(0.5, Math.min(0.95, hsl[1]));
    const l = Math.max(0.27, Math.min(0.46, hsl[2]));
    return hslToHex(hsl[0], s, l);
  }

  function hueDist(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

  // Ha a két oldal színe túl hasonló, megkülönböztetjük őket.
  function fixPair(left, right, rightAlt) {
    const a = hexToHsl(left); const b = hexToHsl(right);
    if (!a || !b) return [left, right];
    if (hueDist(a[0], b[0]) < 28 && Math.abs(a[2] - b[2]) < 0.14) {
      const alt = rightAlt ? hexToHsl(tone(rightAlt)) : null;
      if (alt && hueDist(a[0], alt[0]) >= 28) return [left, hslToHex(alt[0], alt[1], alt[2])];
      return [hslToHex(a[0], a[1], Math.max(0.2, a[2] - 0.08)), hslToHex(b[0], Math.min(0.9, b[1] + 0.05), Math.min(0.55, b[2] + 0.14))];
    }
    return [left, right];
  }

  function mix(h1, h2, t) {
    const a = hexToRgb(h1); const b = hexToRgb(h2);
    if (!a || !b) return h1;
    return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }

  return { hexToRgb, rgbToHex, hexToHsl, hslToHex, dominantFromImage, tone, fixPair, mix };
});

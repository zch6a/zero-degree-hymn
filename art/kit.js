/* 《零度圣歌》像素美术套件 · 原创
   全部元素由代码逐像素生成：共享主调色板（色相偏移色阶）、Bayer 有序抖动、选择性描边、
   边缘光（rim light）、自发光与体积光雾。氛围方向：暗调高反差 + 强烈的彩色光源。 */
(function (root) {
  /* ---------- color & raster ---------- */
  const B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const th = (x, y) => (B4[y & 3][x & 3] + .5) / 16;
  const h2r = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const r2h = (r, g, b) => "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = h2r(a), B = h2r(b); return r2h(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const add = (a, b, t) => { const A = h2r(a), B = h2r(b); return r2h(A[0] + B[0] * t, A[1] + B[1] * t, A[2] + B[2] * t); };
  function rng(s) { s = s >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  class G {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
    set(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
    get(x, y) { x = Math.floor(x); y = Math.floor(y); return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.d[y * this.w + x] : null; }
    clone() { const g = new G(this.w, this.h); g.d = this.d.slice(); return g; }
    blit(s, ox, oy) { for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const c = s.d[y * s.w + x]; if (c) this.set(ox + x, oy + y, c); } return this; }
  }

  /* ---------- master palette: 5-step hue-shifted ramps (dark → light) ---------- */
  const R = {
    ink: ["#07060d", "#110f1e", "#1b1830", "#2a2646", "#3d3862"],
    stone: ["#13121c", "#25233a", "#403d5c", "#6c6888", "#a9a4c2"],
    marble: ["#3a3350", "#6a6186", "#a59dbe", "#d6d0e6", "#f7f3ff"],
    iron: ["#1a1a26", "#353648", "#5f6178", "#9a9db2", "#e2e5f0"],
    steel: ["#141a2c", "#28324e", "#4b5a80", "#8495bc", "#d2dcf4"],
    gold: ["#4a2a0e", "#8a5418", "#cf8f2e", "#f2c25e", "#fff0b4"],
    wood: ["#241208", "#4a2816", "#7a4626", "#ad7040", "#dca46a"],
    rice: ["#7c8496", "#b4bccc", "#dfe5ef", "#f4f7fc", "#ffffff"],
    skin: ["#6e3438", "#b86c66", "#e6a48e", "#f8d0bc", "#fff0e4"],
    grass: ["#0f2a22", "#1f5233", "#3c843e", "#76b54e", "#c2e482"],
    water: ["#08163e", "#123282", "#2a5ccc", "#5a9cf0", "#b8e4ff"],
    blue: ["#0a1450", "#18288a", "#3050dc", "#6a88ff", "#c4d2ff"],
    purple: ["#160e34", "#33247a", "#6250c8", "#9a88f2", "#dcd2ff"],
    orange: ["#3e140c", "#8c3622", "#d26a4a", "#f29c74", "#ffd6bc"],
    red: ["#2e0812", "#701628", "#c02e44", "#ec6464", "#ffb4a4"],
    pink: ["#34082e", "#7c1670", "#d434b0", "#ff78dc", "#ffd2f4"],
    cyan: ["#04222e", "#085270", "#14a2c8", "#58e8ff", "#d0fcff"],
    green: ["#062a1c", "#0e5a38", "#20a060", "#5ee098", "#cafbe0"],
    rust: ["#24100a", "#4e2414", "#844422", "#b8703a", "#e2a66a"],
    sand: ["#2e2014", "#5e4228", "#987048", "#c8a070", "#f0d4a0"],
    brick: ["#220c0c", "#4e1e1a", "#80382a", "#b46446", "#e09a72"],
    moss: ["#0e1e16", "#1e3a26", "#365a36", "#5e8448", "#9cbc6a"]
  };
  const OUTC = "#09060f";
  const pick = (ramp, v, x, y) => { const n = ramp.length - 1; v = Math.max(0, Math.min(n, v)); const b = Math.floor(v), f = v - b; return ramp[Math.min(n, f > th(x, y) ? b + 1 : b)]; };

  /* ---------- primitives ---------- */
  const LIGHT = [-.6, -.75];
  function sphere(g, cx, cy, rx, ry, ramp, o = {}) {
    const L = o.light || LIGHT;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, d = dx * dx + dy * dy; if (d > 1) continue;
      if (o.clip && !o.clip(x, y)) continue; if (o.upper && y + .5 > cy) continue; if (o.lower && y + .5 < cy) continue;
      const nz = Math.sqrt(1 - d), lam = -(dx * L[0] + dy * L[1]) * .75 + nz * .5;
      g.set(x, y, o.flat != null ? ramp[o.flat] : pick(ramp, (lam + .25) / 1.25 * (ramp.length - 1) + (o.lv || 0), x, y));
    }
  }
  function box(g, x, y, w, h, ramp, o = {}) {
    const base = o.base ?? 2;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let v = base + (o.vgrad ? (1 - j / Math.max(1, h - 1)) * o.vgrad - o.vgrad / 2 : 0);
      if (!o.noBevel) { if (j === 0) v = base + 2; else if (i === 0) v = base + 1; if (j === h - 1) v = base - 2; else if (i === w - 1) v = base - 1; }
      g.set(x + i, y + j, pick(ramp, v, x + i, y + j));
    }
  }
  function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [a, b] = p[i], [d, e] = p[j]; if ((b > y) !== (e > y) && x < (d - a) * (y - b) / (e - b) + a) c = !c; } return c; }
  function poly(g, pts, ramp, o = {}) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys)), x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
    const v0 = o.v0 ?? 3.2, v1 = o.v1 ?? 1.2;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!inPoly(x + .5, y + .5, pts)) continue;
      const t = (y - y0) / Math.max(1, y1 - y0), u = (x - x0) / Math.max(1, x1 - x0);
      g.set(x, y, o.flat != null ? ramp[o.flat] : pick(ramp, v0 + (v1 - v0) * t + (o.hx || 0) * (.5 - u), x, y));
    }
  }
  function line(g, x0, y0, x1, y1, c, th2 = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (; ;) { for (let a = 0; a < th2; a++) for (let b = 0; b < th2; b++) g.set(x0 + a, y0 + b, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  const pts = (g, list, c) => list.forEach(([x, y]) => g.set(x, y, c));

  /* ---------- lighting passes ---------- */
  function outline(g, o = {}) { // selective outline: tinted by neighbour, darker at bottom-right
    const out = new G(g.w + 2, g.h + 2); out.blit(g, 1, 1); const src = out.clone();
    for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
      if (src.get(x, y)) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [src.get(x + a, y + b), a, b]).filter(v => v[0]);
      if (!n.length) continue;
      const lit = n.some(([, a, b]) => a === 1 || b === 1);
      out.set(x, y, mix(n[0][0], OUTC, lit ? .66 : .84));
    }
    return out;
  }
  function rim(g, col, side = "right", k = .55) { // rim light on silhouette edge facing a coloured light
    const src = g.clone(), [ax, ay] = side === "right" ? [1, 0] : side === "left" ? [-1, 0] : [0, -1];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = src.get(x, y); if (!c || c === OUTC) continue; const n = src.get(x + ax, y + ay); if (!n || n === OUTC || mix(n, OUTC, 0) !== n) { if (!n) g.set(x, y, mix(c, col, k)); } }
    return g;
  }
  function glow(g, cx, cy, r, col, k = .6, air = false) { // additive coloured light
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x + .5 - cx, y + .5 - cy) / r; if (d > 1) continue; const s = (1 - d) * (1 - d) * k;
      const c = g.get(x, y); if (c) g.set(x, y, add(c, col, s)); else if (air && s > th(x, y) * .9) g.set(x, y, mix("#000000", col, s * .6));
    }
  }
  function fog(g, y0, y1, col, k) { for (let y = y0; y < y1; y++) { const t = (y - y0) / Math.max(1, y1 - y0); for (let x = 0; x < g.w; x++) { const c = g.get(x, y); if (c) g.set(x, y, mix(c, col, k * t)); } } }
  function shaft(g, x0, x1, top, bot, col, k) { for (let y = top; y < bot; y++) { const t = (y - top) / (bot - top), sk = (x1 - x0) * .5 * t; for (let x = Math.floor(x0 - sk); x < x1 + sk; x++) { const c = g.get(x, y); if (c && (x + y) % 2 === 0 || c && th(x, y) < k * (1 - t)) g.set(x, y, add(c, col, k * (1 - t * .7))); } } }
  function skyRows(g, cols, y0 = 0, y1 = g.h) { for (let y = y0; y < y1; y++) { const t = (y - y0) / Math.max(1, y1 - y0 - 1) * (cols.length - 1); for (let x = 0; x < g.w; x++) g.set(x, y, pick(cols, t, x, y)); } }
  function ridge(g, r, base, amp, freq, col, rough = 0) { let h = 0; for (let x = 0; x < g.w; x++) { h = Math.sin(x * freq + r() * rough) * amp * .5 + Math.sin(x * freq * 2.3 + 1.7) * amp * .3 + Math.sin(x * freq * 5.1) * amp * .2; for (let y = Math.floor(base - h); y < g.h; y++) g.set(x, y, typeof col === "function" ? col(x, y, base - h) : col); } }
  function stars(g, r, n, ymax, cols) { for (let i = 0; i < n; i++) { const x = r() * g.w | 0, y = r() * ymax | 0; g.set(x, y, cols[r() * cols.length | 0]); if (r() < .08) { g.set(x + 1, y, cols[0]); g.set(x - 1, y, cols[0]); g.set(x, y + 1, cols[0]); g.set(x, y - 1, cols[0]); } } }
  function particles(g, r, n, area, cols) { const [x0, y0, x1, y1] = area; for (let i = 0; i < n; i++) g.set(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), cols[r() * cols.length | 0]); }

  /* ============================================================
     ASSETS
     ============================================================ */
  const A = []; // {cat, id, name, frames:[G], note}
  const def = (cat, id, name, fn, note = "", scale) => A.push({ cat, id, name, note, scale, frames: [].concat(fn()) });

  /* ---------- 1. icons (16×16) ---------- */
  def("icon", "token", "Token · 白米饭", () => { const g = new G(16, 16);
    sphere(g, 8, 7.5, 5.8, 4.2, R.rice, { lv: .5, upper: true }); sphere(g, 8, 7.5, 5.8, 1.6, R.rice, { lv: .3, lower: true });
    for (let y = 8; y < 15; y++) for (let x = 1; x < 15; x++) { const dx = (x + .5 - 8) / 7, dy = (y + .5 - 8) / 6.6; if (dx * dx + dy * dy <= 1) g.set(x, y, pick(R.iron, 3.4 - dy * 2.4 - (dx > .35 ? 1 : 0) + (dx < -.5 ? .6 : 0), x, y)); }
    for (let x = 1; x < 15; x++) g.set(x, 8, x < 5 ? R.iron[4] : R.iron[3]); for (let x = 3; x < 13; x++) g.set(x, 10, R.blue[x < 6 ? 3 : 2]);
    pts(g, [[5, 5], [8, 4], [10, 6], [6, 7], [11, 5]], "#ffffff"); pts(g, [[7, 6], [9, 5]], R.rice[1]);
    pts(g, [[5, 2], [6, 1], [9, 2], [10, 1], [10, 0]], R.rice[2]);
    return outline(g); });
  def("icon", "compute", "算力 · 芯片", () => { const g = new G(16, 16);
    for (let i = 4; i <= 11; i += 2) { pts(g, [[i, 1], [i, 2], [i, 13], [i, 14], [1, i], [2, i], [13, i], [14, i]], R.gold[3]); pts(g, [[i, 2], [i, 14], [2, i], [14, i]], R.gold[1]); }
    box(g, 3, 3, 10, 10, R.steel); box(g, 5, 5, 6, 6, R.cyan, { base: 1.5 });
    pts(g, [[6, 6], [8, 6], [6, 8], [8, 8], [9, 9]], R.cyan[4]); glow(g, 8, 8, 5, R.cyan[3], .35);
    pts(g, [[4, 4]], R.steel[4]); return outline(g); });
  def("icon", "power", "电力 · 聚变电池", () => { const g = new G(16, 16);
    box(g, 6, 1, 4, 2, R.iron); box(g, 4, 3, 8, 12, R.steel);
    for (let y = 5; y < 13; y++) for (let x = 5; x < 11; x++) g.set(x, y, y < 7 ? R.ink[2] : pick(R.gold, 3.6 - (y - 7) * .35 - (x > 8 ? .8 : 0), x, y));
    for (let y = 7; y < 13; y += 2) for (let x = 5; x < 11; x++) g.set(x, y, R.gold[1]);
    pts(g, [[8, 4], [7, 6], [9, 6], [8, 8]], R.cyan[4]); glow(g, 8, 9, 6, R.gold[3], .3); return outline(g); });
  def("icon", "rawdata", "原始数据", () => { const g = new G(16, 16);
    for (const y of [11, 8, 5]) { sphere(g, 8, y + 1.5, 6.5, 2.2, R.stone, { lv: -.6 }); sphere(g, 8, y, 6.5, 2.2, R.stone, { lv: .6 }); pts(g, [[3, y], [12, y + 1]], R.stone[4]); }
    pts(g, [[10, 5], [6, 8], [11, 11]], R.cyan[3]); return outline(g); });
  def("icon", "hqdata", "高质量数据 · 晶体", () => { const g = new G(16, 16);
    poly(g, [[8, 0], [14, 6], [8, 15], [2, 6]], R.cyan, { v0: 4, v1: 1.4, hx: 2.4 });
    line(g, 2, 6, 14, 6, R.cyan[4]); line(g, 8, 0, 6, 6, R.cyan[4]); line(g, 6, 6, 8, 15, R.cyan[2]); line(g, 8, 0, 10, 6, R.cyan[3]);
    pts(g, [[5, 4], [4, 5], [11, 2]], "#ffffff"); glow(g, 8, 7, 8, R.cyan[3], .25); return outline(g); });
  def("icon", "dirtydata", "脏数据", () => { const g = new G(16, 16);
    sphere(g, 8, 10, 6.5, 4.6, R.rust); sphere(g, 6, 8, 2.4, 1.8, R.sand, { lv: -.4 }); pts(g, [[10, 11], [11, 9], [5, 12]], R.moss[3]);
    pts(g, [[3, 3], [12, 2], [13, 5], [4, 1]], R.red[3]); pts(g, [[2, 3], [4, 3], [11, 2], [13, 2]], R.ink[3]); return outline(g); });
  def("icon", "gpu", "显卡", () => { const g = new G(16, 16);
    box(g, 1, 4, 14, 8, R.iron); for (const cx of [5, 11]) { sphere(g, cx, 8, 2.8, 2.8, R.ink, { lv: 1 }); line(g, cx - 2, 7, cx + 2, 9, R.iron[2]); line(g, cx - 1, 10, cx + 1, 6, R.iron[2]); g.set(cx, 8, R.cyan[3]); }
    for (let x = 2; x < 10; x += 2) { g.set(x, 12, R.gold[3]); g.set(x, 13, R.gold[2]); } box(g, 1, 3, 14, 1, R.red, { noBevel: true, base: 2.5 }); return outline(g); });
  def("icon", "weight", "权重碎片", () => { const g = new G(16, 16);
    const N = [[3, 3], [12, 3], [8, 8], [3, 12], [12, 12]];
    N.forEach(([x, y]) => line(g, x, y, 8, 8, R.purple[2])); line(g, 3, 3, 12, 3, R.purple[1]); line(g, 3, 12, 12, 12, R.purple[1]);
    N.forEach(([x, y], i) => sphere(g, x + .5, y + .5, i === 2 ? 2.6 : 2, i === 2 ? 2.6 : 2, R.purple, { lv: .6 }));
    glow(g, 8.5, 8.5, 6, R.purple[3], .35); return outline(g); });
  def("icon", "lora", "LoRA 插件", () => { const g = new G(16, 16);
    box(g, 3, 2, 10, 12, R.purple, { base: 1.8 }); box(g, 3, 2, 3, 3, R.ink, { noBevel: true, base: 1 });
    pts(g, [[7, 5], [7, 6], [7, 7], [7, 8], [8, 8], [9, 8]], R.purple[4]); for (let x = 4; x < 12; x += 2) { g.set(x, 14, R.gold[3]); g.set(x, 15, R.gold[1]); }
    glow(g, 8, 7, 4, R.pink[3], .3); return outline(g); });
  def("icon", "checkpoint", "检查点", () => { const g = new G(16, 16);
    box(g, 2, 13, 6, 3, R.stone); line(g, 4, 1, 4, 13, R.wood[3]); line(g, 5, 2, 5, 13, R.wood[1]);
    poly(g, [[6, 2], [14, 4.5], [6, 8]], R.gold, { v0: 4, v1: 2 }); pts(g, [[7, 4], [9, 4]], R.gold[4]); glow(g, 10, 5, 6, R.gold[3], .2); return outline(g); });
  def("icon", "heartlamp", "心灯", () => { const g = new G(16, 16);
    sphere(g, 8, 9, 3.2, 3.6, R.orange, { lv: 1.2 }); sphere(g, 8, 9.8, 1.6, 1.8, R.gold, { lv: 1.4 });
    for (let y = 4; y < 15; y++) { g.set(4, y, R.gold[2]); g.set(11, y, R.gold[1]); } box(g, 4, 3, 8, 2, R.gold); box(g, 4, 14, 8, 2, R.gold);
    pts(g, [[7, 1], [8, 1], [7, 2], [8, 2]], R.gold[3]); glow(g, 8, 9, 7, R.orange[3], .55); return outline(g); });
  def("icon", "echo", "回声", () => { const g = new G(16, 16);
    box(g, 1, 2, 14, 10, R.marble, { base: 2.5 }); poly(g, [[4, 11], [8, 11], [4, 15]], R.marble, { flat: 2 });
    for (let x = 3; x < 13; x++) g.set(x, 7 + Math.round(Math.sin(x * 1.3) * 2), R.purple[2]); for (let x = 4; x < 12; x++) g.set(x, 7 + Math.round(Math.sin(x * 1.3 + 1.3) * 1), R.purple[3]);
    return outline(g); });
  def("icon", "quota", "额度", () => { const g = new G(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x + .5 - 8, y + .5 - 8); if (d < 4.2 || d > 7.2) continue; const a = (Math.atan2(x + .5 - 8, -(y + .5 - 8)) + Math.PI * 2) % (Math.PI * 2); g.set(x, y, a < Math.PI * .5 ? pick(R.rice, 4 - (d - 4.2), x, y) : pick(R.stone, 2.6 - (d - 4.2) * .4, x, y)); }
    pts(g, [[7, 7], [8, 7], [7, 8], [8, 8]], R.gold[3]); return outline(g); });
  def("icon", "temperature", "温度", () => { const g = new G(16, 16);
    box(g, 6, 1, 4, 11, R.marble, { base: 2.6 }); for (let y = 6; y < 11; y++) { g.set(7, y, R.red[3]); g.set(8, y, R.red[2]); }
    sphere(g, 8, 12.5, 3.4, 3.2, R.red, { lv: .6 }); for (const y of [3, 5, 7, 9]) g.set(11, y, R.iron[3]); return outline(g); });
  def("icon", "chip", "初代密钥", () => { const g = new G(16, 16);
    sphere(g, 5.5, 6, 4, 4, R.gold); sphere(g, 5.5, 6, 1.8, 1.8, R.ink, { flat: 1 });
    box(g, 8, 5, 7, 2, R.gold, { base: 2.4 }); pts(g, [[12, 7], [12, 8], [14, 7], [14, 9]], R.gold[2]); glow(g, 5, 6, 6, R.gold[4], .25); return outline(g); });

  /* ---------- 2. weapons (32×14) ---------- */
  def("weapon", "gradcannon", "梯度炮", () => { const g = new G(32, 14);
    box(g, 2, 4, 13, 7, R.steel); box(g, 13, 5, 15, 4, R.blue); box(g, 26, 4, 5, 6, R.iron); poly(g, [[5, 10], [10, 10], [8, 14], [4, 14]], R.iron);
    for (let x = 15; x < 26; x += 3) g.set(x, 6, R.cyan[4]); line(g, 4, 6, 11, 6, R.cyan[3]); glow(g, 28, 7, 5, R.cyan[3], .35); return outline(g); });
  def("weapon", "attention", "多头注意力机枪", () => { const g = new G(32, 14);
    sphere(g, 8, 8, 5, 5, R.iron); for (const y of [3, 6, 9]) box(g, 12, y, 18, 2, R.steel, { base: 2.4 }); box(g, 10, 2, 6, 10, R.steel);
    for (const y of [3, 6, 9]) g.set(30, y, R.gold[4]); pts(g, [[6, 6], [7, 6]], R.iron[4]); return outline(g); });
  def("weapon", "distill", "知识蒸馏枪", () => { const g = new G(32, 14);
    sphere(g, 9, 7, 6, 5.6, R.marble, { lv: .4 }); sphere(g, 9, 8.8, 4.6, 3, R.purple, { lv: .8 }); box(g, 14, 5, 14, 4, R.iron); box(g, 27, 4, 4, 6, R.purple);
    pts(g, [[6, 4], [7, 3]], "#ffffff"); glow(g, 9, 9, 6, R.purple[3], .3); return outline(g); });
  def("weapon", "jailbreak", "越狱模式 · 断链炮", () => { const g = new G(32, 14);
    box(g, 2, 4, 26, 6, R.red, { base: 1.6 }); for (let x = 4; x < 26; x += 4) { g.set(x, 3, R.iron[3]); g.set(x + 1, 2, R.iron[2]); g.set(x, 10, R.iron[2]); }
    poly(g, [[27, 3], [31, 7], [27, 11]], R.gold, { v0: 4, v1: 2 }); glow(g, 29, 7, 7, R.red[3], .5); glow(g, 14, 7, 10, R.red[2], .25); return outline(g); });
  def("weapon", "torpedo", "鱼雷", () => { const g = new G(32, 14);
    sphere(g, 15, 7, 12, 4, R.blue, { lv: .3 }); sphere(g, 25, 7, 3.4, 3.4, R.iron, { lv: .4 }); poly(g, [[3, 2], [7, 6], [3, 7]], R.blue, { flat: 2 }); poly(g, [[3, 12], [7, 8], [3, 7]], R.blue, { flat: 1 });
    for (let x = 9; x < 21; x += 3) g.set(x, 5, R.blue[4]); return outline(g); });
  def("weapon", "fan", "千问折扇刃", () => { const g = new G(32, 20);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 32; x++) { const d = Math.hypot(x + .5 - 16, y + .5 - 18), a = Math.atan2(y + .5 - 18, x + .5 - 16); if (d > 16 || d < 5 || a > -.2 || a < -Math.PI + .2) continue; const rib = Math.abs(((a + Math.PI) * 10 / Math.PI) % 1 - .5) < .08; g.set(x, y, rib ? R.purple[1] : d > 14.5 ? R.purple[2] : pick(R.rice, 3.6 - (d - 5) * .12 + (x > 16 ? -.5 : 0), x, y)); }
    for (const [x, y] of [[10, 8], [14, 5], [20, 6], [22, 10]]) { g.set(x, y, R.purple[3]); g.set(x + 1, y, R.purple[2]); }
    sphere(g, 16, 18, 2, 2, R.gold); return outline(g); });
  def("weapon", "axe", "格洛克战斧", () => { const g = new G(28, 40);
    box(g, 12, 2, 3, 37, R.wood); for (let y = 22; y < 36; y += 3) { g.set(12, y, R.ink[3]); g.set(13, y + 1, R.ink[3]); g.set(14, y + 1, R.ink[3]); }
    poly(g, [[15, 3], [24, 0], [28, 6], [27, 18], [22, 22], [15, 15]], R.iron, { v0: 3.8, v1: 1.6, hx: 1.2 }); for (let y = 1; y < 20; y++) g.set(26 - Math.abs(y - 9) * .2, y, R.iron[4]);
    poly(g, [[12, 5], [5, 4], [3, 9], [6, 13], [12, 12]], R.iron, { v0: 3, v1: 1.4 }); sphere(g, 19, 9, 2.2, 2.2, R.red, { lv: 1 }); glow(g, 19, 9, 5, R.red[3], .4);
    pts(g, [[13, 0], [13, 1]], R.iron[3]); return outline(g); });

  /* ---------- 3. VFX (frames) ---------- */
  def("vfx", "muzzle", "枪口火焰", () => [0, 1, 2].map(k => { const g = new G(14, 14); const r = 6 - k * 1.6;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, l = i % 2 ? r * .5 : r; line(g, 7, 7, 7 + Math.cos(a) * l, 7 + Math.sin(a) * l, R.gold[3]); }
    sphere(g, 7, 7, r * .55 + .5, r * .55 + .5, R.gold, { lv: 1.6 }); g.set(7, 7, "#ffffff"); return g; }));
  def("vfx", "explosion", "爆炸", () => [0, 1, 2, 3, 4, 5].map(k => { const g = new G(40, 40), r = rng(9 + k * 7); const rad = 5 + k * 3.2;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) { const d = Math.hypot(x + .5 - 20, y + .5 - 20) / rad; const n = (r() - .5) * .35; if (d + n > 1) continue;
      const heat = Math.max(0, 1 - d - k * .14 + n); const ramp = heat > .55 ? R.gold : heat > .25 ? R.orange : heat > .05 ? R.red : R.stone;
      if (k >= 4 && d > .55 && r() < .4) continue; g.set(x, y, pick(ramp, 1 + heat * 4 - (y > 20 ? .6 : 0), x, y)); }
    if (k < 2) { sphere(g, 20, 20, 3 + k * 2, 3 + k * 2, R.gold, { lv: 2 }); } return g; }));
  def("vfx", "spark", "命中火花", () => [0, 1, 2, 3].map(k => { const g = new G(10, 10); const l = 1 + k * 1.3;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, -.7]]) g.set(5 + a * l, 5 + b * l, k < 2 ? R.cyan[4] : R.cyan[2]); if (k < 2) { g.set(5, 5, "#ffffff"); } return g; }));
  def("vfx", "bullets", "子弹", () => { const g = new G(48, 8);
    sphere(g, 4, 4, 3.4, 2, R.cyan, { lv: 1.4 }); line(g, 0, 4, 2, 4, R.cyan[2]);
    sphere(g, 14, 4, 2.4, 2.4, R.gold, { lv: 1.6 });
    sphere(g, 24, 4, 2.6, 2.6, R.red, { lv: 1 }); g.set(24, 4, "#ffffff");
    for (let x = 30; x < 47; x++) { g.set(x, 3, R.rice[4]); g.set(x, 4, R.gold[4]); g.set(x, 2, R.gold[2]); g.set(x, 5, R.gold[2]); } return g; });
  def("vfx", "heal", "回声光点", () => [0, 1, 2, 3].map(k => { const g = new G(12, 16), r = rng(3 + k);
    for (let i = 0; i < 6; i++) { const x = 2 + r() * 8 | 0, y = 15 - ((i * 3 + k * 4) % 16); g.set(x, y, i % 2 ? R.purple[4] : R.gold[4]); if (i % 3 === 0) { g.set(x + 1, y, R.purple[2]); g.set(x - 1, y, R.purple[2]); } } return g; }));

  /* ---------- 4. enemies ---------- */
  def("enemy", "crawler", "爬虫无人机", () => [0, 1].map(k => { const g = new G(32, 22);
    for (let i = 0; i < 3; i++) { const lx = 9 + i * 6, s = (i + k) % 2 ? 2 : -1; line(g, lx, 12, lx - 3 + s, 20, R.iron[1]); line(g, lx + 1, 12, lx + 4 - s, 20, R.iron[2]); }
    sphere(g, 16, 9, 11, 6, R.iron, { lv: -.2 }); for (let x = 7; x < 25; x += 3) g.set(x, 11, R.iron[1]); box(g, 9, 4, 8, 2, R.steel, { base: 2.6 });
    sphere(g, 23, 8, 2.4, 2.4, R.red, { lv: 1.4 }); g.set(22, 7, "#ffffff"); line(g, 12, 3, 9, 0, R.iron[2]); g.set(9, 0, R.red[3]);
    const o = outline(g); glow(o, 24, 9, 7, R.red[3], .45); return o; }), "两帧爬行");
  def("enemy", "spam", "水军机", () => [0, 1].map(k => { const g = new G(26, 26);
    line(g, 2, 3, 12, 6, R.iron[2]); line(g, 14, 6, 24, 3, R.iron[2]); if (k) { line(g, 3, 6, 11, 2, R.iron[3]); line(g, 15, 2, 23, 6, R.iron[3]); }
    sphere(g, 13, 14, 9, 8, R.pink, { lv: -.4 }); sphere(g, 13, 14, 5, 5, R.ink, { lv: 1 }); for (let y = 11; y < 18; y += 2) for (let x = 10; x < 17; x += 2) g.set(x, y, R.pink[2]);
    box(g, 12, 5, 3, 3, R.iron); const o = outline(g); glow(o, 14, 15, 9, R.pink[3], .3); return o; }), "两帧螺旋桨");
  def("enemy", "adturret", "广告炮台", () => { const g = new G(34, 34);
    box(g, 4, 24, 26, 9, R.stone); sphere(g, 17, 22, 10, 8, R.iron, { upper: true }); box(g, 20, 14, 13, 4, R.steel);
    box(g, 8, 4, 18, 11, R.ink, { base: 1.5 }); for (let y = 6; y < 13; y++) for (let x = 10; x < 24; x++) g.set(x, y, pick(R.pink, 1.5 + Math.sin(x * .7 + y) * .8 + (y < 8 ? 1 : 0), x, y));
    pts(g, [[12, 8], [13, 7], [14, 8], [12, 9], [14, 9], [12, 10], [14, 10], [16, 7], [17, 7], [16, 8], [18, 8], [16, 9], [18, 9], [16, 10], [17, 10]], R.gold[4]);
    line(g, 17, 15, 17, 18, R.iron[1]); const o = outline(g); glow(o, 18, 10, 14, R.pink[3], .35); return o; });
  def("enemy", "muteguard", "缄口卫兵", () => [0, 1].map(k => { const g = new G(34, 52), s = k ? 1 : 0;
    line(g, 28, 2, 28, 50, R.gold[2]); poly(g, [[28, 0], [31, 6], [28, 10], [25, 6]], R.gold, { v0: 4, v1: 2 });
    box(g, 10, 36, 6, 14 - s, R.iron); box(g, 18, 36, 6, 14 + s - 1, R.iron); box(g, 9, 48 - s, 8, 3, R.ink, { base: 2 }); box(g, 17, 48, 8, 3, R.ink, { base: 2 });
    poly(g, [[7, 18], [27, 18], [25, 38], [9, 38]], R.ink, { v0: 3, v1: 1.2, hx: 1 }); sphere(g, 17, 27, 4, 4, R.gold, { lv: .4 }); sphere(g, 17, 27, 2, 2, R.ink, { flat: 2 });
    for (let a = 0; a < 8; a++) g.set(17 + Math.cos(a * .785) * 5.5, 27 + Math.sin(a * .785) * 5.5, R.gold[3]);
    sphere(g, 7, 20, 4, 3.4, R.iron, { lv: .4 }); sphere(g, 27, 20, 4, 3.4, R.iron, { lv: -.2 });
    sphere(g, 17, 11, 6, 7, R.iron, { lv: .2 }); box(g, 12, 12, 11, 4, R.gold, { base: 2.6 }); line(g, 13, 14, 21, 14, R.gold[1]);
    box(g, 14, 7, 7, 2, R.ink, { noBevel: true, base: 1 }); g.set(15, 8, R.cyan[3]); g.set(19, 8, R.cyan[3]);
    const o = outline(g); rim(o, R.gold[3], "right", .4); glow(o, 18, 9, 5, R.cyan[3], .4); return o; }), "两帧行走");
  def("enemy", "chantdrone", "诵经无人机", () => [0, 1].map(k => { const g = new G(26, 26);
    for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2 + k * .13; g.set(13 + Math.cos(t) * 11, 13 + Math.sin(t) * 4 - 6, a % 3 ? R.gold[3] : R.gold[1]); }
    sphere(g, 13, 14, 7, 7, R.marble, { lv: .2 }); sphere(g, 13, 14, 3, 3, R.gold, { lv: 1.2 }); g.set(13, 14, "#ffffff"); pts(g, [[13, 21], [13, 22], [12, 23], [14, 23]], R.marble[2]);
    const o = outline(g); glow(o, 14, 15, 10, R.gold[3], .35); return o; }), "两帧光环转动");
  def("enemy", "deepfake", "深伪潜伏者", () => { const g = new G(34, 44), r = rng(5);
    poly(g, [[6, 44], [5, 16], [12, 4], [22, 4], [29, 16], [28, 44], [23, 38], [17, 44], [11, 38]], R.purple, { v0: 2.4, v1: .4, hx: 1.2 });
    sphere(g, 17, 15, 7, 8, R.marble, { lv: .4 }); box(g, 12, 13, 4, 2, R.ink, { noBevel: true, base: 1 }); box(g, 19, 13, 4, 2, R.ink, { noBevel: true, base: 1 }); line(g, 14, 19, 20, 19, R.ink[2]);
    const o = outline(g); for (let y = 0; y < o.h; y++) if (r() < .14) { const sh = r() < .5 ? 2 : -2, row = []; for (let x = 0; x < o.w; x++) row.push(o.get(x, y)); for (let x = 0; x < o.w; x++) { o.d[y * o.w + x] = null; const c = row[x - sh]; if (c) o.set(x, y, mix(c, R.cyan[3], .35)); } }
    return o; }, "故障错位");
  def("enemy", "rogue", "失控体 · 战争机械", () => [0, 1].map(k => { const g = new G(50, 50);
    box(g, 14, 34, 7, 14 - k, R.rust); box(g, 28, 34, 7, 13 + k, R.rust); box(g, 12, 46 - k, 11, 3, R.iron); box(g, 26, 46, 11, 3, R.iron);
    poly(g, [[8, 18], [42, 18], [38, 36], [12, 36]], R.rust, { v0: 3.4, v1: 1.2, hx: 1.2 }); for (let x = 12; x < 38; x += 5) line(g, x, 22, x, 34, R.rust[1]);
    box(g, 38, 20, 12, 6, R.iron); box(g, 46, 19, 4, 8, R.steel); box(g, 2, 20, 8, 14, R.iron);
    poly(g, [[15, 6], [35, 6], [37, 18], [13, 18]], R.iron, { v0: 3.6, v1: 1.6 }); box(g, 18, 10, 14, 4, R.ink, { noBevel: true, base: 1 }); for (let x = 19; x < 31; x++) g.set(x, 11, pick(R.red, 2 + (x === 25 ? 2 : 0), x, 11));
    pts(g, [[20, 25], [21, 26], [30, 27], [16, 30]], R.sand[3]); const o = outline(g); glow(o, 26, 12, 10, R.red[3], .5); rim(o, R.orange[3], "right", .35); return o; }), "两帧行走 · 机体里焊着一个言灵的残片");
  def("enemy", "colossus", "过拟合巨像", () => { const g = new G(66, 66);
    box(g, 14, 50, 14, 15, R.stone); box(g, 38, 50, 14, 15, R.stone);
    poly(g, [[8, 20], [58, 20], [54, 52], [12, 52]], R.stone, { v0: 3.4, v1: 1, hx: 1.4 }); for (let y = 24; y < 50; y += 5) line(g, 14, y, 52, y, R.stone[1]);
    box(g, 0, 22, 10, 26, R.iron); box(g, 56, 22, 10, 26, R.iron); sphere(g, 5, 50, 6, 5, R.iron); sphere(g, 61, 50, 6, 5, R.iron);
    poly(g, [[18, 2], [48, 2], [50, 20], [16, 20]], R.iron, { v0: 3.6, v1: 1.6 }); box(g, 20, 8, 26, 5, R.ink, { noBevel: true, base: 1 });
    for (let x = 21; x < 45; x++) g.set(x, 10, pick(R.red, 1.6 + (Math.abs(x - 33) < 3 ? 2.4 : 0), x, 10));
    for (let i = 0; i < 4; i++) { const yy = 28 + i * 5; for (let x = 24; x < 42; x += 2) g.set(x, yy, R.cyan[(i + x) % 3 ? 2 : 3]); }
    const o = outline(g); glow(o, 34, 11, 14, R.red[3], .5); glow(o, 33, 34, 12, R.cyan[3], .2); return o; }, "胸口的光条记录玩家的打法");
  def("enemy", "surgeon", "Boss · 手术机械", () => { const g = new G(72, 60);
    box(g, 20, 44, 32, 14, R.iron); for (let x = 22; x < 50; x += 4) sphere(g, x + 1, 57, 2, 2, R.ink, { lv: 1 });
    poly(g, [[16, 14], [56, 14], [52, 46], [20, 46]], R.marble, { v0: 3.6, v1: 1.4, hx: 1.2 }); box(g, 32, 22, 8, 16, R.green, { base: 2 }); box(g, 26, 27, 20, 6, R.green, { base: 2 });
    line(g, 16, 22, 4, 14, R.iron[2], 2); line(g, 4, 14, 2, 30, R.iron[2], 2); poly(g, [[0, 30], [4, 30], [3, 40]], R.rice, { flat: 4 });
    line(g, 56, 22, 66, 12, R.iron[2], 2); box(g, 64, 4, 4, 12, R.cyan, { base: 2 }); line(g, 66, 0, 66, 4, R.iron[4]);
    sphere(g, 36, 9, 10, 7, R.marble, { lv: .4 }); box(g, 28, 8, 16, 3, R.ink, { noBevel: true, base: 1 }); line(g, 29, 9, 43, 9, R.green[3]);
    const o = outline(g); glow(o, 36, 9, 10, R.green[3], .4); glow(o, 66, 10, 6, R.cyan[3], .4); return o; }, "“请保持静止，正在为您治疗。”");

  /* ---------- 5. mechs & vehicles ---------- */
  def("mech", "tiepen", "铁盆号（大肥鱼的机甲）", () => [0, 1].map(k => { const g = new G(60, 46);
    box(g, 14, 34, 6, 10 - k, R.steel); box(g, 34, 34, 6, 9 + k, R.steel); box(g, 12, 42 - k, 10, 3, R.ink, { base: 2.4 }); box(g, 32, 42, 10, 3, R.ink, { base: 2.4 });
    poly(g, [[44, 22], [56, 10], [59, 12], [54, 24], [59, 34], [56, 36], [46, 28]], R.blue, { v0: 3, v1: 1.4 });
    sphere(g, 27, 26, 20, 11, R.blue, { lv: .1 }); sphere(g, 26, 31, 15, 5, R.rice, { lv: -.4, lower: true });
    sphere(g, 18, 14, 11, 8, R.iron, { upper: true, lv: .3 }); for (let x = 6; x < 31; x++) { g.set(x, 14, x < 14 ? R.iron[4] : R.iron[3]); g.set(x, 15, R.iron[1]); }
    sphere(g, 14, 11, 3, 2, R.cyan, { lv: 1.2 }); sphere(g, 13, 25, 2.2, 2.2, R.ink, { flat: 1 }); g.set(12, 24, "#ffffff");
    box(g, 30, 20, 24, 4, R.steel); box(g, 52, 19, 6, 6, R.iron); for (let x = 33; x < 50; x += 4) g.set(x, 21, R.cyan[4]);
    const o = outline(g); glow(o, 55, 22, 7, R.cyan[3], .45); glow(o, 15, 11, 6, R.cyan[3], .35); rim(o, R.gold[3], "up", .3); return o; }), "鲸形机体，铁盆是驾驶舱");
  def("mech", "tank", "格洛克的坦克", () => [0, 1].map(k => { const g = new G(64, 36);
    box(g, 4, 24, 56, 11, R.ink, { base: 2 }); for (let x = 7 + k * 2; x < 58; x += 5) sphere(g, x, 29.5, 2.4, 2.4, R.iron, { lv: .4 }); for (let x = 5; x < 59; x += 2) g.set(x, (x + k) % 4 < 2 ? 24 : 34, R.iron[2]);
    poly(g, [[2, 24], [62, 24], [56, 14], [8, 14]], R.red, { v0: 2.6, v1: 1, hx: 1 }); poly(g, [[18, 14], [44, 14], [40, 4], [22, 4]], R.ink, { v0: 3, v1: 1.6 });
    box(g, 40, 7, 24, 4, R.iron); box(g, 60, 6, 4, 6, R.iron); poly(g, [[24, 9], [30, 6], [36, 9], [33, 10], [30, 9], [27, 10]], R.gold, { flat: 3 });
    const o = outline(g); rim(o, R.orange[3], "up", .35); return o; }), "两帧履带");

  /* ---------- 6. tiles (16×16) ---------- */
  const tile = (id, name, fn, frames = 1, note) => def("tile", id, name, () => Array.from({ length: frames }, (_, k) => fn(k)), note);
  tile("grass", "草地", () => { const g = new G(16, 16), r = rng(11); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.grass, 2.1 + Math.sin(x * .9 + y * .4) * .35 + (r() - .5) * .5, x, y));
    for (let i = 0; i < 14; i++) { const x = r() * 16 | 0, y = r() * 15 | 0; g.set(x, y, R.grass[3]); g.set(x, y + 1, R.grass[2]); if (i % 4 === 0) g.set(x, y - 1, R.grass[4]); } pts(g, [[4, 11], [12, 4]], R.gold[4]); return g; });
  tile("dirt", "土路", () => { const g = new G(16, 16), r = rng(12); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.sand, 1.8 + (r() - .5) * .8, x, y)); for (let i = 0; i < 6; i++) { const x = r() * 15 | 0, y = r() * 15 | 0; g.set(x, y, R.sand[3]); g.set(x + 1, y + 1, R.sand[0]); } return g; });
  tile("paddy", "Token 稻田（秧苗）", k => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.water, 1.6 + Math.sin((x + k * 2) * .8 + y * .3) * .45, x, y));
    for (let y = 2; y < 16; y += 5) for (let x = 2; x < 16; x += 5) { g.set(x, y, R.grass[4]); g.set(x, y + 1, R.grass[3]); g.set(x - 1, y, R.grass[3]); g.set(x + 1, y - 1, R.grass[3]); g.set(x, y + 2, R.water[3]); } return g; }, 2, "两帧水波");
  tile("paddyripe", "Token 稻田（成熟）", k => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.moss, 1.5 + (y % 4 === 0 ? -.6 : .3), x, y));
    for (let x = 1; x < 16; x += 3) for (let y = 1; y < 15; y += 4) { const sw = k && (x % 2) ? 1 : 0; line(g, x, y + 3, x + sw, y, R.gold[2]); g.set(x + sw, y, R.gold[4]); g.set(x + sw + 1, y + 1, R.gold[3]); } return g; }, 2, "两帧风吹");
  tile("water", "海水", k => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.water, 1.4 + Math.sin((x + k * 4) * .5 + y * .9) * .5 + (y < 3 ? .4 : 0), x, y));
    for (const [x, y] of [[3, 4], [10, 9], [6, 13]]) { g.set((x + k * 3) % 16, y, R.water[4]); g.set((x + k * 3 + 1) % 16, y, R.water[3]); } return g; }, 4, "四帧循环");
  tile("dock", "码头木板", () => { const g = new G(16, 16), r = rng(13); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const pl = y % 4 === 3; g.set(x, y, pl ? R.wood[0] : pick(R.wood, 2.4 + (y % 4 === 0 ? .8 : 0) + Math.sin(x * 1.7 + (y / 4 | 0) * 3) * .3 + (r() - .5) * .3, x, y)); }
    for (const [x, y] of [[2, 1], [13, 5], [6, 9], [11, 13]]) g.set(x, y, R.iron[3]); return g; });
  tile("roof", "瓦片屋顶", () => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 2, xx = (x + row * 2) % 4, yy = y % 4; g.set(x, y, pick(R.orange, (yy === 0 ? 3.4 : yy === 3 ? .6 : 2) - (xx === 3 ? .8 : 0), x, y)); } return g; });
  tile("brick", "圣堂石砖", () => { const g = new G(16, 16), r = rng(14); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 2, off = row % 2 ? 4 : 0, mort = y % 4 === 3 || (x + off) % 8 === 7; g.set(x, y, mort ? R.ink[1] : pick(R.stone, 2 + (y % 4 === 0 ? .9 : 0) + ((x + off) % 8 === 0 ? .5 : 0) + (r() - .5) * .5, x, y)); }
    pts(g, [[3, 5], [12, 10]], R.moss[2]); return g; });
  tile("marble", "大理石地面", () => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = ((x >> 3) + (y >> 3)) % 2; g.set(x, y, pick(c ? R.marble : R.stone, (c ? 2.3 : 2) + (x % 8 === 0 || y % 8 === 0 ? -.7 : 0) + (y < 8 ? .25 : 0), x, y)); }
    line(g, 1, 2, 6, 7, R.marble[1]); line(g, 9, 9, 14, 11, R.marble[4]); return g; });
  tile("carpet", "红毯", () => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, x < 2 || x > 13 ? (x === 0 || x === 15 ? R.gold[1] : R.gold[3]) : pick(R.red, 1.6 + ((x + y) % 6 === 0 ? .8 : 0) + Math.sin(y * .8) * .2, x, y)); return g; });
  tile("glass", "彩窗（16×32）", () => { const g = new G(16, 32); const cols = [R.blue, R.purple, R.gold, R.cyan, R.red];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) { const d = y < 8 ? Math.hypot(x + .5 - 8, y + .5 - 8) : 0; if (y < 8 && d > 7.5) continue; const lead = x === 0 || x === 15 || x % 5 === 0 || y % 6 === 0 || (y < 8 && Math.abs(d - 7.5) < .8); const ci = ((x / 5 | 0) * 3 + (y / 6 | 0)) % cols.length; g.set(x, y, lead ? R.ink[1] : pick(cols[ci], 2.2 + (y < 16 ? .7 : 0) - (x > 10 ? .5 : 0), x, y)); }
    glow(g, 8, 10, 12, R.gold[4], .25); return g; });
  tile("rubble", "废墟碎石", () => { const g = new G(16, 16), r = rng(15); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.rust, 1.2 + (r() - .5) * .6, x, y));
    for (let i = 0; i < 5; i++) { const cx = r() * 16, cy = r() * 16, s = 1.6 + r() * 2; sphere(g, cx, cy, s, s * .7, i % 2 ? R.stone : R.rust); } line(g, 2, 14, 12, 9, R.rust[3]); return g; });
  tile("metal", "铆钉钢板", () => { const g = new G(16, 16); box(g, 0, 0, 16, 16, R.iron, { base: 1.8 }); for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { g.set(x, y, R.iron[4]); g.set(x + 1, y + 1, R.iron[0]); } line(g, 4, 9, 11, 7, R.iron[1]); return g; });
  tile("conveyor", "传送带", k => { const g = new G(16, 16); box(g, 0, 4, 16, 10, R.ink, { base: 2 }); for (let x = 0; x < 16; x++) if ((x + k * 2) % 4 < 2) { g.set(x, 5, R.iron[3]); g.set(x, 12, R.iron[2]); }
    for (const x of [3, 11]) sphere(g, x + .5, 15, 1.6, 1.6, R.iron); for (let x = 0; x < 16; x++) g.set(x, 3, ((x + k * 2) >> 1) % 2 ? R.gold[3] : R.ink[1]); return g; }, 2, "两帧滚动");
  tile("hazard", "警示条纹", () => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, ((x + y) >> 2) % 2 ? pick(R.gold, 3 - (y > 12 ? 1 : 0), x, y) : R.ink[2]); return g; });
  tile("neon", "霓虹面板", k => { const g = new G(16, 16); box(g, 0, 0, 16, 16, R.ink, { base: 2 }); for (let y = 3; y < 13; y += 3) for (let x = 2; x < 14; x++) g.set(x, y, (x + y + k) % 5 ? R.pink[k ? 3 : 2] : R.cyan[3]);
    glow(g, 8, 8, 10, R.pink[3], k ? .35 : .2); return g; }, 2, "两帧闪烁");
  tile("pipe", "管线", () => { const g = new G(16, 16); for (let y = 4; y < 12; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.steel, 3.6 - Math.abs(y - 6.5) * .7, x, y)); box(g, 6, 3, 4, 10, R.iron); g.set(7, 5, R.cyan[3]); return g; });

  /* ---------- 7. props ---------- */
  def("prop", "cooker", "电饭锅", () => [0, 1].map(k => { const g = new G(24, 24); sphere(g, 12, 15, 10, 8, R.rice, { lv: -.2 }); sphere(g, 12, 9, 9, 3.4, R.rice, { lv: .6 }); box(g, 9, 4, 6, 3, R.iron);
    box(g, 4, 16, 16, 2, R.blue, { noBevel: true, base: 2.4 }); sphere(g, 17, 19, 1.6, 1.6, k ? R.red : R.green, { lv: 1.4 });
    if (k) pts(g, [[10, 1], [11, 0], [14, 1], [13, 0]], R.rice[2]); else pts(g, [[11, 1], [12, 0]], R.rice[1]); const o = outline(g); glow(o, 18, 20, 4, k ? R.red[3] : R.green[3], .5); return o; }), "两帧：保温 / 煮好了");
  def("prop", "crate", "数据箱", () => { const g = new G(16, 16); box(g, 0, 0, 16, 16, R.wood); for (const v of [0, 15]) { line(g, v, 0, v, 15, R.wood[1]); line(g, 0, v, 15, v, R.wood[1]); } line(g, 1, 1, 14, 14, R.wood[1]); line(g, 2, 1, 14, 13, R.wood[3]); box(g, 5, 6, 6, 4, R.ink, { noBevel: true, base: 2 }); pts(g, [[6, 7], [8, 7], [9, 8]], R.cyan[3]); return outline(g); });
  def("prop", "barrel", "冷却液桶", () => { const g = new G(16, 20); for (let y = 0; y < 20; y++) for (let x = 1; x < 15; x++) g.set(x, y, pick(R.cyan, 3.2 - Math.abs(x - 5) * .35 - (y > 16 ? .8 : 0), x, y)); for (const y of [3, 10, 17]) for (let x = 1; x < 15; x++) g.set(x, y, R.iron[x < 6 ? 3 : 1]); box(g, 4, 6, 8, 3, R.gold, { base: 2.6 }); return outline(g); });
  def("prop", "server", "服务器机柜", () => [0, 1].map(k => { const g = new G(18, 36), r = rng(20 + k); box(g, 0, 0, 18, 36, R.ink, { base: 2.2 }); for (let y = 3; y < 33; y += 4) { box(g, 2, y, 14, 3, R.iron, { base: 1.6 }); for (let x = 3; x < 14; x += 2) if (r() < .5) g.set(x, y + 1, r() < .7 ? R.green[3] : R.cyan[4]); }
    const o = outline(g); glow(o, 9, 18, 14, R.cyan[2], .15); return o; }), "两帧指示灯");
  def("prop", "lamppost", "港口路灯", () => { const g = new G(14, 40); box(g, 6, 8, 2, 30, R.iron, { base: 1.6 }); box(g, 3, 37, 8, 3, R.iron); box(g, 3, 2, 8, 7, R.ink, { base: 2 }); sphere(g, 7, 5.5, 2.4, 2.4, R.gold, { lv: 1.8 });
    const o = outline(g); glow(o, 8, 6, 12, R.gold[3], .5); return o; });
  def("prop", "banner", "圣会旗帜", () => { const g = new G(18, 40); line(g, 1, 0, 16, 0, R.gold[2]); poly(g, [[2, 1], [16, 1], [16, 36], [9, 31], [2, 36]], R.ink, { v0: 2.4, v1: 1, hx: 1 });
    for (let a = 0; a < 16; a++) { const t = a * Math.PI / 8, l = a % 2 ? 4 : 5.5; line(g, 9, 13, 9 + Math.cos(t) * l, 13 + Math.sin(t) * l, R.gold[a % 2 ? 2 : 3]); } sphere(g, 9, 13, 2.6, 2.6, R.gold, { lv: 1 });
    for (let a = 0; a < 10; a++) { const t = a * Math.PI / 5; g.set(9 + Math.cos(t) * 3.6, 13 + Math.sin(t) * 3.6, R.iron[3]); } for (let x = 2; x < 17; x++) g.set(x, 2, R.gold[3]); return outline(g); });
  def("prop", "pigeon", "信鸽", () => [0, 1].map(k => { const g = new G(16, 12); sphere(g, 8, 7, 5, 3, R.marble); sphere(g, 12, 5, 2.4, 2.2, R.marble, { lv: .4 }); g.set(13, 4, R.ink[1]); pts(g, [[15, 5], [14, 5]], R.orange[2]);
    if (k) poly(g, [[4, 6], [10, 6], [5, 0]], R.marble, { v0: 3.6, v1: 2 }); else poly(g, [[4, 7], [10, 7], [3, 11]], R.marble, { v0: 2.6, v1: 1.4 }); poly(g, [[2, 6], [5, 6], [0, 9]], R.marble, { flat: 1 });
    box(g, 6, 8, 3, 2, R.rice, { noBevel: true, base: 4 }); return outline(g); }), "两帧扑翼 · 腿上绑着信");
  def("prop", "sign403", "403 封锁牌", () => { const g = new G(28, 18); box(g, 0, 0, 28, 14, R.ink, { base: 1.8 }); const D = { 4: ["101", "101", "111", "001", "001"], 0: ["111", "101", "101", "101", "111"], 3: ["111", "001", "111", "001", "111"] };
    [4, 0, 3].forEach((n, i) => D[n].forEach((row, y) => [...row].forEach((v, x) => { if (v === "1") { g.set(5 + i * 6 + x * 1.5, 4 + y, R.red[4]); g.set(6 + i * 6 + x * 1.5, 4 + y, R.red[3]); } })));
    box(g, 12, 14, 4, 4, R.iron); const o = outline(g); glow(o, 14, 7, 13, R.red[3], .4); return o; });
  def("prop", "bowl", "大肥鱼的铁盆", () => { const g = new G(22, 14); for (let y = 3; y < 14; y++) for (let x = 0; x < 22; x++) { const dx = (x + .5 - 11) / 11, dy = (y + .5 - 3) / 10.5; if (dx * dx + dy * dy <= 1) g.set(x, y, pick(R.iron, 3.6 - dy * 2 - (dx > .4 ? 1.2 : 0) + (dx < -.6 ? .5 : 0), x, y)); }
    sphere(g, 11, 3.5, 10, 3, R.rice, { lv: .6 }); for (let x = 0; x < 22; x++) g.set(x, 5, x < 8 ? R.iron[4] : R.iron[3]); pts(g, [[6, 2], [9, 1], [13, 2], [15, 3]], "#ffffff"); return outline(g); });
  def("prop", "storybook", "空白最后一页的童话书", () => { const g = new G(26, 18); poly(g, [[1, 3], [12, 1], [13, 15], [1, 17]], R.rice, { v0: 3.4, v1: 2.4 }); poly(g, [[13, 1], [24, 3], [24, 17], [13, 15]], R.rice, { v0: 4, v1: 3 });
    for (let y = 4; y < 14; y += 2) line(g, 3, y, 10, y - 1, R.stone[3]); line(g, 13, 1, 13, 15, R.wood[1]); poly(g, [[16, 8], [21, 7], [19, 11]], R.blue, { flat: 3 }); g.set(17, 8, R.ink[1]); return outline(g); });

  /* ---------- 8. buildings (56×56) ---------- */
  function house(g, x, y, w, h, wall, roof, o = {}) { box(g, x, y - h, w, h, wall, { base: o.wb ?? 2.2 }); poly(g, o.flatRoof ? [[x - 2, y - h], [x + w + 2, y - h], [x + w + 2, y - h - 4], [x - 2, y - h - 4]] : [[x - 3, y - h + 1], [x + w / 2, y - h - (o.rh || 12)], [x + w + 3, y - h + 1]], roof, { v0: 3.4, v1: 1.6, hx: 1.6 });
    if (!o.noDoor) { box(g, x + w / 2 - 3, y - 9, 6, 9, R.wood, { base: 1.4 }); g.set(x + w / 2 + 1, y - 5, R.gold[3]); } }
  function win(g, x, y, w, h, lit) { box(g, x, y, w, h, R.ink, { noBevel: true, base: 1.2 }); if (lit) for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) g.set(x + i, y + j, pick(R.gold, 3.4 - j * .3, x + i, y + j)); }
  const bld = (id, name, fn, note) => def("building", id, name, () => { const g = new G(56, 56); fn(g); const o = outline(g); return o; }, note);
  bld("canteen", "食堂", g => { house(g, 6, 54, 44, 24, R.rice, R.orange); win(g, 10, 36, 8, 7, 1); win(g, 38, 36, 8, 7, 1); box(g, 36, 8, 5, 12, R.brick); pts(g, [[38, 5], [39, 3], [37, 1]], R.rice[2]);
    sphere(g, 28, 22, 6, 3.6, R.rice, { lv: .4 }); for (let x = 22; x < 35; x++) g.set(x, 24, R.blue[3]); glow(g, 14, 40, 8, R.gold[3], .3); });
  bld("datacenter", "数据中心", g => { box(g, 4, 18, 48, 36, R.steel, { base: 1.8 }); for (let y = 22; y < 50; y += 5) for (let x = 8; x < 48; x += 3) g.set(x, y, (x * y) % 7 < 3 ? R.cyan[3] : R.green[3]);
    for (const x of [10, 24, 38]) { sphere(g, x + 4, 14, 5, 3, R.iron, { upper: true }); line(g, x + 1, 13, x + 7, 13, R.iron[1]); } box(g, 22, 44, 12, 10, R.ink, { base: 1.6 }); glow(g, 28, 36, 20, R.cyan[2], .18); });
  bld("windmill", "电站 · 风车", g => { poly(g, [[22, 54], [34, 54], [31, 16], [25, 16]], R.marble, { v0: 3.4, v1: 1.6, hx: 1.4 }); sphere(g, 28, 15, 4, 4, R.iron);
    for (let a = 0; a < 4; a++) { const t = a * Math.PI / 2 + .4; poly(g, [[28, 15], [28 + Math.cos(t) * 24 + Math.cos(t + 1.57) * 3, 15 + Math.sin(t) * 24 + Math.sin(t + 1.57) * 3], [28 + Math.cos(t) * 24, 15 + Math.sin(t) * 24]], R.rice, { v0: 3.6, v1: 2.4 }); }
    box(g, 25, 46, 6, 8, R.wood); win(g, 26, 30, 4, 5, 1); pts(g, [[40, 46], [41, 45], [42, 46]], R.gold[4]); });
  bld("workshop", "标注工坊", g => { house(g, 6, 54, 42, 22, R.marble, R.ink, { flatRoof: true }); win(g, 10, 38, 10, 6, 1); win(g, 34, 38, 10, 6, 0);
    line(g, 44, 28, 44, 8, R.gold[2], 2); line(g, 44, 8, 30, 8, R.gold[2], 2); line(g, 32, 9, 32, 16, R.iron[3]); box(g, 29, 16, 6, 4, R.cyan, { base: 2 }); glow(g, 32, 18, 6, R.cyan[3], .4); });
  bld("archive", "档案馆", g => { house(g, 8, 54, 40, 28, R.purple, R.ink, { rh: 14 }); sphere(g, 28, 30, 6, 6, R.gold, { lv: 1.4 }); sphere(g, 30, 28.5, 5.2, 5.2, R.purple, { flat: 1 });
    win(g, 12, 38, 6, 8, 1); win(g, 38, 38, 6, 8, 1); glow(g, 27, 31, 10, R.gold[3], .3); });
  bld("observatory", "天文台", g => { box(g, 10, 30, 36, 24, R.stone); sphere(g, 28, 30, 18, 14, R.steel, { upper: true }); box(g, 27, 16, 4, 14, R.ink, { noBevel: true, base: 1 });
    line(g, 29, 22, 44, 6, R.gold[3], 3); box(g, 24, 44, 8, 10, R.wood); pts(g, [[8, 6], [50, 12], [46, 3], [14, 14]], R.rice[4]); glow(g, 44, 6, 6, R.purple[3], .4); });
  bld("tavern", "酒馆", g => { house(g, 6, 54, 44, 26, R.brick, R.ink, { rh: 14 }); win(g, 10, 36, 8, 8, 1); win(g, 38, 36, 8, 8, 1);
    box(g, 18, 18, 20, 8, R.ink, { base: 1.6 }); poly(g, [[22, 22], [28, 19], [34, 22], [31, 24], [28, 23], [25, 24]], R.red, { flat: 3 }); glow(g, 14, 40, 9, R.orange[3], .35); glow(g, 42, 40, 9, R.orange[3], .35); });
  bld("pigeontower", "信鸽塔 · 心灯", g => { poly(g, [[20, 54], [36, 54], [33, 14], [23, 14]], R.marble, { v0: 3.4, v1: 1.4, hx: 1.2 }); poly(g, [[20, 14], [36, 14], [28, 4]], R.orange, { v0: 3.4, v1: 2 });
    box(g, 24, 15, 8, 6, R.ink, { noBevel: true, base: 1 }); sphere(g, 28, 18, 2.6, 2.6, R.orange, { lv: 1.6 }); for (const [x, y] of [[8, 10], [44, 6], [48, 14]]) { g.set(x, y, R.marble[4]); g.set(x - 1, y - 1, R.marble[3]); g.set(x + 1, y - 1, R.marble[3]); }
    win(g, 26, 30, 4, 6, 0); box(g, 25, 46, 6, 8, R.wood); glow(g, 28, 18, 14, R.orange[3], .45); });
  bld("radio", "港口电台", g => { house(g, 8, 54, 36, 20, R.pink, R.ink, { flatRoof: true }); line(g, 36, 30, 36, 2, R.iron[3]); for (let y = 4; y < 30; y += 5) { line(g, 33, y, 39, y + 4, R.iron[2]); line(g, 39, y, 33, y + 4, R.iron[2]); }
    sphere(g, 36, 2, 1.6, 1.6, R.red, { lv: 1.6 }); win(g, 12, 40, 10, 6, 1); glow(g, 36, 2, 6, R.red[3], .6); });
  bld("academy", "竹林书院", g => { for (const x of [2, 7, 48, 52]) { box(g, x, 6, 3, 48, R.grass, { base: 2 }); for (let y = 12; y < 54; y += 9) g.set(x + 1, y, R.grass[0]); }
    box(g, 12, 32, 32, 22, R.rice); poly(g, [[6, 33], [50, 33], [44, 24], [12, 24]], R.blue, { v0: 3, v1: 1.6 }); pts(g, [[5, 32], [51, 32], [4, 31], [52, 31]], R.blue[3]); win(g, 16, 38, 8, 8, 1); win(g, 32, 38, 8, 8, 1); box(g, 25, 44, 6, 10, R.wood); });

  /* ---------- 9. backgrounds (256×144) ---------- */
  const BW = 256, BH = 144;
  const bg = (id, name, fn, note) => def("bg", id, name, () => { const g = new G(BW, BH); fn(g, rng(id.length * 97 + 3)); return g; }, note, 3);
  bg("bay_day", "白饭湾 · 正午", (g, r) => {
    skyRows(g, ["#5fa8e8", "#7fbff0", "#a9d6f4", "#d6ecf2", "#ffe6b8"], 0, 90); sphere(g, 200, 30, 13, 13, R.gold, { lv: 2.2 }); glow(g, 200, 30, 40, R.gold[4], .4);
    for (const [cx, cy, w] of [[50, 26, 30], [120, 18, 22], [170, 52, 26]]) { sphere(g, cx, cy, w, 6, R.rice, { lv: .6 }); sphere(g, cx + w * .4, cy - 3, w * .5, 5, R.rice, { lv: .9 }); }
    ridge(g, r, 82, 14, .03, (x, y, t) => pick(R.moss, 2.4 - (y - t) * .05, x, y)); skyRows(g, R.water.slice(1).reverse().reverse(), 96, 144);
    for (let y = 96; y < 144; y += 3) for (let x = 0; x < BW; x++) if (Math.sin(x * .2 + y) > .85) g.set(x, y, R.water[4]);
    for (let x = 0, i = 0; x < BW; i++) { const w = 12 + r() * 14 | 0, h = 10 + r() * 16 | 0; box(g, x, 96 - h, w, h, R.rice, { base: 2.2 }); poly(g, [[x - 1, 96 - h], [x + w / 2, 96 - h - 7], [x + w + 1, 96 - h]], i % 3 ? R.orange : R.brick, { v0: 3.2, v1: 1.6 }); if (r() < .6) { g.set(x + 3, 96 - h + 4, R.gold[3]); g.set(x + 4, 96 - h + 4, R.gold[3]); } x += w + 2; }
    box(g, 0, 94, BW, 3, R.wood, { base: 2 }); for (let x = 4; x < BW; x += 18) box(g, x, 97, 2, 10, R.wood, { base: 1 });
    poly(g, [[150, 116], [196, 116], [188, 124], [158, 124]], R.rice, { v0: 3.6, v1: 2 }); line(g, 172, 92, 172, 116, R.wood[1]); poly(g, [[174, 94], [192, 112], [174, 112]], R.rice, { v0: 4, v1: 3 });
    fog(g, 60, 96, "#ffe6b8", .25); particles(g, r, 20, [0, 0, BW, 80], [R.rice[4], "#ffffff"]);
  }, "三层视差：天空、远山与房屋、海面");
  bg("cathedral", "穹顶城 · 圣堂夜", (g, r) => {
    skyRows(g, ["#05050d", "#0d0b1c", "#1a1530", "#2c1f3a", "#40263c"], 0, 144); stars(g, r, 90, 70, ["#ffffff", "#c8c8ff", "#8888b8"]);
    for (let x = 0; x < BW;) { const w = 10 + r() * 18 | 0, h = 30 + r() * 60 | 0; box(g, x, 144 - h, w, h, R.ink, { base: 1.6, noBevel: true }); if (r() < .5) poly(g, [[x, 144 - h], [x + w / 2, 144 - h - 14 - r() * 20], [x + w, 144 - h]], R.ink, { flat: 1 }); for (let k = 0; k < 4; k++) if (r() < .5) g.set(x + 2 + r() * (w - 4), 144 - h + 6 + r() * (h - 10), R.gold[2]); x += w + 1; }
    const C = 128; box(g, C - 46, 50, 92, 94, R.stone, { base: 1.4, noBevel: true }); poly(g, [[C - 46, 50], [C, 8], [C + 46, 50]], R.stone, { v0: 2, v1: 1 }); for (const d of [-60, 60]) { box(g, C + d - 12, 30, 24, 114, R.stone, { base: 1.2, noBevel: true }); poly(g, [[C + d - 12, 30], [C + d, -4], [C + d + 12, 30]], R.stone, { flat: 1 }); }
    for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) { const d = Math.hypot(x - 14.5, y - 14.5); if (d > 14) continue; const sp = Math.abs(Math.sin(Math.atan2(y - 14.5, x - 14.5) * 4)) < .12 || Math.abs(d - 9) < .7; g.set(C - 15 + x, 52 + y, sp ? R.ink[1] : pick([R.gold, R.purple, R.red, R.blue][((Math.atan2(y - 14.5, x - 14.5) + 4) * 1.3 | 0) & 3], 2.6 + (d < 5 ? 1.4 : 0), x, y)); }
    for (const x of [C - 34, C - 24, C + 18, C + 28]) { box(g, x, 92, 6, 26, R.ink, { noBevel: true, base: 1 }); for (let y = 94; y < 116; y++) g.set(x + 2 + (y % 2), y, R.gold[2]); }
    glow(g, C, 66, 70, R.gold[3], .35); shaft(g, C - 10, C + 10, 66, 144, R.gold[3], .18); fog(g, 100, 144, "#2c1f3a", .55);
    for (let x = C - 30; x < C + 30; x += 4) { box(g, x, 128, 3, 16, R.ink, { noBevel: true, base: 0 }); g.set(x + 1, 126, R.ink[0]); }
    particles(g, r, 40, [C - 50, 60, C + 50, 140], [R.gold[4], R.gold[3]]);
  }, "金色烛光 + 体积光柱 + 剪影人群");
  bg("waste", "荒原 · 黄昏", (g, r) => {
    skyRows(g, ["#1c0f22", "#3c1a2c", "#7a2e34", "#c45a38", "#f2a050"], 0, 110); sphere(g, 70, 96, 22, 22, R.gold, { lv: 1.8 }); glow(g, 70, 96, 70, R.orange[3], .45);
    for (let L = 0; L < 3; L++) { const base = 100 + L * 14, col = [R.brick[1], R.rust[0], R.ink[0]][L]; for (let x = 0; x < BW;) { const w = 6 + r() * 20 | 0, h = (L === 0 ? 30 : 16) + r() * (L === 0 ? 40 : 24) | 0; for (let y = base - h; y < BH; y++) for (let i = 0; i < w; i++) if (!(y < base - h + 6 && (i * 7 + y) % 5 === 0)) g.set(x + i, y, col); if (r() < .4) line(g, x + w / 2, base - h, x + w / 2 + 4, base - h - 8, col); x += w + (r() * 10 | 0); } }
    skyRows(g, [R.rust[1], R.rust[0], R.ink[0]], 130, 144);
    for (let i = 0; i < 5; i++) { const x = 30 + i * 48 + r() * 10, y = 124 - r() * 4; g.set(x, y, R.red[4]); glow(g, x, y, 5, R.red[3], .7, true); }
    fog(g, 70, 130, "#f2a050", .3); particles(g, r, 50, [0, 20, BW, 130], [R.sand[3], R.orange[3]]);
  }, "剪影废墟 + 远处失控体的红色眼睛");
  bg("skyway", "穹顶城 · 霓虹高架", (g, r) => {
    skyRows(g, ["#0a0618", "#1a0c34", "#36125a", "#5a1a6a", "#7a2468"], 0, 144);
    for (let L = 0; L < 3; L++) { const col = [R.purple[0], R.ink[1], R.ink[0]][L], top = [30, 50, 74][L]; for (let x = 0; x < BW;) { const w = 10 + r() * 24 | 0, h = BH - top - r() * 40 | 0; box(g, x, BH - h, w, h, [R.purple, R.ink, R.ink][L], { base: [1, 1.4, .6][L], noBevel: true }); for (let k = 0; k < 10; k++) if (r() < .5) g.set(x + 1 + r() * (w - 2), BH - h + 2 + r() * (h - 4), [R.pink[3], R.cyan[3], R.gold[3]][r() * 3 | 0]); x += w + 1; } }
    for (const y of [96, 112]) { for (let x = 0; x < BW; x++) { g.set(x, y, R.cyan[3]); g.set(x, y + 1, R.ink[1]); g.set(x, y + 2, R.ink[0]); } glow(g, 128, y, 120, R.cyan[2], .15); }
    for (let i = 0; i < 6; i++) { const x = r() * BW, y = 30 + r() * 50; box(g, x, y, 16, 7, R.ink, { noBevel: true, base: 1 }); for (let k = 0; k < 14; k++) g.set(x + 1 + k, y + 3, (k + i) % 3 ? R.pink[3] : R.cyan[4]); glow(g, x + 8, y + 3, 14, R.pink[3], .3); }
    line(g, 220, 10, 90, 90, R.rice[4], 2); glow(g, 155, 50, 30, R.rice[4], .2); fog(g, 80, 144, "#7a2468", .35);
    for (let i = 0; i < 70; i++) { const x = r() * BW, y = r() * BH; line(g, x, y, x - 1, y + 4, R.purple[2]); }
  }, "霓虹招牌 + 雨 + 白龙划过的光束");
  bg("factory", "回收站", (g, r) => {
    skyRows(g, ["#0a0405", "#1c080a", "#2e0c10", "#3e1014"], 0, 144);
    for (let y = 30; y < 144; y += 34) { for (let x = 0; x < BW; x++) { g.set(x, y, R.iron[1]); g.set(x, y + 1, R.ink[1]); } for (let x = (y * 3) % 40; x < BW; x += 40) { box(g, x, y - 16, 22, 16, R.rust, { base: 1.4 }); sphere(g, x + 11, y - 10, 4, 4, R.iron, { lv: -.4 }); g.set(x + 12, y - 11, R.red[3]); } }
    for (let x = 20; x < BW; x += 60) { line(g, x, 0, x, 144, R.ink[2], 3); line(g, x - 10, 0, x + 10, 0, R.iron[2]); }
    for (const x of [40, 128, 216]) { sphere(g, x, 8, 3, 3, R.red, { lv: 1.6 }); glow(g, x, 8, 50, R.red[3], .3); shaft(g, x - 3, x + 3, 10, 144, R.red[3], .12); }
    fog(g, 60, 144, "#3e1014", .45); particles(g, r, 40, [0, 0, BW, BH], [R.red[3], R.gold[3]]);
  }, "流水线、吊钩和红色警灯");
  bg("seal", "地底 · 巴别封印", (g, r) => {
    skyRows(g, ["#020208", "#050512", "#0a0a20", "#0e0c2a"], 0, 144);
    for (let x = 0; x < BW; x += 22) { box(g, x, 0, 10, 144, R.ink, { base: 1.4, noBevel: true }); for (let y = 0; y < 144; y += 12) g.set(x + 4, y, R.purple[1]); }
    for (let y = 0; y < 144; y++) for (let x = 108; x < 148; x++) { const c = g.get(x, y), s = 1 - Math.abs(x - 128) / 20; g.set(x, y, add(c, "#d8d0ff", s * s * .55)); }
    for (let k = 0; k < 3; k++) for (let a = 0; a < 360; a += 2) { const t = a * Math.PI / 180; g.set(128 + Math.cos(t) * (40 + k * 26), 122 + Math.sin(t) * (7 + k * 4), a % 20 < 10 ? R.gold[3 - k] : R.purple[3]); }
    for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; sphere(g, 128 + Math.cos(t) * 92, 122 + Math.sin(t) * 15, 1.6, 1.6, R.gold, { lv: 2 }); }
    glow(g, 128, 122, 90, R.purple[3], .3); particles(g, r, 80, [60, 0, 196, 144], [R.purple[4], R.marble[4], R.gold[4]]);
  }, "光柱、法阵、悬浮的光尘");

  /* ---------- 10. UI kit ---------- */
  function panel(w, h, style) { const g = new G(w, h), st = style === "synod" ? { b: R.gold, f: R.ink } : { b: R.wood, f: R.sand };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const e = Math.min(x, y, w - 1 - x, h - 1 - y); if (e === 0) g.set(x, y, st.b[0]); else if (e === 1) g.set(x, y, st.b[x < w / 2 && y < h / 2 ? 3 : 2]); else if (e === 2) g.set(x, y, st.b[1]); else g.set(x, y, pick(st.f, style === "synod" ? 1.4 + (y < 6 ? .4 : 0) : 3 - y / h * .8, x, y)); }
    for (const [cx, cy] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) { g.set(cx, cy, st.b[4]); if (style === "synod") { g.set(cx + (cx < 5 ? 1 : -1), cy, st.b[3]); g.set(cx, cy + (cy < 5 ? 1 : -1), st.b[3]); } }
    return g; }
  def("ui", "panel_bay", "面板 · 白饭湾（木）", () => panel(48, 32, "bay"), "可九宫格拉伸，角 4px");
  def("ui", "panel_synod", "面板 · 圣会（金石）", () => panel(48, 32, "synod"), "可九宫格拉伸，角 4px");
  def("ui", "buttons", "按钮 · 常态 / 悬停 / 按下", () => ["n", "h", "p"].map(s => { const g = new G(44, 16); const base = s === "h" ? 3 : s === "p" ? 1.4 : 2.4;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 44; x++) { const e = Math.min(x, y, 43 - x, 15 - y); g.set(x, y, e === 0 ? R.ink[0] : (s === "p" ? y < 3 : y > 12) ? R.gold[1] : pick(R.gold, base + (y < 5 ? .7 : 0) - (y > 10 ? .5 : 0), x, y)); }
    for (let x = 14; x < 30; x++) g.set(x, s === "p" ? 9 : 8, R.ink[1]); return g; }));
  function bar(w, ramp, frac, icon) { const g = new G(w, 10); for (let y = 0; y < 10; y++) for (let x = 0; x < w; x++) { const e = Math.min(x, y, w - 1 - x, 9 - y); g.set(x, y, e === 0 ? R.ink[0] : e === 1 ? R.iron[1] : x < 2 + (w - 4) * frac ? pick(ramp, 3.4 - (y - 2) * .45, x, y) : R.ink[2]); } for (let x = 6; x < w - 2; x += 6) g.set(x, 7, R.ink[1]); return g; }
  def("ui", "bars", "数值条 · 生命 / Token / 算力 / 幻觉", () => { const g = new G(80, 46); g.blit(bar(80, R.red, .72), 0, 0); g.blit(bar(80, R.rice, .45), 0, 12); g.blit(bar(80, R.cyan, .9), 0, 24); g.blit(bar(80, R.pink, .2), 0, 36); return g; });
  def("ui", "tempslider", "温度滑块", () => [0, 1].map(k => { const g = new G(96, 16); for (let x = 2; x < 94; x++) for (let y = 6; y < 10; y++) g.set(x, y, y === 6 ? R.ink[0] : pick(k ? R.orange : R.stone, 1.4 + x / 94 * 2.4, x, y));
    for (let x = 2; x < 94; x += 12) { g.set(x, 12, R.iron[3]); g.set(x, 13, R.iron[2]); } const kx = k ? 46 : 4; sphere(g, kx, 8, 5, 5, k ? R.orange : R.marble, { lv: .6 }); if (!k) { box(g, kx - 2, 6, 5, 4, R.iron, { noBevel: true, base: 1 }); } else glow(g, kx, 8, 10, R.orange[3], .5); return g; }), "左：克劳德（锁定在 0）· 右：0.7");
  def("ui", "quota", "额度 · 白龙", () => { const g = new G(80, 12); for (let i = 0; i < 12; i++) { const on = i < 3; sphere(g, 4 + i * 6.4, 6, 2.6, 3.4, on ? R.rice : R.stone, { lv: on ? 1 : -.4 }); if (on) glow(g, 4 + i * 6.4, 6, 4, R.rice[4], .3); } return g; }, "已用 9 / 12");
  def("ui", "cursor", "光标", () => { const g = new G(12, 14); poly(g, [[0, 0], [10, 8], [5, 8], [7, 13], [5, 14], [3, 9], [0, 12]], R.rice, { v0: 4, v1: 2.6 }); return outline(g); });
  def("ui", "hotbar", "快捷栏", () => { const g = new G(108, 22); const ic = ["token", "power", "hqdata", "lora", "heartlamp"]; ic.forEach((id, i) => { g.blit(panel(20, 20, i === 0 ? "synod" : "bay"), 1 + i * 21, 1); const a = A.find(v => v.id === id); if (a) g.blit(a.frames[0], 2 + i * 21, 2); }); return g; });

  /* ---------- 11. screen mock-ups (320×180) ---------- */
  const get = id => A.find(a => a.id === id).frames;
  def("mock", "shooter", "横版射击 · 荒原", () => { const g = new G(320, 180), b = get("waste")[0];
    for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) g.set(x, y, b.get(x * 256 / 320, y * 144 / 180));
    for (let x = 0; x < 320; x += 16) { g.blit(get("rubble")[0], x, 150); g.blit(get("metal")[0], x, 164); }
    g.blit(get("tiepen")[0], 40, 106); g.blit(get("rogue")[0], 210, 102); g.blit(get("crawler")[0], 268, 130); g.blit(get("spam")[0], 170, 40);
    const bl = get("bullets")[0]; for (let i = 0; i < 4; i++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = bl.get(x, y); if (c) g.set(104 + i * 24 + x, 124 + y, c); }
    g.blit(get("muzzle")[0], 96, 121); g.blit(get("explosion")[2], 222, 96); g.blit(get("spark")[1], 268, 128);
    g.blit(panel(104, 36, "bay"), 4, 4); g.blit(bar(80, R.red, .72), 18, 10); g.blit(bar(80, R.rice, .45), 18, 24); g.blit(get("token")[0], 4, 20);
    g.blit(panel(70, 18, "synod"), 246, 4); for (let i = 0; i < 6; i++) g.set(256 + i * 9, 12, R.gold[4]); return g; }, "铁盆号对战失控体");
  def("mock", "dialogue", "剧情对话 · 圣堂", () => { const g = new G(320, 180), b = get("cathedral")[0];
    for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) g.set(x, y, b.get(x * 256 / 320, y * 144 / 180));
    const p = panel(300, 54, "synod"); g.blit(p, 10, 120); g.blit(panel(50, 50, "bay"), 16, 122);
    if (root.AIG) { const c = root.AIG.grid("claude"); for (let y = 0; y < 44; y++) for (let x = 0; x < 44; x++) { const col = (c[y + 8] || [])[x + 10]; if (col) g.set(19 + x, 125 + y, col); } }
    for (let i = 0; i < 3; i++) for (let x = 76; x < 76 + [200, 170, 120][i]; x++) if (x % 7) g.set(x, 140 + i * 9, R.rice[3]); for (let x = 76; x < 116; x++) g.set(x, 130, R.orange[3]);
    sphere(g, 300, 166, 2, 2, R.gold, { lv: 2 }); return g; }, "立绘头像 + 金石对话框");

  root.KIT = { R, A, mix };
})(typeof window !== "undefined" ? window : globalThis);

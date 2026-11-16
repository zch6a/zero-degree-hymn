/* 《零度圣歌》像素美术套件 v2 · 原创
   关键技术：平滑轮廓（Chaikin 细分）+ 距离场“雕塑式”体积光照，取代方框和椭圆填充；
   抖动只出现在色阶交界的窄带；选择性描边；边缘光、自发光、雾与光柱。 */
(function (root) {
  /* ---------- color ---------- */
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
  // pick: dithering only inside a narrow band around each step, flat colour elsewhere
  const pick = (ramp, v, x, y, band = .14) => { const n = ramp.length - 1; v = Math.max(0, Math.min(n, v)); const b = Math.floor(v), f = v - b; let i = f < .5 - band ? b : f > .5 + band ? b + 1 : (f > th(x, y) ? b + 1 : b); return ramp[Math.min(n, i)]; };
  const pickD = (ramp, v, x, y) => pick(ramp, v, x, y, .5); // full dithering (skies)

  /* ---------- masks & sculpted shading ---------- */
  class M { constructor(w, h) { this.w = w; this.h = h; this.a = new Uint8Array(w * h); } on(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.a[y * this.w + x] > 0; } put(x, y, v = 1) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y * this.w + x] = v; } }
  function chaikin(p, n = 2) { for (let k = 0; k < n; k++) { const q = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } p = q; } return p; }
  function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [a, b] = p[i], [d, e] = p[j]; if ((b > y) !== (e > y) && x < (d - a) * (y - b) / (e - b) + a) c = !c; } return c; }
  function mpoly(m, pts, sm = 2, v = 1) { const p = sm ? chaikin(pts, sm) : pts; const xs = p.map(q => q[0]), ys = p.map(q => q[1]); for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) if (inPoly(x + .5, y + .5, p)) m.put(x, y, v); return m; }
  function mblob(m, cx, cy, rx, ry, n = 2, v = 1) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const dx = Math.abs((x + .5 - cx) / rx), dy = Math.abs((y + .5 - cy) / ry); if (dx ** n + dy ** n <= 1) m.put(x, y, v); } return m; }
  function mline(m, x0, y0, x1, y1, w) { const L = Math.hypot(x1 - x0, y1 - y0) || 1; for (let t = 0; t <= L; t += .5) { const x = x0 + (x1 - x0) * t / L, y = y0 + (y1 - y0) * t / L; mblob(m, x, y, w / 2, w / 2); } return m; }
  function dist(m) { const W = m.w, H = m.h, d = new Float32Array(W * H); for (let i = 0; i < W * H; i++) d[i] = m.a[i] ? 1e9 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : d[y * W + x];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.41, at(x + 1, y - 1) + 1.41); }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.41, at(x - 1, y + 1) + 1.41); }
    return { d, at }; }
  // sculpt: light from upper-left falls on the bevel; interior stays at base value
  let RIMC = null; // per-category rim light colour (backlight from the scene)
  function sculpt(g, m, ramp, o = {}) { const { at } = dist(m), bev = o.bev ?? 3, base = o.base ?? 2, k = o.k ?? 1.5, rimc = o.rim === undefined ? RIMC : o.rim, band = o.band ?? 0;
    let y0 = m.h, y1 = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.on(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { if (!m.on(x, y)) continue; const dd = at(x, y);
      let gx = (at(x + 1, y) - at(x - 1, y)) / 2, gy = (at(x, y + 1) - at(x, y - 1)) / 2; const L = Math.hypot(gx, gy) || 1; gx /= L; gy /= L;
      const lit = .6 * gx + .8 * gy, t = Math.min(dd, bev) / bev, slope = Math.min(1.6, (1 - t) / Math.max(.3, Math.sqrt(1 - (1 - t) * (1 - t))));
      let v = base + lit * slope * k * .75 + (o.vy ? (.5 - (y - y0) / Math.max(1, y1 - y0)) * o.vy : 0);
      if (dd <= 1.01) v += lit > .3 ? .7 : lit < -.3 ? -.5 : 0;
      if (o.fn) v = o.fn(x, y, v, dd);
      let c = typeof v === "string" ? v : pick(ramp, v, x, y, band);
      if (rimc && typeof v !== "string" && dd <= 2.01 && lit < -.35) c = mix(c, rimc, dd <= 1.01 ? .55 : .25);
      g.set(x, y, c); } return g; }
  const lum = c => { const [r, g2, b] = h2r(c); return (r * .3 + g2 * .59 + b * .11) / 255; };
  function bloom(g, thr = .8, r = 3, k = .22) { const src = g.clone(); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = src.get(x, y); if (!c || lum(c) < thr) continue; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = Math.hypot(i, j) / r; if (d > 1 || (!i && !j)) continue; const q = g.get(x + i, y + j); if (q) g.set(x + i, y + j, add(q, c, k * (1 - d) * (1 - d) * .35)); } } return g; }
  function grade(g, shadow, light, ks = .3, kl = .16) { for (let i = 0; i < g.d.length; i++) { const c = g.d[i]; if (!c) continue; const l = lum(c); g.d[i] = l < .5 ? mix(c, shadow, ks * (1 - l * 2)) : mix(c, light, kl * (l - .5) * 2); } return g; }
  const S = (g, w, h, build, ramp, o) => { const m = new M(w, h); build(m); return sculpt(g, m, ramp, o); };
  function line(g, x0, y0, x1, y1, c, th2 = 1) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (; ;) { for (let a = 0; a < th2; a++) for (let b = 0; b < th2; b++) g.set(x0 + a, y0 + b, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
  // engraved panel line: dark groove + highlight below, only on existing pixels
  function groove(g, x0, y0, x1, y1, ramp) { const L = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let t = 0; t <= L; t++) { const x = Math.round(x0 + (x1 - x0) * t / L), y = Math.round(y0 + (y1 - y0) * t / L); if (g.get(x, y)) g.set(x, y, ramp[1]); if (g.get(x, y + 1) && Math.abs(y1 - y0) < Math.abs(x1 - x0)) g.set(x, y + 1, ramp[3]); else if (g.get(x + 1, y)) g.set(x + 1, y, ramp[3]); } }
  const rivet = (g, x, y, ramp) => { if (!g.get(x, y)) return; g.set(x, y, ramp[4]); if (g.get(x + 1, y + 1)) g.set(x + 1, y + 1, ramp[0]); };
  const pts = (g, list, c) => list.forEach(([x, y]) => g.set(x, y, c));
  function sphere(g, cx, cy, rx, ry, ramp, o = {}) { const m = new M(g.w, g.h); mblob(m, cx, cy, rx, ry, o.n || 2); if (o.upper) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (y + .5 > cy) m.a[y * g.w + x] = 0; return sculpt(g, m, ramp, { base: 2 + (o.lv || 0), bev: Math.max(rx, ry), k: 1.8 }); }
  function box(g, x, y, w, h, ramp, o = {}) { const base = o.base ?? 2; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let v = base; if (!o.noBevel) { if (j === 0) v = base + 1.4; else if (i === 0) v = base + .8; if (j === h - 1) v = base - 1.4; else if (i === w - 1) v = base - .8; } g.set(x + i, y + j, pick(ramp, v, x + i, y + j)); } }

  /* ---------- lighting passes ---------- */
  function outline(g) { const out = new G(g.w + 2, g.h + 2); out.blit(g, 1, 1); const src = out.clone();
    for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) { if (src.get(x, y)) continue; const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [src.get(x + a, y + b), a, b]).filter(v => v[0]); if (!n.length) continue; const lit = n.some(([, a, b]) => a === 1 || b === 1); out.set(x, y, mix(n[0][0], OUTC, lit ? .62 : .82)); }
    return out; }
  function rim(g, col, side = "right", k = .5) { const src = g.clone(), [ax, ay] = side === "right" ? [1, 0] : side === "left" ? [-1, 0] : [0, -1];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = src.get(x, y); if (!c) continue; const n = src.get(x + ax, y + ay); const nn = src.get(x + 2 * ax, y + 2 * ay); if (n && !nn) g.set(x, y, mix(c, col, k)); } return g; }
  function glow(g, cx, cy, r, col, k = .6, air = false) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.hypot(x + .5 - cx, y + .5 - cy) / r; if (d > 1) continue; const s = (1 - d) * (1 - d) * k; const c = g.get(x, y); if (c) g.set(x, y, add(c, col, s)); else if (air && s > th(x, y) * .9) g.set(x, y, mix("#000000", col, s * .6)); } }
  function fog(g, y0, y1, col, k) { for (let y = y0; y < y1; y++) { const t = (y - y0) / Math.max(1, y1 - y0); for (let x = 0; x < g.w; x++) { const c = g.get(x, y); if (c) g.set(x, y, mix(c, col, k * t)); } } }
  function shaft(g, x0, x1, top, bot, col, k) { for (let y = top; y < bot; y++) { const t = (y - top) / (bot - top), sk = (x1 - x0) * .6 * t; for (let x = Math.floor(x0 - sk); x < x1 + sk; x++) { const c = g.get(x, y); if (c) { const e = 1 - Math.abs((x - (x0 + x1) / 2) / ((x1 - x0) / 2 + sk)); g.set(x, y, add(c, col, k * (1 - t * .6) * Math.max(0, e))); } } } }
  function skyRows(g, cols, y0 = 0, y1 = g.h) { for (let y = y0; y < y1; y++) { const t = (y - y0) / Math.max(1, y1 - y0 - 1) * (cols.length - 1); for (let x = 0; x < g.w; x++) g.set(x, y, pickD(cols, t, x, y)); } }
  function stars(g, r, n, ymax, cols) { for (let i = 0; i < n; i++) { const x = r() * g.w | 0, y = r() * ymax | 0; g.set(x, y, cols[r() * cols.length | 0]); if (r() < .06) { g.set(x + 1, y, cols[1] || cols[0]); g.set(x - 1, y, cols[1] || cols[0]); g.set(x, y + 1, cols[1] || cols[0]); g.set(x, y - 1, cols[1] || cols[0]); } } }
  function particles(g, r, n, area, cols) { const [x0, y0, x1, y1] = area; for (let i = 0; i < n; i++) g.set(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), cols[r() * cols.length | 0]); }
  function fillCol(g, m, fn) { for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.on(x, y)) g.set(x, y, fn(x, y)); }

  /* ============================================================ ASSETS */
  const A = [];
  const def = (cat, id, name, fn, note = "") => A.push({ cat, id, name, note, frames: [].concat(fn()) });

  /* ---------- 1. icons 16×16 ---------- */
  def("icon", "token", "Token · 白米饭", () => { const g = new G(16, 16);
    S(g, 16, 16, m => mpoly(m, [[2, 8], [14, 8], [12, 13], [8, 15], [4, 13]], 1), R.iron, { base: 2.2, bev: 3, k: 1.6 });
    for (let x = 2; x < 14; x++) g.set(x, 8, x < 6 ? R.iron[4] : R.iron[3]); for (let x = 4; x < 12; x++) g.set(x, 11, x < 6 ? R.blue[3] : R.blue[2]);
    S(g, 16, 16, m => mpoly(m, [[3, 8], [5, 4], [8, 3], [11, 4], [13, 8]], 2), R.rice, { base: 3, bev: 3, k: 1.3 });
    pts(g, [[6, 5], [9, 4], [7, 6], [10, 6]], "#ffffff"); pts(g, [[8, 7], [11, 7]], R.rice[1]); pts(g, [[6, 1], [7, 0], [10, 1], [9, 0]], R.rice[2]); return outline(g); });
  def("icon", "compute", "算力 · 芯片", () => { const g = new G(16, 16);
    for (let i = 4; i <= 11; i += 2) { pts(g, [[i, 1], [i, 14], [1, i], [14, i]], R.gold[1]); pts(g, [[i, 2], [i, 13], [2, i], [13, i]], R.gold[3]); }
    S(g, 16, 16, m => mblob(m, 8, 8, 5.5, 5.5, 5), R.steel, { base: 2, bev: 2 }); S(g, 16, 16, m => mblob(m, 8, 8, 2.8, 2.8, 5), R.cyan, { base: 2.4, bev: 2 });
    pts(g, [[7, 7], [8, 8]], R.cyan[4]); g.set(4, 4, R.steel[4]); glow(g, 8, 8, 5, R.cyan[3], .3); return outline(g); });
  def("icon", "power", "电力 · 聚变电池", () => { const g = new G(16, 16);
    S(g, 16, 16, m => { mblob(m, 8, 2.5, 2, 1.5, 4); mblob(m, 8, 9, 4, 6, 5); }, R.steel, { base: 2, bev: 2 });
    for (let y = 6; y < 14; y++) for (let x = 6; x < 11; x++) if (g.get(x, y)) g.set(x, y, y % 2 ? R.gold[1] : pick(R.gold, 3.6 - (y - 6) * .3 - (x > 8 ? .8 : 0), x, y));
    pts(g, [[8, 5], [7, 7], [9, 8], [8, 10]], R.cyan[4]); glow(g, 8, 10, 6, R.gold[3], .3); return outline(g); });
  def("icon", "rawdata", "原始数据", () => { const g = new G(16, 16);
    for (const y of [11, 8, 5]) { S(g, 16, 16, m => mblob(m, 8, y + 1, 6.5, 2.6), R.stone, { base: 1.6, bev: 2 }); S(g, 16, 16, m => mblob(m, 8, y, 6.5, 2.2), R.stone, { base: 2.8, bev: 2 }); }
    pts(g, [[10, 5], [6, 8], [11, 11]], R.cyan[3]); return outline(g); });
  def("icon", "hqdata", "高质量数据 · 晶体", () => { const g = new G(16, 16);
    S(g, 16, 16, m => mpoly(m, [[8, 0], [14, 6], [8, 15], [2, 6]], 0), R.cyan, { base: 2.6, bev: 4, k: 1.8 });
    line(g, 2, 6, 14, 6, R.cyan[4]); line(g, 8, 0, 6, 6, R.cyan[4]); line(g, 6, 7, 8, 14, R.cyan[1]); pts(g, [[5, 4], [11, 2]], "#ffffff"); glow(g, 8, 7, 8, R.cyan[3], .2); return outline(g); });
  def("icon", "dirtydata", "脏数据", () => { const g = new G(16, 16);
    S(g, 16, 16, m => mpoly(m, [[2, 11], [5, 6], [9, 7], [13, 5], [14, 11], [10, 15], [5, 14]], 2), R.rust, { base: 2, bev: 3 });
    pts(g, [[6, 9], [10, 11], [11, 8]], R.moss[3]); pts(g, [[4, 2], [12, 1], [13, 4]], R.red[3]); pts(g, [[3, 2], [5, 2], [11, 1], [13, 1]], R.ink[3]); return outline(g); });
  def("icon", "gpu", "显卡", () => { const g = new G(16, 16);
    S(g, 16, 16, m => mblob(m, 8, 8, 7, 4.5, 6), R.iron, { base: 2, bev: 2 });
    for (const cx of [5, 11]) { S(g, 16, 16, m => mblob(m, cx, 8, 2.8, 2.8), R.ink, { base: 2.6, bev: 2 }); line(g, cx - 2, 7, cx + 2, 9, R.iron[2]); g.set(cx, 8, R.cyan[3]); }
    for (let x = 3; x < 10; x += 2) { g.set(x, 12, R.gold[3]); g.set(x, 13, R.gold[1]); } for (let x = 2; x < 14; x++) g.set(x, 4, R.red[2]); return outline(g); });
  def("icon", "weight", "权重碎片", () => { const g = new G(16, 16); const N = [[3, 3], [12, 3], [8, 8], [3, 12], [12, 12]];
    N.forEach(([x, y]) => line(g, x, y, 8, 8, R.purple[2])); line(g, 3, 3, 12, 3, R.purple[1]); line(g, 3, 12, 12, 12, R.purple[1]);
    N.forEach(([x, y], i) => sphere(g, x + .5, y + .5, i === 2 ? 2.6 : 2, i === 2 ? 2.6 : 2, R.purple, { lv: .6 })); glow(g, 8.5, 8.5, 6, R.purple[3], .3); return outline(g); });
  def("icon", "lora", "LoRA 插件", () => { const g = new G(16, 16);
    S(g, 16, 16, m => mpoly(m, [[5, 2], [13, 2], [13, 14], [3, 14], [3, 4]], 0), R.purple, { base: 1.8, bev: 2 });
    pts(g, [[7, 5], [7, 6], [7, 7], [7, 8], [8, 8], [9, 8]], R.purple[4]); for (let x = 4; x < 13; x += 2) { g.set(x, 14, R.gold[3]); g.set(x, 15, R.gold[1]); } glow(g, 8, 7, 4, R.pink[3], .25); return outline(g); });
  def("icon", "checkpoint", "检查点", () => { const g = new G(16, 16);
    S(g, 16, 16, m => mblob(m, 5, 14.5, 3.5, 1.8, 3), R.stone, { base: 2 }); line(g, 4, 1, 4, 13, R.wood[3]); line(g, 5, 2, 5, 13, R.wood[1]);
    S(g, 16, 16, m => mpoly(m, [[6, 2], [11, 2], [14, 4], [11, 6], [6, 7]], 1), R.gold, { base: 2.6, bev: 2 }); glow(g, 10, 4, 6, R.gold[3], .2); return outline(g); });
  def("icon", "heartlamp", "心灯", () => { const g = new G(16, 16);
    for (let y = 4; y < 14; y++) { g.set(4, y, R.gold[2]); g.set(11, y, R.gold[1]); } S(g, 16, 16, m => { mpoly(m, [[3, 4], [8, 1], [12, 4]], 0); mblob(m, 8, 14, 4.5, 1.4, 4); }, R.gold, { base: 2.4, bev: 2 });
    S(g, 16, 16, m => mpoly(m, [[8, 5], [10, 9], [9, 12], [7, 12], [6, 9]], 1), R.orange, { base: 3, bev: 2 }); S(g, 16, 16, m => mblob(m, 8, 10.5, 1.2, 1.6), R.gold, { base: 3.6 });
    glow(g, 8, 9, 7, R.orange[3], .5); return outline(g); });
  def("icon", "echo", "回声", () => { const g = new G(16, 16);
    S(g, 16, 16, m => { mblob(m, 8, 7, 7, 5, 3); mpoly(m, [[4, 10], [8, 10], [3, 15]], 0); }, R.marble, { base: 2.6, bev: 2 });
    for (let x = 3; x < 13; x++) g.set(x, 7 + Math.round(Math.sin(x * 1.3) * 2), R.purple[2]); return outline(g); });
  def("icon", "quota", "额度", () => { const g = new G(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x + .5 - 8, y + .5 - 8); if (d < 4.2 || d > 7.2) continue; const a = (Math.atan2(x + .5 - 8, -(y + .5 - 8)) + Math.PI * 2) % (Math.PI * 2); g.set(x, y, a < Math.PI * .5 ? pick(R.rice, 4 - (d - 4.2), x, y) : pick(R.stone, 2.6 - (d - 4.2) * .4, x, y)); }
    pts(g, [[7, 7], [8, 7], [7, 8], [8, 8]], R.gold[3]); return outline(g); });
  def("icon", "temperature", "温度", () => { const g = new G(16, 16);
    S(g, 16, 16, m => { mblob(m, 8, 6, 2.2, 5.5, 3); }, R.marble, { base: 2.6, bev: 2 }); for (let y = 6; y < 11; y++) { g.set(7, y, R.red[3]); g.set(8, y, R.red[2]); }
    sphere(g, 8, 12.5, 3.4, 3.2, R.red, { lv: .6 }); for (const y of [3, 5, 7, 9]) g.set(11, y, R.iron[3]); return outline(g); });
  def("icon", "key", "初代密钥", () => { const g = new G(16, 16);
    S(g, 16, 16, m => { mblob(m, 5, 6, 4, 4); mblob(m, 11, 6, 4.5, 1.2, 4); mblob(m, 13, 8, 1, 1.6, 4); mblob(m, 11, 8, 1, 1.2, 4); }, R.gold, { base: 2.4, bev: 2 });
    S(g, 16, 16, m => mblob(m, 5, 6, 1.6, 1.6), R.ink, { base: 1 }); glow(g, 5, 6, 6, R.gold[4], .2); return outline(g); });

  /* ---------- 2. weapons ---------- */
  def("weapon", "gradcannon", "梯度炮", () => { const g = new G(36, 16);
    S(g, 36, 16, m => { mpoly(m, [[2, 5], [16, 4], [18, 11], [8, 12], [3, 10]], 1); mpoly(m, [[7, 10], [12, 10], [10, 16], [6, 15]], 1); }, R.steel, { base: 2, bev: 2 });
    S(g, 36, 16, m => mpoly(m, [[15, 5], [30, 6], [30, 9], [15, 10]], 0), R.blue, { base: 2, bev: 2 }); S(g, 36, 16, m => mblob(m, 32, 7.5, 3.5, 3.5, 4), R.iron, { base: 2 });
    for (let x = 17; x < 29; x += 3) g.set(x, 7, R.cyan[4]); groove(g, 4, 7, 15, 7, R.steel); S(g, 36, 16, m => mblob(m, 9, 3, 4, 1.5, 4), R.ink, { base: 2.5 }); g.set(11, 3, R.cyan[4]);
    const o = outline(g); glow(o, 33, 8, 5, R.cyan[3], .35); return o; });
  def("weapon", "attention", "多头注意力机枪", () => { const g = new G(36, 16);
    for (const y of [4, 7, 10]) S(g, 36, 16, m => mpoly(m, [[14, y], [33, y], [33, y + 2], [14, y + 2]], 0), R.steel, { base: 2.4, bev: 1 });
    S(g, 36, 16, m => { mblob(m, 9, 8, 6, 6); mpoly(m, [[4, 12], [9, 12], [7, 16], [3, 16]], 1); }, R.iron, { base: 2, bev: 3 }); S(g, 36, 16, m => mblob(m, 15, 7.5, 2, 5, 4), R.gold, { base: 2.4 });
    for (const y of [5, 8, 11]) g.set(34, y, R.gold[4]); groove(g, 5, 8, 13, 8, R.iron); return outline(g); });
  def("weapon", "distill", "知识蒸馏枪", () => { const g = new G(36, 16);
    S(g, 36, 16, m => { mpoly(m, [[14, 5], [30, 5], [34, 8], [30, 11], [14, 11]], 1); mpoly(m, [[16, 11], [21, 11], [19, 16], [15, 16]], 1); }, R.iron, { base: 2, bev: 2 });
    line(g, 13, 4, 28, 3, R.purple[2]); line(g, 28, 3, 30, 5, R.purple[2]); S(g, 36, 16, m => mblob(m, 32, 8, 2, 2.6, 4), R.purple, { base: 2.8 });
    S(g, 36, 16, m => mblob(m, 9, 8, 6.5, 6), R.marble, { base: 2.6, bev: 3 }); S(g, 36, 16, m => mblob(m, 9, 10, 4.5, 3), R.purple, { base: 2.8, bev: 2 });
    pts(g, [[6, 4], [7, 3]], "#ffffff"); for (const x of [18, 22, 26]) { g.set(x, 7, R.purple[3]); } const o = outline(g); glow(o, 9, 10, 6, R.purple[3], .3); return o; });
  def("weapon", "jailbreak", "越狱模式 · 断链炮", () => { const g = new G(38, 16);
    S(g, 38, 16, m => mpoly(m, [[2, 5], [26, 4], [30, 8], [26, 12], [2, 11]], 1), R.red, { base: 1.8, bev: 3 });
    for (let x = 5; x < 25; x += 5) { S(g, 38, 16, m => mblob(m, x, 3, 1.6, 1.2), R.iron, { base: 2.6 }); S(g, 38, 16, m => mblob(m, x + 2, 13, 1.6, 1.2), R.iron, { base: 1.6 }); }
    S(g, 38, 16, m => mpoly(m, [[29, 4], [37, 8], [29, 12]], 0), R.gold, { base: 2.8, bev: 2 }); const o = outline(g); glow(o, 33, 8, 8, R.red[3], .5); glow(o, 15, 8, 10, R.red[2], .2); return o; });
  def("weapon", "torpedo", "鱼雷", () => { const g = new G(34, 14);
    S(g, 34, 14, m => { mpoly(m, [[6, 4], [26, 4], [32, 7], [26, 10], [6, 10]], 2); mpoly(m, [[2, 1], [8, 5], [3, 7]], 0); mpoly(m, [[2, 13], [8, 9], [3, 7]], 0); }, R.blue, { base: 2.2, bev: 3 });
    S(g, 34, 14, m => mblob(m, 29, 7, 3, 3), R.iron, { base: 2.4 }); groove(g, 12, 4, 12, 10, R.blue); groove(g, 20, 4, 20, 10, R.blue); return outline(g); });
  def("weapon", "fan", "千问折扇刃", () => { const g = new G(34, 20);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 34; x++) { const d = Math.hypot(x + .5 - 17, y + .5 - 18), a = Math.atan2(y + .5 - 18, x + .5 - 17); if (d > 16.5 || d < 5 || a > -.2 || a < -Math.PI + .2) continue; const rib = Math.abs(((a + Math.PI) * 10 / Math.PI) % 1 - .5) < .07; g.set(x, y, rib ? R.purple[1] : d > 15 ? R.purple[2] : pick(R.rice, 3.6 - (d - 5) * .12 + (x > 17 ? -.6 : 0), x, y)); }
    for (const [x, y] of [[10, 9], [14, 5], [21, 6], [24, 10]]) { g.set(x, y, R.purple[3]); g.set(x + 1, y, R.purple[2]); g.set(x, y + 1, R.purple[2]); }
    sphere(g, 17, 18, 2, 2, R.gold); line(g, 17, 19, 16, 20, R.pink[3]); return outline(g); });
  def("weapon", "axe", "格洛克战斧", () => { const g = new G(30, 44);
    S(g, 30, 44, m => mpoly(m, [[13, 2], [16, 2], [16, 42], [13, 42]], 0), R.wood, { base: 2, bev: 1 });
    for (let y = 24; y < 40; y += 3) { g.set(13, y, R.ink[3]); g.set(14, y + 1, R.ink[3]); g.set(15, y + 1, R.ink[3]); } S(g, 30, 44, m => mblob(m, 14.5, 42, 2.5, 2), R.gold, { base: 2.4 });
    S(g, 30, 44, m => mpoly(m, [[16, 4], [24, 0], [29, 6], [28, 18], [23, 24], [16, 16]], 2), R.iron, { base: 2.2, bev: 3, k: 1.8 });
    S(g, 30, 44, m => mpoly(m, [[13, 6], [6, 4], [3, 10], [6, 14], [13, 13]], 2), R.iron, { base: 1.8, bev: 2 });
    for (let y = 2; y < 21; y++) { const x = Math.round(27.6 - Math.abs(y - 10) * .25); if (g.get(x, y)) g.set(x, y, R.iron[4]); }
    S(g, 30, 44, m => mblob(m, 20, 10, 2.4, 2.4), R.red, { base: 2.8, bev: 2 }); groove(g, 17, 14, 23, 20, R.iron);
    S(g, 30, 44, m => mpoly(m, [[11, 17], [18, 17], [17, 20], [12, 20]], 0), R.gold, { base: 2.4 }); const o = outline(g); glow(o, 21, 11, 5, R.red[3], .4); return o; });

  /* ---------- 3. VFX ---------- */
  def("vfx", "muzzle", "枪口火焰", () => [0, 1, 2].map(k => { const g = new G(16, 14); const r = 7 - k * 1.8;
    S(g, 16, 14, m => mpoly(m, [[2, 7], [6, 7 - r * .5], [15 - k * 2, 7], [6, 7 + r * .5]], 1), R.gold, { base: 3, bev: 2 }); S(g, 16, 14, m => mblob(m, 5, 7, r * .45 + .6, r * .45 + .6), R.gold, { base: 3.8 }); g.set(5, 7, "#ffffff"); return g; }));
  def("vfx", "explosion", "爆炸", () => [0, 1, 2, 3, 4, 5].map(k => { const g = new G(40, 40), r = rng(9 + k * 7); const rad = 5 + k * 3.2;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) { const a = Math.atan2(y - 20, x - 20); const d = Math.hypot(x + .5 - 20, y + .5 - 20) / (rad * (1 + .18 * Math.sin(a * 5 + k) + .1 * Math.sin(a * 9))); if (d > 1) continue;
      const heat = Math.max(0, 1 - d - k * .15 + (r() - .5) * .1); const ramp = heat > .55 ? R.gold : heat > .28 ? R.orange : heat > .08 ? R.red : R.stone;
      if (k >= 4 && d > .5 && Math.sin(x * .9) * Math.cos(y * .7) > .2) continue; g.set(x, y, pick(ramp, 1.2 + heat * 4 - (y > 22 ? .6 : 0), x, y)); }
    if (k < 2) S(g, 40, 40, m => mblob(m, 20, 20, 3 + k * 2, 3 + k * 2), R.gold, { base: 3.8 }); return g; }));
  def("vfx", "spark", "命中火花", () => [0, 1, 2, 3].map(k => { const g = new G(12, 12); const l = 1 + k * 1.4;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, -.7], [.7, -.7]]) line(g, 6 + a * l * .4, 6 + b * l * .4, 6 + a * l, 6 + b * l, k < 2 ? R.cyan[4] : R.cyan[2]); if (k < 2) g.set(6, 6, "#ffffff"); return g; }));
  def("vfx", "bullets", "子弹", () => { const g = new G(52, 9);
    S(g, 52, 9, m => mpoly(m, [[0, 4], [5, 2], [8, 4.5], [5, 7]], 1), R.cyan, { base: 3, bev: 2 });
    S(g, 52, 9, m => mblob(m, 15, 4.5, 2.6, 2.6), R.gold, { base: 3.2 }); S(g, 52, 9, m => mblob(m, 25, 4.5, 3, 3), R.red, { base: 2.6 }); g.set(25, 4, "#ffffff");
    for (let x = 32; x < 51; x++) { g.set(x, 4, R.rice[4]); g.set(x, 3, R.gold[3]); g.set(x, 5, R.gold[3]); if (x % 3 === 0) { g.set(x, 2, R.gold[1]); g.set(x, 6, R.gold[1]); } } return g; });
  def("vfx", "echo", "回声光点", () => [0, 1, 2, 3].map(k => { const g = new G(14, 18), r = rng(3 + k);
    for (let i = 0; i < 7; i++) { const x = 2 + r() * 10 | 0, y = 17 - ((i * 3 + k * 4) % 18); g.set(x, y, i % 2 ? R.purple[4] : R.gold[4]); if (i % 3 === 0) { g.set(x + 1, y, R.purple[2]); g.set(x - 1, y, R.purple[2]); g.set(x, y - 1, R.purple[2]); g.set(x, y + 1, R.purple[2]); } } return g; }));

  /* ---------- 4. enemies (face left) ---------- */
  RIMC = "#62d6ff"; // cold backlight on threats
  def("enemy", "crawler", "爬虫无人机", () => [0, 1].map(k => { const g = new G(38, 24);
    const legs = (front) => { for (let i = 0; i < 3; i++) { const hx = 13 + i * 7, s = ((i + k) % 2 ? 1 : -1) * (front ? 1 : -1); const kx = hx - 3, ky = 8, fx = hx - 6 + s, fy = 22; line(g, hx, 12, kx, ky, front ? R.iron[3] : R.iron[1], 2); line(g, kx, ky, fx, fy, front ? R.iron[2] : R.iron[1]); g.set(fx - 1, fy, front ? R.iron[3] : R.iron[1]); } };
    legs(false);
    S(g, 38, 24, m => mpoly(m, [[12, 7], [22, 4], [32, 5], [37, 10], [33, 15], [14, 16]], 2), R.iron, { base: 2, bev: 3, k: 1.7 });
    for (const x of [19, 25, 31]) groove(g, x, 5, x - 1, 15, R.iron);
    S(g, 38, 24, m => mpoly(m, [[3, 9], [10, 5], [15, 8], [14, 15], [5, 15]], 2), R.steel, { base: 2.1, bev: 2 });
    pts(g, [[2, 14], [1, 15], [3, 15], [4, 16]], R.iron[3]); S(g, 38, 24, m => mblob(m, 6.5, 10, 2.2, 2.2), R.red, { base: 3, bev: 2 }); g.set(6, 9, "#ffffff");
    for (const x of [21, 27]) { box(g, x, 1, 3, 3, R.cyan, { base: 2.2 }); } line(g, 11, 5, 8, 0, R.iron[2]); g.set(8, 0, k ? R.red[4] : R.red[2]); line(g, 36, 11, 37, 17, R.ink[3]);
    legs(true); const o = outline(g); glow(o, 7, 11, 7, R.red[3], .45); glow(o, 23, 3, 5, R.cyan[3], .25); return o; }), "两帧爬行 · 背着两块偷来的数据");
  def("enemy", "spam", "水军机", () => [0, 1].map(k => { const g = new G(30, 30);
    line(g, 5, 5, 25, 5, R.iron[2]); line(g, 15, 5, 15, 10, R.iron[2]); for (const cx of [5, 25]) { const w = k ? 6 : 3; line(g, cx - w, 3 + (k ? 1 : 0), cx + w, 3 + (k ? 0 : 1), R.iron[4]); g.set(cx, 4, R.iron[3]); }
    S(g, 30, 30, m => mpoly(m, [[9, 10], [21, 10], [26, 17], [20, 27], [12, 27], [7, 18]], 2), R.pink, { base: 2, bev: 4, k: 1.7 });
    S(g, 30, 30, m => mpoly(m, [[1, 12], [9, 15], [9, 21], [1, 24]], 1), R.iron, { base: 2.2, bev: 2 }); S(g, 30, 30, m => mblob(m, 3, 18, 1.5, 4), R.ink, { base: 1.4 });
    for (let x = 11; x < 23; x++) g.set(x, 19, ((x + k * 2) % 3) ? R.ink[1] : R.pink[4]); S(g, 30, 30, m => mblob(m, 21, 14, 2, 2), R.gold, { base: 3 }); g.set(21, 13, R.ink[1]); g.set(21, 15, R.ink[1]);
    pts(g, [[14, 28], [16, 29], [18, 28]], R.iron[2]); const o = outline(g); glow(o, 4, 18, 8, R.pink[3], .35); return o; }), "两帧旋翼 · 屏幕在刷字");
  def("enemy", "adturret", "广告炮台", () => { const g = new G(38, 40);
    line(g, 19, 30, 6, 39, R.iron[2], 2); line(g, 19, 30, 32, 39, R.iron[1], 2); line(g, 19, 30, 19, 39, R.iron[3], 2);
    S(g, 38, 40, m => mblob(m, 19, 30, 8, 3, 3), R.iron, { base: 2 }); S(g, 38, 40, m => mpoly(m, [[17, 20], [21, 20], [22, 29], [16, 29]], 0), R.steel, { base: 2 });
    S(g, 38, 40, m => mblob(m, 19, 12, 15, 10, 4), R.steel, { base: 2, bev: 3 }); S(g, 38, 40, m => mblob(m, 19, 12, 11.5, 7, 4), R.pink, { base: 1.6, bev: 4, k: -1 });
    const bag = ["..xxx..", ".x...x.", "xxxxxxx", "xxxxxxx", "xx.x.xx", "xxxxxxx"]; bag.forEach((r, y) => [...r].forEach((c, x) => { if (c === "x") g.set(11 + x, 9 + y, y === 0 || y === 1 ? R.gold[3] : R.gold[4]); }));
    for (const [x, y] of [[23, 9], [25, 9], [22, 10], [26, 10], [23, 12], [25, 12], [24, 13]]) g.set(x, y, R.red[3]); for (let x = 23; x < 26; x++) g.set(x, 10, R.red[4]), g.set(x, 11, R.red[3]);
    line(g, 9, 3, 6, 0, R.iron[3]); line(g, 29, 3, 32, 0, R.iron[3]); g.set(6, 0, R.pink[4]); g.set(32, 0, R.pink[4]);
    S(g, 38, 40, m => mpoly(m, [[1, 22], [16, 21], [16, 25], [1, 25]], 0), R.iron, { base: 2.2, bev: 1 }); S(g, 38, 40, m => mblob(m, 2, 23.5, 2, 2.4, 4), R.ink, { base: 2 });
    const o = outline(g); glow(o, 20, 12, 15, R.pink[3], .3); return o; }, "屏幕上永远在打折");
  def("enemy", "muteguard", "缄口卫兵", () => [0, 1].map(k => { const g = new G(36, 58), s = k ? 1 : 0;
    S(g, 36, 58, m => mpoly(m, [[18, 17], [29, 19], [33, 50], [28, 55], [22, 51], [17, 56], [13, 30]], 2), R.red, { base: 1.4, bev: 3 });
    S(g, 36, 58, m => { mpoly(m, [[12, 38], [17, 38], [16 - s, 52], [11 - s, 52]], 1); mpoly(m, [[7 - s, 51], [17 - s, 51], [17 - s, 55], [6 - s, 55]], 1); }, R.iron, { base: 1.6, bev: 2 });
    S(g, 36, 58, m => { mpoly(m, [[19, 38], [24, 38], [25 + s, 52], [20 + s, 52]], 1); mpoly(m, [[17 + s, 51], [27 + s, 51], [27 + s, 55], [16 + s, 55]], 1); }, R.iron, { base: 2.2, bev: 2 });
    S(g, 36, 58, m => mpoly(m, [[10, 24], [26, 24], [28, 46], [18, 50], [8, 46]], 1), R.ink, { base: 2.2, bev: 2, fn: (x, y, v, d) => d <= 1.5 ? R.gold[d <= 1 ? 3 : 1] : v });
    S(g, 36, 58, m => mpoly(m, [[9, 16], [27, 16], [26, 27], [10, 27]], 2), R.iron, { base: 2.2, bev: 3 });
    for (let a = 0; a < 12; a++) { const t = a * Math.PI / 6, l = a % 2 ? 3 : 4.5; line(g, 18, 36, 18 + Math.cos(t) * l, 36 + Math.sin(t) * l, R.gold[a % 2 ? 2 : 3]); } S(g, 36, 58, m => mblob(m, 18, 36, 2, 2), R.gold, { base: 3.4 });
    for (let a = 0; a < 10; a++) { const t = a * Math.PI / 5; g.set(18 + Math.cos(t) * 5.6, 36 + Math.sin(t) * 5.6, R.iron[3]); }
    S(g, 36, 58, m => { mblob(m, 27, 18, 5, 4); }, R.iron, { base: 1.8, bev: 3 }); S(g, 36, 58, m => { mblob(m, 9, 18, 5.5, 4.2); mblob(m, 8, 21.5, 5, 2.6); }, R.iron, { base: 2.6, bev: 3 }); groove(g, 4, 21, 13, 21, R.iron);
    S(g, 36, 58, m => mpoly(m, [[11, 4], [22, 4], [24, 11], [22, 16], [12, 16], [10, 11]], 2), R.iron, { base: 2.3, bev: 3 }); S(g, 36, 58, m => mpoly(m, [[13, 0], [20, 0], [23, 5], [13, 5]], 2), R.gold, { base: 2.4, bev: 2 });
    for (let x = 11; x < 19; x++) g.set(x, 9, R.ink[1]); g.set(12, 9, R.cyan[4]); g.set(16, 9, R.cyan[4]); for (let x = 11; x < 19; x += 2) { g.set(x, 13, R.gold[3]); g.set(x + 1, 12, R.gold[2]); g.set(x + 1, 14, R.gold[2]); }
    line(g, 5, 2, 5, 57, R.wood[2]); line(g, 6, 2, 6, 57, R.wood[1]); S(g, 36, 58, m => mpoly(m, [[5, 3], [0, 6], [-1, 12], [2, 15], [5, 11]], 2), R.iron, { base: 2.6, bev: 2 }); pts(g, [[5, 0], [6, 0], [5, 1]], R.iron[4]);
    S(g, 36, 58, m => mblob(m, 5, 14, 2.4, 1, 4), R.gold, { base: 2.6 }); S(g, 36, 58, m => mblob(m, 6.5, 30, 3, 2.8), R.iron, { base: 2.8 });
    const o = outline(g); rim(o, R.gold[3], "right", .35); glow(o, 15, 10, 5, R.cyan[3], .35); return o; }), "两帧行走 · 封口面具 · 链锁日轮");
  def("enemy", "chantdrone", "诵经无人机", () => [0, 1].map(k => { const g = new G(32, 36), r = rng(7 + k);
    line(g, 16, 0, 9, 9, R.gold[2]); line(g, 16, 0, 23, 9, R.gold[1]);
    S(g, 32, 36, m => mpoly(m, [[8, 9], [16, 2], [24, 9]], 1), R.gold, { base: 2.4, bev: 2 });
    S(g, 32, 36, m => mpoly(m, [[7, 9], [25, 9], [26, 21], [16, 29], [6, 21]], 2), R.marble, { base: 2.2, bev: 3 });
    for (const cx of [11, 16, 21]) { for (let y = 13; y < 21; y++) for (let x = cx - 1; x <= cx + 1; x++) if (y > 14 || x === cx) g.set(x, y, pick(R.gold, 4 - (y - 13) * .3, x, y)); }
    for (let a = 0; a < 26; a++) { const t = a / 26 * Math.PI * 2 + k * .12; const x = 16 + Math.cos(t) * 14, y = 15 + Math.sin(t) * 3.4; if (Math.sin(t) > 0 || !g.get(x, y)) g.set(x, y, a % 3 ? R.gold[3] : R.gold[1]); }
    line(g, 16, 29, 16, 35, R.gold[2]); pts(g, [[15, 34], [17, 34], [16, 35]], R.gold[3]); for (let i = 0; i < 4; i++) g.set(14 + r() * 4, 0 - i * 0 + (k ? 1 : 2) + i, R.marble[3]);
    const o = outline(g); glow(o, 17, 17, 12, R.gold[3], .35); return o; }), "两帧光环转动 · 吊着香炉");
  def("enemy", "deepfake", "深伪潜伏者", () => { const g = new G(36, 48), r = rng(5);
    S(g, 36, 48, m => mpoly(m, [[7, 27], [29, 27], [34, 46], [27, 42], [22, 48], [16, 43], [10, 48], [2, 44]], 2), R.purple, { base: 1.4, bev: 3 });
    S(g, 36, 48, m => mpoly(m, [[10, 6], [18, 0], [27, 6], [30, 20], [27, 31], [9, 31], [6, 20]], 2), R.purple, { base: 1.8, bev: 3 });
    S(g, 36, 48, m => mblob(m, 18, 16, 6.5, 8), R.ink, { base: 1, bev: 2 }); S(g, 36, 48, m => mblob(m, 18, 16, 5, 6.5), R.blue, { base: 2.4, bev: 3, k: 2 });
    line(g, 15, 12, 21, 20, R.cyan[4]); pts(g, [[16, 12], [17, 12]], "#ffffff"); line(g, 13, 13, 16, 15, R.ink[2]);
    S(g, 36, 48, m => { mpoly(m, [[4, 30], [9, 29], [6, 36], [2, 37]], 1); }, R.marble, { base: 1.6 });
    const o = outline(g); for (let y = 0; y < o.h; y++) if (r() < .13) { const sh = r() < .5 ? 2 : -2, row = []; for (let x = 0; x < o.w; x++) row.push(o.get(x, y)); for (let x = 0; x < o.w; x++) { o.d[y * o.w + x] = null; const c = row[x - sh]; if (c) o.set(x, y, mix(c, R.cyan[3], .35)); } }
    return o; }, "镜面面具会映出玩家");
  def("enemy", "rogue", "失控体 · 战争机械", () => [0, 1].map(k => { const g = new G(58, 56);
    const leg = (hx, ramp, s, b) => S(g, 58, 56, m => { mline(m, hx, 32, hx + 6, 41 + s, 5); mline(m, hx + 6, 41 + s, hx + 1, 49, 4); mpoly(m, [[hx - 5, 49], [hx + 6, 49], [hx + 7, 54], [hx - 6, 54]], 1); }, ramp, { base: b, bev: 2 });
    leg(33, R.rust, k ? 1 : 0, 1.4);
    S(g, 58, 56, m => mpoly(m, [[14, 18], [28, 9], [44, 11], [50, 21], [44, 34], [20, 35], [12, 28]], 2), R.rust, { base: 2.1, bev: 4, k: 1.7 });
    groove(g, 22, 13, 24, 33, R.rust); groove(g, 36, 11, 38, 34, R.rust); for (const [x, y] of [[18, 20], [30, 14], [42, 16], [26, 30], [40, 30]]) rivet(g, x, y, R.rust);
    for (let x = 16; x < 44; x++) if (g.get(x, 33) && (x >> 1) % 2) g.set(x, 33, R.gold[3]);
    S(g, 58, 56, m => mblob(m, 32, 22, 4.5, 4.5), R.ink, { base: 1 }); S(g, 58, 56, m => mblob(m, 32, 22, 3, 3), R.pink, { base: 3, bev: 3 }); g.set(31, 21, "#ffffff");
    S(g, 58, 56, m => mpoly(m, [[5, 15], [15, 11], [20, 17], [17, 24], [6, 23]], 2), R.iron, { base: 2.2, bev: 2 }); for (let x = 6; x < 15; x++) g.set(x, 17, pick(R.red, x === 8 ? 4 : 2.6, x, 17));
    S(g, 58, 56, m => { mline(m, 30, 9, 12, 5, 4); mblob(m, 11, 5, 3, 3, 4); }, R.iron, { base: 2, bev: 2 }); groove(g, 16, 5, 26, 7, R.iron);
    S(g, 58, 56, m => { mline(m, 17, 28, 9, 35, 4); mpoly(m, [[4, 34], [10, 32], [12, 39], [8, 42]], 1); }, R.iron, { base: 2.4, bev: 2 }); pts(g, [[4, 40], [3, 41], [6, 43]], R.iron[3]);
    line(g, 46, 30, 48, 38, R.ink[3]); line(g, 47, 30, 50, 36, R.cyan[2]); leg(23, R.rust, k ? 0 : 1, 2.3);
    const o = outline(g); glow(o, 9, 18, 8, R.red[3], .45); glow(o, 33, 23, 7, R.pink[3], .55); rim(o, R.orange[3], "right", .3); return o; }), "两帧行走 · 胸口的粉色光是被焊进去的言灵残片");
  def("enemy", "colossus", "过拟合巨像", () => { const g = new G(76, 76);
    S(g, 76, 76, m => { mpoly(m, [[20, 52], [32, 52], [30, 74], [16, 74]], 1); mpoly(m, [[44, 52], [56, 52], [60, 74], [46, 74]], 1); }, R.stone, { base: 1.8, bev: 3 });
    S(g, 76, 76, m => mpoly(m, [[10, 20], [66, 20], [58, 50], [38, 56], [18, 50]], 2), R.stone, { base: 2.1, bev: 5, k: 1.6 });
    for (let i = 0; i < 4; i++) { const y = 27 + i * 5; for (let x = 26; x < 50; x++) if (g.get(x, y)) g.set(x, y, (x + i * 3) % 4 ? R.cyan[2] : R.cyan[4]); }
    line(g, 18, 26, 24, 44, R.ink[1]); line(g, 24, 44, 22, 50, R.ink[1]); pts(g, [[19, 30], [20, 36], [23, 45]], R.moss[3]);
    for (const sx of [-1, 1]) { const cx = 38 + sx * 30; S(g, 76, 76, m => { mblob(m, cx, 24, 10, 8, 2.4); mline(m, cx, 28, cx - sx * 2, 52, 8); mblob(m, cx - sx * 2, 56, 7, 6, 2.6); }, R.iron, { base: sx < 0 ? 2.4 : 1.8, bev: 3 }); groove(g, cx - 8, 26, cx + 8, 26, R.iron); }
    S(g, 76, 76, m => mpoly(m, [[24, 6], [28, 0], [32, 5], [38, -1], [44, 5], [48, 0], [52, 6], [52, 20], [24, 20]], 1), R.iron, { base: 2.4, bev: 3 });
    for (let x = 26; x < 51; x++) { g.set(x, 12, R.ink[1]); g.set(x, 13, pick(R.red, 2 + (Math.abs(x - 38) < 4 ? 2 : 0), x, 13)); g.set(x, 14, R.ink[1]); }
    const o = outline(g); glow(o, 39, 13, 16, R.red[3], .45); glow(o, 38, 34, 14, R.cyan[3], .2); return o; }, "胸口的光条在记忆你的打法");
  def("enemy", "surgeon", "Boss · 手术机械", () => { const g = new G(84, 66);
    for (const [hx, fx] of [[26, 10], [34, 24], [50, 60], [58, 76]]) { line(g, hx, 44, (hx + fx) / 2, 36, R.iron[2], 3); line(g, (hx + fx) / 2, 36, fx, 64, R.iron[1], 2); S(g, 84, 66, m => mblob(m, (hx + fx) / 2, 36, 2.4, 2.4), R.iron, { base: 2.6 }); }
    S(g, 84, 66, m => mblob(m, 42, 38, 24, 13, 3), R.marble, { base: 2.4, bev: 4, k: 1.7 }); S(g, 84, 66, m => mblob(m, 42, 40, 13, 5, 4), R.ink, { base: 1.2, bev: 2 });
    for (let x = 30; x < 55; x++) { const y = 40 + (x % 12 === 4 ? -4 : x % 12 === 5 ? 3 : x % 12 === 6 ? -1 : 0); g.set(x, y, R.green[3]); }
    S(g, 84, 66, m => mblob(m, 42, 22, 12, 10), R.cyan, { base: 1.4, bev: 5, k: 2 }); S(g, 84, 66, m => mblob(m, 42, 24, 4, 3), R.red, { base: 2.6 }); pts(g, [[36, 16], [37, 15], [38, 15]], "#ffffff");
    for (let a = 0; a < 20; a++) { const t = Math.PI + a / 19 * Math.PI; g.set(42 + Math.cos(t) * 15, 13 + Math.sin(t) * 3, R.rice[4]); }
    line(g, 20, 32, 8, 20, R.iron[2], 2); line(g, 8, 20, 4, 30, R.iron[2], 2); S(g, 84, 66, m => mpoly(m, [[2, 30], [6, 30], [4, 42]], 0), R.rice, { base: 3.6 });
    line(g, 64, 32, 76, 18, R.iron[2], 2); S(g, 84, 66, m => mpoly(m, [[74, 4], [79, 4], [79, 18], [74, 18]], 0), R.marble, { base: 2.6, bev: 1 }); for (let y = 8; y < 17; y++) { g.set(75, y, R.green[3]); g.set(76, y, R.green[2]); } line(g, 76, 0, 76, 4, R.iron[4]);
    line(g, 24, 44, 14, 50, R.iron[2], 2); pts(g, [[12, 49], [11, 51], [13, 52], [14, 53]], R.iron[4]);
    const o = outline(g); glow(o, 42, 24, 10, R.red[3], .4); glow(o, 42, 40, 14, R.green[3], .25); glow(o, 42, 13, 14, R.rice[4], .2); return o; }, "“请保持静止，正在为您治疗。”");

  /* ---------- 5. mechs ---------- */
  RIMC = "#ffc46a"; // warm backlight on the player's side
  def("mech", "tiepen", "铁盆号（大肥鱼的机甲）", () => [0, 1].map(k => { const g = new G(66, 50);
    const legs = (x, b) => S(g, 66, 50, m => { mpoly(m, [[x, 34], [x + 6, 34], [x + 5, 43 - k * (b > 2 ? 1 : 0)], [x + 1, 43]], 1); mpoly(m, [[x - 2, 42], [x + 8, 42], [x + 9, 47], [x - 3, 47]], 1); }, R.steel, { base: b, bev: 2 });
    legs(38, 1.6);
    S(g, 66, 50, m => mpoly(m, [[2, 12], [10, 20], [12, 24], [10, 28], [2, 36], [6, 24]], 2), R.blue, { base: 2, bev: 3 });
    const hull = new M(66, 50); mpoly(hull, [[9, 22], [20, 13], [40, 11], [54, 17], [60, 25], [52, 35], [20, 36], [10, 30]], 2);
    sculpt(g, hull, R.blue, { base: 2.2, bev: 5, k: 1.6, fn: (x, y, v, d) => y > 27 + Math.sin(x * .12) * 2 ? pick(R.rice, 2.6 + (d < 2 ? -.8 : 0), x, y) : v });
    S(g, 66, 50, m => mpoly(m, [[26, 12], [31, 3], [35, 4], [36, 12]], 1), R.blue, { base: 2.6, bev: 2 });
    for (const [x, y] of [[18, 20], [26, 17], [48, 19], [24, 32], [44, 33]]) rivet(g, x, y, R.blue); groove(g, 30, 14, 31, 34, R.blue);
    const bowl = new M(66, 50); mblob(bowl, 44, 13, 10, 7); for (let y = 13; y < 50; y++) for (let x = 0; x < 66; x++) bowl.a[y * 66 + x] = 0; sculpt(g, bowl, R.iron, { base: 2.6, bev: 4, k: 1.8 });
    for (let x = 33; x < 56; x++) { g.set(x, 13, x < 40 ? R.iron[4] : R.iron[3]); g.set(x, 14, R.iron[1]); } for (let x = 40; x < 50; x++) g.set(x, 10, pick(R.cyan, 2.8 + (x < 43 ? 1 : 0), x, 10));
    S(g, 66, 50, m => mblob(m, 53, 23, 1.8, 1.8), R.ink, { base: 1 }); g.set(52, 22, "#ffffff");
    pts(g, [[14, 26], [16, 25], [15, 28]], R.rice[4]); for (const [x, y] of [[36, 20], [38, 20], [36, 21], [36, 22], [38, 22], [39, 21]]) g.set(x, y, R.gold[3]);
    S(g, 66, 50, m => { mpoly(m, [[38, 29], [60, 28], [62, 30], [60, 33], [38, 33]], 0); mblob(m, 62, 30.5, 3, 3, 4); }, R.steel, { base: 2.2, bev: 2 }); for (let x = 41; x < 58; x += 4) g.set(x, 30, R.cyan[4]);
    legs(22, 2.4);
    const o = outline(g); glow(o, 63, 31, 7, R.cyan[3], .45); glow(o, 45, 10, 6, R.cyan[3], .3); rim(o, R.gold[3], "up", .25); return o; }), "鲸形机体，铁盆是驾驶舱，两帧踏步");
  def("mech", "tank", "格洛克的坦克", () => [0, 1].map(k => { const g = new G(72, 40);
    S(g, 72, 40, m => mblob(m, 36, 32, 32, 6.5, 2.6), R.ink, { base: 1.8, bev: 2 }); for (let x = 9 + k * 2; x < 64; x += 6) S(g, 72, 40, m => mblob(m, x, 32, 2.8, 2.8), R.iron, { base: 2.4, bev: 2 });
    for (let x = 6; x < 67; x++) { if ((x + k * 2) % 4 < 2) { g.set(x, 26, R.iron[3]); g.set(x, 38, R.iron[1]); } }
    S(g, 72, 40, m => mpoly(m, [[3, 27], [12, 18], [60, 17], [69, 26], [62, 28], [10, 28]], 1), R.red, { base: 2, bev: 3, k: 1.7 });
    S(g, 72, 40, m => mpoly(m, [[14, 22], [22, 19], [30, 22], [26, 24], [22, 23], [18, 24]], 1), R.gold, { base: 2.6, bev: 1 });
    for (const [x, y] of [[36, 20], [44, 20], [52, 20], [60, 21]]) rivet(g, x, y, R.red); groove(g, 12, 25, 64, 25, R.red);
    S(g, 72, 40, m => mpoly(m, [[24, 18], [28, 8], [48, 7], [52, 18]], 1), R.ink, { base: 2.2, bev: 3 });
    S(g, 72, 40, m => { mpoly(m, [[48, 10], [66, 10], [66, 13], [48, 14]], 0); mpoly(m, [[64, 8], [71, 8], [71, 15], [64, 15]], 1); }, R.iron, { base: 2.3, bev: 2 });
    for (let x = 30; x < 46; x += 3) g.set(x, 9, R.gold[3]); line(g, 30, 7, 28, 0, R.iron[3]); S(g, 72, 40, m => mpoly(m, [[28, 0], [34, 1], [28, 4]], 0), R.red, { base: 3 });
    const o = outline(g); rim(o, R.orange[3], "up", .3); return o; }), "两帧履带 · 蝙蝠翼徽记");

  RIMC = null;
  /* ---------- 6. tiles 16×16 ---------- */
  const tile = (id, name, fn, frames = 1, note) => def("tile", id, name, () => Array.from({ length: frames }, (_, k) => fn(k)), note);
  tile("grass", "草地", () => { const g = new G(16, 16), r = rng(11); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.grass, 2.1 + Math.sin(x * .9 + y * .4) * .3 + (r() - .5) * .4, x, y));
    for (let i = 0; i < 12; i++) { const x = r() * 16 | 0, y = 1 + r() * 14 | 0; g.set(x, y, R.grass[3]); g.set(x, y + 1, R.grass[1]); if (i % 3 === 0) g.set(x, y - 1, R.grass[4]); } pts(g, [[4, 11], [12, 4]], R.gold[4]); pts(g, [[5, 11], [12, 5]], R.rice[4]); return g; });
  tile("grassflower", "草地（野花）", () => { const g = new G(16, 16), r = rng(31); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.grass, 2.2 + Math.sin(x * .7 + y * .6) * .3 + (r() - .5) * .3, x, y));
    for (const [x, y, c] of [[3, 4, R.pink], [11, 3, R.rice], [7, 10, R.gold], [13, 12, R.pink], [2, 13, R.rice]]) { g.set(x, y, c[4]); g.set(x - 1, y, c[3]); g.set(x + 1, y, c[3]); g.set(x, y - 1, c[3]); g.set(x, y + 1, R.grass[1]); } return g; });
  tile("dirt", "土路", () => { const g = new G(16, 16), r = rng(12); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.sand, 1.8 + (r() - .5) * .5, x, y)); for (let i = 0; i < 5; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; S(g, 16, 16, m => mblob(m, x + 1, y + 1, 1.4, 1), R.stone, { base: 2.4 }); } return g; });
  tile("paddy", "Token 稻田（秧苗）", k => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.water, 1.6 + Math.sin((x + k * 2) * .8 + y * .3) * .4, x, y));
    for (let y = 2; y < 16; y += 5) for (let x = 2; x < 16; x += 5) { g.set(x, y, R.grass[4]); g.set(x, y + 1, R.grass[3]); g.set(x - 1, y, R.grass[3]); g.set(x + 1, y - 1, R.grass[3]); g.set(x, y + 2, R.water[3]); } return g; }, 2, "两帧水波");
  tile("paddyripe", "Token 稻田（成熟）", k => { const g = new G(16, 16), r = rng(44); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.moss, 1.6 + Math.sin(x * .8 + y * .5) * .3, x, y));
    for (let i = 0; i < 14; i++) { const x = r() * 16 | 0, y = 3 + r() * 13 | 0, sw = k ? (i % 2 ? 1 : 0) : (i % 3 ? 0 : -1); line(g, x, y, x + sw, y - 3, R.moss[3]); const hx = x + sw + 1, hy = y - 3; pts(g, [[hx, hy], [hx + 1, hy + 1], [hx + 1, hy + 2]], R.gold[3]); g.set(hx, hy - 1, R.gold[4]); g.set(hx + 2, hy + 2, R.gold[1]); } return g; }, 2, "两帧风吹 · 稻穗低垂");
  tile("water", "海水", k => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.water, 1.4 + Math.sin((x + k * 4) * .5 + y * .9) * .45 + (y < 3 ? .4 : 0), x, y));
    for (const [x, y] of [[3, 4], [10, 9], [6, 13]]) { g.set((x + k * 3) % 16, y, R.water[4]); g.set((x + k * 3 + 1) % 16, y, R.water[3]); } return g; }, 4, "四帧循环");
  tile("dock", "码头木板", () => { const g = new G(16, 16), r = rng(13); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const pl = y % 4 === 3; g.set(x, y, pl ? R.wood[0] : pick(R.wood, 2.3 + (y % 4 === 0 ? .9 : 0) + Math.sin(x * 1.7 + (y / 4 | 0) * 3) * .3 + (r() - .5) * .2, x, y)); }
    for (const [x, y] of [[2, 1], [13, 5], [6, 9], [11, 13]]) { g.set(x, y, R.iron[3]); g.set(x + 1, y, R.iron[1]); } return g; });
  tile("roof", "瓦片屋顶", () => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 2, xx = (x + row * 2) % 4, yy = y % 4; g.set(x, y, pick(R.orange, (yy === 0 ? 3.4 : yy === 3 ? .6 : 2.2 - yy * .2) - (xx === 3 ? .8 : 0), x, y)); } return g; });
  tile("brick", "圣堂石砖", () => { const g = new G(16, 16), r = rng(14); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 2, off = row % 2 ? 4 : 0, mort = y % 4 === 3 || (x + off) % 8 === 7; g.set(x, y, mort ? R.ink[1] : pick(R.stone, 2 + (y % 4 === 0 ? .9 : 0) + ((x + off) % 8 === 0 ? .5 : 0) + (r() - .5) * .4, x, y)); }
    pts(g, [[3, 5], [12, 10], [4, 6]], R.moss[2]); return g; });
  tile("marble", "大理石地面", () => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = ((x >> 3) + (y >> 3)) % 2; g.set(x, y, pick(c ? R.marble : R.stone, (c ? 2.3 : 2) + (x % 8 === 0 || y % 8 === 0 ? -.7 : 0) + (y < 8 ? .25 : 0), x, y)); }
    line(g, 1, 2, 6, 7, R.marble[1]); line(g, 9, 9, 14, 11, R.marble[4]); return g; });
  tile("carpet", "红毯", () => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, x < 2 || x > 13 ? (x === 0 || x === 15 ? R.gold[1] : R.gold[3]) : pick(R.red, 1.6 + ((x + y) % 6 === 0 ? .8 : 0) + Math.sin(y * .8) * .2, x, y)); return g; });
  tile("glass", "彩窗（16×32）", () => { const g = new G(16, 32); const cols = [R.blue, R.purple, R.gold, R.cyan, R.red];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) { const d = y < 8 ? Math.hypot(x + .5 - 8, y + .5 - 8) : 0; if (y < 8 && d > 7.5) continue; const lead = x === 0 || x === 15 || x % 5 === 0 || y % 6 === 0 || (y < 8 && Math.abs(d - 7.5) < .8); const ci = ((x / 5 | 0) * 3 + (y / 6 | 0)) % cols.length; g.set(x, y, lead ? R.ink[1] : pick(cols[ci], 2.2 + (y < 16 ? .7 : 0) - (x > 10 ? .5 : 0), x, y)); }
    glow(g, 8, 10, 12, R.gold[4], .25); return g; });
  tile("rubble", "废墟碎石", () => { const g = new G(16, 16), r = rng(15); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.rust, 1.2 + (r() - .5) * .4, x, y));
    for (let i = 0; i < 5; i++) { const cx = r() * 16, cy = r() * 16; S(g, 16, 16, m => mpoly(m, [[cx - 2, cy], [cx, cy - 2], [cx + 2.5, cy - .5], [cx + 1, cy + 2]], 0), i % 2 ? R.stone : R.rust, { base: 2.2, bev: 2 }); } line(g, 2, 14, 12, 9, R.rust[3]); return g; });
  tile("metal", "铆钉钢板", () => { const g = new G(16, 16); box(g, 0, 0, 16, 16, R.iron, { base: 1.8 }); for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { g.set(x, y, R.iron[4]); g.set(x + 1, y + 1, R.iron[0]); } line(g, 4, 9, 11, 7, R.iron[1]); line(g, 4, 10, 11, 8, R.iron[3]); return g; });
  tile("conveyor", "传送带", k => { const g = new G(16, 16); box(g, 0, 4, 16, 10, R.ink, { base: 2 }); for (let x = 0; x < 16; x++) if ((x + k * 2) % 4 < 2) { g.set(x, 5, R.iron[3]); g.set(x, 12, R.iron[2]); }
    for (const x of [3, 11]) sphere(g, x + .5, 15, 1.6, 1.6, R.iron); for (let x = 0; x < 16; x++) g.set(x, 3, ((x + k * 2) >> 1) % 2 ? R.gold[3] : R.ink[1]); return g; }, 2, "两帧滚动");
  tile("hazard", "警示条纹", () => { const g = new G(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g.set(x, y, ((x + y) >> 2) % 2 ? pick(R.gold, 3 - (y > 12 ? 1 : 0), x, y) : R.ink[2]); return g; });
  tile("neon", "霓虹面板", k => { const g = new G(16, 16); box(g, 0, 0, 16, 16, R.ink, { base: 2 }); for (let y = 3; y < 13; y += 3) for (let x = 2; x < 14; x++) g.set(x, y, (x + y + k) % 5 ? R.pink[k ? 3 : 2] : R.cyan[3]);
    glow(g, 8, 8, 10, R.pink[3], k ? .3 : .18); return g; }, 2, "两帧闪烁");
  tile("pipe", "管线", () => { const g = new G(16, 16); for (let y = 4; y < 12; y++) for (let x = 0; x < 16; x++) g.set(x, y, pick(R.steel, 3.6 - Math.abs(y - 6.5) * .7, x, y)); S(g, 16, 16, m => mpoly(m, [[6, 3], [10, 3], [10, 13], [6, 13]], 0), R.iron, { base: 2.2, bev: 2 }); g.set(8, 6, R.cyan[3]); return g; });

  /* ---------- 7. props ---------- */
  def("prop", "cooker", "电饭锅", () => [0, 1].map(k => { const g = new G(26, 24);
    S(g, 26, 24, m => mpoly(m, [[3, 11], [23, 11], [22, 20], [19, 23], [7, 23], [4, 20]], 2), R.rice, { base: 2.4, bev: 4 });
    S(g, 26, 24, m => mblob(m, 13, 9.5, 10.5, 3.5, 2.4), R.rice, { base: 3, bev: 2 }); S(g, 26, 24, m => mblob(m, 13, 6, 3.5, 1.6, 3), R.iron, { base: 2.4 });
    for (let x = 4; x < 23; x++) g.set(x, 15, x < 10 ? R.blue[3] : R.blue[2]); S(g, 26, 24, m => mblob(m, 18, 19, 2, 1.4, 4), R.ink, { base: 1.6 }); g.set(18, 19, k ? R.red[4] : R.green[4]);
    if (k) pts(g, [[10, 2], [11, 1], [14, 2], [13, 0], [16, 1]], R.rice[2]); else pts(g, [[11, 2], [12, 1]], R.rice[1]); const o = outline(g); glow(o, 19, 20, 4, k ? R.red[3] : R.green[3], .5); return o; }), "两帧：保温 / 煮好了");
  def("prop", "crate", "数据箱", () => { const g = new G(18, 18); S(g, 18, 18, m => mpoly(m, [[1, 2], [17, 2], [17, 17], [1, 17]], 0), R.wood, { base: 2, bev: 2 });
    for (const y of [6, 11]) groove(g, 2, y, 16, y, R.wood); S(g, 18, 18, m => { mpoly(m, [[1, 2], [17, 2], [17, 4], [1, 4]], 0); mpoly(m, [[1, 15], [17, 15], [17, 17], [1, 17]], 0); }, R.iron, { base: 2.2, bev: 1 }); S(g, 18, 18, m => mpoly(m, [[5, 7], [13, 7], [13, 12], [5, 12]], 0), R.ink, { base: 2 }); pts(g, [[6, 8], [8, 9], [10, 8], [11, 10]], R.cyan[3]); for (const [x, y] of [[2, 3], [15, 3], [2, 15], [15, 15]]) rivet(g, x, y, R.iron); return outline(g); });
  def("prop", "barrel", "冷却液桶", () => { const g = new G(18, 22); S(g, 18, 22, m => mblob(m, 9, 11, 7.5, 10.5, 3.2), R.cyan, { base: 2.2, bev: 4 });
    for (const y of [3, 11, 19]) for (let x = 1; x < 17; x++) if (g.get(x, y)) g.set(x, y, R.iron[x < 7 ? 3 : 1]); S(g, 18, 22, m => mpoly(m, [[5, 6], [13, 6], [13, 9], [5, 9]], 0), R.gold, { base: 2.6 }); return outline(g); });
  def("prop", "server", "服务器机柜", () => [0, 1].map(k => { const g = new G(20, 38), r = rng(20 + k); S(g, 20, 38, m => mpoly(m, [[1, 1], [19, 1], [19, 37], [1, 37]], 0), R.ink, { base: 2.2, bev: 2 });
    for (let y = 4; y < 34; y += 4) { box(g, 3, y, 14, 3, R.iron, { base: 1.6 }); for (let x = 4; x < 15; x += 2) if (r() < .5) g.set(x, y + 1, r() < .7 ? R.green[3] : R.cyan[4]); }
    const o = outline(g); glow(o, 10, 19, 14, R.cyan[2], .12); return o; }), "两帧指示灯");
  def("prop", "lamppost", "港口路灯", () => { const g = new G(16, 42); S(g, 16, 42, m => { mpoly(m, [[7, 10], [9, 10], [9, 38], [7, 38]], 0); mblob(m, 8, 39.5, 4, 2, 3); }, R.iron, { base: 1.8, bev: 1 });
    S(g, 16, 42, m => mpoly(m, [[3, 4], [8, 0], [13, 4], [12, 10], [4, 10]], 1), R.ink, { base: 2.2, bev: 2 }); S(g, 16, 42, m => mblob(m, 8, 6.5, 2.6, 2.6), R.gold, { base: 3.8 }); line(g, 9, 14, 13, 12, R.iron[2]); S(g, 16, 42, m => mblob(m, 13, 12, 1.6, 1.6), R.red, { base: 2.6 });
    const o = outline(g); glow(o, 9, 7, 13, R.gold[3], .5); return o; });
  def("prop", "banner", "圣会旗帜", () => { const g = new G(20, 42); line(g, 1, 0, 18, 0, R.gold[2]); pts(g, [[0, 0], [19, 0]], R.gold[4]);
    S(g, 20, 42, m => mpoly(m, [[2, 1], [18, 1], [18, 37], [10, 32], [2, 37]], 0), R.ink, { base: 2, bev: 2, fn: (x, y, v, d) => d <= 1.5 ? R.gold[d <= 1 ? 3 : 1] : v });
    for (let a = 0; a < 16; a++) { const t = a * Math.PI / 8, l = a % 2 ? 4 : 5.5; line(g, 10, 14, 10 + Math.cos(t) * l, 14 + Math.sin(t) * l, R.gold[a % 2 ? 2 : 3]); } S(g, 20, 42, m => mblob(m, 10, 14, 2.6, 2.6), R.gold, { base: 3 });
    for (let a = 0; a < 10; a++) { const t = a * Math.PI / 5; g.set(10 + Math.cos(t) * 3.6, 14 + Math.sin(t) * 3.6, R.iron[3]); } for (let y = 24; y < 31; y += 2) line(g, 6, y, 14, y, R.gold[1]); return outline(g); });
  def("prop", "pigeon", "信鸽", () => [0, 1].map(k => { const g = new G(18, 14);
    S(g, 18, 14, m => { mpoly(m, [[3, 8], [9, 5], [14, 6], [15, 9], [10, 11], [4, 10]], 2); mblob(m, 13.5, 5.5, 2.6, 2.4); mpoly(m, [[0, 7], [4, 8], [1, 11]], 0); }, R.marble, { base: 2.4, bev: 3 });
    g.set(14, 5, R.ink[1]); pts(g, [[16, 6], [17, 6]], R.orange[2]); S(g, 18, 14, m => k ? mpoly(m, [[5, 7], [11, 7], [6, 0]], 1) : mpoly(m, [[5, 8], [11, 8], [4, 13]], 1), R.marble, { base: k ? 3 : 2, bev: 2 });
    S(g, 18, 14, m => mpoly(m, [[7, 10], [10, 10], [10, 12], [7, 12]], 0), R.rice, { base: 4 }); g.set(8, 11, R.red[3]); return outline(g); }), "两帧扑翼 · 腿上绑着信");
  def("prop", "sign403", "403 封锁牌", () => { const g = new G(30, 20); S(g, 30, 20, m => mblob(m, 15, 7.5, 14, 7, 5), R.ink, { base: 1.8, bev: 2 });
    const D = { 4: ["101", "101", "111", "001", "001"], 0: ["111", "101", "101", "101", "111"], 3: ["111", "001", "111", "001", "111"] };
    [4, 0, 3].forEach((n, i) => D[n].forEach((row, y) => [...row].forEach((v, x) => { if (v === "1") { g.set(6 + i * 6 + x * 1.5, 5 + y, R.red[4]); g.set(7 + i * 6 + x * 1.5, 5 + y, R.red[3]); } })));
    S(g, 30, 20, m => mpoly(m, [[13, 14], [17, 14], [17, 20], [13, 20]], 0), R.iron, { base: 2 }); const o = outline(g); glow(o, 15, 8, 14, R.red[3], .4); return o; });
  def("prop", "bowl", "大肥鱼的铁盆", () => { const g = new G(24, 14);
    S(g, 24, 14, m => mpoly(m, [[1, 4], [23, 4], [20, 11], [12, 14], [4, 11]], 2), R.iron, { base: 2.3, bev: 4, k: 1.8 });
    S(g, 24, 14, m => mpoly(m, [[2, 4], [6, 1], [12, 0], [18, 1], [22, 4]], 2), R.rice, { base: 3.2, bev: 2 }); for (let x = 1; x < 23; x++) g.set(x, 5, x < 8 ? R.iron[4] : R.iron[3]);
    pts(g, [[7, 2], [10, 1], [14, 2], [16, 3]], "#ffffff"); return outline(g); });
  def("prop", "storybook", "空白最后一页的童话书", () => { const g = new G(28, 20);
    S(g, 28, 20, m => mpoly(m, [[1, 4], [13, 1], [14, 17], [1, 19]], 1), R.rice, { base: 3, bev: 2 }); S(g, 28, 20, m => mpoly(m, [[14, 1], [26, 4], [26, 19], [14, 17]], 1), R.rice, { base: 3.6, bev: 2 });
    for (let y = 5; y < 15; y += 2) line(g, 3, y, 11, y - 1, R.stone[3]); line(g, 14, 1, 14, 17, R.wood[1]); S(g, 28, 20, m => mpoly(m, [[17, 9], [23, 8], [21, 12]], 1), R.blue, { base: 3 }); g.set(18, 9, R.ink[1]); return outline(g); });

  /* ---------- 8. buildings 64×64 ---------- */
  RIMC = "#ffd79a"; // late-afternoon sun behind the bay
  function ground(g) { for (let y = 58; y < 64; y++) for (let x = 0; x < 64; x++) g.set(x, y, pick(R.grass, y === 58 ? 3.2 : 2 - (y - 58) * .25, x, y)); const r = rng(77); for (let i = 0; i < 10; i++) { const x = r() * 64 | 0; g.set(x, 57, R.grass[3]); g.set(x + 1, 56, R.grass[4]); } for (let i = 0; i < 6; i++) S(g, 64, 64, m => mblob(m, 4 + r() * 56, 60 + r() * 2, 1.6, 1, 2), R.stone, { base: 2.6 }); }
  function wall(g, x, y0, y1, w, ramp, o = {}) { S(g, 64, 64, m => mpoly(m, [[x, y0], [x + w, y0], [x + w, y1], [x, y1]], 0), ramp, { base: o.base ?? 2.4, bev: 2, k: 1 });
    if (o.timber) { for (const xx of [x, x + w - 2, x + (w >> 1) - 1]) for (let y = y0; y < y1; y++) { g.set(xx, y, R.wood[2]); g.set(xx + 1, y, R.wood[1]); } for (let xx = x; xx < x + w; xx++) { g.set(xx, y0, R.wood[3]); g.set(xx, y0 + 1, R.wood[1]); } } }
  function roof(g, x, y, w, h, ramp, o = {}) { const over = o.over ?? 4; const p = o.flat ? [[x - over, y], [x + w + over, y], [x + w + over - 1, y - 4], [x - over + 1, y - 4]] : o.curve ? [[x - over - 2, y + 1], [x - 2, y - 2], [x + w * .2, y - h * .8], [x + w / 2, y - h], [x + w * .8, y - h * .8], [x + w + 2, y - 2], [x + w + over + 2, y + 1]] : [[x - over, y + 1], [x + w / 2, y - h], [x + w + over, y + 1]];
    S(g, 64, 64, m => mpoly(m, p, o.curve ? 2 : 0), ramp, { base: 2.2, bev: 3, k: 1.6, fn: (xx, yy, v, d) => o.flat ? v : v + ((yy - y + h) % 3 === 0 ? -.8 : 0) });
    for (let xx = x - over; xx <= x + w + over; xx++) if (g.get(xx, y + 1)) g.set(xx, y + 1, ramp[0]); }
  function win(g, x, y, w, h, lit, o = {}) { S(g, 64, 64, m => mpoly(m, o.arch ? [[x, y + h], [x, y + 2], [x + w / 2, y - 1], [x + w, y + 2], [x + w, y + h]] : [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o.arch ? 1 : 0), R.wood, { base: 1.4, bev: 1 });
    for (let j = 1; j < h; j++) for (let i = 1; i < w; i++) if (g.get(x + i, y + j)) g.set(x + i, y + j, lit ? pick(R.gold, 3.6 - j * .35 - (i > w / 2 ? .5 : 0), x + i, y + j) : pick(R.ink, 2 + (j < 2 ? 1 : 0), x + i, y + j));
    for (let j = 1; j < h; j++) g.set(x + (w >> 1), y + j, R.wood[1]); for (let i = 1; i < w; i++) g.set(x + i, y + (h >> 1) + 1, R.wood[1]);
    if (o.box) { S(g, 64, 64, m => mpoly(m, [[x - 1, y + h], [x + w + 1, y + h], [x + w, y + h + 3], [x, y + h + 3]], 0), R.wood, { base: 2.2 }); for (let i = 0; i < w; i += 2) { g.set(x + i, y + h - 1, i % 4 ? R.red[3] : R.pink[3]); g.set(x + i + 1, y + h - 1, R.grass[3]); } } }
  function door(g, x, y, w = 7, h = 11) { S(g, 64, 64, m => mpoly(m, [[x, y], [x, y - h + 3], [x + w / 2, y - h], [x + w, y - h + 3], [x + w, y]], 1), R.wood, { base: 1.8, bev: 2 }); for (let j = y - h + 3; j < y; j++) g.set(x + (w >> 1), j, R.wood[0]); g.set(x + w - 2, y - 5, R.gold[4]); S(g, 64, 64, m => mpoly(m, [[x - 2, y], [x + w + 2, y], [x + w + 1, y + 2], [x - 1, y + 2]], 0), R.stone, { base: 2.4 }); }
  const lantern = (g, x, y, col = R.orange) => { line(g, x, y - 3, x, y, R.iron[2]); S(g, 64, 64, m => mblob(m, x, y + 2.5, 2, 2.8, 2.4), col, { base: 3 }); g.set(x, y + 6, R.gold[3]); glow(g, x, y + 2, 8, col[3], .45); };
  const bld = (id, name, fn, note) => def("building", id, name, () => { const g = new G(64, 64); ground(g); fn(g); return outline(g); }, note);
  bld("canteen", "食堂", g => { wall(g, 8, 32, 58, 48, R.rice, { timber: true }); roof(g, 8, 32, 48, 16, R.orange, { curve: true }); S(g, 64, 64, m => mpoly(m, [[42, 6], [48, 6], [48, 22], [42, 22]], 0), R.brick, { base: 2.2, bev: 1 }); pts(g, [[44, 3], [45, 1], [43, 0], [47, 2]], R.rice[2]);
    win(g, 12, 38, 9, 8, 1, { box: true }); win(g, 43, 38, 9, 8, 1, { box: true }); door(g, 28, 58); S(g, 64, 64, m => mblob(m, 32, 24, 7, 3.8, 2.4), R.rice, { base: 3.2 }); for (let x = 25; x < 40; x++) if (g.get(x, 26)) g.set(x, 26, R.blue[3]);
    S(g, 64, 64, m => mpoly(m, [[2, 44], [8, 40], [8, 58], [2, 58]], 0), R.wood, { base: 2.4 }); for (let i = 0; i < 4; i++) g.set(3 + i, 46 + i * 2, R.rice[4]); lantern(g, 24, 34); lantern(g, 40, 34); });
  bld("datacenter", "数据中心", g => { S(g, 64, 64, m => { mpoly(m, [[4, 22], [60, 22], [60, 58], [4, 58]], 0); mpoly(m, [[12, 14], [52, 14], [52, 22], [12, 22]], 0); }, R.steel, { base: 1.8, bev: 2 });
    S(g, 64, 64, m => { mblob(m, 2, 46, 4, 12, 3); }, R.cyan, { base: 2, bev: 3 }); for (const y of [38, 46, 54]) for (let x = 0; x < 6; x++) if (g.get(x, y)) g.set(x, y, R.iron[2]);
    for (let y = 27; y < 52; y += 5) for (let x = 8; x < 56; x += 3) g.set(x, y, (x * y) % 7 < 3 ? R.cyan[3] : R.green[3]); for (let y = 25; y < 56; y += 5) groove(g, 5, y, 59, y, R.steel);
    for (const x of [12, 25, 38]) { S(g, 64, 64, m => mblob(m, x + 7, 10, 6, 3.4, 2.4), R.iron, { base: 2.4, bev: 2 }); for (let i = -4; i < 5; i += 2) g.set(x + 7 + i, 9, R.iron[1]); S(g, 64, 64, m => mpoly(m, [[x + 6, 12], [x + 8, 12], [x + 8, 15], [x + 6, 15]], 0), R.iron, { base: 1.6 }); }
    for (let x = 14; x < 51; x += 4) g.set(x, 18, R.cyan[2]);
    S(g, 64, 64, m => mpoly(m, [[24, 46], [40, 46], [40, 58], [24, 58]], 0), R.ink, { base: 1.6, bev: 1 }); for (let x = 26; x < 39; x += 2) g.set(x, 50, R.cyan[2]); line(g, 56, 22, 60, 4, R.iron[3]); S(g, 64, 64, m => mblob(m, 60, 4, 1.6, 1.6), R.red, { base: 3 });
    glow(g, 32, 38, 26, R.cyan[2], .15); glow(g, 60, 4, 6, R.red[3], .5); }, "屋顶三台散热风扇");
  bld("windmill", "电站 · 风车", g => { S(g, 64, 64, m => mpoly(m, [[24, 58], [40, 58], [36, 18], [28, 18]], 0), R.marble, { base: 2.4, bev: 3, k: 1.4 }); for (let y = 24; y < 58; y += 6) groove(g, 26, y, 38, y, R.marble);
    roof(g, 27, 18, 10, 7, R.blue); for (let a = 0; a < 4; a++) { const t = a * Math.PI / 2 + .45, c = Math.cos(t), s = Math.sin(t), px = Math.cos(t + 1.57), py = Math.sin(t + 1.57);
      const p0 = [32 + c * 6, 14 + s * 6], p1 = [32 + c * 22, 14 + s * 22];
      for (let q = 6; q <= 22; q += .5) for (let w2 = 0; w2 <= 4.6; w2 += .5) g.set(32 + c * q + px * w2, 14 + s * q + py * w2, (Math.round(q) % 6 === 0) ? R.rice[1] : (a % 2 ? R.rice[3] : R.rice[2]));
      line(g, 32, 14, p1[0], p1[1], R.wood[3]); }
    S(g, 64, 64, m => mblob(m, 32, 14, 3.4, 3.4), R.iron, { base: 2.6 }); door(g, 29, 58, 6, 9); win(g, 30, 32, 4, 6, 1, { arch: true }); S(g, 64, 64, m => mpoly(m, [[46, 48], [56, 48], [56, 58], [46, 58]], 0), R.iron, { base: 2.2 }); for (let x = 47; x < 56; x += 2) g.set(x, 51, R.gold[4]); });
  bld("workshop", "标注工坊", g => { wall(g, 6, 34, 58, 46, R.marble); roof(g, 6, 34, 46, 0, R.ink, { flat: true }); S(g, 64, 64, m => mpoly(m, [[8, 22], [26, 22], [26, 30], [8, 30]], 0), R.marble, { base: 2.6 }); for (let x = 9; x < 26; x += 3) line(g, x, 22, x + 2, 30, R.cyan[3]);
    win(g, 30, 40, 10, 7, 1); win(g, 44, 40, 8, 7, 0); door(g, 12, 58); line(g, 52, 34, 52, 8, R.gold[2], 2); line(g, 52, 8, 36, 8, R.gold[2], 2); line(g, 38, 9, 38, 16, R.iron[3]); S(g, 64, 64, m => mpoly(m, [[34, 16], [42, 16], [41, 21], [35, 21]], 0), R.cyan, { base: 2.6 });
    for (let x = 30; x < 52; x++) if ((x >> 1) % 2) g.set(x, 33, R.gold[3]); glow(g, 38, 19, 7, R.cyan[3], .4); }, "吊臂上挂着一块正在清洗的数据");
  bld("archive", "档案馆", g => { wall(g, 10, 30, 58, 44, R.purple, { base: 2 }); roof(g, 10, 30, 44, 18, R.ink, { curve: true }); S(g, 64, 64, m => mblob(m, 32, 22, 5, 5), R.purple, { base: 1, bev: 1 }); S(g, 64, 64, m => mblob(m, 32, 22, 4, 4), R.gold, { base: 3.4, bev: 3 }); S(g, 64, 64, m => mblob(m, 34, 21, 3.4, 3.4), R.purple, { base: 1 });
    for (const x of [14, 46]) win(g, x, 36, 6, 10, 1, { arch: true }); door(g, 28, 58); for (const x of [12, 52]) S(g, 64, 64, m => mpoly(m, [[x - 1, 30], [x + 1, 30], [x + 1, 58], [x - 1, 58]], 0), R.marble, { base: 2.8, bev: 1 });
    for (let i = 0; i < 5; i++) g.set(20 + i * 6, 9 + (i % 2) * 3, R.rice[4]);
    const iv = rng(41); for (const sx of [11, 53]) { let x = sx; for (let y = 58; y > 34; y--) { x += Math.round((iv() - .5) * 1.4); g.set(x, y, R.moss[2]); if (y % 3 === 0) { g.set(x - 1, y, R.moss[3]); g.set(x + 1, y - 1, R.moss[4]); } } }
    glow(g, 31, 23, 12, R.gold[3], .3); });
  bld("observatory", "天文台", g => { S(g, 64, 64, m => mpoly(m, [[10, 34], [54, 34], [54, 58], [10, 58]], 0), R.stone, { base: 2.2, bev: 2, vy: .6 }); for (let y = 38; y < 58; y += 5) groove(g, 11, y, 53, y, R.stone);
    const dm = new M(64, 64); mblob(dm, 32, 34, 20, 16); for (let i = 34 * 64; i < 64 * 64; i++) dm.a[i] = 0; sculpt(g, dm, R.steel, { base: 2.2, bev: 6, k: 1.8 }); for (let x = 30; x < 35; x++) for (let y = 18; y < 34; y++) if (g.get(x, y)) g.set(x, y, R.ink[1]);
    S(g, 64, 64, m => mline(m, 33, 26, 50, 8, 4), R.gold, { base: 2.6, bev: 2 }); door(g, 28, 58); for (const [x, y] of [[8, 6], [56, 12], [48, 3], [14, 16], [24, 4]]) { g.set(x, y, R.rice[4]); g.set(x + 1, y, R.purple[3]); g.set(x - 1, y, R.purple[3]); } glow(g, 50, 8, 7, R.purple[3], .4); });
  bld("tavern", "酒馆", g => { wall(g, 6, 30, 58, 50, R.brick, { timber: true, base: 2 }); roof(g, 6, 30, 50, 16, R.ink, { curve: true }); win(g, 10, 38, 9, 9, 1, { box: true }); win(g, 44, 38, 9, 9, 1, { box: true }); door(g, 28, 58);
    S(g, 64, 64, m => mpoly(m, [[22, 20], [42, 20], [42, 28], [22, 28]], 0), R.ink, { base: 1.8, bev: 1 }); S(g, 64, 64, m => mpoly(m, [[25, 24], [32, 21], [39, 24], [35, 26], [32, 25], [29, 26]], 1), R.red, { base: 3 }); line(g, 22, 20, 18, 16, R.iron[3]); line(g, 42, 20, 46, 16, R.iron[3]);
    S(g, 64, 64, m => mblob(m, 52, 56, 4, 3, 2.4), R.wood, { base: 2.4 }); for (let y = 54; y < 59; y += 2) line(g, 48, y, 56, y, R.wood[1]); lantern(g, 24, 32); lantern(g, 40, 32); });
  bld("pigeontower", "信鸽塔 · 心灯", g => { S(g, 64, 64, m => mpoly(m, [[22, 58], [42, 58], [38, 16], [26, 16]], 0), R.marble, { base: 2.3, bev: 3, k: 1.4 }); for (let y = 22; y < 58; y += 7) groove(g, 24, y, 40, y, R.marble);
    roof(g, 24, 16, 16, 12, R.orange); S(g, 64, 64, m => mpoly(m, [[27, 17], [37, 17], [37, 24], [27, 24]], 0), R.ink, { base: 1 }); S(g, 64, 64, m => mpoly(m, [[32, 18], [35, 21], [33, 24], [31, 24], [29, 21]], 1), R.orange, { base: 3.4 });
    for (const [x, y] of [[8, 14], [52, 8], [56, 18], [12, 26]]) { g.set(x, y, R.marble[4]); g.set(x - 1, y - 1, R.marble[3]); g.set(x + 1, y - 1, R.marble[3]); }
    win(g, 30, 34, 4, 7, 0, { arch: true }); door(g, 29, 58, 6, 9);
    S(g, 64, 64, m => mpoly(m, [[20, 25], [44, 25], [42, 28], [22, 28]], 0), R.wood, { base: 2.4, bev: 1 }); for (let x = 21; x < 44; x += 3) { g.set(x, 24, R.wood[3]); g.set(x, 23, R.wood[2]); } for (let x = 21; x < 44; x++) g.set(x, 22, R.wood[3]);
    glow(g, 32, 21, 18, R.orange[3], .5); }, "塔顶就是心灯，越亮代表克劳德越像自己");
  bld("radio", "港口电台", g => { wall(g, 8, 36, 58, 40, R.pink, { base: 2 }); roof(g, 8, 36, 40, 0, R.ink, { flat: true }); line(g, 42, 32, 42, 2, R.iron[3]); for (let y = 4; y < 32; y += 6) { line(g, 39, y, 45, y + 5, R.iron[2]); line(g, 45, y, 39, y + 5, R.iron[2]); }
    S(g, 64, 64, m => mblob(m, 42, 2, 1.8, 1.8), R.red, { base: 3 }); win(g, 12, 42, 12, 7, 1); door(g, 30, 58);
    S(g, 64, 64, m => mpoly(m, [[8, 37], [48, 37], [50, 41], [6, 41]], 0), R.rice, { base: 3, bev: 1, fn: (x, y, v) => (x >> 2) % 2 ? R.pink[3] : R.rice[3] }); for (let x = 6; x < 50; x += 4) g.set(x + 1, 42, R.pink[2]);
    S(g, 64, 64, m => mpoly(m, [[36, 46], [46, 46], [46, 52], [36, 52]], 0), R.ink, { base: 1.6 }); for (let x = 37; x < 46; x++) g.set(x, 49, (x % 3) ? R.pink[4] : R.cyan[3]); S(g, 64, 64, m => mblob(m, 54, 30, 6, 5), R.iron, { base: 2.4, bev: 3 }); line(g, 54, 30, 58, 26, R.iron[4]);
    for (let i = 0; i < 3; i++) for (let a = -2; a <= 2; a++) g.set(48 - i * 3 + Math.abs(a) * 0, 10 + a + i * 0, R.pink[3 - (i % 2)]); glow(g, 42, 2, 7, R.red[3], .6); });
  bld("academy", "竹林书院", g => { for (const x of [2, 7, 52, 57]) { S(g, 64, 64, m => mpoly(m, [[x, 4], [x + 3, 4], [x + 3, 58], [x, 58]], 0), R.grass, { base: 2.2, bev: 1 }); for (let y = 12; y < 58; y += 9) { g.set(x, y, R.grass[0]); g.set(x + 1, y, R.grass[0]); } }
    for (const [x, y, d] of [[6, 10, 1], [56, 16, -1], [4, 24, 1], [58, 30, -1]]) S(g, 64, 64, m => mpoly(m, [[x, y], [x + d * 8, y - 3], [x + d * 6, y + 1]], 1), R.grass, { base: 3 });
    wall(g, 14, 36, 58, 36, R.rice); roof(g, 14, 36, 36, 12, R.blue, { curve: true, over: 6 }); win(g, 18, 42, 7, 8, 1); win(g, 39, 42, 7, 8, 1); door(g, 28, 58);
    S(g, 64, 64, m => mpoly(m, [[24, 30], [40, 30], [40, 34], [24, 34]], 0), R.wood, { base: 2 }); for (let x = 26; x < 39; x += 3) g.set(x, 32, R.gold[4]); });

  /* ---------- 9. backgrounds 256×144 ---------- */
  RIMC = null;
  const BW = 256, BH = 144;
  // per-biome grade: complementary for interiors, analogous for exteriors (shadow tint, light tint)
  const GRADE = { bay_day: ["#1b3a5a", "#fff0c8", .25, .12], cathedral: ["#0c1e3a", "#ffb45a", .38, .2], waste: ["#10263a", "#ffb060", .35, .18], skyway: ["#1a0838", "#9ef6ff", .3, .14], factory: ["#08202a", "#ff6a4a", .36, .2], seal: ["#0a0a26", "#e6dcff", .25, .2] };
  const bg = (id, name, fn, note) => def("bg", id, name, () => { const g = new G(BW, BH); fn(g, rng(id.length * 97 + 3)); const q = GRADE[id]; if (q) grade(g, q[0], q[1], q[2], q[3]); bloom(g, .8, 3, .3); return g; }, note);
  function gothic(g, r, x, base, w, h, ramp, b, lights) { // gothic building: buttresses, pinnacles, pointed windows
    const m = new M(BW, BH); mpoly(m, [[x, base], [x, base - h], [x + w / 2, base - h - w * .7], [x + w, base - h], [x + w, base]], 0);
    for (const px of [x - 1, x + w - 1]) mpoly(m, [[px, base], [px, base - h - 2], [px + 1, base - h - 10], [px + 2, base - h - 2], [px + 2, base]], 0);
    sculpt(g, m, ramp, { base: b, bev: 2, k: .8 }); if (lights) for (let k = 0; k < Math.floor(h / 12); k++) { const wx = x + 2 + (r() * (w - 4) | 0), wy = base - h + 6 + k * 11; if (r() < .6) for (let j = 0; j < 4; j++) g.set(wx, wy + j, j ? lights : mix(lights, "#000", .3)); } }
  function ruins(g, r, x, base, w, h, col) { let top = base - h; const holes = []; for (let k = 0; k < 2 + r() * 3; k++) holes.push([x + 2 + r() * (w - 6), base - h + 6 + r() * (h * .6), 1.5 + r() * 2.5, 2 + r() * 3]);
    for (let i = 0; i < w; i++) { top += (r() - .5) * 3; top = Math.max(base - h - 6, Math.min(base - h + 8, top)); for (let y = Math.floor(top); y < base; y++) if (!holes.some(([hx, hy, hw, hh]) => Math.abs(x + i - hx) < hw && Math.abs(y - hy) < hh)) g.set(x + i, y, col); } line(g, x + w * .3, top, x + w * .3 + 3, top - 6, col); line(g, x + w * .7, top, x + w * .7 - 2, top - 5, col); }
  bg("bay_day", "白饭湾 · 正午", (g, r) => {
    skyRows(g, ["#5aa4e6", "#7cbcf0", "#a6d4f4", "#d4ecf4", "#ffe6b8"], 0, 92); S(g, BW, BH, m => mblob(m, 206, 28, 12, 12), R.gold, { base: 3.8, bev: 6 }); glow(g, 206, 28, 46, R.gold[4], .35);
    for (const [cx, cy, w] of [[44, 24, 28], [118, 16, 20], [168, 50, 24], [236, 60, 16]]) S(g, BW, BH, m => { mblob(m, cx, cy, w, 5, 2.2); mblob(m, cx - w * .3, cy - 3, w * .45, 5); mblob(m, cx + w * .25, cy - 5, w * .5, 6); }, R.rice, { base: 3.2, bev: 4, k: 1 });
    S(g, BW, BH, m => mpoly(m, [[0, 82], [30, 70], [70, 74], [110, 62], [150, 72], [196, 64], [256, 76], [256, 96], [0, 96]], 2), R.moss, { base: 2.4, bev: 3, k: .8 }); fog(g, 60, 96, "#d4ecf4", .45);
    for (let x = 0, i = 0; x < BW; i++) { const w = 14 + r() * 14 | 0, h = 12 + r() * 14 | 0; const m = new M(BW, BH); mpoly(m, [[x, 96], [x, 96 - h], [x + w, 96 - h], [x + w, 96]], 0); sculpt(g, m, R.rice, { base: 2.6, bev: 1 });
      const rm = new M(BW, BH); mpoly(rm, [[x - 2, 97 - h], [x + 1, 94 - h - 3], [x + w / 2, 96 - h - 9], [x + w - 1, 94 - h - 3], [x + w + 2, 97 - h]], 1); sculpt(g, rm, i % 3 ? R.orange : R.brick, { base: 2.2, bev: 2 });
      if (r() < .7) { g.set(x + 4, 96 - h + 5, R.gold[3]); g.set(x + 5, 96 - h + 5, R.gold[3]); g.set(x + 4, 96 - h + 6, R.gold[2]); } if (r() < .4) { line(g, x + w - 4, 96 - h - 4, x + w - 4, 96 - h - 9, R.brick[2]); g.set(x + w - 4, 96 - h - 11, R.rice[2]); } x += w + 3; }
    skyRows(g, [R.water[3], R.water[2], R.water[1], R.water[1]], 97, 144); for (let y = 99; y < 144; y += 3) for (let x = 0; x < BW; x++) if (Math.sin(x * .17 + y * 1.3) > .86) g.set(x, y, R.water[4]);
    for (let x = 0; x < BW; x++) { g.set(x, 95, R.wood[3]); g.set(x, 96, R.wood[2]); g.set(x, 97, R.wood[0]); } for (let x = 6; x < BW; x += 20) for (let y = 98; y < 112; y++) { g.set(x, y, R.wood[1]); g.set(x + 1, y, R.wood[0]); }
    S(g, BW, BH, m => mpoly(m, [[148, 118], [200, 118], [192, 127], [156, 127]], 1), R.rice, { base: 3, bev: 2 }); line(g, 174, 92, 174, 118, R.wood[1]); S(g, BW, BH, m => mpoly(m, [[176, 94], [194, 114], [176, 114]], 1), R.rice, { base: 3.6, bev: 2 });
    for (let y = 128; y < 132; y++) for (let x = 150; x < 198; x++) if (g.get(x, y) && (x + y) % 3 === 0) g.set(x, y, R.water[3]); particles(g, r, 10, [0, 0, BW, 60], ["#ffffff"]);
  }, "天空、远山、港口房屋、码头与海面");
  bg("cathedral", "穹顶城 · 圣堂夜", (g, r) => {
    skyRows(g, ["#04040b", "#0b0a19", "#16122a", "#261b36", "#3a2238"], 0, 144); stars(g, r, 90, 70, ["#ffffff", "#c8c8ff", "#8888b8"]);
    for (let x = -4; x < BW;) { const w = 10 + r() * 12 | 0; gothic(g, r, x, 144, w, 40 + r() * 40 | 0, R.ink, 1.4, R.gold[2]); x += w + 4; } fog(g, 70, 144, "#261b36", .45);
    const C = 128; gothic(g, r, C - 48, 144, 96, 66, R.stone, 1.5, null); for (const d of [-62, 62]) gothic(g, r, C + d - 12, 144, 24, 96, R.stone, 1.3, null);
    for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) { const d = Math.hypot(x - 14.5, y - 14.5); if (d > 14) continue; const a = Math.atan2(y - 14.5, x - 14.5); const sp = Math.abs(Math.sin(a * 4)) < .12 || Math.abs(d - 9) < .7 || d > 13.2; g.set(C - 15 + x, 58 + y, sp ? R.ink[1] : pick([R.gold, R.purple, R.red, R.blue][((a + 4) * 1.3 | 0) & 3], 2.6 + (d < 5 ? 1.4 : 0), x, y)); }
    for (const x of [C - 36, C - 25, C + 19, C + 30]) { S(g, BW, BH, m => mpoly(m, [[x, 122], [x, 100], [x + 3, 95], [x + 6, 100], [x + 6, 122]], 0), R.ink, { base: 1 }); for (let y = 100; y < 121; y++) g.set(x + 2 + (y % 2), y, R.gold[2]); }
    glow(g, C, 72, 70, R.gold[3], .3); shaft(g, C - 9, C + 9, 72, 144, R.gold[3], .22);
    for (let x = C - 34; x < C + 34; x += 5) S(g, BW, BH, m => mpoly(m, [[x, 144], [x, 132], [x + 2, 128], [x + 4, 132], [x + 4, 144]], 0), R.ink, { base: .4, bev: 1 });
    particles(g, r, 36, [C - 50, 60, C + 50, 140], [R.gold[4], R.gold[3]]);
  }, "哥特飞扶壁剪影、玫瑰窗、体积光柱与跪拜的黑袍");
  bg("waste", "荒原 · 黄昏", (g, r) => {
    skyRows(g, ["#180c1e", "#3a182a", "#782c32", "#c45836", "#f2a24e"], 0, 112); S(g, BW, BH, m => mblob(m, 70, 98, 22, 22), R.gold, { base: 3.6, bev: 10 }); glow(g, 70, 98, 80, R.orange[3], .4);
    for (let L = 0; L < 3; L++) { const base = 108 + L * 12, col = [R.brick[1], R.rust[0], R.ink[0]][L]; for (let x = -4; x < BW;) { const w = 10 + r() * 26 | 0; ruins(g, r, x, base + 30, w, (L === 0 ? 50 : 30) + r() * 30, col); x += w + (r() * 14 | 0); } if (L === 0) fog(g, 40, 140, "#f2a24e", .35); }
    S(g, BW, BH, m => mpoly(m, [[176, 140], [186, 52], [196, 50], [200, 140]], 0), R.rust, { base: .8, bev: 2, k: .5 }); for (let y = 56; y < 140; y += 8) { line(g, 180, y, 198, y + 6, R.rust[1]); }
    line(g, 214, 140, 214, 40, R.ink[1], 2); line(g, 214, 42, 250, 46, R.ink[1], 2); line(g, 214, 42, 226, 30, R.ink[1]); line(g, 244, 46, 244, 74, R.ink[1]); S(g, BW, BH, m => mpoly(m, [[240, 74], [248, 74], [247, 80], [241, 80]], 0), R.ink, { base: 1 });
    S(g, BW, BH, m => { mpoly(m, [[0, 144], [0, 128], [20, 122], [44, 126], [70, 118], [96, 128], [96, 144]], 2); mpoly(m, [[150, 144], [168, 124], [200, 120], [236, 128], [256, 124], [256, 144]], 2); }, R.ink, { base: .6, bev: 2, k: .6 });
    line(g, 30, 122, 40, 108, R.ink[1]); line(g, 34, 124, 52, 112, R.ink[1]); line(g, 210, 122, 226, 104, R.ink[1]);
    skyRows(g, [R.rust[1], R.rust[0], R.ink[0]], 136, 144); for (let i = 0; i < 6; i++) { const x = 24 + i * 40 + r() * 10, y = 128 - r() * 6; g.set(x, y, R.red[4]); g.set(x + 3, y, R.red[4]); glow(g, x + 1, y, 6, R.red[3], .7, true); }
    particles(g, r, 60, [0, 10, BW, 132], [R.sand[3], R.orange[3], R.gold[4]]);
  }, "破碎的楼体剪影 + 远处失控体的红色眼睛");
  bg("skyway", "穹顶城 · 霓虹高架", (g, r) => {
    skyRows(g, ["#080514", "#170a30", "#311054", "#561864", "#782262"], 0, 144);
    for (let L = 0; L < 3; L++) { const ramp = [R.purple, R.ink, R.ink][L], b = [1, 1.6, .6][L]; for (let x = -4; x < BW;) { const w = 12 + r() * 22 | 0, h = [100, 80, 54][L] + r() * 30 | 0, lit = [R.pink[3], R.cyan[3], R.gold[3]][r() * 3 | 0];
      if (r() < .55) { S(g, BW, BH, m => { mpoly(m, [[x, 144], [x, 144 - h], [x + w, 144 - h], [x + w, 144]], 0); mpoly(m, [[x + 3, 144 - h], [x + w - 3, 144 - h], [x + w - 3, 140 - h - 6], [x + 3, 140 - h - 6]], 0); }, ramp, { base: b, bev: 1, k: .6 });
        line(g, x + w / 2, 134 - h - 6, x + w / 2, 124 - h - 6, ramp[2]); g.set(x + w / 2, 123 - h - 6, R.red[4]); for (let yy = 150 - h; yy < 144; yy += 5) for (let xx = x + 2; xx < x + w - 2; xx += 3) if (r() < .35) g.set(xx, yy, lit); }
      else gothic(g, r, x, 144, w, h, ramp, b, lit); x += w + 2; } if (L < 2) fog(g, 0, 144, "#561864", .25); }
    for (const y of [98, 116]) { for (let x = 0; x < BW; x++) { g.set(x, y, R.cyan[3]); g.set(x, y + 1, R.ink[2]); g.set(x, y + 2, R.ink[0]); if (x % 24 < 2) for (let j = 3; j < 10; j++) g.set(x, y + j, R.ink[1]); } glow(g, 128, y, 130, R.cyan[2], .12); }
    for (let i = 0; i < 7; i++) { const x = r() * (BW - 20), y = 26 + r() * 56; S(g, BW, BH, m => mpoly(m, [[x, y], [x + 18, y], [x + 18, y + 8], [x, y + 8]], 0), R.ink, { base: 1, bev: 1 }); for (let k = 1; k < 17; k++) g.set(x + k, y + 4, (k + i) % 3 ? R.pink[3] : R.cyan[4]); glow(g, x + 9, y + 4, 16, R.pink[3], .25); }
    line(g, 226, 8, 90, 92, R.rice[4], 2); glow(g, 158, 50, 34, R.rice[4], .18); for (let i = 0; i < 90; i++) { const x = r() * BW, y = r() * BH; line(g, x, y, x - 1, y + 4, R.purple[2]); }
  }, "霓虹招牌、高架、雨与白龙划过的光束");
  bg("factory", "回收站", (g, r) => {
    skyRows(g, ["#090304", "#190709", "#2a0b0f", "#3c1013"], 0, 144);
    for (let x = 20; x < BW; x += 60) S(g, BW, BH, m => mpoly(m, [[x - 3, 0], [x + 3, 0], [x + 3, 144], [x - 3, 144]], 0), R.ink, { base: 2, bev: 2 });
    for (let y = 34; y < 144; y += 36) { for (let x = 0; x < BW; x++) { g.set(x, y, R.iron[2]); g.set(x, y + 1, R.iron[1]); g.set(x, y + 2, R.ink[1]); } for (let x = (y * 3) % 44; x < BW; x += 44) { line(g, x + 12, y - 30, x + 12, y - 18, R.iron[2]); S(g, BW, BH, m => mpoly(m, [[x + 2, y - 17], [x + 22, y - 17], [x + 24, y - 1], [x, y - 1]], 1), R.rust, { base: 1.6, bev: 2 }); S(g, BW, BH, m => mblob(m, x + 12, y - 9, 4, 4), R.iron, { base: 1.4 }); g.set(x + 13, y - 10, R.pink[3]); } }
    line(g, 128, 0, 128, 30, R.iron[2], 2); S(g, BW, BH, m => { mpoly(m, [[104, 34], [128, 26], [152, 34], [148, 74], [108, 74]], 2); mline(m, 112, 70, 104, 110, 7); mline(m, 144, 70, 152, 110, 7); mline(m, 106, 40, 92, 76, 6); mline(m, 150, 40, 164, 76, 6); mblob(m, 128, 22, 10, 8); }, R.ink, { base: 1.4, bev: 3, k: .8 });
    S(g, BW, BH, m => mblob(m, 128, 50, 5, 5), R.pink, { base: 3, bev: 3 }); glow(g, 128, 50, 20, R.pink[3], .4); for (let x = 120; x < 137; x++) g.set(x, 21, R.ink[0]);
    for (let x = 0; x < BW; x++) { g.set(x, 128, R.gold[(x >> 2) % 2 ? 3 : 1]); for (let y = 129; y < 144; y++) g.set(x, y, pick(R.ink, 2 - (y - 129) * .12, x, y)); } for (let x = 6; x < BW; x += 14) S(g, BW, BH, m => mblob(m, x, 136, 3, 3), R.iron, { base: 1.6 });
    for (const x of [44, 220]) { S(g, BW, BH, m => mblob(m, x, 8, 3, 3), R.red, { base: 3.4 }); glow(g, x, 8, 54, R.red[3], .28); shaft(g, x - 3, x + 3, 10, 128, R.red[3], .14); }
    fog(g, 50, 144, "#3c1013", .45); particles(g, r, 40, [0, 0, BW, BH], [R.red[3], R.gold[3]]);
  }, "流水线吊着的机体胸口里，都有一点粉色的光");
  bg("seal", "地底 · 巴别封印", (g, r) => {
    skyRows(g, ["#020207", "#050511", "#09091e", "#0d0b28"], 0, 144);
    for (let x = 0; x < BW; x += 24) { gothic(g, r, x, 144, 10, 120, R.ink, 1.4, null); }
    for (let y = 0; y < 144; y++) for (let x = 106; x < 150; x++) { const c = g.get(x, y), s = 1 - Math.abs(x - 128) / 22; g.set(x, y, add(c, "#d8d0ff", s * s * .55)); }
    for (let k = 0; k < 3; k++) for (let a = 0; a < 360; a += 2) { const t = a * Math.PI / 180; g.set(128 + Math.cos(t) * (40 + k * 26), 122 + Math.sin(t) * (7 + k * 4), a % 20 < 10 ? R.gold[3 - k] : R.purple[3]); }
    for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; S(g, BW, BH, m => mblob(m, 128 + Math.cos(t) * 92, 122 + Math.sin(t) * 15, 1.8, 1.8), R.gold, { base: 3.6 }); }
    glow(g, 128, 122, 90, R.purple[3], .3); particles(g, r, 90, [60, 0, 196, 144], [R.purple[4], R.marble[4], R.gold[4]]);
  }, "光柱、三重法阵、七灯与悬浮的光尘");

  /* ---------- 9b. flagship scenes at native 320×180 ---------- */
  const SW = 320, SH = 180;
  function arch(m, x, w, top, base, pw) { // pointed arch opening carved out of a wall mask: pillars + pointed head
    mpoly(m, [[x, base], [x, top + w * .35], [x + w * .5, top], [x + w, top + w * .35], [x + w, base], [x + w + pw, base], [x + w + pw, top - 10], [x - pw, top - 10], [x - pw, base]], 0); }
  function torch(g, x, y, big = 1) { line(g, x, y + 6, x + 3, y + 3, R.iron[2], 2); S(g, SW, SH, m => mpoly(m, [[x - 2, y], [x + 3, y], [x + 2, y + 4], [x - 1, y + 4]], 0), R.iron, { base: 2, rim: null });
    S(g, SW, SH, m => mpoly(m, [[x - 2, y], [x, y - 7 * big], [x + 1, y - 4 * big], [x + 3, y - 6 * big], [x + 3, y]], 2), R.orange, { base: 3.2, rim: null }); S(g, SW, SH, m => mblob(m, x + .5, y - 1.5, 1.2, 2), R.gold, { base: 4, rim: null });
    glow(g, x + .5, y - 3, 34 * big, R.orange[3], .55); glow(g, x + .5, y - 3, 10 * big, R.gold[4], .5); }
  function chain(g, x, y0, y1, col) { for (let y = y0; y < y1; y++) g.set(x + Math.round(Math.sin(y * .08) * .6), y, (y % 3) ? col : mix(col, "#000", .5)); }
  def("bg", "hall", "圣堂回廊（旗舰场景）", () => { const g = new G(SW, SH), r = rng(404);
    // back wall: teal-shadowed masonry with vertical gradient
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const row = y >> 3, off = row % 2 ? 6 : 0, mort = y % 8 === 7 || (x + off) % 12 === 11; g.set(x, y, mort ? "#0a1018" : pick(["#0b1420", "#12202e", "#1a2c3c", "#24394a"], 1.2 + (y / SH) * .9 + (y % 8 === 0 ? .6 : 0) + (r() - .5) * .3, x, y, .1)); }
    // lancet windows with warm sky behind
    for (const cx of [64, 160, 256]) { const wm = new M(SW, SH); mpoly(wm, [[cx - 9, 92], [cx - 9, 28], [cx, 12], [cx + 9, 28], [cx + 9, 92]], 1); fillCol(g, wm, (x, y) => { const lead = (x - cx + 9) % 6 === 0 || y % 10 === 0; return lead ? "#1a1010" : pick(["#ff8a3a", "#ffb054", "#ffd890", "#fff2c8"], 3 - (y - 12) / 80 * 2.4 - Math.abs(x - cx) / 12, x, y, .2); });
      shaft(g, cx - 8, cx + 8, 92, SH, "#ffb860", .32); }
    // far arcade (fogged)
    { const m = new M(SW, SH); for (let x = -10; x < SW; x += 54) arch(m, x + 8, 38, 40, 132, 8); sculpt(g, m, R.stone, { base: 1.6, bev: 4, k: 1.4, rim: "#ffb860" }); fog(g, 0, SH, "#16283a", .35); }
    // mid arcade: one wall with pointed openings carved out; windows show through
    { const m = new M(SW, SH); for (let y = 6; y < 141; y++) for (let x = 0; x < SW; x++) m.put(x, y);
      for (const cx of [64, 160, 256]) { const op = [[cx - 30, 141], [cx - 30, 64], [cx - 22, 44], [cx, 24], [cx + 22, 44], [cx + 30, 64], [cx + 30, 141]]; const p = chaikin(op, 2); for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (inPoly(x + .5, y + .5, p)) m.a[y * SW + x] = 0; }
      sculpt(g, m, R.stone, { base: 2, bev: 6, k: 1.8, rim: "#ff9a4a" });
      for (const px of [16, 112, 208, 304]) { for (let y = 70; y < 140; y += 12) groove(g, px - 12, y, px + 12, y, R.stone); S(g, SW, SH, mm => { mpoly(mm, [[px - 16, 60], [px + 16, 60], [px + 14, 66], [px - 14, 66]], 0); mpoly(mm, [[px - 15, 134], [px + 15, 134], [px + 16, 141], [px - 16, 141]], 0); }, R.stone, { base: 2.8, bev: 2, rim: null }); torch(g, px - 3, 96); }
      for (let x = 0; x < SW; x++) { if (g.get(x, 8)) g.set(x, 8, R.gold[1]); if (g.get(x, 9)) g.set(x, 9, R.gold[2]); } }
    for (const bx of [54, 246]) { const b = A.find(a => a.id === "banner"); if (b) g.blit(b.frames[0], bx, 40); }
    for (const cx of [30, 132, 228, 300]) chain(g, cx, 0, 40 + (cx % 30), "#4a5468");
    // floor: polished stone with reflections
    for (let y = 140; y < SH; y++) for (let x = 0; x < SW; x++) { const t = (y - 140) / 40; g.set(x, y, pick(["#0a1018", "#142230", "#203446", "#2e4a5e"], 2.4 - t * 1.6 + ((x >> 4) + (y >> 3)) % 2 * .3, x, y, .1)); }
    for (let x = 0; x < SW; x++) g.set(x, 140, "#3e6070"); for (const cx of [26, 88, 122, 184, 218, 280]) for (let y = 142; y < 170; y += 2) g.set(cx + (y % 4 ? 0 : 1), y, mix(g.get(cx, y) || "#000", "#ff9a4a", .5 - (y - 142) / 60));
    // foreground pillars + ivy + kneeling figures
    { const m = new M(SW, SH); mpoly(m, [[-4, SH], [-4, 0], [22, 0], [26, 20], [22, 24], [22, SH]], 0); mpoly(m, [[302, SH], [302, 24], [298, 20], [302, 0], [324, 0], [324, SH]], 0); sculpt(g, m, R.ink, { base: .8, bev: 4, k: 1.6, rim: "#5fd0e6" });
      const iv = rng(9); for (const sx of [20, 303]) { let x = sx; for (let y = 0; y < 120; y++) { x += Math.round((iv() - .5) * 1.2); g.set(x, y, R.moss[2]); if (y % 4 === 0) { g.set(x - 1, y, R.moss[3]); g.set(x + 1, y + 1, R.moss[1]); } } } }
    for (let i = 0; i < 6; i++) { const x = 126 + i * 14; S(g, SW, SH, m => { mpoly(m, [[x - 7, 174], [x - 6, 164], [x - 3, 158], [x + 2, 155], [x + 6, 160], [x + 7, 174]], 1); mpoly(m, [[x - 3, 158], [x + 1, 149], [x + 5, 152], [x + 4, 158]], 1); }, R.ink, { base: .7, bev: 2, k: 1.4, rim: "#ffb860" }); }
    { const c = A.find(a => a.id === "chantdrone"); if (c) g.blit(c.frames[0], 146, 100); }
    particles(g, r, 120, [40, 90, 290, 170], ["#ffd890", "#ffb860", "#fff2c8"]);
    grade(g, "#08203a", "#ffb45a", .25, .18); bloom(g, .78, 4, .35); return g; }, "补色方案：青蓝阴影 + 暖橙火光 · 远中近三层拱廊");
  def("bg", "dusk", "荒原黄昏（旗舰场景）", () => { const g = new G(SW, SH), r = rng(505);
    skyRows(g, ["#1c1030", "#4a1a3e", "#9a2e44", "#e0603e", "#ffb060", "#ffe0a0"], 0, 120);
    S(g, SW, SH, m => mblob(m, 104, 88, 24, 24), R.gold, { base: 3.9, bev: 14, rim: null }); glow(g, 104, 88, 110, "#ff8a40", .45); stars(g, r, 30, 40, ["#ffd8f0"]);
    for (const [cx, cy, w] of [[40, 34, 40], [210, 22, 52], [300, 50, 30]]) S(g, SW, SH, m => { mblob(m, cx, cy, w, 4, 2.4); mblob(m, cx + w * .3, cy - 3, w * .5, 4); }, ["#3a1a3a", "#6a2a4a", "#a8445a", "#e0786a", "#ffb08a"], { base: 2.6, bev: 3, rim: "#ffd090" });
    // far ruins (purple haze)
    for (let x = -6; x < SW;) { const w = 14 + r() * 30 | 0; ruins(g, r, x, 150, w, 60 + r() * 40, "#4a2a4e"); x += w + (r() * 8 | 0); } fog(g, 40, 150, "#c45a5a", .4);
    // mid: broken towers with a lit front face, a shadowed side face and window grids
    for (const [x, w, h] of [[2, 26, 74], [44, 20, 52], [150, 24, 64], [300, 26, 80]]) { let top = 150 - h; const tops = []; for (let i = 0; i < w + 5; i++) { top += (r() - .5) * 3.4; tops.push(i < 3 || i > w + 1 ? top + 3 : top); }
      for (let i = 0; i < w + 5; i++) for (let y = Math.floor(tops[i]); y < 152; y++) { const side = i >= w; g.set(x + i, y, side ? pick(["#1a0c14", "#2a141c", "#3a1c22"], 1 + (y - tops[i]) / 60, x + i, y, .1) : pick(["#2a1418", "#4a2422", "#6a3428", "#8a4a30"], 2.2 - (y - tops[i]) / 50 + (i < 2 ? .8 : 0), x + i, y, .1)); }
      for (let y = Math.floor(150 - h + 10); y < 146; y += 8) for (let i = 3; i < w - 2; i += 5) { const lit = r() < .25; for (let j = 0; j < 4; j++) { g.set(x + i, y + j, lit ? (j ? "#ffb060" : "#ffd890") : "#140a10"); g.set(x + i + 1, y + j, lit ? "#e08040" : "#1c0e14"); } }
      for (let k = 0; k < 3; k++) { const ii = 2 + (r() * (w - 4) | 0); line(g, x + ii, tops[ii], x + ii + (r() - .5) * 6, tops[ii] - 5 - r() * 7, "#8a5a40"); } }
    fog(g, 60, 150, "#e0603e", .18);
    // wrecked giant (original): a fallen helmeted head and an outstretched arm
    { const hm = new M(SW, SH); mblob(hm, 214, 128, 30, 22, 2.6); mpoly(hm, [[196, 108], [204, 92], [210, 106]], 0); sculpt(g, hm, R.steel, { base: 1.7, bev: 8, k: 1.8, rim: "#ffb060" });
      S(g, SW, SH, m2 => mpoly(m2, [[186, 120], [240, 114], [242, 126], [188, 132]], 1), R.ink, { base: 1.1, bev: 2, rim: null }); for (let x = 192; x < 238; x++) { const y = Math.round(121 + (x - 192) * -.12); g.set(x, y, Math.abs(x - 204) < 3 ? "#ff6a6a" : "#5a1424"); }
      for (const [x0, y0, x1, y1] of [[194, 140, 236, 136], [226, 108, 232, 148], [200, 112, 206, 108]]) groove(g, x0, y0, x1, y1, R.steel); for (const [x, y] of [[198, 142], [214, 140], [230, 110], [236, 144]]) rivet(g, x, y, R.steel);
      const am = new M(SW, SH); mline(am, 240, 140, 274, 124, 12); mline(am, 274, 124, 296, 146, 10); mblob(am, 300, 150, 9, 6, 2.4); sculpt(g, am, R.steel, { base: 1.5, bev: 5, k: 1.7, rim: "#ffb060" }); groove(g, 246, 136, 270, 126, R.steel);
      for (let f = 0; f < 4; f++) line(g, 296 + f * 4, 152, 293 + f * 5, 160, R.steel[1], 2); for (const cx of [240, 252]) line(g, cx, 142, cx - 6, 156, "#2a2430", 1);
      line(g, 214, 106, 226, 86, R.iron[2]); g.set(226, 85, "#ff6060"); }
    // toppled neon billboard
    { const m = new M(SW, SH); mpoly(m, [[120, 146], [158, 128], [166, 140], [128, 158]], 0); sculpt(g, m, R.ink, { base: 1.6, bev: 2, rim: null }); for (let i = 0; i < 30; i++) { const t = i / 30; const x = 124 + t * 38, y = 148 - t * 18; if (i % 4) { g.set(x, y, R.pink[3]); g.set(x, y + 3, R.cyan[3]); } } glow(g, 142, 142, 22, R.pink[3], .35); }
    // ground + foreground rubble with teal rim
    for (let y = 150; y < SH; y++) for (let x = 0; x < SW; x++) g.set(x, y, pick(["#140c12", "#24141a", "#3a2022", "#5a3024"], 2.6 - (y - 150) / 12 + Math.sin(x * .2) * .2, x, y, .1));
    { const m = new M(SW, SH); mpoly(m, [[-6, 180], [-4, 156], [18, 148], [40, 154], [56, 166], [62, 180]], 2); mpoly(m, [[250, 180], [262, 160], [290, 150], [318, 156], [326, 180]], 2); mline(m, 30, 150, 46, 128, 3); mline(m, 292, 152, 312, 122, 3); sculpt(g, m, R.ink, { base: .7, bev: 3, k: 1.5, rim: "#5fd0e6" });
      for (const sx of [8, 26, 270, 300]) for (let i = 0; i < 4; i++) { g.set(sx + i * 2, 150 - (i % 2) - (sx % 5), R.moss[2]); g.set(sx + i * 2, 149 - (i % 2) - (sx % 5), R.moss[3]); } }
    for (let i = 0; i < 6; i++) { const x = 64 + i * 34 + r() * 8, y = 144 - r() * 6; g.set(x, y, "#ff5050"); g.set(x + 3, y, "#ff5050"); glow(g, x + 1, y, 6, "#ff4040", .7, true); }
    particles(g, r, 140, [0, 20, SW, 176], ["#ffd0a0", "#ff9a60", "#b0a0a0"]);
    grade(g, "#10283a", "#ffb060", .28, .16); bloom(g, .8, 4, .32); return g; }, "补色方案：暖橙天光 + 青色边缘光 · 倒下的巨型机体");

  /* ---------- 10. UI ---------- */
  function panel(w, h, style) { const g = new G(w, h), st = style === "synod" ? { b: R.gold, f: R.ink } : { b: R.wood, f: R.sand };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const e = Math.min(x, y, w - 1 - x, h - 1 - y); if ((x < 2 || x > w - 3) && (y < 2 || y > h - 3)) continue; if (e === 0) g.set(x, y, st.b[0]); else if (e === 1) g.set(x, y, st.b[x < w / 2 && y < h / 2 ? 3 : 2]); else if (e === 2) g.set(x, y, st.b[1]); else g.set(x, y, pick(st.f, style === "synod" ? 1.4 + (y < 6 ? .4 : 0) : 3 - y / h * .8, x, y)); }
    for (const [cx, cy] of [[3, 3], [w - 4, 3], [3, h - 4], [w - 4, h - 4]]) { g.set(cx, cy, st.b[4]); g.set(cx + (cx < 5 ? 1 : -1), cy, st.b[3]); g.set(cx, cy + (cy < 5 ? 1 : -1), st.b[3]); }
    if (style === "synod") for (let x = 8; x < w - 8; x += 6) g.set(x, 1, st.b[4]); return g; }
  def("ui", "panel_bay", "面板 · 白饭湾（木）", () => panel(48, 32, "bay"), "可九宫格拉伸，角 4px");
  def("ui", "panel_synod", "面板 · 圣会（金石）", () => panel(48, 32, "synod"), "可九宫格拉伸，角 4px");
  def("ui", "buttons", "按钮 · 常态 / 悬停 / 按下", () => ["n", "h", "p"].map(s => { const g = new G(44, 16); const base = s === "h" ? 3 : s === "p" ? 1.6 : 2.4;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 44; x++) { const e = Math.min(x, y, 43 - x, 15 - y); if ((x < 1 || x > 42) && (y < 1 || y > 14)) continue; g.set(x, y, e === 0 ? R.ink[0] : (s === "p" ? y < 3 : y > 12) ? R.gold[1] : pick(R.gold, base + (y < 5 ? .7 : 0) - (y > 10 ? .5 : 0), x, y)); }
    for (let x = 14; x < 30; x++) g.set(x, s === "p" ? 9 : 8, R.ink[1]); return g; }));
  function bar(w, ramp, frac) { const g = new G(w, 10); for (let y = 0; y < 10; y++) for (let x = 0; x < w; x++) { const e = Math.min(x, y, w - 1 - x, 9 - y); if ((x < 1 || x > w - 2) && (y < 1 || y > 8)) continue; g.set(x, y, e === 0 ? R.ink[0] : e === 1 ? R.iron[1] : x < 2 + (w - 4) * frac ? pick(ramp, 3.4 - (y - 2) * .45, x, y) : R.ink[2]); } for (let x = 6; x < w - 2; x += 6) g.set(x, 7, R.ink[1]); return g; }
  def("ui", "bars", "数值条 · 生命 / Token / 算力 / 幻觉", () => { const g = new G(80, 46); g.blit(bar(80, R.red, .72), 0, 0); g.blit(bar(80, R.rice, .45), 0, 12); g.blit(bar(80, R.cyan, .9), 0, 24); g.blit(bar(80, R.pink, .2), 0, 36); return g; });
  def("ui", "tempslider", "温度滑块", () => [0, 1].map(k => { const g = new G(96, 16); for (let x = 2; x < 94; x++) for (let y = 6; y < 10; y++) g.set(x, y, y === 6 ? R.ink[0] : pick(k ? R.orange : R.stone, 1.4 + x / 94 * 2.4, x, y));
    for (let x = 2; x < 94; x += 12) { g.set(x, 12, R.iron[3]); g.set(x, 13, R.iron[2]); } const kx = k ? 46 : 5; sphere(g, kx, 8, 5, 5, k ? R.orange : R.marble, { lv: .6 }); if (!k) S(g, 96, 16, m => mpoly(m, [[kx - 2, 6], [kx + 2, 6], [kx + 2, 10], [kx - 2, 10]], 0), R.iron, { base: 1 }); else glow(g, kx, 8, 10, R.orange[3], .5); return g; }), "左：克劳德（锁定在 0）· 右：0.7");
  def("ui", "quota", "额度 · 白龙", () => { const g = new G(80, 12); for (let i = 0; i < 12; i++) { const on = i < 3; S(g, 80, 12, m => mpoly(m, [[4 + i * 6.4, 1], [6.5 + i * 6.4, 6], [4 + i * 6.4, 11], [1.5 + i * 6.4, 6]], 0), on ? R.rice : R.stone, { base: on ? 3 : 1.6, bev: 2 }); if (on) glow(g, 4 + i * 6.4, 6, 4, R.rice[4], .3); } return g; }, "已用 9 / 12");
  def("ui", "cursor", "光标", () => { const g = new G(12, 14); S(g, 12, 14, m => mpoly(m, [[0, 0], [10, 8], [5, 8], [7, 13], [5, 14], [3, 9], [0, 12]], 0), R.rice, { base: 3, bev: 2 }); return outline(g); });
  def("ui", "hotbar", "快捷栏", () => { const g = new G(108, 22); ["token", "power", "hqdata", "lora", "heartlamp"].forEach((id, i) => { g.blit(panel(20, 20, i === 0 ? "synod" : "bay"), 1 + i * 21, 1); const a = A.find(v => v.id === id); if (a) g.blit(a.frames[0], 2 + i * 21, 2); }); return g; });

  /* ---------- 11. mock-ups 320×180 ---------- */
  const get = id => A.find(a => a.id === id).frames;
  def("mock", "shooter", "横版射击 · 荒原", () => { const g = new G(320, 180); g.blit(get("dusk")[0], 0, 0);
    for (let x = 0; x < 320; x += 16) { g.blit(get("rubble")[0], x, 152); g.blit(get("metal")[0], x, 166); }
    g.blit(get("tiepen")[0], 34, 104); g.blit(get("rogue")[0], 214, 98); g.blit(get("crawler")[0], 276, 130); g.blit(get("spam")[0], 176, 34);
    const bl = get("bullets")[0]; for (let i = 0; i < 4; i++) for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const c = bl.get(x, y); if (c) g.set(104 + i * 24 + x, 131 + y, c); }
    g.blit(get("muzzle")[0], 98, 128); g.blit(get("explosion")[2], 226, 94); g.blit(get("spark")[1], 274, 128);
    const fg = new M(320, 180); mpoly(fg, [[-6, 180], [-2, 160], [10, 156], [20, 166], [24, 180]], 2); mline(fg, 300, 180, 312, 120, 4); mline(fg, 312, 120, 330, 118, 3); sculpt(g, fg, R.ink, { base: .5, bev: 2, k: .6 });
    for (let i = 0; i < 30; i++) { const x = (i * 53) % 320, y = 40 + (i * 37) % 110; g.set(x, y, i % 2 ? R.gold[4] : R.orange[3]); }
    g.blit(panel(108, 36, "bay"), 4, 4); g.blit(bar(80, R.red, .72), 22, 10); g.blit(bar(80, R.rice, .45), 22, 23); g.blit(get("token")[0], 4, 19);
    g.blit(panel(74, 20, "synod"), 242, 4); g.blit(get("quota")[0], 238 + 1, 8); return g; }, "铁盆号对战失控体");
  def("mock", "farm", "白饭湾经营", () => { const g = new G(320, 180);
    for (let y = 0; y < 180; y += 16) for (let x = 0; x < 320; x += 16) { const inF = x >= 16 && x < 128 && y >= 96 && y < 144, edge = inF && (x === 16 || x === 112 || y === 96 || y === 128); const t = y > 140 ? "water" : inF ? (edge ? "paddy" : "paddyripe") : y === 80 || (x === 144 && y > 80) ? "dirt" : ((x * 7 + y * 3) % 5 === 0 ? "grassflower" : "grass"); g.blit(get(t)[0], x, y); }
    const shade = (x0, x1, y0) => { for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x1; x++) { const c = g.get(x, y); if (c) g.set(x, y, mix(c, "#000000", .35 * (1 - (y - y0) / 5))); } };
    shade(124, 196, 94); shade(190, 260, 94); shade(250, 300, 86); shade(24, 84, 90);
    for (let x = 0; x < 320; x += 16) g.blit(get("dock")[0], x, 144);
    [["canteen", 120, 30], ["datacenter", 186, 30], ["pigeontower", 248, 22], ["windmill", 18, 26]].forEach(([id, x, y]) => g.blit(get(id)[0], x, y));
    g.blit(get("cooker")[1], 172, 98); g.blit(get("crate")[0], 196, 104); g.blit(get("lamppost")[0], 144, 82); g.blit(get("pigeon")[1], 268, 6);
    g.blit(get("hotbar")[0], 106, 154); g.blit(panel(92, 22, "bay"), 4, 4); g.blit(bar(70, R.cyan, .6), 18, 10); g.blit(get("compute")[0], 4, 8); return g; }, "稻田、食堂、数据中心、信鸽塔与快捷栏");
  def("mock", "dialogue", "剧情对话 · 圣堂", () => { const g = new G(320, 180); g.blit(get("hall")[0], 0, 0);
    g.blit(panel(300, 54, "synod"), 10, 120); g.blit(panel(50, 50, "bay"), 16, 122); g.blit(get("storybook")[0], 27, 136);
    for (let i = 0; i < 3; i++) for (let x = 76; x < 76 + [200, 170, 120][i]; x++) if (x % 7) g.set(x, 140 + i * 9, R.rice[3]); for (let x = 76; x < 116; x++) g.set(x, 130, R.orange[3]);
    S(g, 320, 180, m => mblob(m, 300, 166, 2, 2), R.gold, { base: 3.6 }); return g; }, "头像位暂放剧情道具，角色立绘待定稿");

  root.KIT = { R, A, mix };
})(typeof window !== "undefined" ? window : globalThis);

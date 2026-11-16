/* AI 娘像素立绘引擎 v2 · 64×96
   原创代码生成，无任何外部图片。
   流程：形状(材质+色阶) → 线稿 pass → 高光环 → 面部贴花 → 合成 → 外描边 → 闪光 */
(function () {
  const W = 64, H = 96;
  let G, D, Z, GR, MATS, POST;

  /* ---------- color ---------- */
  const h2r = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const r2h = (r, g, b) => "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = h2r(a), B = h2r(b); return r2h(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  function r2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
  function hsl(h, s, l) { h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l)); const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return r2h((r + m) * 255, (g + m) * 255, (b + m) * 255); }
  const toward = (h, t, a) => { const d = ((t - h + 540) % 360) - 180; return h + Math.sign(d) * Math.min(Math.abs(d), a); };
  function ramp(base) {
    const [h, s, l] = r2hsl(h2r(base));
    const bright = l > .86;
    return [
      bright ? "#FFFFFF" : hsl(toward(h, 55, 10), s * .85, Math.min(.96, l + .19)),
      bright ? mix(base, "#FFFFFF", .5) : hsl(toward(h, 55, 5), s * .95, Math.min(.93, l + .09)),
      base,
      hsl(toward(h, 250, 14), Math.min(.92, s * .97 + (bright ? .18 : .03)), l - (bright ? .1 : .13)),
      hsl(toward(h, 250, 26), Math.min(.9, s * .97 + (bright ? .22 : .05)), Math.max(.07, l - (bright ? .24 : .27)))
    ];
  }
  const SKIN = ["#FFF6EF", "#FFE8DA", "#FAD6C4", "#EDB29F", "#C8807A"];
  function mat(name, base, o = {}) { MATS[name] = { r: o.ramp || ramp(base), line: o.line !== false, hair: !!o.hair, self: o.self !== false }; }

  /* ---------- raster ---------- */
  const nz = () => [++Z, ++GR];
  function put(x, y, m, l, z, g) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || x >= W || y < 0 || y >= H) return; G[y][x] = { m, l: Math.max(0, Math.min(4, l)), z, g }; }
  function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [a, b] = p[i], [d, e] = p[j]; if ((b > y) !== (e > y) && x < (d - a) * (y - b) / (e - b) + a) c = !c; } return c; }
  function lev(o, x, y, L, R, cx, y0, y1) {
    const s = o.shade || "across"; let l;
    if (s === "flat") l = o.l != null ? o.l : 2;
    else {
      const w = R - L + 1, u = (x - L + .5) / w;
      l = u < .2 ? 1 : u < .66 ? 2 : 3;
      if (s === "pleat") { const f = Math.sin((x + .5 - cx) / Math.max(1, w / 2) * Math.PI * (o.folds || 3)); if (f > .55) l--; else if (f < -.62) l++; }
      if (s === "vert") { const t = (y - y0) / Math.max(1, y1 - y0); l = t < .22 ? 1 : t < .7 ? 2 : 3; }
      if (o.top && y < y0 + o.top) l--;
    }
    return l + (o.lv || 0);
  }
  function poly(pts, m, o = {}) {
    const [z, g] = nz(); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    const X0 = Math.max(0, Math.floor(Math.min(...xs))), X1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
    for (let y = y0; y <= y1; y++) {
      const row = []; for (let x = X0; x <= X1; x++) if (inPoly(x + .5, y + .5, pts)) row.push(x);
      if (!row.length) continue; const L = row[0], R = row[row.length - 1], cx = (L + R + 1) / 2;
      for (const x of row) { if (o.clip && !o.clip(x, y)) continue; put(x, y, m, lev(o, x, y, L, R, cx, y0, y1), z, g); }
    }
  }
  function ell(cx, cy, rx, ry, m, o = {}) {
    const [z, g] = nz();
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy > 1) continue;
      if (o.upper && y + .5 > cy) continue; if (o.clip && !o.clip(x, y)) continue;
      let l; const s = o.shade || "sphere";
      if (s === "flat") l = o.l != null ? o.l : 2;
      else {
        const b = -.55 * dx - .8 * dy; l = b > .5 ? 0 : b > .15 ? 1 : b > -.35 ? 2 : b > -.72 ? 3 : 4;
        if (s === "pleat") { const hw = Math.sqrt(Math.max(.04, 1 - dy * dy)); const f = Math.sin(dx / hw * Math.PI * (o.folds || 4)); if (f > .55) l--; else if (f < -.62) l++; }
      }
      put(x, y, m, l + (o.lv || 0), z, g);
    }
  }
  const rect = (x, y, w, h, m, o) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], m, o);
  function seg(x0, y0, x1, y1, m, l = 2, th = 1) {
    const [z, g] = nz(); const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) put(x + a - (th - 1) / 2, y + b - (th - 1) / 2, m, l, z, g); }
  }
  function carve(cx, cy, rx, ry, m) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1 && G[y][x] && G[y][x].m === m) G[y][x] = null; } }
  const qb = (a, b, c, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];
  function lock(x1, x2, y0, tx, ty, bend, m, o = {}) {
    const n = 12, pts = [], c1 = [x1 + bend, (y0 + ty) / 2], c2 = [x2 + bend, (y0 + ty) / 2];
    for (let i = 0; i <= n; i++) pts.push(qb([x1, y0], c1, [tx, ty], i / n));
    for (let i = n; i >= 0; i--) pts.push(qb([x2, y0], c2, [tx, ty], i / n));
    poly(pts, m, Object.assign({ shade: "across", top: 4 }, o));
  }
  const MX = p => p.map(([x, y]) => [64 - x, y]);
  const mxX = x => 64 - x;

  /* ---------- decals ---------- */
  function dk(x, y, c, only) {
    x = Math.floor(x); y = Math.floor(y); if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = G[y][x]; if (only && (!p || (only !== "any" && (Array.isArray(only) ? !only.includes(p.m) : p.m !== only)))) return;
    D[y][x] = { c, z: p && only ? p.z : -1 };
  }
  const R_ = (m, l) => MATS[m].r[l];
  function spark(x, y, c, big) { POST.push([x, y, "#FFFFFF"]); const a = big ? 2 : 1; for (let i = 1; i <= a; i++) { POST.push([x + i, y, c], [x - i, y, c], [x, y + i, c], [x, y - i, c]); } if (big) POST.push([x + 1, y + 1, mix(c, "#FFFFFF", .5)], [x - 1, y - 1, mix(c, "#FFFFFF", .5)], [x + 1, y - 1, mix(c, "#FFFFFF", .5)], [x - 1, y + 1, mix(c, "#FFFFFF", .5)]); }
  function bow(cx, cy, m, s = 1) {
    poly([[cx, cy], [cx - 4.5 * s, cy - 3.2 * s], [cx - 5 * s, cy + 2.6 * s]], m, { shade: "across" });
    poly([[cx, cy], [cx + 4.5 * s, cy - 3.2 * s], [cx + 5 * s, cy + 2.6 * s]], m, { shade: "across" });
    seg(cx - .5, cy + 1, cx - 2.2 * s, cy + 5.5 * s, m, 2, 1); seg(cx + .5, cy + 1, cx + 2.2 * s, cy + 5.5 * s, m, 3, 1);
    ell(cx, cy, 1.4 * s, 1.4 * s, m, { shade: "flat", l: 1 });
  }
  function gem(cx, cy, r, m) { ell(cx, cy, r, r, m, {}); }
  function scallop(x0, x1, y, m, step = 4) { const [z, g] = nz(); for (let x = x0; x <= x1; x++) { put(x, y, m, 1, z, g); const k = ((x - x0) % step + step) % step; if (k === 1 || k === 2) put(x, y + 1, m, 2, z, g); } }

  /* ---------- passes ---------- */
  function linePass() {
    const out = G.map(r => r.map(p => p && Object.assign({}, p)));
    const N = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = G[y][x]; if (!p || !MATS[p.m].line) continue;
      for (const [a, b] of N) {
        const q = (G[y + b] || [])[x + a]; if (!q || q.z <= p.z || q.g === p.g || !MATS[q.m].line) continue;
        if (q.m === p.m && !MATS[p.m].self) continue;
        out[y][x].l = 4; break;
      }
      if (p.m === "skin" && out[y][x].l < 4) for (let k = 2; k <= 3; k++) { const q = (G[y - k] || [])[x]; if (q && MATS[q.m].hair && q.z > p.z) { out[y][x].l = Math.max(out[y][x].l, k === 2 ? 3 : 2); break; } }
    }
    G = out;
  }
  function ringPass(y0 = 12, amp = 7) {
    for (let x = 18; x <= 46; x++) {
      if (x % 5 === 0) continue; const y = Math.round(y0 + ((x - 32) / 15) ** 2 * amp);
      for (let k = 0; k < 2; k++) { const p = (G[y + k] || [])[x]; if (p && p.m === "hair" && p.l < 4) p.l = k === 0 ? 0 : Math.min(p.l, 1); }
      const q = (G[y - 1] || [])[x]; if (q && q.m === "hair" && q.l < 4 && x % 3 === 0) q.l = 1;
    }
  }
  function compose() {
    const dv = (y, x) => { const d = D[y][x]; if (!d) return null; const p = G[y][x]; if (d.z !== -1 && (!p || p.z !== d.z)) return null; return d.c; };
    const C = G.map((r, y) => r.map((p, x) => dv(y, x) || (p ? R_(p.m, p.l) : null)));
    const O = C.map(r => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (C[y][x]) continue;
      const pick = (a, b) => { const c = (C[y + b] || [])[x + a]; if (!c) return null; const p = G[y + b][x + a]; return p ? MATS[p.m].r : [c, c, c, c, c]; };
      const lit = pick(1, 0) || pick(0, 1), shd = pick(-1, 0) || pick(0, -1);
      if (lit) O[y][x] = mix(lit[4], lit[3], .25);
      else if (shd) O[y][x] = mix(shd[4], "#120C1C", .38);
    }
    POST.forEach(([x, y, c]) => { if (x >= 0 && x < W && y >= 0 && y < H) O[y][x] = c; });
    return O;
  }

  /* ---------- face ---------- */
  const EYE = [
    "..kKKKK",
    "kKKKKKK",
    "KKDDDDK",
    ".dDDDdS",
    ".ddPPdW",
    ".dPPPdW",
    ".MPPPMW",
    ".MMIMMS",
    "..IJJI.",
    "...kk.."
  ];
  function eye(x0, y0, flip, base, c) {
    const ir = ramp(base), K = c.lash || "#2A1B2E", k = mix(K, SKIN[2], .5);
    const map = { K, k, D: ir[4], d: ir[3], M: ir[2], I: ir[1], J: ir[0], P: mix(ir[4], "#0B0612", .55), W: "#FFFFFF", S: "#E4DEF0" };
    EYE.forEach((row, r) => [...row].forEach((ch, col) => { if (ch === ".") return; dk(x0 + (flip ? 6 - col : col), y0 + r, map[ch], "skin"); }));
    dk(flip ? x0 + 7 : x0 - 1, y0 + 1, K, "skin"); dk(flip ? x0 + 8 : x0 - 2, y0 + 2, k, "skin");
    if (!c.lid) for (let col = 2; col <= 5; col++) dk(x0 + (flip ? 6 - col : col), y0 - 1, mix(SKIN[3], K, .18), "skin");
    if (c.lid) {
      for (let r = 0; r < c.lid; r++) for (let col = -2; col <= 8; col++) { const xx = x0 + col; if (G[y0 + r] && G[y0 + r][xx] && G[y0 + r][xx].m === "skin") D[y0 + r][xx] = null; }
      for (let col = 0; col <= 6; col++) dk(x0 + col, y0 + c.lid, K, "skin");
      dk(flip ? x0 + 7 : x0 - 1, y0 + c.lid, K, "skin");
    }
    const hy = y0 + Math.max(3, (c.lid || 0) + 1);
    [[2, 0], [3, 0], [2, 1], [3, 1]].forEach(([a, b]) => dk(x0 + a, hy + b, "#FFFFFF", "skin"));
    dk(x0 + 4, y0 + 7, "#FFFFFF", "skin"); dk(x0 + 1, y0 + 6, mix(ir[0], "#FFFFFF", .5), "skin");
  }
  const BROW = { calm: [[22, 20], [23, 19], [24, 19], [25, 19], [26, 20]], angry: [[22, 19], [23, 19], [24, 20], [25, 20], [26, 21]], worried: [[22, 21], [23, 20], [24, 19], [25, 19], [26, 19]] };
  function faceDecals(c) {
    const K = c.lash || "#2A1B2E";
    eye(21, 24, false, c.eyeL || c.eye, c); eye(36, 24, true, c.eyeR || c.eye, c);
    const bc = mix(MATS.hair.r[3], K, .35);
    (BROW[c.brow || "calm"]).forEach(([x, y]) => { dk(x, y, bc, "skin"); dk(63 - x, y, bc, "skin"); });
    dk(32, 33, SKIN[3], "skin");
    const blush = mix(SKIN[1], "#F59C9C", .42);
    for (const cx of [24.5, 39.5]) for (let y = 34; y <= 35; y++) for (let x = Math.floor(cx - 3.5); x <= cx + 3.5; x++) { const dx = (x + .5 - cx) / 3.6, dy = (y + .5 - 35) / 1.5; if (dx * dx + dy * dy <= 1 && (!D[y][x] || D[y][x].c === undefined)) dk(x, y, blush, "skin"); }
    const hatch = "#EC8A90";[[22, 35], [23, 34], [25, 35], [26, 34]].forEach(([x, y]) => { dk(x, y, hatch, "skin"); dk(63 - x, y, hatch, "skin"); });
    const ml = "#8E3F48", mi = "#B9475C", tg = "#F08A96";
    const M = {
      smile: () => { dk(30, 36, ml, "skin"); dk(31, 37, ml, "skin"); dk(32, 37, ml, "skin"); dk(33, 36, ml, "skin"); },
      open: () => { [30, 31, 32, 33].forEach(x => dk(x, 36, ml, "skin")); [30, 31, 32, 33].forEach(x => dk(x, 37, mi, "skin")); dk(31, 38, tg, "skin"); dk(32, 38, tg, "skin"); dk(29, 36, mix(ml, SKIN[2], .5), "skin"); dk(34, 36, mix(ml, SKIN[2], .5), "skin"); },
      cat: () => { [[29, 36], [30, 37], [31, 36], [32, 36], [33, 37], [34, 36]].forEach(([x, y]) => dk(x, y, ml, "skin")); },
      smug: () => { [[29, 37], [30, 37], [31, 37], [32, 37], [33, 36], [34, 35]].forEach(([x, y]) => dk(x, y, ml, "skin")); dk(30, 38, "#FFFFFF", "skin"); dk(31, 38, mix(ml, SKIN[2], .55), "skin"); },
      flat: () => { [30, 31, 32, 33].forEach(x => dk(x, 37, "#C27476", "skin")); },
      o: () => { dk(31, 36, ml, "skin"); dk(32, 36, ml, "skin"); dk(31, 37, mi, "skin"); dk(32, 37, mi, "skin"); dk(30, 37, mix(ml, SKIN[2], .5), "skin"); dk(33, 37, mix(ml, SKIN[2], .5), "skin"); }
    };
    (M[c.mouth] || M.smile)();
    if (c.sweat) { const s = "#BFE6FF", s2 = "#86C6F0"; dk(47, 23, s, "any"); [46, 47].forEach(x => dk(x, 24, s, "any")); [45, 46, 47].forEach(x => dk(x, 25, x === 45 ? "#FFFFFF" : s, "any")); [45, 46, 47].forEach(x => dk(x, 26, s2, "any")); dk(46, 27, s2, "any"); }
    if (c.drool) { dk(33, 38, "#BFE6FF", "skin"); dk(33, 39, "#9FD3F5", "skin"); dk(33, 40, "#9FD3F5", "any"); }
    if (c.glasses) {
      const f = c.glasses, fs = mix(f, SKIN[2], .55);
      for (const x0 of [20, 35]) {
        for (let x = x0 + 1; x <= x0 + 7; x++) dk(x, 34, fs, "skin");
        for (let y = 26; y <= 33; y++) { dk(x0, y, fs, "skin"); dk(x0 + 8, y, fs, "skin"); }
        dk(x0, 34, fs, "skin"); dk(x0 + 8, 34, fs, "skin"); dk(x0 + 2, 33, "#FFFFFF", "any");
      }
      [29, 30, 31, 32, 33, 34].forEach(x => dk(x, 27, f, "skin"));
    }
  }

  /* ---------- hair ---------- */
  function hairBack(c) {
    const len = c.len || 76, sp = c.spread || 4;
    if (c.style === "twin") {
      for (const s of [-1, 1]) {
        const X = x => s < 0 ? x : mxX(x), B = b => s < 0 ? b : -b;
        lock(X(14), X(23), 16, X(8), 82, B(-13), "hair", { lv: 0 });
        lock(X(10), X(18), 18, X(3), 74, B(-10), "hair", { lv: 1 });
        lock(X(16), X(24), 18, X(13), 86, B(-9), "hair", { lv: 0 });
        lock(X(12), X(19), 30, X(6), 62, B(-5), "hair", { lv: 0 });
      }
      lock(18, 46, 14, 32, 42, 0, "hair", { lv: 1 });
      return;
    }
    if (c.style === "bob") { lock(16, 30, 16, 17, 47, -3, "hair", { lv: 1 }); lock(34, 48, 16, 47, 47, 3, "hair", { lv: 1 }); lock(22, 42, 16, 32, 46, 0, "hair", { lv: 1 }); return; }
    const n = 7;
    for (let i = 0; i < n; i++) {
      const x1 = 15 + i * 4.6, x2 = x1 + 7.6, t = (i + .5) / n;
      const tx = (14 - sp) + (36 + 2 * sp) * t, ty = len - [0, 4, 1, 5, 2, 3, 0][i];
      const bend = c.style === "wavy" ? (i % 2 ? 5 : -5) : (t - .5) * -6;
      lock(x1, x2, 14, tx, ty, bend, "hair", { lv: 1 });
    }
    if (c.style === "wavy") for (let i = 0; i < n; i += 2) { const t = (i + .5) / n, tx = (14 - sp) + (36 + 2 * sp) * t; ell(tx + (i % 4 ? 2 : -2), len - 3, 2.6, 2.4, "hair", { lv: 0 }); }
  }
  function hairCap() { ell(32, 22, 16.5, 14.5, "hair", {}); }
  function bangs(c) {
    const S = c.side || 58;
    if (c.style === "bob") {
      lock(14, 21, 18, 16, 44, -1, "hair", { top: 0 }); lock(43, 50, 18, 48, 44, 1, "hair", { top: 0 });
      [[17, 24, 20, 25], [22, 29, 25, 26], [27, 34, 30, 26], [31, 38, 34, 26], [36, 43, 39, 26], [40, 47, 44, 25]].forEach(([a, b, tx, ty]) => lock(a, b, 11, tx, ty, 0, "hair"));
      return;
    }
    lock(14, 21, 18, 17, S, -2, "hair", { top: 0 }); lock(43, 50, 18, 47, S, 2, "hair", { top: 0 });
    if (c.style !== "twin") { lock(13, 18, 26, 15, S + 6, -3, "hair", { lv: 1, top: 0 }); lock(46, 51, 26, 49, S + 6, 3, "hair", { lv: 1, top: 0 }); }
    const L = [[17, 24, 18, 33, -1], [20, 28, 23, 24, 0], [25, 32, 29, 27, 1], [29, 36, 32, 22, 0], [32, 39, 35, 27, -1], [36, 44, 41, 24, 0], [40, 47, 46, 33, 1]];
    [0, 6, 1, 5, 2, 4, 3].forEach(i => { const [a, b, tx, ty, bd] = L[i]; lock(a, b, 11, tx, ty, bd, "hair"); });
  }

  /* ---------- body ---------- */
  function neck() { rect(28.5, 36, 7, 9, "neck", { shade: "flat", l: 2 }); rect(28.5, 36, 7, 4, "neck", { shade: "flat", l: 3 }); }
  function faceSkin() { ell(32, 27, 13, 12.5, "skin", { lv: -1 }); poly([[23, 33], [41, 33], [36, 39.6], [28, 39.6]], "skin", { shade: "flat", l: 1 }); }
  function torso() { poly([[24, 43], [40, 43], [42, 47], [40.5, 57], [23.5, 57], [22, 47]], "top", {}); }
  function sleeves(c) {
    const reach = c.reach || 0;
    ell(22.5, 46.5, 4.6, 4, "sleeve", {}); ell(41.5, 46.5, 4.6, 4, "sleeve", {});
    const arm = [[18.6, 48], [24.2, 48], [24.6, 58], [19.2, 60], [17.4, 55]];
    poly(arm, "sleeve", {}); poly(MX(arm).map(([x, y]) => [x + (y > 52 ? reach : 0), y]), "sleeve", {});
    const cuff = [[17.6, 57], [24.6, 56.5], [25, 60.2], [18.6, 61]];
    poly(cuff, "cuff", {}); poly(MX(cuff).map(([x, y]) => [x + reach, y]), "cuff", {});
    ell(21.5, 62.6, 2.8, 2.6, "skin", { lv: -1 }); ell(42.5 + reach, 62.6, 2.8, 2.6, "skin", { lv: -1 });
    dk(20, 64, SKIN[3], "skin"); dk(22, 64, SKIN[3], "skin"); dk(41 + reach, 64, SKIN[3], "skin"); dk(43 + reach, 64, SKIN[3], "skin");
  }
  function shoes(x0, y0, m) { poly([[x0, y0], [x0 + 6.4, y0], [x0 + 7.4, y0 + 4.5], [x0 - 1, y0 + 4.5]], m, { shade: "across", top: 1 }); }
  function legsPair(y0, y1, m, gap = 0) { rect(25 - gap, y0, 5, y1 - y0, m, {}); rect(34 + gap, y0, 5, y1 - y0, m, {}); }

  const OUTFIT = {
    gown(c) {
      if (c.slit) { poly([[23, 55], [41, 55], [54, 91], [10, 91]], "slit", { shade: "pleat", folds: 2 }); }
      const skirt = [[23, 55], [41, 55], [54, 91], [10, 91]];
      if (c.slit) { poly([[23, 55], [31, 55], [27, 91], [10, 91]], "skirt", { shade: "pleat", folds: 2 }); poly([[33, 55], [41, 55], [54, 91], [37, 91]], "skirt", { shade: "pleat", folds: 2 }); }
      else poly(skirt, "skirt", { shade: "pleat", folds: 3.5 });
      if (c.over) { poly([[23, 55], [28.5, 55], [21, 80], [11.5, 88]], "top", { shade: "pleat", folds: 1.5 }); poly(MX([[23, 55], [28.5, 55], [21, 80], [11.5, 88]]), "top", { shade: "pleat", folds: 1.5 }); }
      poly([[11, 86.5], [53, 86.5], [54, 91.5], [10, 91.5]], "hem", { shade: "pleat", folds: 3.5 });
      scallop(10, 54, 92, "lace");
      for (let x = 13; x <= 51; x += 4) { dk(x, 88, R_("trim", 0), "hem"); dk(x - 1, 89, R_("trim", 1), "hem"); dk(x + 1, 89, R_("trim", 1), "hem"); dk(x, 90, R_("trim", 2), "hem"); }
      for (let x = 12; x <= 52; x++) dk(x, 85, R_("trim", 1), ["skirt", "slit", "top"]);
      torso(); sleeves(c);
      rect(23.5, 54, 17, 3, "trim", { shade: "flat", l: 1 });
    },
    maid(c) {
      legsPair(76, 88, "legs"); shoes(24, 87, "shoes"); shoes(34, 87, "shoes");
      dk(25, 88, R_("shoes", 0), "shoes"); dk(35, 88, R_("shoes", 0), "shoes");
      for (const x0 of [24.5, 34.5]) for (let x = 0; x < 6; x++) dk(x0 + x, 89, R_("shoes", 3), "shoes");
      poly([[16, 72], [48, 72], [49.5, 77], [14.5, 77]], "lace", { shade: "pleat", folds: 6 }); scallop(14, 50, 78, "lace", 3);
      poly([[23, 55], [41, 55], [48, 74], [16, 74]], "skirt", { shade: "pleat", folds: 3 });
      poly([[26, 57], [38, 57], [41.5, 71], [22.5, 71]], "apron", { shade: "across" }); scallop(22, 42, 72, "apron", 3);
      for (let x = 27; x <= 37; x++) dk(x, 64, R_("apron", 3), "apron"); dk(26, 65, R_("apron", 3), "apron"); dk(38, 65, R_("apron", 3), "apron");
      torso(); sleeves(c);
      seg(27, 43.5, 27.6, 57, "apron", 1, 2); seg(37, 43.5, 36.4, 57, "apron", 1, 2);
      poly([[26, 47], [38, 47], [37, 57], [27, 57]], "apron", { shade: "across" });
      ell(32, 44.2, 6, 2.6, "apron", {}); scallop(26, 38, 46, "apron", 2);
      bow(32, 45, "tie", .8);
      [50, 53].forEach(y => dk(32, y, R_("tie", 1), "apron"));
    },
    short(c) {
      rect(25, 69, 5, 5, "skin", { shade: "flat", l: 1 }); rect(34, 69, 5, 5, "skin", { shade: "flat", l: 1 });
      legsPair(74, 88, "legs"); for (let x = 25; x < 30; x++) { dk(x, 74, R_("accent", 1), "legs"); dk(x + 9, 74, R_("accent", 1), "legs"); }
      shoes(24, 87, "shoes"); shoes(34, 87, "shoes"); dk(25, 88, R_("shoes", 0), "shoes"); dk(35, 88, R_("shoes", 0), "shoes");
      poly([[23, 55], [41, 55], [47.5, 71], [16.5, 71]], "skirt", { shade: "pleat", folds: 4 });
      poly([[16.8, 68.5], [47.2, 68.5], [47.8, 71.6], [16.2, 71.6]], "hem", {});
      [[22, 62], [42, 60], [33, 66]].forEach(([x, y]) => { dk(x, y, R_("accent", 1), "skirt"); dk(x - 1, y, R_("accent", 2), "skirt"); dk(x + 1, y, R_("accent", 2), "skirt"); dk(x, y - 1, R_("accent", 2), "skirt"); dk(x, y + 1, R_("accent", 2), "skirt"); });
      torso(); sleeves(c);
      poly([[23.5, 43], [40.5, 43], [39, 50], [32, 46.5], [25, 50]], "hem", { shade: "across" });
      for (const [x, y] of [[25, 48], [26, 48], [38, 48], [39, 48], [27, 47], [37, 47]]) dk(x, y, R_("accent", 1), "hem");
      bow(32, 47.5, "accent", .9);
    },
    hanfu(c) {
      poly([[23, 55], [41, 55], [50, 91], [14, 91]], "skirt", { shade: "pleat", folds: 3 });
      poly([[29.5, 56], [41, 55], [45.5, 91], [31, 91]], "skirt2", { shade: "pleat", folds: 1.5 });
      poly([[14.6, 87.5], [49.4, 87.5], [50, 91.5], [14, 91.5]], "hem", {});
      for (let x = 16; x <= 48; x += 6) { dk(x, 89, R_("trim", 1), "hem"); dk(x + 1, 88, R_("trim", 1), "hem"); dk(x + 2, 89, R_("trim", 1), "hem"); dk(x + 3, 90, R_("trim", 2), "hem"); }
      torso();
      poly([[37.5, 42], [40.5, 43], [32.5, 53], [30.5, 51]], "trim", { shade: "flat", l: 2 });
      poly([[23.5, 43], [26.5, 42], [36.5, 53], [33.5, 54]], "trim", { shade: "flat", l: 1 });
      poly([[22.5, 51.5], [41.5, 51.5], [41.5, 57], [22.5, 57]], "sash", { shade: "vert" });
      for (let x = 23; x <= 41; x++) dk(x, 52, R_("trim", 1), "sash");
      seg(35, 57, 33, 73, "sash", 2, 2); seg(37, 57, 39.5, 71, "sash", 3, 2); ell(36, 55, 2.3, 2.3, "sash", {});
      gem(33, 75, 1.6, "gold"); seg(33, 76.5, 33, 80, "trim", 2, 1);
      const sl = [[24, 44], [17, 46.5], [10.5, 70], [14.5, 75.5], [25.5, 71.5], [26, 58]];
      poly(sl, "sleeve", { shade: "across" }); poly(MX(sl), "sleeve", { shade: "across", lv: 1 });
      const cf = [[10.5, 69], [25.5, 67.5], [25.5, 71.5], [14.5, 75.5]];
      poly(cf, "trim", {}); poly(MX(cf), "trim", { lv: 1 });
      if (c.cloud) for (const [x, y] of [[17, 56], [19, 62], [46, 57], [44, 63]]) { const col = R_("sleeve", 3); dk(x, y, col, "sleeve"); dk(x + 1, y - 1, col, "sleeve"); dk(x + 2, y, col, "sleeve"); dk(x + 1, y + 1, col, "sleeve"); }
      ell(21, 71.5, 2.6, 2.3, "skin", { lv: -1 }); ell(43, 71.5, 2.6, 2.3, "skin", { lv: -1 });
    },
    lolita(c) {
      legsPair(80, 88, "legs");
      for (const x0 of [25, 34]) for (let y = 81; y < 88; y += 2) dk(x0 + 2, y, R_("ribbon", 2), "legs");
      shoes(24, 87, "shoes"); shoes(34, 87, "shoes"); for (const x0 of [24.5, 34.5]) for (let x = 0; x < 6; x++) dk(x0 + x, 88, R_("ribbon", 3), "shoes");
      ell(32, 81, 20.5, 5.5, "skirt2", { shade: "pleat", folds: 7 });
      scallop(12, 52, 86, "lace", 3);
      ell(32, 79.5, 19.5, 3.4, "lace", { shade: "pleat", folds: 9 });
      poly([[23, 55], [41, 55], [45.5, 64], [18.5, 64]], "skirt", { shade: "pleat", folds: 3 });
      ell(32, 68, 18.5, 12, "skirt", { shade: "pleat", folds: 5 });
      poly([[37, 59], [50.5, 64], [52.5, 84], [45, 81], [40, 70]], "skirt2", { shade: "pleat", folds: 2 });
      for (let x = 16; x <= 48; x++) { if (x % 2) dk(x, 74, R_("lace", 1), "skirt"); }
      bow(16.5, 73, "ribbon", .9); bow(46, 64, "ribbon", .9);
      torso();
      for (let y = 46; y <= 55; y += 3) { dk(31, y, R_("lace", 1), "top"); dk(32, y, R_("lace", 1), "top"); }
      sleeves(c);
      ell(32, 44.3, 6.2, 2.4, "lace", {}); scallop(26, 38, 46, "lace", 2);
      bow(32, 46, "ribbon", .9);
    }
  };

  /* ---------- extras ---------- */
  const EX = {
    tiara() { ell(32, 22, 16.8, 14.8, "gold", { shade: "flat", l: 1, clip: (x, y) => y >= 9 && y <= 10 && x > 20 && x < 44 }); gem(32, 9, 1.8, "gem"); poly([[30, 9], [32, 4], [34, 9]], "gold", {}); },
    wings() {
      for (const s of [-1, 1]) {
        const X = x => s < 0 ? x : mxX(x);
        const pts = [[26, 48], [18, 36], [10, 26], [4, 21], [1, 30], [2, 40], [5, 48], [9, 56], [14, 60], [19, 58], [24, 56]].map(([x, y]) => [X(x), y]);
        poly(pts, "wing", { shade: "across", top: 3 });
        [[4, 22], [1.5, 32], [3, 43], [8, 54], [14, 59]].forEach(([x, y]) => seg(X(25), 48, X(x), y, "bone", 2, 1));
        seg(X(25), 48, X(4), 22, "bone", 1, 2);
      }
    },
    horns() { for (const s of [-1, 1]) { const X = x => s < 0 ? x : mxX(x); poly([[24, 14.5], [21, 8], [17, 3], [15.5, -.5], [20, 1.5], [25.5, 7], [28.5, 12.5]].map(([x, y]) => [X(x), y]), "horn", { shade: "across" }); [[20, 4], [22, 7], [24, 10]].forEach(([x, y]) => { dk(X(x), y, R_("horn", 3), "horn"); dk(X(x + 1), y, R_("horn", 3), "horn"); }); } },
    dtail() { poly([[17, 70], [24, 73], [17, 83], [9, 91], [2, 94], [4, 88], [11, 81]], "tailw", { shade: "across" }); poly([[2, 94], [-1, 89], [5, 90]], "gold", {}); [[12, 81], [17, 76]].forEach(([x, y]) => poly([[x, y], [x - 4, y - 3], [x + 1, y - 1]], "gold", {})); },
    whale() {
      poly([[37, 63], [44, 61], [50, 67], [53.5, 76], [50, 80], [46, 74], [40.5, 69.5]], "tail", { shade: "across" });
      poly([[49.5, 75], [57, 66], [63, 63.5], [61.5, 72], [55, 79]], "tail", { shade: "across", top: 2 });
      poly([[49.5, 79], [56, 82], [63, 90], [57, 90.5], [51, 84]], "tail", { shade: "across" });
      for (const [x, y] of [[45, 70], [47, 73], [49, 76]]) dk(x, y, R_("tail", 0), "tail");
    },
    fins() { for (const s of [-1, 1]) { const X = x => s < 0 ? x : mxX(x); poly([[19, 27], [12, 23], [3.5, 21.5], [5.5, 26.5], [8, 31.5], [13, 35], [19, 35]].map(([x, y]) => [X(x), y]), "fin", { shade: "across", top: 2 }); seg(X(18), 29, X(6), 23, "fin", 3, 1); seg(X(18), 32.5, X(9), 30, "fin", 3, 1); dk(X(7), 24, R_("fin", 0), "fin"); dk(X(8), 24, R_("fin", 0), "fin"); } },
    helmet() {
      poly([[16.5, 13], [47.5, 8], [45, 1.5], [20, 4]], "metal", { shade: "across", top: 2 });
      poly([[15, 12.4], [48.6, 6.8], [49, 9.2], [15.6, 14.8]], "metal", { shade: "flat", l: 1 });
      for (let x = 22; x <= 42; x += 1) dk(x, Math.round(4.6 - (x - 22) * .1), R_("metal", 0), "metal");
      dk(30, 8, R_("metal", 3), "metal"); dk(31, 8, R_("metal", 3), "metal"); dk(38, 6, R_("metal", 3), "metal");
    },
    bowl() {
      seg(25, 58, 33, 47, "wood", 2, 1); seg(27, 58, 35.5, 48.5, "wood", 3, 1);
      ell(21.5, 59.8, 7, 2.6, "rice", {});
      poly([[14, 60], [29, 60], [26.2, 67], [16.8, 67]], "bowl", { shade: "across" });
      for (let x = 15; x <= 28; x++) dk(x, 62, R_("tail", 1), "bowl");
      [[17, 64], [21, 64], [25, 64]].forEach(([x, y]) => dk(x, y, R_("tail", 2), "bowl"));
      [[18, 59], [21, 58], [24, 59], [20, 60]].forEach(([x, y]) => dk(x, y, "#FFFFFF", "rice"));
      ell(16, 63.5, 1.8, 2, "skin", {});
    },
    cat() { for (const s of [-1, 1]) { const X = x => s < 0 ? x : mxX(x); poly([[19, 17], [18.5, 3], [23, 4.5], [30.5, 11]].map(([x, y]) => [X(x), y]), "hair", { shade: "across" }); poly([[21, 14], [20.8, 7], [23.5, 7.5], [27.5, 11.5]].map(([x, y]) => [X(x), y]), "inner", {}); dk(X(22), 9, R_("inner", 0), "inner"); } },
    fox() {
      for (const s of [-1, 1]) {
        const X = x => s < 0 ? x : mxX(x);
        poly([[16, 19], [12.5, 4], [13.5, -1], [19, 1.5], [29.5, 10.5]].map(([x, y]) => [X(x), y]), "hair", { shade: "across" });
        poly([[18, 16], [15.8, 5], [18.6, 4.6], [26, 11]].map(([x, y]) => [X(x), y]), "innerf", {});
        for (let y = 0; y <= 4; y++) for (let x = 11; x <= 20; x++) { const xx = s < 0 ? x : 63 - x; dk(xx, y, y < 2 ? "#FFFFFF" : "#E9E9EE", "hair"); }
        [[18, 8], [19, 10], [20, 12]].forEach(([x, y]) => dk(X(x), y, "#FFFFFF", "innerf"));
      }
    },
    ftail() {
      poly([[40, 64], [46, 58], [54, 56.5], [60.5, 61], [62.5, 70], [59, 81], [52, 88.5], [45, 86], [42, 77]], "tail", { shade: "across" });
      ell(56.5, 61.5, 5.6, 4.6, "white", {});
      seg(48, 63, 55, 80, "tail", 3, 1); seg(52, 62, 59, 76, "tail", 3, 1); seg(45, 68, 49, 83, "tail", 3, 1);
    },
    flower() {
      for (let k = 0; k < 5; k++) { const a = (-90 + k * 72) * Math.PI / 180; ell(44 + Math.cos(a) * 2.7, 15 + Math.sin(a) * 2.7, 2.1, 2.1, "flower", {}); }
      ell(44, 15, 1.4, 1.4, "gold", { shade: "flat", l: 1 }); poly([[41, 18], [36.5, 20], [39.5, 16.5]], "leaf", {}); poly([[47, 18.5], [50, 22], [46, 20.5]], "leaf", {});
      for (let k = 0; k < 5; k++) { const a = (-90 + k * 72) * Math.PI / 180; ell(49 + Math.cos(a) * 1.5, 21.5 + Math.sin(a) * 1.5, 1.2, 1.2, "flower", { lv: 1 }); }
    },
    brooch() { for (let k = 0; k < 5; k++) { const a = (-90 + k * 72) * Math.PI / 180; ell(32 + Math.cos(a) * 1.8, 47 + Math.sin(a) * 1.8, 1.4, 1.4, "flower", {}); } ell(32, 47, 1, 1, "gold", { shade: "flat", l: 0 }); for (const y of [50, 53]) { dk(32, y, R_("gold", 1), "top"); } },
    book(c) {
      rect(11.5, 52.5, 10.5, 13.5, "book", { shade: "across" }); rect(11.5, 52.5, 2, 13.5, "book", { shade: "flat", l: 3 });
      rect(13.5, 64.6, 8.5, 1.6, "paper", { shade: "flat", l: 1 });
      for (let x = 15; x <= 20; x++) { dk(x, 54, R_("gold", 1), "book"); dk(x, 62, R_("gold", 2), "book"); } for (let y = 54; y <= 62; y++) { dk(15, y, R_("gold", 1), "book"); dk(20, y, R_("gold", 2), "book"); }
      dk(17, 58, R_("gold", 0), "book"); dk(18, 58, R_("gold", 1), "book"); dk(17, 57, R_("gold", 1), "book"); dk(18, 59, R_("gold", 2), "book");
      seg(19, 66, 20, 70, "ribbonb", 2, 1);
      if (c.quill) { seg(20, 54, 13, 42, "feather", 1, 2); seg(20, 54, 22.5, 58, "gold", 2, 1); }
      ell(21.6, 60.5, 2.2, 2.4, "skin", {});
    },
    starclip() { poly([[44, 8], [45.4, 12.6], [50, 14], [45.4, 15.4], [44, 20], [42.6, 15.4], [38, 14], [42.6, 12.6]], "gold", { shade: "across" }); dk(44, 14, "#FFFFFF", "gold"); },
    wand() { seg(42.5, 61, 50, 46, "gold", 2, 1); poly([[50.5, 38], [52, 43], [57, 44.5], [52, 46], [50.5, 51], [49, 46], [44, 44.5], [49, 43]], "gold", { shade: "across" }); gem(50.5, 44.5, 1.3, "gem"); },
    bat() {
      poly([[21.5, 10.5], [27, 7.5], [32, 12], [37, 7.5], [42.5, 10.5], [40.5, 14.5], [36, 13], [32, 16.5], [28, 13], [23.5, 14.5]], "batm", { shade: "across" });
      gem(32, 12.2, 1.7, "redgem"); bow(15, 17, "ribbon", 1); bow(49, 17, "ribbon", 1);
    },
    choker() { rect(28.5, 40, 7, 1.8, "batm", { shade: "flat", l: 2 }); gem(32, 41.8, 1.3, "redgem"); },
    lacing() { for (let y = 46; y <= 55; y += 3) { [[30, y], [31, y + 1], [32, y + 1], [33, y]].forEach(([x, yy]) => dk(x, yy, R_("redgem", 1), "top")); } },
    axe() {
      rect(47, 2, 2.6, 89, "wood", { shade: "across" });
      for (let y = 56; y <= 70; y += 3) { dk(47, y, R_("wood", 4), "wood"); dk(48, y + 1, R_("wood", 4), "wood"); dk(49, y + 1, R_("wood", 4), "wood"); }
      poly([[47, 7], [41, 5], [38.5, 9.5], [41, 14.5], [47, 14]], "blade", { shade: "across" });
      poly([[49.4, 5], [57, 1], [63, 2], [63.6, 14], [62, 26], [56, 24], [49.4, 18]], "blade", { shade: "across", top: 2 });
      for (let y = 3; y <= 24; y++) dk(62, y, R_("blade", 0), "blade");
      poly([[47, 2.5], [48.3, -2], [49.6, 2.5]], "blade", {}); ell(48.3, 91.6, 2.2, 1.6, "blade", {});
      gem(53.5, 12, 2, "redgem");
      ell(47.6, 62.6, 2.8, 2.6, "skin", { lv: -1 });
    },
    fan() {
      ell(46, 71, 12.5, 11.5, "fanb", { upper: true });
      ell(46, 71, 10.5, 9.5, "paper", { upper: true, shade: "flat", l: 1 });
      for (let a = 180; a <= 360; a += 22.5) { const r = a * Math.PI / 180; for (let t = 2; t <= 10; t++) dk(46 + Math.cos(r) * t, 71 + Math.sin(r) * t, R_("paper", 3), "paper"); }
      [[41, 66], [47, 64], [51, 67]].forEach(([x, y]) => { const c = R_("fanb", 2); dk(x, y, c, "paper"); dk(x + 1, y - 1, c, "paper"); dk(x + 2, y, c, "paper"); dk(x + 1, y, R_("fanb", 1), "paper"); });
      seg(46, 71, 43.5, 76, "wood", 2, 2); gem(43, 77.5, 1.2, "gold"); seg(43, 78.5, 42, 84, "sash", 2, 1);
    },
    round() { ell(44.5, 15, 3, 3, "clip", {}); ell(44.5, 15, 1.3, 1.3, "gold", { shade: "flat", l: 1 }); seg(44.5, 18, 45, 26, "sash", 2, 1); gem(45, 27.5, 1.3, "gold"); },
    cube() { rect(42, 12, 4.6, 4.6, "cube", { shade: "across" }); for (let x = 42; x <= 46; x++) dk(x, 12, R_("cube", 0), "cube"); rect(46.5, 17.5, 3, 3, "cube", { lv: 1 }); seg(17, 9, 24, 15, "gold", 1, 1); gem(16.5, 8.5, 1.3, "gem"); },
    brush() { seg(43, 71, 55, 44, "wood", 2, 2); seg(53.6, 47, 55.6, 43, "gold", 1, 2); poly([[54.5, 43.5], [58.5, 36.5], [57.5, 44.5]], "ink", {}); },
    bamboo() {
      for (const x0 of [1, 59.5]) { rect(x0, 0, 3.2, 96, "bamboo", { shade: "across" }); for (let y = 9; y < 96; y += 13) rect(x0 - .4, y, 4, 1.2, "bamboo", { shade: "flat", l: 3 }); }
      [[[4, 22], [13, 18], [6, 25]], [[4, 35], [11, 35], [5, 38]], [[60, 28], [51, 24], [59, 31]], [[60, 52], [52, 52], [59, 55]], [[4, 62], [12, 59], [5, 65]]].forEach(p => poly(p, "leaf", { shade: "across" }));
    },
    moon() { ell(32, 28, 27, 27, "moon", { shade: "flat", l: 1 }); carve(41, 21, 24.5, 24.5, "moon"); for (const [x, y] of [[8, 36], [10, 44], [7, 28]]) { dk(x, y, R_("moon", 2), "moon"); dk(x + 1, y, R_("moon", 2), "moon"); } },
    crescent() { ell(44, 15, 3.2, 3.2, "moonc", {}); carve(45.6, 13.8, 2.6, 2.6, "moonc"); },
    bonnet() { ell(32, 22, 17, 15, "lace", { shade: "flat", l: 1, clip: (x, y) => y >= 8 && y <= 10 }); bow(18, 13, "ribbon", .9); },
    scroll() { rect(11, 60, 6.5, 32, "paper", { shade: "across" }); for (let y = 63; y < 90; y += 3) for (let x = 12; x <= 16; x++) if ((x + y) % 4) dk(x, y, R_("paper", 3), "paper"); ell(14.3, 60, 4.5, 1.8, "wood", {}); ell(14.3, 92, 4.5, 1.6, "wood", {}); ell(21.5, 62.6, 2.8, 2.6, "skin", { lv: -1 }); }
  };

  /* ---------- characters ---------- */
  const CHARS = {
    gpt: { hair: "#ECEDF4", style: "wavy", len: 84, spread: 7, eye: "#9A86D6", mouth: "smile", outfit: "gown",
      mats: { top: "#FFFFFF", skirt: "#FFFFFF", hem: "#F3EEDD", trim: "#D8B76A", lace: "#FFFFFF", sleeve: "#F7F7FB", cuff: "#D8B76A", gold: "#E0BE62", gem: "#9A86D6", wing: "#EEF0F7", bone: "#D6C38A", horn: "#E3C77E", tailw: "#F1F2F8", flower: "#E0BE62" },
      back: ["wings"], behind: ["dtail"], front: ["horns", "tiara", "brooch"], sparkle: [[5, 8, "#E0BE62", 1], [58, 44, "#E0BE62", 1], [57, 6, "#C9CCE0"], [4, 62, "#C9CCE0"]] },
    claude: { hair: "#D97757", len: 78, eye: "#D4743F", mouth: "smile", outfit: "gown", over: true,
      mats: { top: "#3A2A22", skirt: "#F3E8D2", hem: "#3A2A22", trim: "#D9A45A", lace: "#FBF6EC", sleeve: "#3A2A22", cuff: "#F3E8D2", gold: "#D9A45A", flower: "#E8875F", leaf: "#7F9A62", book: "#7E3F2A", paper: "#F3EAD8", ribbonb: "#D97757", feather: "#FBF6EC" },
      front: ["flower", "brooch", "book"], quill: true, sparkle: [[55, 30, "#E8875F"]] },
    gemini: { hair: "#9589E6", len: 68, eyeL: "#3186FF", eyeR: "#F0A23A", mouth: "o", brow: "worried", sweat: true, outfit: "short",
      mats: { top: "#9C8CF5", skirt: "#8676EE", hem: "#FFFFFF", sleeve: "#FFFFFF", cuff: "#9C8CF5", legs: "#FFFFFF", shoes: "#4A3BB0", accent: "#FBD24E", gold: "#FBD24E", gem: "#3186FF", inner: "#F4B9D2" },
      front: ["cat", "starclip", "wand"], sparkle: [[6, 20, "#FBD24E", 1], [57, 30, "#3186FF"], [6, 52, "#FC6B5D"], [58, 62, "#22C27A"]] },
    grok: { hair: "#F6D36A", style: "twin", eye: "#3F86E0", mouth: "smug", brow: "angry", lid: 2, outfit: "gown", slit: true, reach: 4, side: 42,
      mats: { top: "#24222B", skirt: "#24222B", slit: "#B3202E", hem: "#B3202E", trim: "#B3202E", lace: "#3A3742", sleeve: "#24222B", cuff: "#B3202E", batm: "#2A2830", redgem: "#D8303E", ribbon: "#C42634", wood: "#5A3A2E", blade: "#C9CED6", gold: "#D9A45A", flower: "#D8303E" },
      front: ["bat", "choker", "lacing", "axe"] },
    deepseek: { hair: "#2F4BD8", len: 74, eye: "#3F7BFF", mouth: "open", outfit: "maid",
      mats: { top: "#3550C8", skirt: "#3550C8", apron: "#F7F9FF", lace: "#F7F9FF", sleeve: "#3550C8", cuff: "#F7F9FF", legs: "#F7F9FF", shoes: "#1E2C80", tie: "#4D6BFE", tail: "#4D6BFE", fin: "#4D6BFE", metal: "#AEB6C2", bowl: "#F0F3F8", rice: "#FFFFFF", wood: "#9A6A3E" },
      behind: ["whale", "fins"], front: ["helmet", "bowl"], sparkle: [[6, 40, "#BFD4FF"], [58, 34, "#BFD4FF"], [8, 70, "#BFD4FF", 1]] },
    glm: { hair: "#2A2A33", len: 78, eye: "#D4A84E", mouth: "flat", lid: 1, glasses: "#C9A15A", lash: "#18121E", outfit: "maid",
      mats: { top: "#26262E", skirt: "#26262E", apron: "#F2F2F4", lace: "#F2F2F4", sleeve: "#26262E", cuff: "#F2F2F4", legs: "#34343E", shoes: "#16161B", tie: "#C9A15A", tail: "#2A2A33", white: "#F4F4F6", innerf: "#EAD2BC", book: "#2E2E38", paper: "#ECE6D8", gold: "#C9A15A", ribbonb: "#C9A15A" },
      behind: ["ftail"], front: ["fox", "book"] },
    qwen: { hair: "#6A5ACD", len: 80, eye: "#6F7BE0", mouth: "smile", outfit: "hanfu", cloud: true,
      mats: { top: "#FFFFFF", skirt: "#8F86E8", skirt2: "#B2A9F2", hem: "#6A5ACD", trim: "#6A5ACD", sash: "#B8C6F2", sleeve: "#FFFFFF", gold: "#E0BE62", clip: "#B8C6F2", fanb: "#6A5ACD", paper: "#F7F3EA", wood: "#8A5A3A" },
      front: ["round", "fan"] },
    kimi: { hair: "#DAD5EE", len: 78, eye: "#8C7BD6", mouth: "flat", lid: 2, outfit: "lolita",
      mats: { top: "#262C54", skirt: "#262C54", skirt2: "#5A4B8F", lace: "#F2EFFA", ribbon: "#8C7BD6", sleeve: "#5A4B8F", cuff: "#F2EFFA", legs: "#F2EFFA", shoes: "#262C54", moon: "#FFF1BE", moonc: "#FFE58A", paper: "#F7F2E4", wood: "#4B3A6E" },
      back: ["moon"], front: ["bonnet", "crescent", "scroll"], sparkle: [[56, 8, "#FFF1BE", 1], [59, 34, "#DAD5EE"], [4, 72, "#FFF1BE"], [58, 70, "#FFF1BE"]] },
    wenxin: { hair: "#2B4FA8", len: 82, eye: "#4A6FD0", mouth: "smile", outfit: "hanfu",
      mats: { top: "#F4F7FC", skirt: "#4C7BD9", skirt2: "#7FA2E6", hem: "#2B4FA8", trim: "#2B4FA8", sash: "#5E9C76", sleeve: "#F4F7FC", gold: "#D9B45A", gem: "#5E9C76", cube: "#4C7BD9", wood: "#7A5A3A", ink: "#2B2B33", bamboo: "#5E9C76", leaf: "#78B48E" },
      back: ["bamboo"], front: ["cube", "brush"], sparkle: [[56, 28, "#2B2B33"], [52, 36, "#55556A"]] }
  };

  function begin() { G = Array.from({ length: H }, () => Array(W).fill(null)); D = Array.from({ length: H }, () => Array(W).fill(null)); Z = 0; GR = 0; MATS = {}; POST = []; }
  function baseMats(c) {
    MATS.skin = { r: SKIN, line: true, hair: false, self: false }; MATS.neck = { r: SKIN, line: true, hair: false, self: false };
    mat("hair", c.hair, { hair: true });
    const defaults = { white: "#FFFFFF", gold: "#E0BE62", gem: "#E04A5A", paper: "#F3EAD8", wood: "#8A5A3A" };
    Object.entries(Object.assign({}, defaults, c.mats)).forEach(([k, v]) => mat(k, v));
    ["top", "skirt", "skirt2", "hem", "trim", "lace", "sleeve", "cuff", "legs", "shoes", "apron", "tie", "accent", "sash", "ribbon", "slit"].forEach(k => { if (!MATS[k]) mat(k, MATS.top ? MATS.top.r[2] : "#888888"); });
  }
  function drawChar(id) {
    const c = CHARS[id]; begin(); baseMats(c);
    (c.back || []).forEach(k => EX[k](c));
    hairBack(c);
    (c.behind || []).forEach(k => EX[k](c));
    neck(); OUTFIT[c.outfit](c);
    hairCap(); faceSkin(); bangs(c);
    (c.front || []).forEach(k => EX[k](c));
    linePass(); ringPass();
    faceDecals(c);
    (c.sparkle || []).forEach(([x, y, col, big]) => spark(x, y, col, big));
    return compose();
  }
  function drawDoubao() {
    begin();
    const c = { hair: "#1E1A1A", style: "bob", eye: "#6B4A3A", mouth: "open", drool: true, brow: "calm", mats: {} };
    baseMats(c); mat("bun", "#F7C948"); mat("belly", "#FCE08A"); mat("scarf", "#D9363E"); mat("feet", "#E59A2E");
    ell(23, 91, 5, 2.4, "feet", {}); ell(41, 91, 5, 2.4, "feet", {});
    ell(12.5, 70, 3.6, 4.6, "bun", {}); ell(51.5, 70, 3.6, 4.6, "bun", {});
    ell(32, 70, 19.5, 20.5, "bun", {}); ell(32, 76, 10.5, 9.5, "belly", { shade: "flat", l: 1 });
    for (const [x, y] of [[24, 56], [28, 55], [36, 55], [40, 56]]) { dk(x, y, MATS.bun.r[3], "bun"); dk(x + 1, y + 1, MATS.bun.r[3], "bun"); }
    for (const [x, y] of [[27, 76], [37, 76], [32, 82]]) { dk(x, y, MATS.belly.r[0], "belly"); }
    hairBack(c); neck(); hairCap(); faceSkin(); bangs(c);
    poly([[17.5, 43.5], [46.5, 43.5], [47.5, 49.5], [16.5, 49.5]], "scarf", { shade: "vert" });
    poly([[37, 47], [44, 47], [46.5, 63], [39.5, 64]], "scarf", { shade: "across" });
    for (let x = 40; x <= 46; x += 2) { dk(x, 64, MATS.scarf.r[2], "any"); dk(x, 65, MATS.scarf.r[3], "any"); }
    for (let x = 18; x <= 46; x += 4) dk(x, 46, MATS.scarf.r[0], "scarf");
    linePass(); ringPass(11, 6);
    faceDecals(c);
    [[52, 26, "#FFE58A", 1], [10, 38, "#FFE58A"]].forEach(([x, y, col, big]) => spark(x, y, col, big));
    return compose();
  }
  const cache = {};
  function grid(id) { return cache[id] || (cache[id] = id === "doubao" ? drawDoubao() : drawChar(id)); }
  function paint(cv, id, s, mono) { const g = grid(id); cv.width = W * s; cv.height = H * s; const x = cv.getContext("2d"); for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) { const c = g[y][i]; if (c) { x.fillStyle = mono || c; x.fillRect(i * s, y * s, s, s); } } return cv; }
  window.AIG = { W, H, grid, paint };
})();

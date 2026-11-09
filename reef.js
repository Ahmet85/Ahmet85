/* OKTO resif ve kayalık dünyası: tamamı kodla çizilir, her parça bir kez çizilip önbelleğe alınır.
   Tasarım rehberi: kullanıcının 19 referans görseli (yosunlu kaya adacıkları, mercanlar, deniz yıldızı,
   parlayan mağara ağzı, yanlardan uzanan mercanlı kayalıklar, arka plan silüetleri).
   OktoReef.make(kind, w, tier, seed, side) -> { img, ox, oy, hit:[{x,y,r}], mouth, w }
     kind: 'mossy' | 'spiky' | 'cave' | 'ledge'   (ledge: kenardan uzanan çıkıntı; side -1 sol, 1 sağ)
   OktoReef.silhouette(kind, w, seed), OktoReef.frond(w, seed, side), OktoReef.drawCanyon(...), OktoReef.drawSeabed(...) */
(() => {
'use strict';
const TAU = Math.PI * 2;
function rng(seed) { let s = Math.floor(Math.abs(seed)) % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

// Derinlik kademesine göre kaya renkleri (sevimli, mavi-gri, hafif hacimli)
const ROCK = {
  1: { hi: '#b4c7dc', mid: '#7f97b4', lo: '#4a5f80', line: '#26364f' },
  2: { hi: '#93a6c9', mid: '#62769e', lo: '#36466b', line: '#1a2540' },
  3: { hi: '#7d80b3', mid: '#52568a', lo: '#2b2e57', line: '#13152e' },
};
const MOSS = { 1: ['#b6f06a', '#5cc24a', '#2f8a3a'], 2: ['#9fe27a', '#4aa85a', '#25713d'], 3: ['#7fe3b0', '#3a9a7a', '#1f5f52'] };

function canvasFor(wpx, hpx) {
  const c = document.createElement('canvas'), d = DPR();
  c.width = Math.ceil(wpx * d); c.height = Math.ceil(hpx * d);
  const x = c.getContext('2d'); x.scale(d, d);
  return [c, x];
}
function blob(x, cx, cy, rx, ry, r, bump = 0.08, n = 14) { // hafif yamru yumru elips
  x.beginPath();
  for (let i = 0; i <= n; i++) { const a = i / n * TAU, k = 1 + (r() - 0.5) * bump * 2; x.lineTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k); }
  x.closePath();
}
function boulder(x, cx, cy, rx, ry, P, r, lw) {
  const g = x.createRadialGradient(cx - rx * 0.35, cy - ry * 0.45, rx * 0.1, cx, cy, Math.max(rx, ry) * 1.15);
  g.addColorStop(0, P.hi); g.addColorStop(0.55, P.mid); g.addColorStop(1, P.lo);
  blob(x, cx, cy, rx, ry, r); x.fillStyle = g; x.fill(); x.strokeStyle = P.line; x.lineWidth = lw; x.stroke();
  x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.ellipse(cx - rx * 0.32, cy - ry * 0.42, rx * 0.32, ry * 0.16, -0.4, 0, TAU); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = lw * 0.7; x.beginPath(); x.moveTo(cx + rx * 0.2, cy - ry * 0.1); x.lineTo(cx + rx * 0.05, cy + ry * 0.3); x.lineTo(cx + rx * 0.22, cy + ry * 0.5); x.stroke();
}
function mossCap(x, cx, cy, rx, ry, tier, r, lw) { // kabarık yosun tümsekleri + damlayan yosun
  const M = MOSS[tier] || MOSS[1];
  const g = x.createLinearGradient(0, cy - ry * 1.4, 0, cy + ry); g.addColorStop(0, M[0]); g.addColorStop(0.55, M[1]); g.addColorStop(1, M[2]);
  x.fillStyle = g; x.strokeStyle = M[2]; x.lineWidth = lw * 0.8;
  // alt örtü (damlalı kenar)
  x.beginPath(); x.moveTo(cx - rx, cy);
  const n = 16;
  for (let i = 0; i <= n; i++) { const s = i / n, xx = cx - rx + s * rx * 2, drip = (i % 3 === 1 ? ry * (0.6 + r() * 0.6) : ry * (0.2 + r() * 0.15)); x.lineTo(xx, cy + drip); }
  x.lineTo(cx + rx, cy - ry * 0.3); x.lineTo(cx - rx, cy - ry * 0.3); x.closePath(); x.fill(); x.stroke();
  // üstte kabarık tümsekler
  const bumps = 5;
  for (let i = 0; i < bumps; i++) {
    const bx = cx - rx * 0.78 + (i / (bumps - 1)) * rx * 1.56, br = ry * (0.75 + r() * 0.5), by = cy - ry * (0.35 + r() * 0.35);
    x.beginPath(); x.arc(bx, by, br, Math.PI * 0.95, Math.PI * 2.05); x.lineTo(bx + br, cy); x.lineTo(bx - br, cy); x.closePath(); x.fill();
  }
  x.beginPath(); for (let i = 0; i < bumps; i++) { const bx = cx - rx * 0.78 + (i / (bumps - 1)) * rx * 1.56; x.moveTo(bx + ry * 0.6, cy - ry * 0.9); x.arc(bx, cy - ry * 0.5, ry * 0.6, 0, Math.PI, true); } x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = lw * 0.6; x.stroke();
  x.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(cx - rx * 0.7 + r() * rx * 1.4, cy - ry * (0.4 + r() * 0.8), 1 + r() * 1.8, 0, TAU); x.fill(); }
}
function tubeCoral(x, cx, cy, s, col, r, lw) {
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const tx = cx + (i - (n - 1) / 2) * s * 0.42, h = s * (0.9 + r() * 0.8), w = s * 0.32;
    x.fillStyle = col; x.strokeStyle = 'rgba(40,10,40,.55)'; x.lineWidth = lw * 0.7;
    x.beginPath(); x.roundRect(tx - w / 2, cy - h, w, h, w * 0.4); x.fill(); x.stroke();
    x.fillStyle = 'rgba(40,0,40,.45)'; x.beginPath(); x.ellipse(tx, cy - h + w * 0.25, w * 0.32, w * 0.16, 0, 0, TAU); x.fill();
  }
}
function branchCoral(x, cx, cy, s, col, r, lw) {
  x.strokeStyle = col; x.lineCap = 'round';
  const br = (bx, by, a, len, w, d) => {
    const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
    x.lineWidth = w; x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke();
    if (d > 0) { br(ex, ey, a - 0.45 - r() * 0.2, len * 0.72, w * 0.72, d - 1); br(ex, ey, a + 0.45 + r() * 0.2, len * 0.72, w * 0.72, d - 1); }
    else { x.fillStyle = col; x.beginPath(); x.arc(ex, ey, w * 0.7, 0, TAU); x.fill(); }
  };
  br(cx, cy, -Math.PI / 2 + (r() - 0.5) * 0.3, s * 0.55, Math.max(2, s * 0.16), 2);
}
function seaweed(x, cx, cy, s, r) {
  for (let i = 0; i < 3; i++) {
    const bx = cx + (i - 1) * s * 0.18, h = s * (0.7 + r() * 0.6), sw = (r() - 0.5) * s * 0.4;
    const g = x.createLinearGradient(0, cy, 0, cy - h); g.addColorStop(0, '#2f8a3a'); g.addColorStop(1, '#8fe36a');
    x.fillStyle = g; x.beginPath(); x.moveTo(bx - 3, cy); x.quadraticCurveTo(bx + sw, cy - h * 0.6, bx + sw * 0.4, cy - h); x.quadraticCurveTo(bx + sw + 4, cy - h * 0.5, bx + 3, cy); x.fill();
  }
}
function starfish(x, cx, cy, s, rot) {
  x.save(); x.translate(cx, cy); x.rotate(rot);
  x.fillStyle = '#ff9a3c'; x.strokeStyle = '#a3420f'; x.lineWidth = 1.4; x.lineJoin = 'round';
  x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, l = i % 2 ? s * 0.42 : s; x.lineTo(Math.cos(a) * l, Math.sin(a) * l); } x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#ffd6a6'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; x.beginPath(); x.arc(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.09, 0, TAU); x.fill(); }
  x.restore();
}
const CORAL_COLS = ['#ff6fa5', '#ff9e4a', '#b06dff', '#ffd23f', '#ff5d73'];

// ---------- A: askıda resif adacığı ----------
function make(kind, w, tier = 1, seed = 1, side = 1) {
  const r = rng(seed * 9973 + w), P = ROCK[tier] || ROCK[1], lw = Math.max(1.6, w * 0.022);
  if (kind === 'ledge') return makeLedge(w, tier, seed, side);
  const cw = w * 1.5, ch = w * 1.45, [c, x] = canvasFor(cw, ch);
  const cx = cw / 2, cy = ch * 0.56, hit = [];
  let mouth = null;
  x.lineJoin = 'round';
  // alt gölge
  x.fillStyle = 'rgba(0,20,50,.18)'; x.beginPath(); x.ellipse(cx, cy + w * 0.36, w * 0.48, w * 0.08, 0, 0, TAU); x.fill();
  if (kind === 'cave') {
    // mağara: kubbe gövde + alttan açılan parlak ağız
    boulder(x, cx - w * 0.3, cy + w * 0.08, w * 0.24, w * 0.28, P, r, lw);
    boulder(x, cx + w * 0.3, cy + w * 0.08, w * 0.24, w * 0.28, P, r, lw);
    boulder(x, cx, cy - w * 0.1, w * 0.48, w * 0.3, P, r, lw);
    const mg = x.createRadialGradient(cx, cy + w * 0.12, 1, cx, cy + w * 0.12, w * 0.24);
    mg.addColorStop(0, '#d9ffff'); mg.addColorStop(0.35, '#6fe7ff'); mg.addColorStop(1, '#155a9a');
    x.fillStyle = mg; x.strokeStyle = P.line; x.lineWidth = lw;
    x.beginPath(); x.moveTo(cx - w * 0.2, cy + w * 0.3); x.lineTo(cx - w * 0.2, cy + w * 0.08); x.quadraticCurveTo(cx - w * 0.2, cy - w * 0.12, cx, cy - w * 0.12); x.quadraticCurveTo(cx + w * 0.2, cy - w * 0.12, cx + w * 0.2, cy + w * 0.08); x.lineTo(cx + w * 0.2, cy + w * 0.3); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(cx + (r() - 0.5) * w * 0.25, cy + w * (0.0 + r() * 0.2), 1 + r() * 1.5, 0, TAU); x.fill(); }
    mossCap(x, cx, cy - w * 0.3, w * 0.48, w * 0.12, tier, r, lw);
    hit.push({ x: -w * 0.32, y: w * 0.05, r: w * 0.2 }, { x: w * 0.32, y: w * 0.05, r: w * 0.2 }, { x: 0, y: -w * 0.18, r: w * 0.28 });
    mouth = { x: 0, y: w * 0.2, r: w * 0.17 };
  } else {
    // yosunlu kaya kümesi
    const parts = [[-0.3, 0.06, 0.22, 0.2], [0.3, 0.05, 0.21, 0.19], [0, -0.04, 0.42, 0.3], [0.1, 0.16, 0.16, 0.13]];
    for (const [px, py, rx, ry] of parts) boulder(x, cx + px * w, cy + py * w, rx * w, ry * w, P, r, lw);
    if (kind === 'spiky') { // altı sivri uçlu, havada asılı ada
      x.fillStyle = P.lo; x.strokeStyle = P.line; x.lineWidth = lw;
      for (const [px, len] of [[-0.18, 0.32], [0.06, 0.42], [0.26, 0.26]]) {
        x.beginPath(); x.moveTo(cx + (px - 0.09) * w, cy + w * 0.16); x.lineTo(cx + px * w, cy + (0.16 + len) * w); x.lineTo(cx + (px + 0.09) * w, cy + w * 0.16); x.closePath(); x.fill(); x.stroke();
      }
    }
    mossCap(x, cx, cy - w * 0.2, w * 0.46, w * 0.12, tier, r, lw);
    hit.push({ x: -w * 0.28, y: w * 0.05, r: w * 0.19 }, { x: w * 0.28, y: w * 0.05, r: w * 0.18 }, { x: 0, y: -w * 0.06, r: w * 0.3 });
    if (kind === 'spiky') hit.push({ x: w * 0.05, y: w * 0.36, r: w * 0.09 });
  }
  // üstteki mercan ve bitkiler
  const top = cy - w * (kind === 'cave' ? 0.42 : 0.34);
  seaweed(x, cx + w * 0.02, top + w * 0.08, w * 0.42, r);
  tubeCoral(x, cx - w * 0.24, top + w * 0.08, w * 0.17, CORAL_COLS[Math.floor(r() * 3)], r, lw);
  branchCoral(x, cx + w * 0.22, top + w * 0.1, w * 0.42, CORAL_COLS[1 + Math.floor(r() * 4)], r, lw);
  if (r() < 0.5) branchCoral(x, cx - w * 0.05, top + w * 0.06, w * 0.26, CORAL_COLS[Math.floor(r() * 5)], r, lw);
  if (r() < 0.75) starfish(x, cx + (r() < 0.5 ? -1 : 1) * w * 0.26, cy + w * 0.06, w * 0.07, r() * TAU);
  return { img: c, ox: cx, oy: cy, hit, mouth, w, cw, ch };
}

// ---------- B: kenardan içeri uzanan kayalık çıkıntısı ----------
function makeLedge(len, tier, seed, side) {
  const r = rng(seed * 7919 + len), P = ROCK[tier] || ROCK[1], lw = Math.max(1.6, len * 0.02);
  const th = len * 0.62, cw = len * 1.25, ch = th * 1.9, [c, x] = canvasFor(cw, ch);
  // sol kenara dayalı çiz, sağ taraf için aynala
  x.save(); if (side > 0) { x.translate(cw, 0); x.scale(-1, 1); }
  const cy = ch * 0.55, hit = [];
  x.lineJoin = 'round';
  const steps = [[0.0, 0.0, 0.5, 0.5], [0.42, 0.02, 0.36, 0.38], [0.74, 0.06, 0.24, 0.26]];
  for (const [px, py, rx, ry] of steps) boulder(x, px * len, cy + py * th, rx * len, ry * th * 1.1, P, r, lw);
  mossCap(x, len * 0.36, cy - th * 0.36, len * 0.5, th * 0.2, tier, r, lw);
  tubeCoral(x, len * 0.2, cy - th * 0.42, len * 0.12, CORAL_COLS[Math.floor(r() * 3)], r, lw);
  branchCoral(x, len * 0.6, cy - th * 0.3, len * 0.26, CORAL_COLS[1 + Math.floor(r() * 4)], r, lw);
  if (r() < 0.6) starfish(x, len * 0.45, cy + th * 0.1, len * 0.06, r() * TAU);
  x.restore();
  // çarpışma: kenardan uca doğru daireler (dünya koordinatında x, kenara göre)
  for (const [px, rr] of [[0.05, 0.42], [0.42, 0.3], [0.72, 0.2]]) hit.push({ x: side > 0 ? -px * len : px * len, y: 0, r: rr * th });
  return { img: c, ox: side > 0 ? cw : 0, oy: cy, hit, mouth: null, w: len, cw, ch, side };
}

// ---------- Arka plan silüetleri (çarpışmasız, uzak katman) ----------
function silhouette(kind, w, seed, col) {
  const r = rng(seed * 6007 + w);
  if (kind === 'school') { // balık sürüsü
    const [c, x] = canvasFor(w, w * 0.5); x.fillStyle = col;
    for (let i = 0; i < 14; i++) { const fx = r() * w * 0.85 + 6, fy = r() * w * 0.4 + 5, s = 3 + r() * 3; x.beginPath(); x.ellipse(fx, fy, s * 1.6, s * 0.7, 0, 0, TAU); x.fill(); x.beginPath(); x.moveTo(fx + s * 1.4, fy); x.lineTo(fx + s * 2.4, fy - s * 0.7); x.lineTo(fx + s * 2.4, fy + s * 0.7); x.fill(); }
    return { img: c, ox: w / 2, oy: w * 0.25, cw: w, ch: w * 0.5 };
  }
  if (kind === 'wreck') { // batık gemi silüeti
    const [c, x] = canvasFor(w, w * 0.8); x.fillStyle = col; x.translate(w / 2, w * 0.5); x.rotate(-0.15);
    x.beginPath(); x.moveTo(-w * 0.45, -w * 0.05); x.quadraticCurveTo(-w * 0.35, w * 0.22, 0, w * 0.24); x.quadraticCurveTo(w * 0.35, w * 0.22, w * 0.45, -w * 0.08); x.closePath(); x.fill();
    x.fillRect(-w * 0.05, -w * 0.45, w * 0.035, w * 0.42); x.fillRect(-w * 0.25, -w * 0.3, w * 0.03, w * 0.28);
    x.beginPath(); x.moveTo(-w * 0.015, -w * 0.42); x.quadraticCurveTo(w * 0.15, -w * 0.32, -w * 0.015, -w * 0.18); x.fill();
    return { img: c, ox: w / 2, oy: w * 0.4, cw: w, ch: w * 0.8 };
  }
  // resif / kaya kümesi silüeti
  const h = w * (0.7 + r() * 0.5), [c, x] = canvasFor(w, h); x.fillStyle = col;
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const bx = w * (0.15 + r() * 0.7), rr = w * (0.14 + r() * 0.16), by = h - rr * (0.6 + r() * 1.6); x.beginPath(); x.arc(bx, by, rr, 0, TAU); x.fill(); }
  x.fillRect(w * 0.1, h * 0.75, w * 0.8, h * 0.25);
  x.strokeStyle = col; x.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const bx = w * (0.2 + r() * 0.6), by = h * (0.25 + r() * 0.2); x.lineWidth = 4; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(bx, by + 14); x.lineTo(bx + k * 9, by - 4 - r() * 10); x.stroke(); } }
  return { img: c, ox: w / 2, oy: h / 2, cw: w, ch: h };
}

// ---------- Ön plan: kenarlardan sarkan mercan / yosun (çarpışmasız, hızlı katman) ----------
function frond(w, seed, side) {
  const r = rng(seed * 4241 + w), h = w * 1.6, [c, x] = canvasFor(w, h);
  x.save(); if (side > 0) { x.translate(w, 0); x.scale(-1, 1); }
  x.globalAlpha = 0.9;
  const col = CORAL_COLS[Math.floor(r() * CORAL_COLS.length)];
  if (r() < 0.5) branchCoral(x, w * 0.15, h * 0.95, w * 0.9, col, r, 3);
  else { const g = x.createLinearGradient(0, h, w, 0); g.addColorStop(0, '#1e6b3d'); g.addColorStop(1, '#5fd17a'); x.fillStyle = g; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(0, h * (0.3 + i * 0.25)); x.quadraticCurveTo(w * (0.5 + r() * 0.4), h * (0.2 + i * 0.22), w * (0.7 + r() * 0.3), h * (0.05 + i * 0.25)); x.quadraticCurveTo(w * 0.4, h * (0.35 + i * 0.22), 0, h * (0.42 + i * 0.25)); x.fill(); } }
  x.restore();
  return { img: c, ox: side > 0 ? w : 0, oy: 0, cw: w, ch: h };
}

// ---------- Kanyon duvarları (büyük, dekoratif, çarpışmasız) ----------
function canyonEdge(worldY, seed) { // dünya yüksekliğine göre duvar kalınlığı (0..1), tekrar etmeyen dalga
  return 0.55 + 0.25 * Math.sin(worldY * 0.006 + seed) + 0.15 * Math.sin(worldY * 0.017 + seed * 2.3) + 0.05 * Math.sin(worldY * 0.05 + seed * 5.1);
}
function drawCanyon(ctx, W, H, scrollY, amt, tier, maxW) {
  if (amt <= 0.01) return;
  const P = ROCK[tier] || ROCK[1];
  for (const side of [-1, 1]) {
    const seed = side < 0 ? 1.3 : 4.7;
    ctx.save(); ctx.globalAlpha = amt;
    const g = ctx.createLinearGradient(side < 0 ? 0 : W, 0, side < 0 ? maxW : W - maxW, 0);
    g.addColorStop(0, P.lo); g.addColorStop(1, P.mid);
    ctx.fillStyle = g; ctx.strokeStyle = P.line; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(side < 0 ? -4 : W + 4, -10);
    for (let y = -10; y <= H + 20; y += 16) { const d = maxW * canyonEdge(y + scrollY, seed) * amt; ctx.lineTo(side < 0 ? d : W - d, y); }
    ctx.lineTo(side < 0 ? -4 : W + 4, H + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    // duvar üstünde yosun ve mercan noktaları
    for (let y = -((scrollY % 60) + 60); y < H + 60; y += 60) {
      const wy = y + scrollY, d = maxW * canyonEdge(wy, seed) * amt, k = Math.abs(Math.sin(wy * 0.37 + seed)), xx = side < 0 ? d - 4 : W - d + 4;
      ctx.fillStyle = k > 0.5 ? 'rgba(120,220,110,.75)' : CORAL_COLS[Math.floor(k * 10) % CORAL_COLS.length];
      ctx.beginPath(); ctx.ellipse(xx, y, 6 + k * 6, 3 + k * 2, side * 0.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// ---------- Canavar arenası: aşağıdan yükselen kumlu deniz tabanı ----------
function drawSeabed(ctx, W, H, amt, tier, t) {
  if (amt <= 0.01) return;
  const top = H - H * 0.11 * amt;
  ctx.save();
  const g = ctx.createLinearGradient(0, top, 0, H); g.addColorStop(0, tier >= 3 ? '#4b4a6e' : '#e9c98e'); g.addColorStop(1, tier >= 3 ? '#26263f' : '#b88a4e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, top + Math.sin(x * 0.03) * 6 + Math.sin(x * 0.11) * 2);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  // ışık lekeleri
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = 0; i < 6; i++) { const x = (i * 0.19 % 1) * W + Math.sin(t + i) * 6; ctx.beginPath(); ctx.ellipse(x, top + 18 + (i % 3) * 10, 18, 4, 0, 0, TAU); ctx.fill(); }
  // mercanlar
  const r = rng(77);
  for (let i = 0; i < 7; i++) { const x = (i + 0.5) / 7 * W + (r() - 0.5) * 30; if (Math.abs(x - W / 2) < W * 0.12) continue; branchCoral(ctx, x, top + 8, 34 + r() * 20, CORAL_COLS[i % CORAL_COLS.length], r, 3); }
  ctx.restore();
}

window.OktoReef = { make, silhouette, frond, drawCanyon, drawSeabed, canyonEdge };
})();

/* OKTO karakteri — açılış ekranı, oyun ve mağaza aynı çizimi kullanır.
   OktoChar.draw(ctx, x, y, R, t, o)
     o.palette   : renk kimliği (PALETTES)
     o.accessory : aksesuar kimliği (goggles, none, flower, bow, sunglasses, pirate, crown)
     o.expr      : { look, lookY, sly, wink, blink, wave, dizzy, ouch }  (0..1 değerleri)
     o.trailX/Y  : hareketin tersine dokunaç savrulması (-1..1)
     o.bob, o.rot: hafif zıplama ve eğilme
   OktoChar.CATALOG: mağazadaki renkler ve aksesuarlar */
(() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

const PALETTES = {
  pink:   { body: '#ff7eb6', light: '#ffc6e0', dark: '#d0438a', line: '#7a1c4f', sucker: '#ffe3f0', suckerIn: '#ff9fc9', blush: '255,70,130' },
  purple: { body: '#a463f2', light: '#d2a8ff', dark: '#6b35b8', line: '#3d1a73', sucker: '#f5c9ff', suckerIn: '#d78ee8', blush: '255,105,180' },
  ocean:  { body: '#4aa8ff', light: '#b5dcff', dark: '#1d6fd1', line: '#0b3570', sucker: '#e0f0ff', suckerIn: '#a0cfff', blush: '255,110,160' },
  mint:   { body: '#5fe0b5', light: '#c2f9e6', dark: '#22a37a', line: '#0d5a42', sucker: '#e2fff4', suckerIn: '#9ff0d0', blush: '255,120,150' },
  sunny:  { body: '#ffc93c', light: '#fff1b0', dark: '#e09500', line: '#7a4a00', sucker: '#fff8d6', suckerIn: '#ffe08a', blush: '255,110,110' },
  coral:  { body: '#ff6a5c', light: '#ffc0b5', dark: '#d03a30', line: '#6e1510', sucker: '#ffe2dc', suckerIn: '#ffa89c', blush: '255,200,80' },
  galaxy: { body: '#4a35a0', light: '#8f78f0', dark: '#1d1350', line: '#0c0824', sucker: '#cfc2ff', suckerIn: '#9a86ef', blush: '255,90,210', stars: true },
};

const CATALOG = {
  colors: [
    { id: 'pink', name: 'Pembe', price: 0 },
    { id: 'purple', name: 'Mor', price: 60 },
    { id: 'ocean', name: 'Okyanus', price: 90 },
    { id: 'mint', name: 'Nane', price: 120 },
    { id: 'sunny', name: 'Güneş', price: 160 },
    { id: 'coral', name: 'Mercan', price: 220 },
    { id: 'galaxy', name: 'Galaksi', price: 400 },
  ],
  accessories: [
    { id: 'goggles', name: 'Dalış Gözlüğü', price: 0 },
    { id: 'none', name: 'Aksesuarsız', price: 0 },
    { id: 'flower', name: 'Çiçek', price: 50 },
    { id: 'bow', name: 'Fiyonk', price: 80 },
    { id: 'sunglasses', name: 'Güneş Gözlüğü', price: 150 },
    { id: 'pirate', name: 'Korsan Şapkası', price: 260 },
    { id: 'crown', name: 'Taç', price: 500 },
  ],
};

// ---------- Dokunaçlar ----------
function tentaclePts(bx, by, a0, L, curlDir, curl, phase, t, wave = 1) {
  const N = 22, pts = [];
  let x = bx, y = by, a = a0;
  for (let k = 0; k <= N; k++) {
    const s = k / N;
    pts.push([x, y, a, s]);
    const kappa = curlDir * (0.35 + curl * Math.pow(s, 3.2) * 9) + wave * 1.4 * Math.sin(t * TAU / 3 + phase - s * 4) * (0.3 + s);
    a += kappa / N;
    x += Math.cos(a) * L / N; y += Math.sin(a) * L / N;
  }
  return pts;
}
function tentaclePath(ctx, pts, w0) {
  const N = pts.length - 1, w = s => w0 * (1 - 0.82 * s);
  ctx.beginPath();
  for (let k = 0; k <= N; k++) { const [x, y, a, s] = pts[k]; ctx.lineTo(x + Math.cos(a - Math.PI / 2) * w(s), y + Math.sin(a - Math.PI / 2) * w(s)); }
  const [tx, ty, ta, ts] = pts[N];
  ctx.arc(tx, ty, w(ts), ta - Math.PI / 2, ta + Math.PI / 2);
  for (let k = N; k >= 0; k--) { const [x, y, a, s] = pts[k]; ctx.lineTo(x + Math.cos(a + Math.PI / 2) * w(s), y + Math.sin(a + Math.PI / 2) * w(s)); }
  ctx.closePath();
}
function suckers(ctx, pts, w0, side, P, small) {
  const N = pts.length - 1;
  for (let k = 4; k < N - 1; k += 2) {
    const [x, y, a, s] = pts[k], w = w0 * (1 - 0.82 * s);
    const ox = x + Math.cos(a + side * Math.PI / 2) * w * 0.5, oy = y + Math.sin(a + side * Math.PI / 2) * w * 0.5;
    const r = w * 0.36;
    ctx.fillStyle = P.sucker; ctx.beginPath(); ctx.ellipse(ox, oy, r, r * 0.85, a, 0, TAU); ctx.fill();
    if (!small) { ctx.fillStyle = P.suckerIn; ctx.beginPath(); ctx.ellipse(ox, oy, r * 0.45, r * 0.4, a, 0, TAU); ctx.fill(); }
  }
}

// ---------- Aksesuarlar ----------
function gogglesStrap(ctx, R) {
  ctx.strokeStyle = '#1c8fa3'; ctx.lineWidth = R * 0.17;
  ctx.beginPath(); ctx.moveTo(-1.1 * R, -0.42 * R); ctx.quadraticCurveTo(0, -0.78 * R, 1.1 * R, -0.42 * R); ctx.stroke();
  ctx.strokeStyle = '#3fd2e6'; ctx.lineWidth = R * 0.1;
  ctx.beginPath(); ctx.moveTo(-1.1 * R, -0.44 * R); ctx.quadraticCurveTo(0, -0.8 * R, 1.1 * R, -0.44 * R); ctx.stroke();
}
function gogglesLenses(ctx, R, lw) {
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 0.3 * R, -0.6 * R + (sx > 0 ? -0.02 * R : 0)); ctx.rotate(sx * 0.12);
    ctx.fillStyle = '#ff9f1c'; ctx.strokeStyle = '#a0520a'; ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.27, R * 0.21, 0, 0, TAU); ctx.fill(); ctx.stroke();
    const gg = ctx.createLinearGradient(0, -R * 0.16, 0, R * 0.16);
    gg.addColorStop(0, '#d9fbff'); gg.addColorStop(1, '#5cc8e8');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.2, R * 0.145, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.ellipse(-R * 0.07, -R * 0.05, R * 0.07, R * 0.03, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#ff9f1c'; ctx.strokeStyle = '#a0520a'; ctx.lineWidth = lw * 0.6;
  ctx.beginPath(); ctx.roundRect(-0.07 * R, -0.66 * R, 0.14 * R, 0.08 * R, 0.03 * R); ctx.fill(); ctx.stroke();
}
function flower(ctx, R, lw, t) {
  ctx.save(); ctx.translate(0.62 * R, -0.66 * R); ctx.rotate(0.3 + Math.sin(t * 2) * 0.05);
  ctx.fillStyle = '#ff4f7b'; ctx.strokeStyle = '#a3123a'; ctx.lineWidth = lw * 0.7;
  for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate(i * TAU / 5); ctx.beginPath(); ctx.ellipse(0, -0.17 * R, 0.13 * R, 0.17 * R, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, 0.09 * R, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function bow(ctx, R, lw) {
  ctx.save(); ctx.translate(-0.55 * R, -0.78 * R); ctx.rotate(-0.35);
  ctx.fillStyle = '#ff3d6e'; ctx.strokeStyle = '#8a0f2e'; ctx.lineWidth = lw * 0.8; ctx.lineJoin = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.32 * R, -0.28 * R, s * 0.36 * R, 0); ctx.quadraticCurveTo(s * 0.32 * R, 0.26 * R, 0, 0); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.ellipse(-0.2 * R, -0.07 * R, 0.07 * R, 0.035 * R, -0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff3d6e'; ctx.beginPath(); ctx.arc(0, 0, 0.08 * R, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function sunglasses(ctx, R, lw, wink = 0) {
  const y = 0.06 * R;
  ctx.fillStyle = '#16131f'; ctx.strokeStyle = '#000'; ctx.lineWidth = lw * 0.9;
  for (const sx of [-1, 1]) {
    // göz kırpınca sol cam hafifçe yukarı kalkar (gözlüğün üstünden göz kırpma)
    const lift = sx < 0 ? wink * 0.06 * R : 0;
    ctx.save(); ctx.translate(sx * 0.36 * R, y - lift); ctx.rotate(sx < 0 ? -wink * 0.12 : 0);
    ctx.beginPath(); ctx.roundRect(-0.29 * R, -0.25 * R, 0.58 * R, 0.46 * R, 0.16 * R); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-0.1 * R, -0.12 * R, 0.09 * R, 0.04 * R, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16131f';
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(-0.08 * R, y - 0.1 * R); ctx.quadraticCurveTo(0, y - 0.16 * R, 0.08 * R, y - 0.1 * R); ctx.lineWidth = lw * 1.4; ctx.stroke();
}
function pirate(ctx, R, lw) {
  ctx.save(); ctx.translate(0, -0.78 * R); ctx.rotate(-0.08);
  ctx.fillStyle = '#1d1b26'; ctx.strokeStyle = '#000'; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-1.0 * R, 0.08 * R); ctx.quadraticCurveTo(-0.7 * R, -0.25 * R, -0.45 * R, -0.42 * R);
  ctx.quadraticCurveTo(0, -0.72 * R, 0.45 * R, -0.42 * R); ctx.quadraticCurveTo(0.7 * R, -0.25 * R, 1.0 * R, 0.08 * R);
  ctx.quadraticCurveTo(0, -0.12 * R, -1.0 * R, 0.08 * R); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffcf33'; ctx.lineWidth = lw * 0.9;
  ctx.beginPath(); ctx.moveTo(-0.92 * R, 0.03 * R); ctx.quadraticCurveTo(0, -0.17 * R, 0.92 * R, 0.03 * R); ctx.stroke();
  // kuru kafa
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -0.36 * R, 0.11 * R, 0, TAU); ctx.fill();
  ctx.fillRect(-0.06 * R, -0.3 * R, 0.12 * R, 0.07 * R);
  ctx.fillStyle = '#1d1b26'; ctx.beginPath(); ctx.arc(-0.04 * R, -0.37 * R, 0.03 * R, 0, TAU); ctx.arc(0.04 * R, -0.37 * R, 0.03 * R, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = lw * 0.7;
  ctx.beginPath(); ctx.moveTo(-0.17 * R, -0.18 * R); ctx.lineTo(0.17 * R, -0.08 * R); ctx.moveTo(0.17 * R, -0.18 * R); ctx.lineTo(-0.17 * R, -0.08 * R); ctx.stroke();
  ctx.restore();
}
function crown(ctx, R, lw, t) {
  ctx.save(); ctx.translate(0.05 * R, -0.86 * R); ctx.rotate(0.12);
  const g = ctx.createLinearGradient(0, -0.4 * R, 0, 0.1 * R);
  g.addColorStop(0, '#fff3a0'); g.addColorStop(1, '#f2a900');
  ctx.fillStyle = g; ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = lw * 0.9; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-0.45 * R, 0.08 * R); ctx.lineTo(-0.5 * R, -0.3 * R); ctx.lineTo(-0.25 * R, -0.12 * R); ctx.lineTo(0, -0.4 * R);
  ctx.lineTo(0.25 * R, -0.12 * R); ctx.lineTo(0.5 * R, -0.3 * R); ctx.lineTo(0.45 * R, 0.08 * R); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const [x, c] of [[-0.25, '#ff3d6e'], [0, '#3fd2e6'], [0.25, '#7be35a']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * R, -0.02 * R, 0.06 * R, 0, TAU); ctx.fill(); ctx.stroke(); }
  const sp = (Math.sin(t * 3) * 0.5 + 0.5);
  ctx.fillStyle = `rgba(255,255,255,${sp})`; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 0.02 * R : 0.08 * R; ctx.lineTo(0.0 + Math.cos(a) * r, -0.4 * R + Math.sin(a) * r); }
  ctx.fill();
  ctx.restore();
}

// ---------- Karakter ----------
function draw(ctx, cx, cy, R, t, o = {}) {
  const P = PALETTES[o.palette] || PALETTES.pink;
  const acc = o.accessory || 'goggles';
  const e = Object.assign({ look: 0, lookY: 0, sly: 0, wink: 0, blink: 0, wave: 0, dizzy: 0, ouch: 0 }, o.expr || {});
  const trailX = o.trailX || 0, trailY = o.trailY || 0, bob = o.bob || 0;
  const small = R < 40; // küçük çizimde ayrıntıyı azalt
  const sq = 1 + bob * 0.025;

  ctx.save();
  ctx.translate(cx, cy + bob * R * 0.07);
  ctx.rotate((o.rot || 0) + e.wink * 0.06);
  ctx.scale(1 / sq, sq);
  const lw = Math.max(R * 0.055, 0.9);

  const stretch = 1 + clamp(trailY, -0.4, 1) * 0.25;
  const back = [
    [-0.62, 0.42, Math.PI * 0.92, 1.2, 1, 1.15, 0.0, 0.3],
    [0.62, 0.42, Math.PI * 0.08, 1.2, -1, 1.15, 1.2, 0.3],
    [-0.45, 0.58, Math.PI * 0.72, 1.15, 1, 1.1, 2.1, 0.31],
    [0.45, 0.58, Math.PI * 0.28, 1.15, -1, 1.1, 3.0, 0.31],
    [-0.18, 0.66, Math.PI * 0.57, 1.05, 1, 1.0, 4.0, 0.31],
    [0.18, 0.66, Math.PI * 0.43, 1.05, -1, 1.0, 5.0, 0.31],
  ];
  // hızla yukarı yüzerken dokunaçlar aşağı toplanır, yana giderken tersine savrulur
  const gather = clamp(trailY, 0, 1) * 0.35;
  const tent = back.map(([bx, by, a, L, d, c, ph, w]) => ({
    pts: tentaclePts(bx * R, by * R, a + (Math.PI / 2 - a) * gather - trailX * 0.55, L * R * stretch, d, c * (1 - gather * 0.6), ph, t, 0.8),
    w: w * R, side: d,
  }));
  const fl = { pts: tentaclePts(-0.3 * R, 0.66 * R, Math.PI * 0.6 - trailX * 0.4, 0.85 * R * stretch, -1, 1.1, 0.6, t, 0.6), w: 0.26 * R, side: -1 };
  const wv = smooth(e.wave);
  const waveA = Math.PI * 0.36 - wv * (Math.PI * 0.62) + Math.sin(t * 9 * TAU / 6) * 0.3 * wv - trailX * 0.5 * (1 - wv);
  tent.push({ pts: tentaclePts(0.62 * R, 0.4 * R, waveA, 0.95 * R * stretch, 1, 1.1 - wv * 0.55, 2.4, t, 0.6 * (1 - wv)), w: 0.26 * R, side: 1 });

  const headPath = () => {
    ctx.beginPath(); ctx.ellipse(0, -0.08 * R, R * 1.0, R * 0.96, 0, 0, TAU);
    ctx.moveTo(R * 0.86, 0.5 * R); ctx.ellipse(0, 0.5 * R, R * 0.86, R * 0.36, 0, 0, TAU);
  };
  const bodyGrad = () => {
    const g = ctx.createRadialGradient(-0.35 * R, -0.55 * R, R * 0.1, 0, 0.1 * R, R * 1.9);
    g.addColorStop(0, P.light); g.addColorStop(0.45, P.body); g.addColorStop(1, P.dark); return g;
  };

  ctx.lineJoin = 'round';
  ctx.strokeStyle = P.line; ctx.lineWidth = lw * 2;
  for (const tt of tent) { tentaclePath(ctx, tt.pts, tt.w); ctx.stroke(); }
  headPath(); ctx.stroke();
  const bg = bodyGrad(); ctx.fillStyle = bg;
  for (const tt of tent) { tentaclePath(ctx, tt.pts, tt.w); ctx.fill(); }
  headPath(); ctx.fill();
  for (const tt of tent) suckers(ctx, tt.pts, tt.w, tt.side, P, small);
  ctx.strokeStyle = P.line; ctx.lineWidth = lw * 2; tentaclePath(ctx, fl.pts, fl.w); ctx.stroke(); ctx.fillStyle = bg; ctx.fill(); suckers(ctx, fl.pts, fl.w, fl.side, P, small);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0.52 * R, R * 0.72, R * 0.22, 0, 0, TAU); ctx.fill();

  // baş üzerindeki desenler
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, -0.08 * R, R * 1.0, R * 0.96, 0, 0, TAU); ctx.clip();
  if (P.stars) {
    for (let i = 0; i < 14; i++) {
      const x = (Math.sin(i * 12.9898) * 0.5) * 1.8 * R, y = (Math.cos(i * 78.233) * 0.5) * 1.6 * R - 0.2 * R, tw = 0.5 + 0.5 * Math.sin(t * 3 + i);
      ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.6})`; ctx.beginPath(); ctx.arc(x, y, (0.015 + 0.02 * (i % 3) / 2) * R, 0, TAU); ctx.fill();
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    [[0.55, -0.35, 0.09], [0.7, -0.05, 0.06], [-0.72, -0.2, 0.07], [0.38, -0.82, 0.06]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x * R, y * R, r * R, 0, TAU); ctx.fill(); });
  }
  const hg = ctx.createRadialGradient(-0.42 * R, -0.62 * R, 0, -0.42 * R, -0.62 * R, R * 0.5);
  hg.addColorStop(0, 'rgba(255,255,255,.55)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(-0.42 * R, -0.62 * R, R * 0.5, R * 0.32, -0.5, 0, TAU); ctx.fill();
  if (acc === 'goggles') gogglesStrap(ctx, R);
  ctx.restore();
  ctx.strokeStyle = P.line; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.ellipse(0, -0.08 * R, R * 1.0, R * 0.96, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
  if (acc === 'goggles') gogglesLenses(ctx, R, lw);

  // yanaklar
  for (const sx of [-1, 1]) {
    const g = ctx.createRadialGradient(sx * 0.62 * R, 0.36 * R, 0, sx * 0.62 * R, 0.36 * R, 0.2 * R);
    g.addColorStop(0, `rgba(${P.blush},.6)`); g.addColorStop(1, `rgba(${P.blush},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx * 0.62 * R, 0.36 * R, 0.2 * R, 0, TAU); ctx.fill();
  }

  // gözler
  const ey = 0.06 * R;
  ctx.lineCap = 'round';
  const shades = acc === 'sunglasses' && e.dizzy < 0.5 && e.ouch < 0.5;
  for (const sx of [-1, 1]) {
    const ex = sx * 0.36 * R;
    if (shades) continue; // gözler camın arkasında
    if (e.dizzy > 0.5) { // sersem: sarmal gözler
      ctx.strokeStyle = P.line; ctx.lineWidth = lw * 0.9; ctx.beginPath();
      for (let a = 0; a < TAU * 2.2; a += 0.3) { const r = a / (TAU * 2.2) * 0.2 * R, aa = a * sx + t * 6; ctx.lineTo(ex + Math.cos(aa) * r, ey + Math.sin(aa) * r); }
      ctx.stroke(); continue;
    }
    if (e.ouch > 0.5) { // acı: > < gözler
      ctx.strokeStyle = P.line; ctx.lineWidth = lw * 1.2; ctx.beginPath();
      ctx.moveTo(ex - sx * 0.15 * R, ey - 0.12 * R); ctx.lineTo(ex + sx * 0.12 * R, ey); ctx.lineTo(ex - sx * 0.15 * R, ey + 0.12 * R); ctx.stroke(); continue;
    }
    const closedHappy = sx < 0 ? e.wink : 0;
    if (closedHappy > 0.5) {
      ctx.strokeStyle = P.line; ctx.lineWidth = lw * 1.1;
      ctx.beginPath(); ctx.moveTo(ex - 0.2 * R, ey + 0.04 * R); ctx.quadraticCurveTo(ex, ey - 0.16 * R, ex + 0.2 * R, ey + 0.04 * R); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex - 0.2 * R, ey + 0.04 * R); ctx.lineTo(ex - 0.27 * R, ey - 0.02 * R); ctx.stroke();
      continue;
    }
    ctx.save();
    ctx.beginPath(); ctx.ellipse(ex, ey, 0.25 * R, 0.3 * R, 0, 0, TAU);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = lw * 0.8; ctx.stroke();
    ctx.clip();
    const px = ex + e.look * 0.07 * R + (sx > 0 ? -0.01 : 0.01) * R, py = ey + 0.04 * R + e.lookY * 0.06 * R;
    const ig = ctx.createRadialGradient(px, py + 0.06 * R, 0, px, py, 0.2 * R);
    ig.addColorStop(0, '#7d4bc4'); ig.addColorStop(0.6, '#3a1c6b'); ig.addColorStop(1, '#1a0b33');
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(px, py, 0.19 * R, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0d0520'; ctx.beginPath(); ctx.arc(px, py, 0.1 * R, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px + 0.07 * R, py - 0.08 * R, 0.07 * R, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(px - 0.07 * R, py + 0.08 * R, 0.035 * R, 0, TAU); ctx.fill();
    const lidAmt = Math.max(e.blink, e.sly * 0.22);
    if (lidAmt > 0.01) {
      ctx.fillStyle = P.body; ctx.fillRect(ex - 0.3 * R, ey - 0.32 * R, 0.6 * R, 0.62 * R * lidAmt);
      ctx.strokeStyle = P.line; ctx.lineWidth = lw * 0.9;
      ctx.beginPath(); ctx.moveTo(ex - 0.3 * R, ey - 0.32 * R + 0.62 * R * lidAmt); ctx.lineTo(ex + 0.3 * R, ey - 0.32 * R + 0.62 * R * lidAmt); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = P.line; ctx.lineWidth = lw * 0.7;
    ctx.beginPath(); ctx.moveTo(ex + sx * 0.2 * R, ey - 0.2 * R); ctx.lineTo(ex + sx * 0.29 * R, ey - 0.27 * R); ctx.stroke();
  }
  if (shades) sunglasses(ctx, R, lw, e.wink);
  // kaşlar
  ctx.strokeStyle = P.line; ctx.lineWidth = lw * 1.15;
  for (const sx of [-1, 1]) {
    const raise = (sx > 0 ? e.wink * 0.1 : -e.wink * 0.02) + e.ouch * 0.04;
    const tilt = sx * (e.sly * 0.25) - (sx > 0 ? e.wink * 0.2 : 0) - sx * e.ouch * 0.3;
    ctx.save(); ctx.translate(sx * 0.36 * R, -0.33 * R - raise * R); ctx.rotate(tilt);
    ctx.beginPath(); ctx.moveTo(-0.13 * R, 0.02 * R); ctx.quadraticCurveTo(0, -0.05 * R, 0.13 * R, 0.02 * R); ctx.stroke();
    ctx.restore();
  }
  // ağız
  const my = 0.4 * R;
  if (e.dizzy > 0.5 || e.ouch > 0.5) {
    ctx.fillStyle = '#5a1436'; ctx.strokeStyle = P.line; ctx.lineWidth = lw * 0.9;
    ctx.beginPath(); ctx.ellipse(0, my + 0.03 * R, 0.08 * R, 0.1 * R, 0, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (e.wink > 0.5) {
    ctx.fillStyle = '#5a1436'; ctx.strokeStyle = P.line; ctx.lineWidth = lw * 0.9;
    ctx.beginPath(); ctx.moveTo(-0.15 * R, my - 0.02 * R); ctx.quadraticCurveTo(0, my + 0.03 * R, 0.17 * R, my - 0.05 * R); ctx.quadraticCurveTo(0.05 * R, my + 0.2 * R, -0.15 * R, my - 0.02 * R); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6f91'; ctx.strokeStyle = '#b8325a'; ctx.lineWidth = lw * 0.6;
    ctx.beginPath(); ctx.ellipse(0.02 * R, my + 0.11 * R, 0.08 * R, 0.07 * R, 0.2, 0, Math.PI); ctx.lineTo(-0.06 * R, my + 0.05 * R); ctx.lineTo(0.1 * R, my + 0.06 * R); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.strokeStyle = P.line; ctx.lineWidth = lw;
    const smirk = e.sly * 0.05;
    ctx.beginPath(); ctx.moveTo(-0.14 * R, my - 0.01 * R + smirk * R * 0.3); ctx.quadraticCurveTo(0.0, my + 0.11 * R, 0.15 * R, my - 0.03 * R - smirk * R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.15 * R, my - 0.03 * R - smirk * R); ctx.lineTo(0.18 * R, my - 0.07 * R - smirk * R); ctx.stroke();
  }
  if (e.wink > 0.05) {
    const sxp = -0.75 * R, syp = -0.25 * R, s = 0.13 * R * e.wink * (1 + 0.2 * Math.sin(t * 20));
    ctx.fillStyle = `rgba(255,240,140,${e.wink})`;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? s * 0.3 : s; ctx.lineTo(sxp + Math.cos(a) * r, syp + Math.sin(a) * r); }
    ctx.fill();
  }
  // baş üstü aksesuarları
  if (acc === 'flower') flower(ctx, R, lw, t);
  else if (acc === 'bow') bow(ctx, R, lw);
  else if (acc === 'pirate') pirate(ctx, R, lw);
  else if (acc === 'crown') crown(ctx, R, lw, t);
  ctx.restore();
}

window.OktoChar = { draw, PALETTES, CATALOG };
})();

/* OKTO — animasyonlu açılış ekranı (tamamı kodla çizilir).
   window.OktoTitle.draw(ctx, W, H, t, opts)  -> sahneyi t (sn) anında çizer
   window.OktoTitle.playRect                  -> son çizimdeki "oyna" düğmesinin alanı
   Tüm hareketler 6 sn'lik döngüdür; GIF/kayıt için kusursuz tekrar eder. */
(() => {
'use strict';
const TAU = Math.PI * 2, LOOP = 6, W0 = TAU / LOOP;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
// a..b aralığında yumuşak açılıp kapanan pencere (0..1)
const win = (t, a, b, f = 0.18) => smooth((t - a) / f) * (1 - smooth((t - (b - f)) / f));
const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- Ahtapot (çizim okto.js'de) ----------
// ---------- Etkileşim: dokunma, parmağı gözle takip, kaçan balıklar ----------
const I = { px: 0, py: 0, pt: -99, react: null, reactT: -99, lastReact: '', laughT: -99, fish: [{ escT: -99, dx: 1, dy: 0 }, { escT: -99, dx: -1, dy: 0 }], parts: [], hits: { okto: null, fish: [] }, now: 0, lastT: 0 };
const REACT_DUR = { spin: 1.1, jump: 1.0, giggle: 1.2, hearts: 1.4 };
const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
function pointer(x, y, t) { I.px = x; I.py = y; I.pt = t; }
function tap(x, y, t) {
  pointer(x, y, t);
  for (let i = 0; i < I.hits.fish.length; i++) { // balık mı?
    const f = I.hits.fish[i], st = I.fish[i];
    if (f && t - st.escT > 3.8 && Math.hypot(x - f.x, y - f.y) < f.r) {
      const d = Math.hypot(f.x - x, f.y - y) || 1;
      st.escT = t; st.dx = (f.x - x) / d || (Math.random() < 0.5 ? -1 : 1); st.dy = (f.y - y) / d - 0.4;
      I.laughT = t; addPart('text', I.hits.okto ? I.hits.okto.x + I.hits.okto.r * 0.6 : x, I.hits.okto ? I.hits.okto.y - I.hits.okto.r * 0.9 : y, 'hihi!');
      for (let k = 0; k < 6; k++) addPart('bubble', f.x, f.y);
      return 'fish';
    }
  }
  const o = I.hits.okto;
  if (o && Math.hypot(x - o.x, y - o.y) < o.r) {
    const kinds = Object.keys(REACT_DUR).filter(k => k !== I.lastReact);
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    I.react = k; I.lastReact = k; I.reactT = t;
    if (k === 'hearts') for (let n = 0; n < 7; n++) addPart('heart', o.x + (Math.random() - 0.5) * o.r, o.y - o.r * 0.5);
    else if (k === 'giggle') addPart('text', o.x + o.r * 0.7, o.y - o.r * 0.9, 'kıkır!');
    else if (k === 'spin') addPart('text', o.x - o.r * 0.9, o.y - o.r, 'vüüü!');
    return 'okto';
  }
  return null;
}
function addPart(kind, x, y, text) {
  I.parts.push({ kind, x, y, text, vx: (Math.random() - 0.5) * 60, vy: kind === 'bubble' ? -60 - Math.random() * 80 : -50 - Math.random() * 40, life: kind === 'text' ? 1.3 : 1.6, s: 0.7 + Math.random() * 0.6 });
}
function drawParts(ctx, dt, u) {
  for (const p of I.parts) { p.life -= dt; p.x += p.vx * dt * u; p.y += p.vy * dt * u; }
  I.parts = I.parts.filter(p => p.life > 0);
  for (const p of I.parts) {
    const a = clamp(p.life, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y);
    if (p.kind === 'heart') {
      ctx.scale(p.s * u, p.s * u); ctx.fillStyle = '#ff4d8d'; ctx.strokeStyle = '#a3123a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-18, -3, -9, -16, 0, -6); ctx.bezierCurveTo(9, -16, 18, -3, 0, 10); ctx.fill(); ctx.stroke();
    } else if (p.kind === 'bubble') {
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.arc(0, 0, 4 * p.s * u, 0, TAU); ctx.stroke();
    } else {
      ctx.font = `700 ${20 * u}px Fredoka, "Trebuchet MS", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.rotate(-0.12); ctx.lineWidth = 5 * u; ctx.strokeStyle = '#0f3d8c'; ctx.strokeText(p.text, 0, 0); ctx.fillStyle = '#fff'; ctx.fillText(p.text, 0, 0);
    }
    ctx.restore();
  }
}

function drawOkto(ctx, cx, cy, R, t, look, abs) {
  const tc = ((t % LOOP) + LOOP) % LOOP;
  // muzip ifade zaman çizelgesi (6 sn döngü)
  const expr = {
    look: Math.sin(clamp((tc - 1.1) / 1.3, 0, 1) * TAU) * win(tc, 1.0, 2.5, 0.2), // önce sola sonra sağa
    sly: win(tc, 1.0, 2.6, 0.25),
    wink: win(tc, 2.75, 4.1, 0.12),
    blink: Math.max(win(tc, 5.05, 5.3, 0.1), win(tc, 0.35, 0.55, 0.08)),
    wave: win(tc, 2.6, 4.4, 0.35),
  };
  let x = cx, y = cy, rot = Math.sin(tc * W0) * 0.04;
  // parmak yakınlarda gezinirken gözleriyle takip eder
  if (abs - I.pt < 2.5) { expr.look = clamp((I.px - cx) / (R * 2.5), -1, 1); expr.lookY = clamp((I.py - cy) / (R * 2.5), -1, 1); expr.sly = 0; }
  // dokunma tepkileri
  const k = (abs - I.reactT) / (REACT_DUR[I.react] || 1);
  if (k >= 0 && k < 1) {
    expr.wink = 1; expr.blink = 0; expr.sly = 0;
    if (I.react === 'spin') { rot += easeOut(k) * TAU; y -= Math.sin(Math.PI * k) * R * 0.45; expr.wave = 1; }
    else if (I.react === 'jump') { y -= Math.abs(Math.sin(k * TAU)) * R * 0.4 * (1 - k * 0.4); expr.wave = Math.sin(Math.PI * k); }
    else if (I.react === 'giggle') { x += Math.sin(abs * 45) * R * 0.06 * (1 - k); rot += Math.sin(abs * 30) * 0.06 * (1 - k); }
    else if (I.react === 'hearts') { y -= Math.sin(Math.PI * k) * R * 0.15; expr.wave = 1; }
  }
  // balık kaçırınca güler
  const lk = (abs - I.laughT) / 1.2;
  if (lk >= 0 && lk < 1) { expr.wink = 1; expr.sly = 0; x += Math.sin(abs * 40) * R * 0.04 * (1 - lk); }
  OktoChar.draw(ctx, x, y, R, tc, { palette: look.palette, accessory: look.accessory, expr, bob: Math.sin(tc * W0 * 3), rot });
  I.hits.okto = { x: cx, y: cy + R * 0.3, r: R * 1.35 };
}
// kaçan balık: hızla uzaklaşır, sonra yolunda yavaşça yeniden belirir
function fishFx(i, bx, by, baseDir, abs, u) {
  const st = I.fish[i], e = abs - st.escT;
  if (e < 0 || e > 3.8) return { x: bx, y: by, dir: baseDir, a: 1 };
  if (e < 2.6) { const d = (e * e * 700 + e * 260) * u; return { x: bx + st.dx * d, y: by + st.dy * d * 0.6, dir: st.dx >= 0 ? 1 : -1, a: 1 }; }
  return { x: bx, y: by, dir: baseDir, a: (e - 2.6) / 1.2 };
}

// ---------- Deniz canlıları ----------
function clownfish(ctx, x, y, s, dir, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  const wag = Math.sin(t * W0 * 12) * 0.3;
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#3b1600'; ctx.lineWidth = 2.2;
  ctx.save(); ctx.translate(-22, 0); ctx.rotate(wag);
  ctx.fillStyle = '#ff7b1c'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(-14, -16, -16, -10); ctx.quadraticCurveTo(-10, 0, -16, 10); ctx.quadraticCurveTo(-14, 16, 4, 0); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#ff7b1c'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 16, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.clip();
  for (const bx of [12, -4, -19]) { ctx.fillStyle = '#1a0a00'; ctx.fillRect(bx - 5, -20, 10, 40); ctx.fillStyle = '#fff'; ctx.fillRect(bx - 3.5, -20, 7, 40); }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 16, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#ff9a4d'; ctx.beginPath(); ctx.ellipse(-2, -16, 10, 5, -0.3, Math.PI, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(16, -3, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(17.5, -3, 3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(18.5, -4.5, 1.1, 0, TAU); ctx.fill();
  ctx.restore();
}
function blueTang(ctx, x, y, s, dir, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  const wag = Math.sin(t * W0 * 10 + 1) * 0.28;
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#06204d'; ctx.lineWidth = 2.2;
  ctx.save(); ctx.translate(-24, 0); ctx.rotate(wag);
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-14, -13); ctx.quadraticCurveTo(-8, 0, -14, 13); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#2f7bff'; ctx.beginPath(); ctx.ellipse(0, 0, 27, 19, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#0a1f5c'; ctx.beginPath(); ctx.moveTo(14, -8); ctx.quadraticCurveTo(-4, -18, -26, -2); ctx.quadraticCurveTo(-8, -6, -2, 4); ctx.quadraticCurveTo(6, -4, 14, -8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(4, 8, 16, 5, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, 27, 19, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(15, -4, 6, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(16.5, -4, 3.3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(17.6, -5.5, 1.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#06204d'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(21, 6, 3, 0.2, 2.2); ctx.stroke();
  ctx.restore();
}
function starfish(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = '#ff8c42'; ctx.strokeStyle = '#a3420f'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 22; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd0a1';
  for (let i = 0; i < 5; i++) for (let j = 1; j <= 2; j++) { const a = -Math.PI / 2 + i * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * j * 6.5, Math.sin(a) * j * 6.5, 1.6, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function chest(ctx, x, y, s, t) {
  const tc = ((t % LOOP) + LOOP) % LOOP;
  const pop = win(tc, 4.1, 5.2, 0.15);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#3a1d05'; ctx.lineWidth = 2.5;
  // parıltı
  const gl = ctx.createRadialGradient(0, -34, 0, 0, -34, 70);
  gl.addColorStop(0, `rgba(255,220,90,${0.35 + pop * 0.4})`); gl.addColorStop(1, 'rgba(255,220,90,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, -34, 70, 0, TAU); ctx.fill();
  // altınlar
  ctx.fillStyle = '#ffcf33';
  for (const [cx, cy] of [[-22, -40], [-8, -46], [8, -44], [22, -39], [-14, -36], [14, -35], [0, -38]]) { ctx.beginPath(); ctx.ellipse(cx, cy, 8, 5, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(-6, -48, 2, 0, TAU); ctx.fill();
  // kutu
  ctx.fillStyle = '#9a5a24'; ctx.beginPath(); ctx.roundRect(-38, -36, 76, 40, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#6e3b12'; ctx.lineWidth = 1.5;
  for (const yy of [-24, -12]) { ctx.beginPath(); ctx.moveTo(-36, yy); ctx.lineTo(36, yy); ctx.stroke(); }
  ctx.fillStyle = '#f2b72a'; ctx.strokeStyle = '#7a4a05'; ctx.lineWidth = 2;
  for (const bx of [-32, 26]) { ctx.beginPath(); ctx.rect(bx, -36, 6, 40); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.roundRect(-7, -30, 14, 16, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a1d05'; ctx.beginPath(); ctx.arc(0, -24, 2.4, 0, TAU); ctx.fill(); ctx.fillRect(-1, -24, 2, 5);
  // kapak (zıplar)
  ctx.save(); ctx.translate(-38, -36); ctx.rotate(-0.55 - pop * 0.35 + Math.sin(tc * 30) * 0.05 * pop);
  ctx.fillStyle = '#a8662c'; ctx.strokeStyle = '#3a1d05'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(76, 0); ctx.quadraticCurveTo(76, -26, 38, -28); ctx.quadraticCurveTo(0, -26, 0, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f2b72a'; ctx.strokeStyle = '#7a4a05'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(6, -22, 6, 22); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.rect(64, -22, 6, 22); ctx.fill(); ctx.stroke();
  ctx.restore();
  // zıplayan altın
  if (pop > 0) {
    const ph = clamp((tc - 4.1) / 1.0, 0, 1), cy = -46 - Math.sin(ph * Math.PI) * 55;
    ctx.save(); ctx.translate(4, cy); ctx.scale(Math.cos(ph * TAU * 2), 1);
    ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(-2, -2, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function coralBranch(ctx, x, y, a, len, w, depth, r, sway) {
  const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
  ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  if (depth <= 0) { ctx.beginPath(); ctx.arc(x2, y2, w * 0.62, 0, TAU); ctx.fill(); return; }
  const n = 2;
  for (let i = 0; i < n; i++) coralBranch(ctx, x2, y2, a + (i ? 1 : -1) * (0.35 + r() * 0.3) + sway, len * (0.68 + r() * 0.15), w * 0.72, depth - 1, r, sway);
}
function coral(ctx, x, y, s, color, outline, seed, t, phase) {
  const r = rnd(seed);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineCap = 'round';
  const sway = Math.sin(t * W0 + phase) * 0.04;
  ctx.strokeStyle = outline; ctx.fillStyle = outline;
  coralBranch(ctx, 0, 0, -Math.PI / 2 + sway, 34, 15, 3, rnd(seed), sway);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  coralBranch(ctx, 0, 0, -Math.PI / 2 + sway, 34, 10, 3, rnd(seed), sway);
  r();
  ctx.restore();
}
function kelp(ctx, x, y, h, w, t, phase, c1, c2) {
  const N = 14, pts = [];
  for (let i = 0; i <= N; i++) { const s = i / N; pts.push([x + Math.sin(t * W0 * 2 + phase + s * 3) * 14 * s * (h / 200), y - s * h, s]); }
  ctx.beginPath();
  for (const [px, py, s] of pts) ctx.lineTo(px - w * (1 - s * 0.7), py);
  for (let i = N; i >= 0; i--) { const [px, py, s] = pts[i]; ctx.lineTo(px + w * (1 - s * 0.7) * (0.8 + 0.4 * Math.sin(s * 9 + phase)), py); }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y - h);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(0,40,20,.35)'; ctx.lineWidth = 2; ctx.stroke();
}

// ---------- Başlık ----------
function chunkyText(ctx, text, x, y, size, t, opts = {}) {
  ctx.font = `700 ${size}px Fredoka, "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const widths = [...text].map(c => ctx.measureText(c).width);
  const spacing = opts.spacing ?? -size * 0.02;
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = x - total / 2;
  [...text].forEach((ch, i) => {
    const w = widths[i], lx = cx + w / 2;
    cx += w + spacing;
    const bounce = Math.sin(t * W0 * 2 - i * 0.9) * size * (opts.bounce ?? 0.05);
    const rot = Math.sin(t * W0 * 2 - i * 0.9 + 1) * (opts.rot ?? 0.05);
    ctx.save(); ctx.translate(lx, y + bounce); ctx.rotate(rot + (opts.arc ? (i - (text.length - 1) / 2) * opts.arc : 0));
    if (opts.arcY) ctx.translate(0, Math.pow(i - (text.length - 1) / 2, 2) * opts.arcY);
    ctx.lineJoin = 'round';
    // gölge
    ctx.fillStyle = 'rgba(4,30,70,.45)'; ctx.fillText(ch, size * 0.03, size * 0.08);
    ctx.strokeStyle = opts.outline || '#173a8f'; ctx.lineWidth = size * (opts.stroke ?? 0.2); ctx.strokeText(ch, 0, 0);
    if (opts.inner) { ctx.strokeStyle = opts.inner; ctx.lineWidth = size * 0.09; ctx.strokeText(ch, 0, 0); }
    if (opts.grad) {
      const g = ctx.createLinearGradient(0, -size * 0.75, 0, 0);
      opts.grad.forEach((c, k) => g.addColorStop(k / (opts.grad.length - 1), c));
      ctx.fillStyle = g;
    } else ctx.fillStyle = opts.fill || '#fff';
    ctx.fillText(ch, 0, 0);
    if (opts.gloss) {
      ctx.save(); ctx.beginPath(); ctx.rect(-size, -size, size * 2, size * 0.62); ctx.clip();
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff'; ctx.fillText(ch, 0, 0); ctx.restore();
    }
    ctx.restore();
  });
  return total;
}

function playButton(ctx, x, y, w, h, t) {
  const p = 1 + Math.sin(t * W0 * 3) * 0.04;
  ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
  ctx.fillStyle = 'rgba(0,30,10,.35)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 2, -h / 2 + 10, w, h, h / 2); ctx.fill();
  ctx.fillStyle = '#1f7a22'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + 6, w, h, h / 2); ctx.fill();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#9cf05f'); g.addColorStop(0.5, '#4ccf3a'); g.addColorStop(1, '#2ea12d');
  ctx.fillStyle = g; ctx.strokeStyle = '#155c18'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.roundRect(-w / 2 + h * 0.25, -h / 2 + h * 0.1, w - h * 0.5, h * 0.28, h * 0.14); ctx.fill();
  // üçgen
  const s = h * 0.27;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.35; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.6, -s); ctx.lineTo(s, 0); ctx.lineTo(-s * 0.6, s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  return { x: x - w / 2, y: y - h / 2, w, h };
}

// ---------- Sahne ----------
const bubbles = (() => { const r = rnd(7); return Array.from({ length: 26 }, () => ({ x: r(), off: r(), size: 2 + r() * 7, per: [2, 3, 6][Math.floor(r() * 3)], wob: r() * TAU })); })();
const snow = (() => { const r = rnd(11); return Array.from({ length: 60 }, () => ({ x: r(), y: r(), s: 0.5 + r() * 1.6 })); })();

function draw(ctx, W, H, t, opts = {}) {
  const look = { palette: opts.palette || opts.variant || 'pink', accessory: opts.accessory || 'goggles' };
  const tc = ((t % LOOP) + LOOP) % LOOP;
  const u = Math.min(W / 390, H / 720);   // ölçek birimi
  const sandY = H * 0.74;

  // arka plan
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#6fe0ff'); bg.addColorStop(0.35, '#2ba8e0'); bg.addColorStop(0.75, '#0f6aa8'); bg.addColorStop(1, '#0a4f86');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // ışık huzmeleri
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = W * (i / 5) + Math.sin(tc * W0 + i * 1.7) * 25 * u;
    const g = ctx.createLinearGradient(0, 0, 0, sandY);
    g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 18 * u, -10); ctx.lineTo(x + 22 * u, -10); ctx.lineTo(x + 90 * u, sandY); ctx.lineTo(x + 10 * u, sandY); ctx.fill();
  }
  ctx.restore();
  // yüzey dalgaları (kostik)
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2 * u;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, 14 * u + r * 16 * u + Math.sin(x * 0.03 / u + tc * W0 * 2 + r) * 4 * u);
    ctx.stroke();
  }
  // uzak kayalık silüetleri
  ctx.fillStyle = 'rgba(10,70,120,.55)';
  ctx.beginPath(); ctx.moveTo(0, sandY);
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, sandY - 60 * u - Math.sin(x * 0.012 / u) * 30 * u - Math.sin(x * 0.031 / u + 1) * 14 * u);
  ctx.lineTo(W, sandY); ctx.fill();
  ctx.fillStyle = 'rgba(8,60,105,.6)';
  ctx.beginPath(); ctx.moveTo(0, sandY);
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, sandY - 25 * u - Math.sin(x * 0.02 / u + 2) * 18 * u);
  ctx.lineTo(W, sandY); ctx.fill();
  // deniz karı
  for (const s of snow) {
    const y = ((s.y - tc / LOOP) % 1 + 1) % 1;
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(s.x * W, y * H, s.s * u, 0, TAU); ctx.fill();
  }
  // uzaktaki balık sürüsü
  for (let i = 0; i < 7; i++) {
    const p = ((tc / LOOP + i * 0.02) % 1);
    const x = W * 1.15 - p * W * 1.4 + (i % 3) * 14 * u, y = H * 0.42 + Math.sin(i * 2.1) * 18 * u + Math.sin(tc * W0 * 2 + i) * 4 * u;
    ctx.fillStyle = 'rgba(20,80,130,.55)';
    ctx.beginPath(); ctx.ellipse(x, y, 7 * u, 3.5 * u, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 6 * u, y); ctx.lineTo(x + 11 * u, y - 4 * u); ctx.lineTo(x + 11 * u, y + 4 * u); ctx.fill();
  }
  // arka yosunlar
  kelp(ctx, W * 0.05, sandY + 10 * u, 230 * u, 11 * u, tc, 0, '#1f8a4c', '#5fd17a');
  kelp(ctx, W * 0.13, sandY + 10 * u, 170 * u, 9 * u, tc, 1.3, '#1a7a44', '#4cc26c');
  kelp(ctx, W * 0.9, sandY + 10 * u, 210 * u, 11 * u, tc, 2.2, '#1f8a4c', '#5fd17a');
  kelp(ctx, W * 0.97, sandY + 10 * u, 150 * u, 9 * u, tc, 3.1, '#1a7a44', '#4cc26c');

  // kum
  const sg = ctx.createLinearGradient(0, sandY - 20 * u, 0, H);
  sg.addColorStop(0, '#ffe3a8'); sg.addColorStop(1, '#d9a95f');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, sandY + Math.sin(x * 0.018 / u) * 9 * u + Math.sin(x * 0.05 / u) * 3 * u);
  ctx.lineTo(W, H); ctx.fill();
  // kumda ışık lekeleri
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = 0; i < 9; i++) { const x = (i * 0.137 % 1) * W + Math.sin(tc * W0 + i) * 6 * u, y = sandY + 20 * u + (i * 0.29 % 1) * (H - sandY - 30 * u); ctx.beginPath(); ctx.ellipse(x, y, 16 * u, 4 * u, 0, 0, TAU); ctx.fill(); }
  // çakıllar
  ctx.fillStyle = '#c99556';
  for (const [fx, fy, r] of [[0.3, 0.86, 5], [0.62, 0.9, 4], [0.45, 0.95, 6], [0.75, 0.97, 3.5]]) { ctx.beginPath(); ctx.ellipse(W * fx, H * fy, r * u * 1.4, r * u, 0, 0, TAU); ctx.fill(); }

  // mercanlar
  coral(ctx, W * 0.1, sandY + 18 * u, 1.25 * u, '#ff6fa5', '#b3245e', 3, tc, 0);
  coral(ctx, W * 0.22, sandY + 24 * u, 0.85 * u, '#ff9e5e', '#b3541a', 9, tc, 1);
  coral(ctx, W * 0.66, sandY + 26 * u, 0.8 * u, '#c36dff', '#6f2bb0', 21, tc, 2);
  // sandık + deniz yıldızı
  chest(ctx, W * 0.84, sandY + 36 * u, 0.95 * u, tc);
  starfish(ctx, W * 0.16, sandY + 58 * u, 1.05 * u, 0.25 + Math.sin(tc * W0) * 0.05);
  starfish(ctx, W * 0.56, sandY + 70 * u, 0.6 * u, -0.4);

  // ahtapot gölgesi
  const bob = Math.sin(tc * W0 * 3);
  const oy = H * 0.49, R = 86 * u;
  ctx.fillStyle = `rgba(60,40,10,${0.22 - bob * 0.04})`;
  ctx.beginPath(); ctx.ellipse(W / 2, sandY + 30 * u, R * (1.3 - bob * 0.06), R * 0.18, 0, 0, TAU); ctx.fill();

  // kabarcıklar (arka)
  const drawBubbles = front => {
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i]; if ((i % 3 === 0) !== front) continue;
      const p = ((tc / b.per + b.off) % 1);
      const y = H * (1 - p * 1.1), x = b.x * W + Math.sin(p * TAU * 2 + b.wob) * 8 * u, r = b.size * u * (front ? 1.3 : 1);
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5 * u; ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); ctx.fill();
    }
  };
  drawBubbles(false);

  // balıklar
  const p1 = tc / LOOP;
  const abs = t, dtp = clamp(abs - I.lastT, 0, 0.1); I.lastT = abs;
  const f1 = fishFx(0, -60 * u + p1 * (W + 120 * u), H * 0.3 + Math.sin(tc * W0 * 2) * 10 * u, 1, abs, u);
  const f2 = fishFx(1, W + 60 * u - ((p1 + 0.45) % 1) * (W + 120 * u), H * 0.62 + Math.sin(tc * W0 * 2 + 2) * 8 * u, -1, abs, u);
  ctx.save(); ctx.globalAlpha = f1.a; clownfish(ctx, f1.x, f1.y, 1.0 * u, f1.dir, f1.a < 1 || abs - I.fish[0].escT > 3.8 ? tc : tc * 3); ctx.restore();
  ctx.save(); ctx.globalAlpha = f2.a; blueTang(ctx, f2.x, f2.y, 0.95 * u, f2.dir, f2.a < 1 || abs - I.fish[1].escT > 3.8 ? tc : tc * 3); ctx.restore();
  I.hits.fish = [{ x: f1.x, y: f1.y, r: 34 * u }, { x: f2.x, y: f2.y, r: 34 * u }];

  // OKTO
  drawOkto(ctx, W / 2, oy, R, tc, look, abs);

  drawBubbles(true);
  drawParts(ctx, dtp, u);

  // başlık
  const ty = (opts.top || 0) + Math.max(H * 0.13, 114 * u); // üstteki düğmeler ve çentik için pay
  chunkyText(ctx, 'Sevimli Ahtapot', W / 2, ty, 30 * u, tc, { stroke: 0.22, outline: '#0f3d8c', fill: '#ffffff', bounce: 0.03, rot: 0.03, spacing: 0, arcY: -0.25 * u });
  chunkyText(ctx, 'OKTO', W / 2, ty + 84 * u, 92 * u, tc, { stroke: 0.2, outline: '#123a8c', inner: '#ff8a00', grad: ['#fff9a8', '#ffd73a', '#ff9d0a'], bounce: 0.045, rot: 0.06, gloss: true, spacing: 2 * u });

  // oyna düğmesi
  const pr = playButton(ctx, W / 2, H * 0.865, 150 * u, 64 * u, tc);
  OktoTitle.playRect = pr;

  // ön yosun + vinyet
  kelp(ctx, -4 * u, H + 10, 140 * u, 13 * u, tc, 4.2, '#146b3a', '#3fb862');
  kelp(ctx, W + 4 * u, H + 10, 120 * u, 13 * u, tc, 5.1, '#146b3a', '#3fb862');
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,20,50,0)'); vg.addColorStop(1, 'rgba(0,20,50,.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

window.OktoTitle = { draw, LOOP, playRect: null, pointer, tap };
})();

/* OKTO bölüm sonu canavarları ve saldırıları: game.js'ten ayrılmış çizim modülü (kodla çizilen varlıklar).
   Kullanım: OktoBosses.draw(G), OktoBosses.drawAttacks(G), OktoBosses.DRAWERS (kimliğe göre çizimler; olmayanlar geçici çizimle)  — G = { ctx, S, W, H, time, FONT, boss, player, slams, shots } */
(() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
let ctx, S, W, H, time, FONT, boss, player, slams, shots;
function use(G) { ctx = G.ctx; S = G.S; W = G.W; H = G.H; time = G.time; FONT = G.FONT; boss = G.boss; player = G.player; slams = G.slams; shots = G.shots; }

// ---------- Canavar çizimleri ----------
function bossTentacle(x0, y0, ang, len, w, t, ph, col, line) {
  const N = 16, pts = [];
  let x = x0, y = y0, a = ang;
  for (let k = 0; k <= N; k++) { const s = k / N; pts.push([x, y, a, s]); a += Math.sin(t * 2.2 + ph - s * 3) * 0.12; x += Math.cos(a) * len / N; y += Math.sin(a) * len / N; }
  ctx.beginPath();
  for (const [px, py, pa, s] of pts) ctx.lineTo(px + Math.cos(pa - Math.PI / 2) * w * (1 - s * 0.85), py + Math.sin(pa - Math.PI / 2) * w * (1 - s * 0.85));
  for (let k = N; k >= 0; k--) { const [px, py, pa, s] = pts[k]; ctx.lineTo(px + Math.cos(pa + Math.PI / 2) * w * (1 - s * 0.85), py + Math.sin(pa + Math.PI / 2) * w * (1 - s * 0.85)); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 2.5 * S; ctx.stroke();
  ctx.fillStyle = '#ffd1dc';
  for (let k = 3; k < N - 1; k += 2) { const [px, py, pa, s] = pts[k]; ctx.beginPath(); ctx.arc(px + Math.cos(pa + Math.PI / 2) * w * 0.45 * (1 - s), py + Math.sin(pa + Math.PI / 2) * w * 0.45 * (1 - s), w * 0.25 * (1 - s * 0.8), 0, TAU); ctx.fill(); }
}
function bossEyes(R, ey, gap, size, line, iris, stunned, angry) {
  for (const sx of [-1, 1]) {
    const ex = sx * gap;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = line; ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.ellipse(ex, ey, size, size * 1.12, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (stunned) {
      ctx.beginPath();
      for (let a = 0; a < TAU * 2; a += 0.3) { const r = a / (TAU * 2) * size * 0.75, aa = a * sx + time * 8; ctx.lineTo(ex + Math.cos(aa) * r, ey + Math.sin(aa) * r); }
      ctx.stroke();
    } else {
      const lx = clamp((player.x - boss.x) / W, -1, 1) * size * 0.3, ly = -size * 0.2;
      ctx.fillStyle = iris; ctx.beginPath(); ctx.arc(ex + lx, ey + ly, size * 0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(ex + lx, ey + ly, size * 0.2, size * 0.45, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + lx + size * 0.2, ey + ly - size * 0.25, size * 0.14, 0, TAU); ctx.fill();
    }
    if (angry) { ctx.strokeStyle = line; ctx.lineWidth = 5 * S; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex + sx * size * 0.85, ey - size * 1.5); ctx.lineTo(ex - sx * size * 0.75, ey - size * 1.0); ctx.stroke(); } // dış uç yukarı, iç uç aşağı: kızgın
  }
}
function drawSquidBoss(b, R, hit, stunned) {
  const line = '#4a0a18';
  for (let i = 0; i < 8; i++) { const s = i / 7 - 0.5; bossTentacle(s * R * 1.2, -R * 0.1, -Math.PI / 2 + s * 2.6, R * (1.5 + (i % 2) * 0.4), R * 0.22, time, i * 1.3, hit ? '#fff' : '#d23b52', line); }
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.6, R * 0.1, 0, 0, R * 1.6);
  g.addColorStop(0, hit ? '#fff' : '#ff8a9a'); g.addColorStop(0.6, hit ? '#fff' : '#e0475b'); g.addColorStop(1, '#8a1630');
  ctx.fillStyle = g; ctx.strokeStyle = line; ctx.lineWidth = 3 * S;
  ctx.beginPath(); ctx.ellipse(0, R * 0.4, R * 1.05, R * 1.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  for (const [x, y, r] of [[-0.5, 0.2, 0.12], [0.55, 0.0, 0.1], [0.2, 0.6, 0.14], [-0.3, 0.9, 0.1]]) { ctx.beginPath(); ctx.arc(x * R, y * R, r * R, 0, TAU); ctx.fill(); }
  bossEyes(R, -R * 0.35, R * 0.42, R * 0.3, line, '#ffb000', stunned, true);
}
function drawPufferBoss(b, R, hit, stunned) {
  const p = b.puff, RR = R * (1 + p * 0.3), line = '#7a4a00';
  ctx.save(); ctx.scale(1 + Math.sin(time * 30) * 0.02 * (b.puffT > 0 ? 1 : 0), 1);
  // yüzgeçler
  ctx.fillStyle = hit ? '#fff' : '#ffb347'; ctx.strokeStyle = line; ctx.lineWidth = 3 * S;
  for (const sx of [-1, 1]) { ctx.save(); ctx.translate(sx * RR * 0.95, R * 0.1); ctx.rotate(sx * (0.4 + Math.sin(time * 8) * 0.3)); ctx.beginPath(); ctx.ellipse(sx * R * 0.25, 0, R * 0.3, R * 0.16, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
  // dikenler
  const spikes = 18;
  ctx.fillStyle = hit ? '#fff' : '#e8a400';
  for (let i = 0; i < spikes; i++) {
    const a = i / spikes * TAU + time * 0.2, l = RR * (1.12 + p * 0.28);
    ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.12) * RR * 0.95, Math.sin(a - 0.12) * RR * 0.95); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.lineTo(Math.cos(a + 0.12) * RR * 0.95, Math.sin(a + 0.12) * RR * 0.95); ctx.fill(); ctx.stroke();
  }
  const g = ctx.createRadialGradient(-RR * 0.3, -RR * 0.4, RR * 0.1, 0, 0, RR * 1.2);
  g.addColorStop(0, hit ? '#fff' : '#fff2a8'); g.addColorStop(0.6, hit ? '#fff' : '#ffd23f'); g.addColorStop(1, '#e09500');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, RR, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(160,100,0,.25)';
  for (const [x, y, r] of [[-0.5, -0.5, 0.1], [0.45, -0.6, 0.08], [0.6, -0.1, 0.09], [-0.65, 0.05, 0.08]]) { ctx.beginPath(); ctx.arc(x * RR, y * RR, r * RR, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.ellipse(0, RR * 0.45, RR * 0.7, RR * 0.4, 0, 0, Math.PI); ctx.fill();
  bossEyes(RR, -RR * 0.15, RR * 0.38, RR * 0.25, line, '#3a8f2a', stunned, true);
  // somurtkan ağız
  ctx.fillStyle = '#ff7a5c'; ctx.strokeStyle = line; ctx.lineWidth = 3 * S;
  ctx.beginPath(); ctx.ellipse(0, RR * 0.32, RR * 0.14 * (1 + p * 0.5), RR * 0.1 * (1 + p), 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (b.dash && b.dash.stage === 'tele') { ctx.fillStyle = `rgba(255,60,60,${0.6 + 0.4 * Math.sin(time * 25)})`; ctx.font = `700 ${34 * S}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, -R * 1.7); }
}
function drawJellyBoss(b, R, hit, stunned) {
  // uzun parlayan dokunaçlar
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const x0 = (i / 8 - 0.5) * R * 1.5;
    ctx.strokeStyle = `rgba(150,220,255,${0.35 + 0.2 * Math.sin(time * 6 + i)})`; ctx.lineWidth = 4 * S;
    ctx.beginPath(); ctx.moveTo(x0, R * 0.2);
    for (let k = 1; k <= 10; k++) ctx.lineTo(x0 + Math.sin(time * 2.5 + i + k * 0.7) * 12 * S, R * 0.2 + k * R * 0.25);
    ctx.stroke();
  }
  // gövde parıltısı
  const glow = ctx.createRadialGradient(0, -R * 0.2, 0, 0, -R * 0.2, R * 2);
  glow.addColorStop(0, `rgba(170,120,255,${0.35 + 0.15 * Math.sin(time * 5)})`); glow.addColorStop(1, 'rgba(170,120,255,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -R * 0.2, R * 2, 0, TAU); ctx.fill();
  ctx.restore();
  const pulse = Math.sin(b.t * 2.2) * 0.06;
  const g = ctx.createRadialGradient(0, -R * 0.6, R * 0.1, 0, -R * 0.2, R * 1.3);
  g.addColorStop(0, hit ? '#fff' : 'rgba(255,255,255,.95)'); g.addColorStop(0.45, hit ? '#fff' : 'rgba(190,150,255,.9)'); g.addColorStop(1, 'rgba(110,70,220,.75)');
  ctx.fillStyle = g; ctx.strokeStyle = '#3b1f8a'; ctx.lineWidth = 3 * S;
  ctx.beginPath(); ctx.ellipse(0, 0, R * (1.15 + pulse), R * (0.95 - pulse), 0, Math.PI, 0);
  for (let i = 0; i <= 8; i++) { const x = R * (1.15 + pulse) * (1 - i / 4); ctx.quadraticCurveTo(x + R * 0.14, R * 0.28, x - R * 0.0, i % 2 ? R * 0.12 : R * 0.2); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // elektrik çakımı
  if (!stunned && Math.sin(time * 13) > 0.6) {
    ctx.strokeStyle = '#fff59a'; ctx.lineWidth = 2.5 * S; ctx.beginPath();
    let x = rand(-R * 0.6, R * 0.6), y = -R * 0.8; ctx.moveTo(x, y);
    for (let i = 0; i < 5; i++) { x += rand(-14, 14) * S; y += R * 0.18; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  bossEyes(R, -R * 0.35, R * 0.38, R * 0.22, '#3b1f8a', '#ffe14d', stunned, true);
  ctx.strokeStyle = '#3b1f8a'; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.moveTo(-R * 0.18, -R * 0.02); ctx.quadraticCurveTo(0, -R * 0.12, R * 0.18, -R * 0.02); ctx.stroke();
}
// Görseli henüz hazır olmayan (veriyle tanımlanmış) canavarlar için geçici çizim: renkli gövde, gözler, yüzgeçler
function drawGenericBoss(b, R, hit, stunned) {
  const L = (b.def && b.def.look) || {}, body = hit ? '#fff' : L.body || '#8a7dff', line = L.line || '#24124f';
  ctx.strokeStyle = line; ctx.lineWidth = 3 * S;
  for (let i = 0; i < 6; i++) { const s = i / 5 - 0.5; bossTentacle(s * R * 1.3, R * 0.5, Math.PI / 2 + s * 1.2, R * 0.9, R * 0.16, time, i * 1.7, body, line); }
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R * 1.3);
  g.addColorStop(0, hit ? '#fff' : 'rgba(255,255,255,.55)'); g.addColorStop(0.35, body); g.addColorStop(1, line);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.1, R * (0.95 + Math.sin(time * 2) * 0.03), 0, 0, TAU); ctx.fill(); ctx.stroke();
  if (L.shape === 'crown') { // büyük canavar: taç
    ctx.fillStyle = hit ? '#fff' : '#ffd36b'; ctx.strokeStyle = '#8a5a00'; ctx.beginPath();
    const w = R * 0.7, y0 = -R * 0.82, h = R * 0.42;
    ctx.moveTo(-w, y0); ctx.lineTo(-w, y0 - h * 0.6); ctx.lineTo(-w * 0.5, y0 - h * 0.25); ctx.lineTo(0, y0 - h); ctx.lineTo(w * 0.5, y0 - h * 0.25); ctx.lineTo(w, y0 - h * 0.6); ctx.lineTo(w, y0); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  bossEyes(R, -R * 0.2, R * 0.4, R * 0.26, line, L.iris || '#ffe14d', stunned, true);
  ctx.strokeStyle = line; ctx.lineWidth = 3.5 * S; ctx.beginPath(); ctx.moveTo(-R * 0.25, R * 0.3); ctx.quadraticCurveTo(0, R * 0.18, R * 0.25, R * 0.3); ctx.stroke();
}
// ---------- Güneşli Sular mini canavarları (tasarım PNG'leri model alınarak kodla çizilir) ----------
// Gözler: beyaz yuvarlak, koyu göz bebeği, parlama; kızgın kaşlar (kullanıcının PNG'lerindeki gibi)
function angryEyes(ey, gap, size, line, stunned, browCol) {
  for (const sx of [-1, 1]) {
    const ex = sx * gap;
    ctx.fillStyle = '#fbf8ff'; ctx.strokeStyle = line; ctx.lineWidth = 2.5 * S;
    ctx.beginPath(); ctx.ellipse(ex, ey, size, size * 1.05, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (stunned) { ctx.strokeStyle = line; ctx.lineWidth = 2.5 * S; ctx.beginPath(); for (let a = 0; a < TAU * 2; a += 0.3) { const r = a / (TAU * 2) * size * 0.75, aa = a * sx + time * 8; ctx.lineTo(ex + Math.cos(aa) * r, ey + Math.sin(aa) * r); } ctx.stroke(); }
    else {
      const lx = clamp((player.x - boss.x) / W, -1, 1) * size * 0.3;
      ctx.fillStyle = '#2a1028'; ctx.beginPath(); ctx.arc(ex + lx, ey + size * 0.1, size * 0.55, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + lx + size * 0.18, ey - size * 0.12, size * 0.18, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = browCol || line; ctx.lineWidth = size * 0.32; ctx.lineCap = 'round'; // kızgın kaş: iç uç aşağıda
    ctx.beginPath(); ctx.moveTo(ex + sx * size * 1.05, ey - size * 1.25); ctx.lineTo(ex - sx * size * 0.75, ey - size * 0.7); ctx.stroke();
  }
}
// ---------- Güneşli Sular mini canavarları: kullanıcının 1024 px PNG'leri model alınarak kodla çizildi (docs/canavarlar/) ----------
function drawKestane(b, R, hit, stunned) { // macenta gövde, kalın yuvarlak uçlu mor dikenler, alında üç mercan rengi nokta
  const glow = b.glowT > 0 ? 0.5 + 0.5 * Math.sin(time * 14) : 0, line = '#4a0a4e';
  ctx.save(); ctx.rotate(Math.sin(time * 0.7) * 0.06);
  const n = 16, ext = b.glowT > 0 ? 0.08 : 0;
  for (let i = 0; i < n; i++) { // dikenler: kalın, sivrilen, yuvarlak uçlu
    const a = i * TAU / n - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
    const r0 = R * 0.8, r1 = R * (1.62 + ext), w0 = R * 0.17, w1 = R * 0.1;
    ctx.beginPath();
    ctx.moveTo(ca * r0 + px * w0, sa * r0 + py * w0); ctx.lineTo(ca * r1 + px * w1, sa * r1 + py * w1);
    ctx.arc(ca * r1, sa * r1, w1, a + Math.PI / 2, a - Math.PI / 2, true);
    ctx.lineTo(ca * r0 - px * w0, sa * r0 - py * w0); ctx.closePath();
    ctx.fillStyle = hit ? '#fff' : '#6b0f74'; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 3 * S; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = hit ? '#fff' : 'rgba(150,40,160,.7)'; ctx.lineWidth = 1.5 * S; ctx.beginPath(); ctx.moveTo(ca * r0 + px * w0 * 0.3, sa * r0 + py * w0 * 0.3); ctx.lineTo(ca * (r1 - w1) + px * w1 * 0.3, sa * (r1 - w1) + py * w1 * 0.3); ctx.stroke();
  }
  ctx.restore();
  const g = ctx.createRadialGradient(0, -R * 0.15, R * 0.05, 0, 0, R * 1.05);
  g.addColorStop(0, hit ? '#fff' : '#f21aa8'); g.addColorStop(0.65, hit ? '#fff' : '#c50c8e'); g.addColorStop(1, '#94086e');
  ctx.fillStyle = g; ctx.strokeStyle = line; ctx.lineWidth = 3.5 * S; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.stroke();
  for (const [x, y, r] of [[0, -0.6, 0.2], [-0.43, -0.45, 0.11], [0.43, -0.45, 0.11]]) { // alındaki mercan noktalar: parlayınca uyarı
    if (glow > 0) { ctx.fillStyle = `rgba(255,170,110,${0.45 * glow})`; ctx.beginPath(); ctx.arc(x * R, y * R, r * R * 1.9, 0, TAU); ctx.fill(); }
    ctx.fillStyle = glow > 0 ? `rgb(255,${150 + 80 * glow | 0},${110 + 60 * glow | 0})` : '#ff7a62'; ctx.beginPath(); ctx.arc(x * R, y * R, r * R, 0, TAU); ctx.fill();
  }
  angryEyes(R * 0.1, R * 0.34, R * 0.24, line, stunned, '#4a0a4e');
}
function drawYengec(b, R, hit, stunned) { // turuncu kubbe gövde, açık karın, sap gözler, iki büyük yuvarlak kıskaç (ağzı içe bakar)
  const out = '#c42a2a', body = hit ? '#fff' : '#f2563a', inward = -(b.side || 1);
  const thick = (x0, y0, cx, cy, x1, y1, w, col) => { ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.strokeStyle = out; ctx.lineWidth = w + 4 * S; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { // bacaklar: her yanda üç, gövdenin yanından dışa ve aşağı
    const k = Math.sin(time * 7 + i + sx) * 0.05, bx = sx * R * (0.62 + i * 0.12), by = R * (0.28 + i * 0.1);
    thick(bx, by, sx * R * (0.95 + i * 0.12), R * (0.45 + i * 0.12 + k), sx * R * (1.0 + i * 0.1), R * (0.8 + i * 0.08 + k), 9 * S, body);
  }
  for (const sx of [-1, 1]) { // kollar ve kıskaçlar: ikisi de yukarıda; içeri bakan kıskaç uyarıda daha da kalkar ve açılıp kapanır
    const warn = sx === inward && b.clawT > 0, lift = warn ? 0.35 + Math.sin(time * 16) * 0.05 : Math.sin(time * 2 + sx) * 0.05;
    const cx = sx * R * (1.15 - lift * 0.2), cy = -R * (0.82 + lift * 0.6), cr = R * 0.42;
    thick(sx * R * 0.72, -R * 0.05, sx * R * 1.0, -R * 0.15, cx - sx * cr * 0.4, cy + cr * 0.75, 11 * S, hit ? '#fff' : '#ff6a38');
    const inA = sx > 0 ? Math.PI * 1.05 : -Math.PI * 0.05, gap = warn ? 0.5 + 0.25 * Math.sin(time * 16) : 0.42; // kıskacın ağzı içeri ve biraz aşağı bakar
    const g = ctx.createLinearGradient(cx, cy - cr, cx, cy + cr); g.addColorStop(0, hit ? '#fff' : '#ff5a6a'); g.addColorStop(1, hit ? '#fff' : '#dc2846');
    ctx.fillStyle = g; ctx.strokeStyle = out; ctx.lineWidth = 3 * S; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(inA) * cr * 0.15, cy + Math.sin(inA) * cr * 0.15); ctx.arc(cx, cy, cr, inA + gap, inA - gap + TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(cx - sx * cr * 0.05, cy - cr * 0.55, cr * 0.38, cr * 0.16, -sx * 0.25, 0, TAU); ctx.fill();
  }
  for (const sx of [-1, 1]) thick(sx * R * 0.24, -R * 0.45, sx * R * 0.3, -R * 0.65, sx * R * 0.34, -R * 0.82, 7 * S, hit ? '#fff' : '#ff6a38'); // göz sapları
  const g = ctx.createLinearGradient(0, -R * 0.6, 0, R * 0.55); g.addColorStop(0, hit ? '#fff' : '#ff8a3a'); g.addColorStop(1, hit ? '#fff' : '#ec4a34');
  ctx.fillStyle = g; ctx.strokeStyle = out; ctx.lineWidth = 3.5 * S;
  ctx.beginPath(); ctx.moveTo(-R * 1.0, R * 0.25); ctx.quadraticCurveTo(-R * 0.95, -R * 0.6, 0, -R * 0.62); ctx.quadraticCurveTo(R * 0.95, -R * 0.6, R * 1.0, R * 0.25); ctx.quadraticCurveTo(R * 0.9, R * 0.62, 0, R * 0.62); ctx.quadraticCurveTo(-R * 0.9, R * 0.62, -R * 1.0, R * 0.25); ctx.closePath();
  ctx.fill(); ctx.save(); ctx.clip();
  ctx.fillStyle = hit ? '#fff' : '#ffa25e'; ctx.beginPath(); ctx.ellipse(0, R * 0.62, R * 0.75, R * 0.48, 0, Math.PI, TAU); ctx.fill(); // açık karın
  ctx.restore(); ctx.stroke();
  for (const sx of [-1, 1]) { // sap üstünde turuncu çerçeveli gözler, yarı kapalı kızgın kapaklar
    const ex = sx * R * 0.36, ey = -R * 0.98, er = R * 0.25;
    ctx.fillStyle = hit ? '#fff' : '#ff7a3a'; ctx.strokeStyle = out; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fdf8f0'; ctx.beginPath(); ctx.arc(ex, ey, er * 0.74, 0, TAU); ctx.fill();
    if (stunned) { ctx.strokeStyle = '#222'; ctx.lineWidth = 2 * S; ctx.beginPath(); for (let a = 0; a < TAU * 2; a += 0.3) { const r = a / (TAU * 2) * er * 0.6, aa = a * sx + time * 8; ctx.lineTo(ex + Math.cos(aa) * r, ey + Math.sin(aa) * r); } ctx.stroke(); }
    else { const lx = clamp((player.x - boss.x) / W, -1, 1) * er * 0.25; ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(ex + lx, ey + er * 0.12, er * 0.33, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, er * 0.74, 0, TAU); ctx.clip(); // kızgın göz kapağı (iç uç aşağıda)
    ctx.fillStyle = hit ? '#fff' : '#ff7a3a'; ctx.beginPath(); ctx.moveTo(ex - er, ey - er); ctx.lineTo(ex + er, ey - er); ctx.lineTo(ex + er, ey - er * (sx > 0 ? 0.0 : 0.35)); ctx.lineTo(ex - er, ey - er * (sx > 0 ? 0.35 : 0.0)); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function drawVatoz(b, R, hit, stunned) { // turkuaz vatoz: geniş, uçları kalkık kanatlar, nane rengi çizgiler ve ön bant, yukarı kıvrık kuyruk
  const line = '#0b5f72', fold = b.foldT > 0 ? 1 - b.foldT / 0.8 : 0, flap = Math.sin(time * 3) * 0.1, mint = hit ? '#fff' : '#98f2dc';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const tw = Math.sin(time * 2.2) * 0.15; // kuyruk: sırttan yukarı S biçiminde
  ctx.beginPath(); ctx.moveTo(-R * 0.08, -R * 0.62); ctx.bezierCurveTo(R * 0.05, -R * 0.95, R * (0.55 + tw), -R * 0.9, R * (0.5 + tw), -R * 1.35); ctx.quadraticCurveTo(R * (0.45 + tw), -R * 1.6, R * (0.2 + tw), -R * 1.5);
  ctx.strokeStyle = line; ctx.lineWidth = 14 * S; ctx.stroke(); ctx.strokeStyle = hit ? '#fff' : '#1aa2b8'; ctx.lineWidth = 9 * S; ctx.stroke();
  ctx.save(); ctx.scale(1 - 0.4 * fold, 1); // kanatları toplayınca daralır
  const body = new Path2D(), tipY = -R * (0.48 + flap), sp = R * 1.85;
  body.moveTo(0, -R * 0.72); // ortası kubbeli
  body.bezierCurveTo(R * 0.55, -R * 0.72, R * 0.75, -R * 0.3, R * 1.05, -R * 0.22);
  body.quadraticCurveTo(R * 1.4, -R * 0.12, sp * 0.93, tipY + R * 0.02);
  body.quadraticCurveTo(sp * 1.02, tipY - R * 0.05, sp, tipY + R * 0.18); // kalkık kanat ucu
  body.bezierCurveTo(R * 1.55, R * 0.25, R * 0.9, R * 0.5, R * 0.55, R * 0.58);
  body.lineTo(-R * 0.55, R * 0.58);
  body.bezierCurveTo(-R * 0.9, R * 0.5, -R * 1.55, R * 0.25, -sp, tipY + R * 0.18);
  body.quadraticCurveTo(-sp * 1.02, tipY - R * 0.05, -sp * 0.93, tipY + R * 0.02);
  body.quadraticCurveTo(-R * 1.4, -R * 0.12, -R * 1.05, -R * 0.22);
  body.bezierCurveTo(-R * 0.75, -R * 0.3, -R * 0.55, -R * 0.72, 0, -R * 0.72); body.closePath();
  const g = ctx.createRadialGradient(0, -R * 0.05, R * 0.05, 0, 0, R * 1.7); g.addColorStop(0, hit ? '#fff' : '#22c6d4'); g.addColorStop(0.5, hit ? '#fff' : '#1497ae'); g.addColorStop(1, hit ? '#fff' : '#0e7c94');
  ctx.fillStyle = g; ctx.fill(body);
  ctx.save(); ctx.clip(body); // ön bant: dalgalı nane rengi alt kenar
  ctx.fillStyle = mint; ctx.beginPath(); ctx.moveTo(-sp, R * 0.3);
  for (let x = -sp; x <= sp; x += R * 0.1) ctx.lineTo(x, R * (0.22 + 0.06 * Math.sin(x / R * 5)) + Math.abs(x) * 0.08);
  ctx.lineTo(sp, R); ctx.lineTo(-sp, R); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = line; ctx.lineWidth = 3 * S; ctx.stroke(body);
  ctx.strokeStyle = mint; ctx.lineWidth = 6 * S; // kanatlardaki ikişer çizgi
  for (const sx of [-1, 1]) for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(sx * R * (1.05 + k * 0.2), -R * (0.18 + k * 0.06)); ctx.lineTo(sx * R * (1.28 + k * 0.2), R * 0.2); ctx.stroke(); }
  ctx.restore();
  for (const sx of [-1, 1]) { // önde aşağı sarkan iki baş yüzgeci
    ctx.fillStyle = mint; ctx.strokeStyle = line; ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.moveTo(sx * R * 0.18, R * 0.52); ctx.quadraticCurveTo(sx * R * 0.12, R * 0.95, sx * R * 0.3, R * 0.98); ctx.quadraticCurveTo(sx * R * 0.48, R * 0.95, sx * R * 0.5, R * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (b.openT > 0) { ctx.fillStyle = `rgba(125,255,176,${0.25 + 0.15 * Math.sin(time * 6)})`; ctx.beginPath(); ctx.arc(0, R * 0.05, R * 0.6, 0, TAU); ctx.fill(); } // açık: hedef parlıyor
  angryEyes(R * 0.12, R * 0.27, R * 0.16, '#0b2a40', stunned || b.openT > 0, '#0b2a40');
}
// Canavar çizimleri kimliğe göre; yeni canavarın çizimi buraya eklenir: DRAWERS['kimlik'] = (b, R, hit, stunned) => {...}
const DRAWERS = { puffer: drawPufferBoss, jelly: drawJellyBoss, squid: drawSquidBoss, 'puffer-big': drawPufferBoss, 'jelly-big': drawJellyBoss, 'squid-big': drawSquidBoss,
  kestane: drawKestane, yengec: drawYengec, vatoz: drawVatoz };
function drawBoss() {
  const b = boss;
  ctx.save(); ctx.translate(b.x, b.y);
  const hit = b.flashT > 0, stunned = b.stun > 0;
  (DRAWERS[b.kind] || drawGenericBoss)(b, b.r, hit, stunned);
  ctx.restore();
}
function drawClaw(s) { // yengeç kıskacı: önce yatay uyarı şeridi, sonra kenardan kenara süpüren kıskaç
  const y = s.y, h = s.h;
  if (s.warnOnly) {
    const a = 0.38 + 0.12 * Math.sin(s.t * 14); // belirgin uyarı: kırmızı şerit, kenar çizgileri, kıskacın geleceği yönü gösteren oklar
    ctx.fillStyle = `rgba(255,70,50,${a})`; ctx.fillRect(0, y - h, W, h * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.25 * Math.sin(s.t * 14)})`; ctx.lineWidth = 2 * S; ctx.setLineDash([10 * S, 8 * S]);
    ctx.beginPath(); ctx.moveTo(0, y - h); ctx.lineTo(W, y - h); ctx.moveTo(0, y + h); ctx.lineTo(W, y + h); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 4; i++) { const x = s.side > 0 ? (0.15 + i * 0.22) * W : (0.85 - i * 0.22) * W, k = 9 * S; ctx.beginPath(); ctx.moveTo(x + s.side * k, y); ctx.lineTo(x - s.side * k * 0.6, y - k); ctx.lineTo(x - s.side * k * 0.6, y + k); ctx.closePath(); ctx.fill(); }
    return;
  }
  const front = s.side > 0 ? s.reach * W : W - s.reach * W, x0 = s.side > 0 ? -20 : W + 20;
  ctx.fillStyle = 'rgba(255,120,90,.18)'; ctx.fillRect(Math.min(x0, front), y - h, Math.abs(front - x0), h * 2);
  ctx.lineCap = 'round'; ctx.strokeStyle = '#5a0f08'; ctx.lineWidth = 14 * S; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(front - s.side * 30 * S, y); ctx.stroke();
  ctx.strokeStyle = '#e8452f'; ctx.lineWidth = 9 * S; ctx.stroke();
  ctx.save(); ctx.translate(front, y); ctx.scale(s.side, 1);
  ctx.fillStyle = '#e8452f'; ctx.strokeStyle = '#5a0f08'; ctx.lineWidth = 3 * S;
  ctx.beginPath(); ctx.ellipse(-12 * S, 0, 28 * S, 20 * S, 0, 0, TAU); ctx.fill(); ctx.stroke();
  const open = 0.35 + 0.25 * Math.sin(s.t * 20);
  ctx.fillStyle = '#ff8a6a'; ctx.beginPath(); ctx.moveTo(8 * S, -4 * S); ctx.lineTo(34 * S, -22 * S * open - 6 * S); ctx.lineTo(16 * S, -14 * S); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8 * S, 4 * S); ctx.lineTo(34 * S, 22 * S * open + 6 * S); ctx.lineTo(16 * S, 14 * S); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawCurrent() { // akıntı vatozunun yan akıntısı: Okto'yu sürükleyen yatay çizgiler
  const c = boss && boss.current; if (!c) return;
  const a = Math.min(1, c.t / 0.3, (c.dur - c.t) / 0.2 + 0.3);
  ctx.save(); ctx.strokeStyle = `rgba(200,250,255,${0.45 * a})`; ctx.lineWidth = 2.5 * S; ctx.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const y = ((i * 97) % 1000) / 1000 * H, sp = 0.7 + (i % 5) * 0.12, x = ((time * 520 * sp * S * c.dir + i * 173) % (W + 160) + W + 160) % (W + 160) - 80;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - c.dir * (40 + (i % 4) * 14) * S, y); ctx.stroke();
  }
  ctx.restore();
}
function drawSlams() {
  drawCurrent();
  for (const s of slams) {
    if (s.kind === 'claw') { drawClaw(s); continue; }
    if (s.t < s.warn) { // uyarı sütunu
      const a = 0.18 + 0.14 * Math.sin(s.t * 25);
      ctx.fillStyle = s.kind === 'zap' ? `rgba(255,240,90,${a})` : `rgba(255,60,80,${a})`; ctx.fillRect(s.x - s.w, 0, s.w * 2, H);
      ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(s.t * 25)})`; ctx.font = `700 ${26 * S}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (s.kind === 'zap') { const z = 14 * S, x = s.x, y = H * 0.5; ctx.beginPath(); ctx.moveTo(x + z * 0.2, y - z); ctx.lineTo(x - z * 0.55, y + z * 0.15); ctx.lineTo(x - z * 0.05, y + z * 0.15); ctx.lineTo(x - z * 0.25, y + z); ctx.lineTo(x + z * 0.55, y - z * 0.15); ctx.lineTo(x + z * 0.05, y - z * 0.15); ctx.closePath(); ctx.fill(); }
      else ctx.fillText('!', s.x, H * 0.5);
      continue;
    }
    if (s.kind === 'zap') { // yıldırım: şekil saniyede ~8 kez değişir (her karede değil: titreşim/göz yorgunluğu olmasın)
      if (!s.reach) continue;
      const step = Math.floor((s.t - s.warn) * 8);
      if (s.zStep !== step) { s.zStep = step; s.path = []; for (let y = H; y > -20; y -= 26 * S) s.path.push([s.x + rand(-s.w, s.w) * 0.8, y]); }
      const fade = clamp(1 - (s.t - s.warn) / 0.55, 0.35, 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(255,245,150,.12)'; ctx.fillRect(s.x - s.w, 0, s.w * 2, H);
      for (const [lw, col] of [[9 * S, 'rgba(200,170,255,.45)'], [3.5 * S, 'rgba(255,251,224,.85)']]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(s.x, H);
        for (const [x, y] of s.path) ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
      continue;
    }
    const tipY = H - s.reach * H * 0.92, w = s.w;
    ctx.fillStyle = '#d23b52'; ctx.strokeStyle = '#4a0a18'; ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.moveTo(s.x - w, H + 10); ctx.quadraticCurveTo(s.x - w * 0.8, tipY + w, s.x, tipY); ctx.quadraticCurveTo(s.x + w * 0.8, tipY + w, s.x + w, H + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd1dc';
    for (let y = tipY + w * 1.5; y < H; y += w * 1.1) { ctx.beginPath(); ctx.arc(s.x + w * 0.35, y, w * 0.22, 0, TAU); ctx.fill(); }
  }
  for (const sh of shots) {
    const g = ctx.createRadialGradient(sh.x - 3 * S, sh.y - 3 * S, 1, sh.x, sh.y, 13 * S);
    g.addColorStop(0, '#6b4fa8'); g.addColorStop(1, '#14061f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sh.x, sh.y, 12 * S, 0, TAU); ctx.fill();
  }
}


window.OktoBosses = { DRAWERS, draw(G) { use(G); if (boss) drawBoss(); }, drawAttacks(G) { use(G); drawSlams(); } };
})();

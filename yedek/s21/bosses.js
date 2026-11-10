/* OKTO bölüm sonu canavarları ve saldırıları: game.js'ten ayrılmış çizim modülü (kodla çizilen varlıklar).
   Kullanım: OktoBosses.draw(G), OktoBosses.drawAttacks(G)  — G = { ctx, S, W, H, time, FONT, boss, player, slams, shots } */
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
function drawBoss() {
  const b = boss;
  ctx.save(); ctx.translate(b.x, b.y);
  const hit = b.flashT > 0, stunned = b.stun > 0;
  if (b.kind === 'puffer') drawPufferBoss(b, b.r, hit, stunned);
  else if (b.kind === 'jelly') drawJellyBoss(b, b.r, hit, stunned);
  else drawSquidBoss(b, b.r, hit, stunned);
  ctx.restore();
}
function drawSlams() {
  for (const s of slams) {
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


window.OktoBosses = { draw(G) { use(G); if (boss) drawBoss(); }, drawAttacks(G) { use(G); drawSlams(); } };
})();

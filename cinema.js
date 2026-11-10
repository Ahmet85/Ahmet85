/* OKTO büyük canavar sahneleri: sinematik giriş ve büyük zafer kutlaması (kodla çizilir).
   OktoCinema.drawIntro(G)   — G = { ctx, W, H, S, FONT, time, t, dur, title, sub, color, drawBoss(y, alpha) }
   OktoCinema.drawVictory(G) — G = { ctx, W, H, S, FONT, time, t, x, y, title, sub }
   Yanıp sönme yok: tüm ışıklar yumuşak açılıp kapanır (çocuk oyunu, ışığa hassasiyet). Yazılarda emoji yok. */
(() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const win = (t, a, b, fi = 0.4, fo = 0.4) => ease((t - a) / fi) * (1 - ease((t - (b - fo)) / fo)); // a–b arasında yumuşak aç/kapa

function centerText(ctx, text, x, y, size, FONT, fill, stroke) {
  ctx.font = `700 ${size}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const m = ctx.measureText(text).width, est = text.length * size * 0.56, w = m > est * 0.5 ? m : est; // iPhone ölçüm güvencesi
  if (stroke) { ctx.lineWidth = size * 0.16; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(text, x - w / 2, y); }
  ctx.fillStyle = fill; ctx.fillText(text, x - w / 2, y);
}

// ---------- Sinematik giriş (yaklaşık 5 sn) ----------
// 0.0–1.2 su kararır, akıntılar aşağı çeker · 0.8–3.0 dipte girdap · 1.6–3.6 aşağıdan ışık huzmeleri ·
// 1.2–3.2 canavarın silüeti yükselir · 3.0 ışık açılır, canavar görünür · 3.0–dur isim kartı · kenarlarda sinema şeritleri
function drawIntro(G) {
  const { ctx, W, H, S, FONT, time, t, dur } = G, cx = W / 2, cy = H * 0.78;
  ctx.save();
  // 1) kararma
  const dark = 0.6 * ease(t / 1.2) * (1 - 0.45 * ease((t - 3.0) / 0.8));
  ctx.fillStyle = `rgba(2,6,22,${dark})`; ctx.fillRect(0, 0, W, H);
  // 2) akıntılar: girdaba doğru akan çizgiler
  const cur = win(t, 0.2, 3.2, 0.6, 0.8);
  if (cur > 0) {
    ctx.strokeStyle = `rgba(150,220,255,${0.28 * cur})`; ctx.lineWidth = 2 * S; ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const k = (i * 0.618) % 1, ph = (time * 0.7 + k) % 1, sx = W * ((i * 0.37) % 1), sy = -40 * S + ph * (H * 0.85);
      const x = sx + (cx - sx) * ph * ph, y = sy, len = 40 * S + 30 * S * k;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (cx - x) * 0.08, y + len); ctx.stroke();
    }
  }
  // 3) girdap (canavarın çıkacağı yerde)
  const vx = win(t, 0.8, 3.4, 0.7, 0.8);
  if (vx > 0) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.45);
    const R = W * 0.55;
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      for (let i = 0; i <= 50; i++) { const s = i / 50, a = arm * TAU / 4 + s * 4.5 - time * 3, r = s * R; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.strokeStyle = `rgba(140,200,255,${0.3 * vx})`; ctx.lineWidth = 10 * S * vx; ctx.stroke();
    }
    ctx.restore();
  }
  // 4) aşağıdan yükselen ışık huzmeleri
  const ray = win(t, 1.6, dur - 0.3, 0.9, 0.9);
  if (ray > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx, cy);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.24 + Math.sin(time * 0.6 + i) * 0.04, L = H * 0.95;
      const g = ctx.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
      g.addColorStop(0, `rgba(255,236,170,${0.22 * ray})`); g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.07) * L, Math.sin(a - 0.07) * L); ctx.lineTo(Math.cos(a + 0.07) * L, Math.sin(a + 0.07) * L); ctx.fill();
    }
    ctx.restore();
  }
  // 5) canavar: önce karanlık silüet olarak yükselir, sonra ışıkla görünür
  const rise = ease((t - 1.2) / 2.0), reveal = ease((t - 3.0) / 0.7);
  if (t > 1.2 && G.drawBoss) G.drawBoss(H + 140 * S - rise * (H * 0.32 + 140 * S), 1 - reveal);
  // 6) sinema şeritleri
  const bar = ease(t / 0.5) * (1 - ease((t - (dur - 0.45)) / 0.45)), bh = H * 0.1 * bar;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
  // 7) isim kartı
  const card = win(t, 3.0, dur, 0.5, 0.5);
  if (card > 0) {
    const y = H * 0.36, sc = 0.85 + 0.15 * ease((t - 3.0) / 0.5);
    ctx.save(); ctx.globalAlpha = card; ctx.translate(cx, y); ctx.scale(sc, sc);
    const size = Math.min(34, W / Math.max(8, G.title.length) * 1.5);
    centerText(ctx, G.title, 0, 0, size, FONT, G.color || '#ffd36b', 'rgba(20,8,40,.9)');
    if (G.sub) centerText(ctx, G.sub, 0, size * 1.1, 15, FONT, '#ffffff', 'rgba(0,0,0,.6)');
    ctx.restore();
  }
  if (t > 1.2 && t < dur - 0.6) { ctx.globalAlpha = 0.55 * ease((t - 1.2) / 0.5); centerText(ctx, 'Geçmek için dokun', cx, H - bh - 18, 12, FONT, '#ffffff'); }
  ctx.restore();
}

// ---------- Büyük zafer (canavar ölürken ~3.6 sn) ----------
const confetti = [];
function drawVictory(G) {
  const { ctx, W, H, S, FONT, time, t } = G, a = win(t, 0, 3.6, 0.4, 0.6);
  if (a <= 0) return;
  ctx.save();
  // dönen altın ışınlar
  ctx.globalCompositeOperation = 'lighter'; ctx.translate(G.x, G.y);
  for (let i = 0; i < 12; i++) {
    const ang = i * TAU / 12 + time * 0.4, L = Math.max(W, H);
    ctx.fillStyle = `rgba(255,214,110,${0.11 * a})`; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang - 0.08) * L, Math.sin(ang - 0.08) * L); ctx.lineTo(Math.cos(ang + 0.08) * L, Math.sin(ang + 0.08) * L); ctx.fill();
  }
  ctx.restore();
  // konfeti
  if (t < 0.05) confetti.length = 0;
  while (confetti.length < 70) confetti.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.6, v: (60 + Math.random() * 80) * S, r: (3 + Math.random() * 3) * S, h: Math.floor(Math.random() * 360), s: Math.random() * TAU });
  ctx.save(); ctx.globalAlpha = a;
  for (const c of confetti) {
    const y = c.y + c.v * t, x = c.x + Math.sin(time * 2 + c.s) * 14 * S;
    ctx.fillStyle = `hsl(${c.h},90%,65%)`; ctx.save(); ctx.translate(x, y % (H + 40)); ctx.rotate(time * 3 + c.s); ctx.fillRect(-c.r, -c.r * 0.5, c.r * 2, c.r); ctx.restore();
  }
  // kupa ve yazı
  const y = H * 0.3, pop = 0.7 + 0.3 * ease(t / 0.5);
  ctx.translate(W / 2, y); ctx.scale(pop, pop);
  drawTrophy(ctx, 0, -46 * S, 34 * S, time);
  centerText(ctx, G.title || 'BÜYÜK ZAFER!', 0, 8 * S, 30, FONT, '#ffd36b', 'rgba(40,16,0,.9)');
  if (G.sub) centerText(ctx, G.sub, 0, 38 * S, 15, FONT, '#ffffff', 'rgba(0,0,0,.6)');
  ctx.restore();
}
function drawTrophy(ctx, x, y, R, time) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 2) * 0.05);
  ctx.lineWidth = R * 0.08; ctx.strokeStyle = '#8a5a00'; ctx.fillStyle = '#ffd23f';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * R * 0.62, -R * 0.35, R * 0.28, R * 0.3, 0, 0, TAU); ctx.stroke(); } // kulplar
  ctx.beginPath(); ctx.moveTo(-R * 0.6, -R * 0.75); ctx.lineTo(R * 0.6, -R * 0.75); ctx.quadraticCurveTo(R * 0.55, R * 0.15, 0, R * 0.25); ctx.quadraticCurveTo(-R * 0.55, R * 0.15, -R * 0.6, -R * 0.75); ctx.fill(); ctx.stroke();
  ctx.fillRect(-R * 0.1, R * 0.2, R * 0.2, R * 0.35); ctx.beginPath(); ctx.roundRect(-R * 0.42, R * 0.52, R * 0.84, R * 0.22, R * 0.05); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-R * 0.25, -R * 0.4, R * 0.08, R * 0.25, 0.2, 0, TAU); ctx.fill();
  ctx.restore();
}

window.OktoCinema = { drawIntro, drawVictory, drawTrophy };
})();

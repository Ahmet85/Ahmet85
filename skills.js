/* OKTO becerileri ve yetenek halkası (DENEME: yalnızca test adresinde açılır: ?beceri)
   - 12 beceri tanımlı; ilk denemede 3'ü çalışıyor: Mürekkep Yelpazesi, İnci Atışı, Kalkan Açılımı.
   - Oyuncu 3 beceri kuşanır. Sağ alttaki tek düğme:
       basılı tut  → Okto'nun çevresinde halka açılır (oyun yavaşlar)
       sürükle     → yukarı / sola / sağa: o dilim vurgulanır
       bırak       → beceri seçilir, halka kapanır, düğmedeki simge değişir
       kısa dokun  → seçili beceri çalışır (her becerinin kendi bekleme süresi var)
   - Yönlü beceriler Okto'dan aynı anda yukarı, aşağı, sağa ve sola yayılır; dalış yönünden bağımsızdır.
   game.js her karede bir ortam nesnesi (E) verir: { W, H, S, time, player, entities, boss, enemies(Set), damageBoss, burst,
   floater, sound, addScore, vibrate } */
(() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // yukarı, aşağı, sol, sağ

// ---------- Simgeler (kodla çizilir; r: yarıçap) ----------
function cloud(c, x, y, r, col) { c.fillStyle = col; for (const [dx, dy, k] of [[0, 0, 1], [-0.7, 0.2, 0.75], [0.7, 0.2, 0.75], [-0.3, -0.45, 0.7], [0.35, -0.4, 0.65]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, r * k * 0.62, 0, TAU); c.fill(); } }
const ICONS = {
  inkFan(c, r) { for (const [dx, dy] of DIRS) cloud(c, dx * r * 0.52, dy * r * 0.52, r * 0.42, '#a77ff0'); cloud(c, 0, 0, r * 0.32, '#e2d0ff'); },
  pearlShot(c, r) {
    c.strokeStyle = '#fff'; c.lineWidth = r * 0.12; c.lineCap = 'round';
    for (const [dx, dy] of DIRS) { c.beginPath(); c.moveTo(dx * r * 0.45, dy * r * 0.45); c.lineTo(dx * r * 0.88, dy * r * 0.88); c.stroke(); }
    const g = c.createRadialGradient(-r * 0.12, -r * 0.14, r * 0.05, 0, 0, r * 0.4); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9cbb8');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 0.36, 0, TAU); c.fill();
  },
  shieldArcs(c, r) {
    c.strokeStyle = '#9ee8ff'; c.lineWidth = r * 0.16; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - Math.PI / 2; c.beginPath(); c.arc(0, 0, r * 0.68, a - 0.55, a + 0.55); c.stroke(); }
    c.fillStyle = '#ff7eb6'; c.beginPath(); c.arc(0, 0, r * 0.26, 0, TAU); c.fill();
  },
  generic(c, r) { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(0, 0, r * 0.3, 0, TAU); c.fill(); },
};

// ---------- 12 beceri (ready: bu denemede çalışıyor mu) ----------
const DEFS = [
  { id: 'tentacleSlam', name: 'Dokunaç Darbesi', cd: 5, ready: false },
  { id: 'inkFan', name: 'Mürekkep Yelpazesi', cd: 6, ready: true, color: '#b48cff' },
  { id: 'pearlShot', name: 'İnci Atışı', cd: 3.5, ready: true, color: '#fff3d6' },
  { id: 'bubbleTrap', name: 'Kabarcık Kapanı', cd: 7, ready: false },
  { id: 'reefHook', name: 'Resif Kancası', cd: 7, ready: false },
  { id: 'currentPush', name: 'Akıntı İtişi', cd: 6, ready: false },
  { id: 'lanternPulse', name: 'Fener Nabzı', cd: 8, ready: false },
  { id: 'shieldArcs', name: 'Kalkan Açılımı', cd: 10, ready: true, color: '#9ee8ff' },
  { id: 'lightWave', name: 'Işık Dalgası', cd: 8, ready: false },
  { id: 'spinTentacles', name: 'Dönen Dokunaçlar', cd: 6, ready: false },
  { id: 'vortexPull', name: 'Girdap Çekişi', cd: 9, ready: false },
  { id: 'gigaSlam', name: 'Dev Okto Darbesi', cd: 4, ready: false },
];
const byId = id => DEFS.find(d => d.id === id);

// ---------- Durum ----------
const st = {
  equipped: ['inkFan', 'pearlShot', 'shieldArcs'], sel: 0, cd: {}, lock: 0,
  hold: null,            // { id, x, y, t, open, hover }
  fx: [],                // etkin efektler
};
const SLOT_ANG = [-Math.PI / 2, Math.PI * 5 / 6, Math.PI / 6]; // halkada dilim merkezleri: üst, sol-alt, sağ-alt
// sürükleme yönünden dilim: yukarı → 0, sola → 1, sağa → 2 (başparmak sağ altta olduğu için aşağı yön kullanılmaz)
function slotFromDrag(dx, dy) { if (Math.hypot(dx, dy) < 16) return null; if (-dy > Math.abs(dx) * 0.8) return 0; return dx < 0 ? 1 : 2; }

// ---------- Düğme girdisi (ekran koordinatları) ----------
function down(id, x, y, now) { st.hold = { id, x, y, t: now, open: false, hover: st.sel }; }
function move(id, x, y) {
  const h = st.hold; if (!h || h.id !== id) return;
  const s = slotFromDrag(x - h.x, y - h.y);
  if (!h.open && s !== null && Math.hypot(x - h.x, y - h.y) > 22) h.open = true; // sürükleme halkayı hemen açar
  if (h.open && s !== null) h.hover = s;
}
function up(id, E) {
  const h = st.hold; if (!h || h.id !== id) return null; st.hold = null;
  if (h.open) { if (h.hover !== st.sel) { st.sel = h.hover; E.sound.tone(880, 0.08, 'triangle', 0.07, 200, 0, true); } return 'select'; }
  return activate(E) ? 'fire' : 'wait';
}
function cancel() { st.hold = null; }

// ---------- Ateşleme ----------
function activate(E) {
  const id = st.equipped[st.sel], d = byId(id);
  if (!d || !d.ready || (st.cd[id] || 0) > 0 || st.lock > 0) { E.sound.tone(200, 0.08, 'square', 0.04); return false; }
  st.cd[id] = d.cd; st.lock = 0.35; E.vibrate(25);
  const P = E.player, S = E.S;
  if (id === 'inkFan') {
    E.sound.ink && E.sound.ink();
    const grp = { hitBoss: false }; // dört bulut canavara en fazla bir kez vurur
    for (const [dx, dy] of DIRS) st.fx.push({ kind: 'ink', x: P.x, y: P.y, dx, dy, t: 0, life: 1.5, dist: 120 * S, r: 36 * S, grp });
  } else if (id === 'pearlShot') {
    E.sound.tone(1200, 0.12, 'triangle', 0.08, -500); E.sound.tone(900, 0.1, 'sine', 0.06, 300, 0.04);
    for (const [dx, dy] of DIRS) st.fx.push({ kind: 'pearl', x: P.x + dx * P.r, y: P.y + dy * P.r, vx: dx * 520 * S, vy: dy * 520 * S, t: 0, life: 1.6, r: 9 * S });
  } else if (id === 'shieldArcs') {
    E.sound.tone(500, 0.3, 'sine', 0.08, 400); E.sound.tone(1000, 0.2, 'triangle', 0.05, 0, 0.1, true);
    st.fx = st.fx.filter(f => f.kind !== 'shield');
    st.fx.push({ kind: 'shield', t: 0, life: 6, arcs: [true, true, true, true] }); // sırayla: üst, alt, sol, sağ
  }
  return true;
}

// ---------- Güncelleme ----------
const isShot = e => e.type === 'spike' || e.type === 'blob';
function update(E, dt) {
  for (const k in st.cd) if (st.cd[k] > 0) st.cd[k] = Math.max(0, st.cd[k] - dt);
  if (st.lock > 0) st.lock -= dt;
  if (st.hold && !st.hold.open && E.now - st.hold.t > 220) st.hold.open = true; // basılı tutunca açılır
  const P = E.player, S = E.S;
  // kısa süreli sersemleme sayaçları
  for (const e of E.entities) if (e.skStun > 0) { e.skStun -= dt; if (e.skStun <= 0) { e.stunned = false; e.skStun = 0; } }
  for (const f of st.fx) {
    f.t += dt;
    if (f.kind === 'ink') {
      const k = Math.min(1, f.t / 0.35), ease = 1 - Math.pow(1 - k, 3);
      f.cx = f.x + f.dx * f.dist * ease; f.cy = f.y + f.dy * f.dist * ease;
      if (f.t < 1.0) for (const e of E.entities) {
        if (!E.enemies.has(e.type) || e.dead || Math.hypot(e.x - f.cx, e.y - f.cy) > f.r + e.r) continue;
        if (isShot(e)) { e.dead = true; E.burst(e.x, e.y, '#6b3fa0', 8, 90); continue; }
        if (!e.stunned) { e.stunned = true; e.skStun = 2.5; E.addScore(15); if (e.type === 'shark') { e.warn = 0; e.sp *= 0.35; } }
      }
      const B = E.boss;
      if (!f.grp.hitBoss && f.t < 1.0 && B && B.phase === 'fight' && Math.hypot(B.x - f.cx, B.y - B.r * 0.3 - f.cy) < B.r * 0.85 + f.r) { f.grp.hitBoss = true; E.damageBoss(1); }
    } else if (f.kind === 'pearl') {
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < -30 || f.x > E.W + 30 || f.y < -30 || f.y > E.H + 30) { f.done = true; continue; }
      for (const e of E.entities) {
        if (!E.enemies.has(e.type) || e.dead || (e.type === 'shark' && e.warn > 0)) continue;
        if (Math.hypot(e.x - f.x, e.y - f.y) < e.r + f.r) { // ilk hedef: vur ve dur
          e.dead = true; f.done = true; E.burst(e.x, e.y, '#fff3d6', 12, 140); E.addScore(20); E.floater(e.x, e.y - 20 * S, '+20', '#fff3d6'); break;
        }
      }
      const B = E.boss;
      if (!f.done && B && B.phase === 'fight' && Math.hypot(B.x - f.x, B.y - B.r * 0.3 - f.y) < B.r * 0.9) { f.done = true; E.damageBoss(1); }
    } else if (f.kind === 'shield') {
      const R = P.r * (1.25 + 0.85 * (P.big || 0)) + 14 * S;
      for (const e of E.entities) {
        if (!isShot(e) || e.dead) continue;
        const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
        if (d > R + e.r || d < R * 0.4) continue;
        const i = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 0 : 1); // hangi yaya geldi
        if (!f.arcs[i]) continue;
        f.arcs[i] = false; e.dead = true; E.burst(e.x, e.y, '#9ee8ff', 12, 140); E.sound.tone(700, 0.12, 'triangle', 0.08, -300);
      }
      if (!f.arcs.some(Boolean)) f.done = true;
    }
    if (f.t >= f.life) f.done = true;
  }
  st.fx = st.fx.filter(f => !f.done);
}
const shielding = () => st.fx.some(f => f.kind === 'shield');
const timeScale = () => (st.hold && st.hold.open ? 0.4 : 1); // halka açıkken oyun yavaşlar

// ---------- Çizim: efektler (dünya katmanı) ----------
function drawFx(c, E) {
  const P = E.player, S = E.S;
  for (const f of st.fx) {
    if (f.kind === 'ink') {
      const a = f.t < 1.0 ? 1 : Math.max(0, 1 - (f.t - 1.0) / 0.5);
      c.save(); c.globalAlpha = 0.8 * a; c.translate(f.cx, f.cy);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, f.r * 1.3); g.addColorStop(0, 'rgba(40,16,70,.95)'); g.addColorStop(1, 'rgba(40,16,70,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, f.r * 1.3, 0, TAU); c.fill();
      cloud(c, 0, 0, f.r * (0.7 + 0.15 * Math.sin(f.t * 8)), 'rgba(59,33,96,.9)'); c.restore();
    } else if (f.kind === 'pearl') {
      c.save(); c.translate(f.x, f.y);
      c.strokeStyle = 'rgba(255,243,214,.45)'; c.lineWidth = f.r * 1.1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-f.vx * 0.05, -f.vy * 0.05); c.stroke();
      const g = c.createRadialGradient(-f.r * 0.3, -f.r * 0.3, 1, 0, 0, f.r); g.addColorStop(0, '#fff'); g.addColorStop(1, '#e6d6bf');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, f.r, 0, TAU); c.fill(); c.restore();
    } else if (f.kind === 'shield') {
      const R = P.r * (1.25 + 0.85 * (P.big || 0)) + 14 * S, fade = f.life - f.t < 1 ? 0.35 + 0.65 * (f.life - f.t) : 1; // bitmeye yakın yavaşça solar
      c.save(); c.translate(P.x, P.y); c.lineCap = 'round';
      [-Math.PI / 2, Math.PI / 2, Math.PI, 0].forEach((a, i) => {
        if (!f.arcs[i]) return;
        c.strokeStyle = `rgba(158,232,255,${0.85 * fade})`; c.lineWidth = 6 * S; c.beginPath(); c.arc(0, 0, R, a - 0.6, a + 0.6); c.stroke();
        c.strokeStyle = `rgba(255,255,255,${0.6 * fade})`; c.lineWidth = 2 * S; c.beginPath(); c.arc(0, 0, R + 1 * S, a - 0.45, a + 0.2); c.stroke();
      });
      c.restore();
    }
  }
}

// ---------- Çizim: halka (Okto'nun çevresinde) ----------
function drawRing(c, E) {
  const h = st.hold; if (!h || !h.open) return;
  const P = E.player, S = E.S, R0 = 36 * S, R1 = 104 * S;
  c.save();
  c.fillStyle = 'rgba(2,10,30,.35)'; c.fillRect(0, 0, E.W, E.H); // arka plan biraz kararır
  c.translate(clamp(P.x, R1 + 8, E.W - R1 - 8), clamp(P.y, R1 + 70 * S, E.H - R1 - 90 * S));
  for (let i = 0; i < 3; i++) {
    const a = SLOT_ANG[i], on = i === h.hover, id = st.equipped[i], d = byId(id), cdl = st.cd[id] || 0;
    c.beginPath(); c.arc(0, 0, R1 + (on ? 6 * S : 0), a - Math.PI / 3 + 0.04, a + Math.PI / 3 - 0.04); c.arc(0, 0, R0, a + Math.PI / 3 - 0.04, a - Math.PI / 3 + 0.04, true); c.closePath();
    c.fillStyle = on ? 'rgba(255,215,90,.92)' : 'rgba(20,40,80,.82)'; c.fill();
    c.lineWidth = 3 * S; c.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.35)'; c.stroke();
    const mx = Math.cos(a) * (R0 + R1) / 2, my = Math.sin(a) * (R0 + R1) / 2;
    c.save(); c.translate(mx, my - 6 * S); if (cdl > 0) c.globalAlpha = 0.45; (ICONS[id] || ICONS.generic)(c, 24 * S); c.restore();
    c.font = `700 ${12 * S}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = on ? '#3a2400' : '#fff'; c.fillText(cdl > 0 ? `${Math.ceil(cdl)} sn` : d.name, mx, my + 20 * S);
  }
  c.restore();
}

// ---------- Çizim: sağ alttaki düğme (168×168 tuval) ----------
function drawButton(c, s, E) {
  const id = st.equipped[st.sel], d = byId(id), cdl = st.cd[id] || 0, ready = cdl <= 0, cx = s / 2, rr = s / 2 - 10;
  c.clearRect(0, 0, s, s);
  c.fillStyle = ready ? 'rgba(20,40,90,.88)' : 'rgba(15,25,50,.6)'; c.beginPath(); c.arc(cx, cx, rr, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 10; c.beginPath(); c.arc(cx, cx, rr - 2, 0, TAU); c.stroke();
  const k = ready ? 1 : 1 - cdl / d.cd;
  c.strokeStyle = ready ? d.color || '#ffd36b' : 'rgba(255,255,255,.55)'; c.lineWidth = 10; c.lineCap = 'round';
  c.beginPath(); c.arc(cx, cx, rr - 2, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.stroke();
  c.save(); c.translate(cx, cx - 4); if (!ready) c.globalAlpha = 0.45; (ICONS[id] || ICONS.generic)(c, 44); c.restore();
  // kuşanılmış üç beceri: küçük noktalar
  for (let i = 0; i < 3; i++) { c.fillStyle = i === st.sel ? '#ffd36b' : 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(cx + (i - 1) * 16, s - 26, 5, 0, TAU); c.fill(); }
  if (!ready) { c.fillStyle = '#fff'; c.font = '700 30px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(Math.ceil(cdl), cx, cx - 2); }
}

function reset() { st.cd = {}; st.fx = []; st.hold = null; st.lock = 0; }
window.OktoSkills = {
  DEFS, ICONS, state: st, byId,
  get selected() { return st.equipped[st.sel]; }, get ringOpen() { return !!(st.hold && st.hold.open); },
  setEquipped(list) { if (Array.isArray(list) && list.length === 3) st.equipped = list.slice(); },
  select(i) { st.sel = clamp(i | 0, 0, 2); },
  down, move, up, cancel, activate, update, drawFx, drawRing, drawButton, shielding, timeScale, reset,
};
})();

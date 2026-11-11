/* OKTO becerileri ve yetenek halkası (s27'den beri normal oyunda; eski mürekkep düğmesi için test adresi: ?murekkep)
   - 12 beceri (s28'den beri hepsi çalışıyor). 'Küçük düşman': köpekbalığı ve canavarlar dışındaki düşmanlar.
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
  tentacleSlam(c, r) {
    c.lineCap = 'round';
    for (const [dx, dy] of DIRS) { c.strokeStyle = '#ff7eb6'; c.lineWidth = r * 0.26; c.beginPath(); c.moveTo(dx * r * 0.25, dy * r * 0.25); c.lineTo(dx * r * 0.82, dy * r * 0.82); c.stroke(); c.fillStyle = '#ffe3f0'; c.beginPath(); c.arc(dx * r * 0.82, dy * r * 0.82, r * 0.11, 0, TAU); c.fill(); }
    c.fillStyle = '#ff9fc9'; c.beginPath(); c.arc(0, 0, r * 0.28, 0, TAU); c.fill();
  },
  currentPush(c, r) {
    c.strokeStyle = '#7fd8ff'; c.lineWidth = r * 0.12; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; for (const k of [0.55, 0.85]) { c.beginPath(); c.arc(0, 0, r * k, a - 0.45, a + 0.45); c.stroke(); } }
    c.fillStyle = '#d6f4ff'; c.beginPath(); c.arc(0, 0, r * 0.2, 0, TAU); c.fill();
  },
  bubbleTrap(c, r) {
    for (const [dx, dy] of DIRS) { c.strokeStyle = '#bff3ff'; c.lineWidth = r * 0.08; c.fillStyle = 'rgba(160,230,255,.35)'; c.beginPath(); c.arc(dx * r * 0.6, dy * r * 0.6, r * 0.27, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(dx * r * 0.6 - r * 0.08, dy * r * 0.6 - r * 0.09, r * 0.06, 0, TAU); c.fill(); }
    c.fillStyle = '#ff7eb6'; c.beginPath(); c.arc(0, 0, r * 0.18, 0, TAU); c.fill();
  },
  lanternPulse(c, r) {
    c.fillStyle = 'rgba(255,240,150,.55)';
    for (const [dx, dy] of DIRS) { const px = -dy, py = dx; c.beginPath(); c.moveTo(dx * r * 0.2, dy * r * 0.2); c.lineTo(dx * r * 0.95 + px * r * 0.28, dy * r * 0.95 + py * r * 0.28); c.lineTo(dx * r * 0.95 - px * r * 0.28, dy * r * 0.95 - py * r * 0.28); c.fill(); }
    c.fillStyle = '#ffe680'; c.beginPath(); c.arc(0, 0, r * 0.3, 0, TAU); c.fill();
  },
  reefHook(c, r) {
    c.strokeStyle = '#ff9fc9'; c.lineWidth = r * 0.12; c.lineCap = 'round';
    for (const [dx, dy] of DIRS) { const px = -dy, py = dx; c.beginPath(); c.moveTo(dx * r * 0.2, dy * r * 0.2); c.lineTo(dx * r * 0.75, dy * r * 0.75); c.quadraticCurveTo(dx * r * 0.95 + px * r * 0.2, dy * r * 0.95 + py * r * 0.2, dx * r * 0.7 + px * r * 0.25, dy * r * 0.7 + py * r * 0.25); c.stroke(); }
    c.fillStyle = '#7a6a5a'; c.beginPath(); c.arc(0, 0, r * 0.22, 0, TAU); c.fill();
  },
  lightWave(c, r) {
    c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.strokeStyle = '#fff6b0'; c.lineWidth = r * 0.16; c.beginPath(); c.arc(0, 0, r * 0.72, a - 0.5, a + 0.5); c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.05; c.beginPath(); c.arc(0, 0, r * 0.72, a - 0.4, a + 0.4); c.stroke(); }
    c.fillStyle = '#fff3a0'; c.beginPath(); c.arc(0, 0, r * 0.22, 0, TAU); c.fill();
  },
  spinTentacles(c, r) {
    c.strokeStyle = '#ff7eb6'; c.lineWidth = r * 0.16; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.beginPath(); c.arc(0, 0, r * 0.62, a, a + 1.1); c.stroke(); }
    c.fillStyle = '#ff9fc9'; c.beginPath(); c.arc(0, 0, r * 0.26, 0, TAU); c.fill();
  },
  vortexPull(c, r) {
    c.strokeStyle = '#8fd8ff'; c.lineWidth = r * 0.1; c.lineCap = 'round'; c.beginPath();
    for (let a = 0; a < TAU * 2.2; a += 0.15) { const rr = r * 0.9 * (1 - a / (TAU * 2.4)); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.stroke();
  },
  gigaSlam(c, r) {
    c.fillStyle = '#ffd23f'; c.strokeStyle = '#a86a00'; c.lineWidth = r * 0.05;
    for (const [dx, dy] of DIRS) { const px = -dy, py = dx; c.beginPath(); c.moveTo(dx * r * 0.25 + px * r * 0.16, dy * r * 0.25 + py * r * 0.16); c.lineTo(dx * r * 0.92 + px * r * 0.26, dy * r * 0.92 + py * r * 0.26); c.lineTo(dx * r * 0.92 - px * r * 0.26, dy * r * 0.92 - py * r * 0.26); c.lineTo(dx * r * 0.25 - px * r * 0.16, dy * r * 0.25 - py * r * 0.16); c.closePath(); c.fill(); c.stroke(); }
    c.fillStyle = '#ff7eb6'; c.beginPath(); c.arc(0, 0, r * 0.3, 0, TAU); c.fill();
  },
  generic(c, r) { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(0, 0, r * 0.3, 0, TAU); c.fill(); },
};

// ---------- 12 beceri (s28: hepsi çalışıyor) ----------
// xp: açılması için gereken toplam Kaşif Puanı (dalışlarda kazanılan bütün puanlar birikir; canavar yenmek çok puan verir)
const DEFS = [
  { id: 'inkFan', name: 'Mürekkep Yelpazesi', cd: 6, ready: true, color: '#b48cff', xp: 0, desc: 'Dört bulut, yakındaki düşmanları sersemletir' },
  { id: 'pearlShot', name: 'İnci Atışı', cd: 3.5, ready: true, color: '#fff3d6', xp: 300, desc: 'Dört inci, her biri ilk hedefe vurur' },
  { id: 'shieldArcs', name: 'Kalkan Açılımı', cd: 10, ready: true, color: '#9ee8ff', xp: 800, desc: 'Dört yay, her biri bir mermiyi durdurur' },
  { id: 'tentacleSlam', color: '#ff9fc9', name: 'Dokunaç Darbesi', cd: 5, ready: true, xp: 1500, desc: 'Dört kısa darbe, yakındaki düşmanları iter' },
  { id: 'currentPush', color: '#7fd8ff', name: 'Akıntı İtişi', cd: 6, ready: true, xp: 2400, desc: 'Dört dalga, küçük düşmanları uzaklaştırır' },
  { id: 'bubbleTrap', color: '#bff3ff', name: 'Kabarcık Kapanı', cd: 7, ready: true, xp: 3500, desc: 'Dört kabarcık, küçük düşmanları tutar' },
  { id: 'lanternPulse', color: '#ffe680', name: 'Fener Nabzı', cd: 8, ready: true, xp: 5000, desc: 'Dört huzme, karanlıkta her şeyi gösterir' },
  { id: 'reefHook', color: '#ff9fc9', name: 'Resif Kancası', cd: 7, ready: true, xp: 6500, desc: 'Dört dokunaç, küçük düşmanları uzakta tutar' },
  { id: 'lightWave', color: '#fff3a0', name: 'Işık Dalgası', cd: 8, ready: true, xp: 8500, desc: 'Dört ışık yayı, düşmanlara hasar verir' },
  { id: 'spinTentacles', color: '#ff7eb6', name: 'Dönen Dokunaçlar', cd: 6, ready: true, xp: 11000, desc: 'Dört yönden süpürme, çaprazları da kapsar' },
  { id: 'vortexPull', color: '#8fd8ff', name: 'Girdap Çekişi', cd: 9, ready: true, xp: 14000, desc: 'Küçük düşmanları Okto’nun çevresinde toplar' },
  { id: 'gigaSlam', color: '#ffd23f', name: 'Dev Okto Darbesi', cd: 4, ready: true, xp: 18000, desc: 'Altın karidesle Dev Okto’yken dört geniş darbe', needBig: true },
];
const byId = id => DEFS.find(d => d.id === id);

// ---------- Durum ----------
const st = {
  equipped: ['inkFan', 'pearlShot', 'shieldArcs'], sel: 0, cd: {}, lock: 0,
  hold: null,            // { id, x, y, t, open, hover }
  pushes: [],            // itilen düşmanlar { e, vx, vy }
  fx: [],                // etkin efektler
};
// halkada dilim merkezleri (kuşanılan beceri sayısına göre): 3 → üst, sol-alt, sağ-alt · 2 → sol, sağ
const slotAng = n => (n >= 3 ? [-Math.PI / 2, Math.PI * 5 / 6, Math.PI / 6] : n === 2 ? [Math.PI, 0] : [-Math.PI / 2]);
// sürükleme yönünden dilim: yukarı → 0, sola → 1, sağa → 2 (başparmak sağ altta olduğu için aşağı yön kullanılmaz)
function slotFromDrag(dx, dy) {
  const n = st.equipped.length; if (Math.hypot(dx, dy) < 16) return null;
  if (n <= 1) return 0;
  if (n === 2) return dx < 0 ? 0 : 1;
  if (-dy > Math.abs(dx) * 0.8) return 0; return dx < 0 ? 1 : 2;
}

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
  if (d.needBig && !(E.player.bigT > 0)) { E.sound.tone(200, 0.08, 'square', 0.04); E.floater(E.player.x, E.player.y - 50 * E.S, 'Önce Dev Okto ol!', '#ffd23f'); return false; }
  st.cd[id] = d.cd; st.lock = 0.35; E.vibrate(25);
  E.onFire && E.onFire(id); // test kaydı
  const P = E.player, S = E.S;
  if (id === 'inkFan') {
    E.sound.ink && E.sound.ink();
    const grp = { hitBoss: true }; // canavara bulutlar değil, eskisi gibi güdümlü mürekkep topu vurur
    E.inkShot && E.inkShot();
    for (const [dx, dy] of DIRS) st.fx.push({ kind: 'ink', x: P.x, y: P.y, dx, dy, t: 0, life: 1.5, dist: 120 * S, r: 36 * S, grp });
  } else if (id === 'pearlShot') {
    E.sound.tone(1200, 0.12, 'triangle', 0.08, -500); E.sound.tone(900, 0.1, 'sine', 0.06, 300, 0.04);
    for (const [dx, dy] of DIRS) st.fx.push({ kind: 'pearl', x: P.x + dx * P.r, y: P.y + dy * P.r, vx: dx * 520 * S, vy: dy * 520 * S, t: 0, life: 1.6, r: 9 * S });
  } else if (id === 'shieldArcs') {
    E.sound.tone(500, 0.3, 'sine', 0.08, 400); E.sound.tone(1000, 0.2, 'triangle', 0.05, 0, 0.1, true);
    st.fx = st.fx.filter(f => f.kind !== 'shield');
    st.fx.push({ kind: 'shield', t: 0, life: 6, arcs: [true, true, true, true] }); // sırayla: üst, alt, sol, sağ
  } else if (id === 'tentacleSlam') {
    E.sound.tone(180, 0.15, 'square', 0.08, -60); E.sound.noise(0.15, 0.12, 900);
    const sg = { hitBoss: false };
    for (const [dx, dy] of DIRS) st.fx.push({ kind: 'slam', dx, dy, t: 0, life: 0.4, len: 100 * S, w: 24 * S, hit: new Set(), dmg: 1, push: 360, grp: sg });
  } else if (id === 'gigaSlam') {
    E.sound.tone(90, 0.3, 'sawtooth', 0.12, -30); E.sound.noise(0.3, 0.2, 700); E.shake && E.shake(10);
    const gg = { hitBoss: false };
    for (const [dx, dy] of DIRS) st.fx.push({ kind: 'slam', dx, dy, t: 0, life: 0.45, len: 175 * S, w: 56 * S, hit: new Set(), dmg: 2, push: 0, kill: true, giga: true, grp: gg });
  } else if (id === 'currentPush') {
    E.sound.filtered ? E.sound.filtered(0.6, 0.18, 'bandpass', 700, 0.8, 0, 0.05) : E.sound.noise(0.5, 0.15, 700);
    for (const [dx, dy] of DIRS) st.fx.push({ kind: 'wave', dx, dy, t: 0, life: 0.7, reach: 230 * S, w: 70 * S, hit: new Set() });
  } else if (id === 'bubbleTrap') {
    E.sound.tone(600, 0.15, 'sine', 0.07, 400); E.sound.tone(900, 0.1, 'sine', 0.05, 300, 0.06);
    for (const [dx, dy] of DIRS) st.fx.push({ kind: 'bubble', x: P.x + dx * P.r, y: P.y + dy * P.r, vx: dx * 300 * S, vy: dy * 300 * S, t: 0, life: 1.1, r: 14 * S });
  } else if (id === 'lanternPulse') {
    E.sound.tone(660, 0.5, 'sine', 0.07, 0, 0, true); E.sound.tone(990, 0.6, 'triangle', 0.04, 0, 0.1, true);
    st.fx = st.fx.filter(f => f.kind !== 'lantern');
    st.fx.push({ kind: 'lantern', t: 0, life: 4.5, len: 320 * S, w: 46 * S });
  } else if (id === 'reefHook') {
    E.sound.tone(300, 0.2, 'triangle', 0.08, 300);
    for (const [dx, dy] of DIRS) st.fx.push({ kind: 'hook', dx, dy, t: 0, life: 3.2, len: 150 * S, w: 22 * S, held: null });
  } else if (id === 'lightWave') {
    E.sound.tone(880, 0.3, 'triangle', 0.08, 600, 0, true); E.sound.noise(0.3, 0.08, 4000);
    const lg = { hitBoss: false }; // dört yay canavara en fazla bir kez vurur
    for (const [dx, dy] of DIRS) st.fx.push({ kind: 'light', dx, dy, x: P.x, y: P.y, t: 0, life: 0.6, reach: 330 * S, hit: new Set(), grp: lg });
  } else if (id === 'spinTentacles') {
    E.sound.tone(250, 0.45, 'sawtooth', 0.05, 300); E.sound.noise(0.4, 0.08, 1500);
    st.fx.push({ kind: 'spin', t: 0, life: 0.6, R: 105 * S, hit: new Set(), bossHit: false });
  } else if (id === 'vortexPull') {
    E.sound.tone(200, 1.2, 'sine', 0.08, 300); E.sound.noise(1.2, 0.08, 600);
    st.fx = st.fx.filter(f => f.kind !== 'vortex');
    st.fx.push({ kind: 'vortex', t: 0, life: 2.6, R: 230 * S, orbit: 72 * S, caught: new Set() });
  }
  return true;
}

// ---------- Güncelleme ----------
const isShot = e => e.type === 'spike' || e.type === 'blob';
const isSmall = (E, e) => E.enemies.has(e.type) && !isShot(e) && e.type !== 'shark' && !e.dead;
// Okto'dan (dx,dy) yönünde uzanan şeridin içinde mi? (boy: len, yarı genişlik: w)
function inLane(P, dx, dy, len, w, x, y, r) { const ax = x - P.x, ay = y - P.y, a = ax * dx + ay * dy, p = Math.abs(ax * -dy + ay * dx); return a > -r && a < len + r && p < w + r; }
function stun(E, e, sec) { if (!e.stunned) { E.addScore(15); E.track && E.track('stun_day', 1); } e.stunned = true; e.skStun = Math.max(e.skStun || 0, sec); if (e.type === 'shark') { e.warn = 0; } }
function kick(e, vx, vy) { st.pushes.push({ e, vx, vy }); }
function bossIn(E, x, y, r) { const B = E.boss; return B && B.phase === 'fight' && Math.hypot(B.x - x, B.y - B.r * 0.3 - y) < B.r * 0.85 + r; }
function update(E, dt) {
  for (const k in st.cd) if (st.cd[k] > 0) st.cd[k] = Math.max(0, st.cd[k] - dt);
  if (st.lock > 0) st.lock -= dt;
  if (st.hold && !st.hold.open && E.now - st.hold.t > 220) st.hold.open = true; // basılı tutunca açılır
  const P = E.player, S = E.S;
  // kısa süreli sersemleme sayaçları
  for (const e of E.entities) if (e.skStun > 0) { e.skStun -= dt; if (e.skStun <= 0) { e.stunned = false; e.skStun = 0; e.trapped = false; } }
  for (const q of st.pushes) { q.e.x += q.vx * dt; q.e.y += q.vy * dt; const k = Math.pow(0.02, dt); q.vx *= k; q.vy *= k; }
  st.pushes = st.pushes.filter(q => !q.e.dead && Math.hypot(q.vx, q.vy) > 20 * S);
  for (const f of st.fx) {
    f.t += dt;
    if (f.kind === 'ink') {
      const k = Math.min(1, f.t / 0.35), ease = 1 - Math.pow(1 - k, 3);
      f.cx = f.x + f.dx * f.dist * ease; f.cy = f.y + f.dy * f.dist * ease;
      if (f.t < 1.0) for (const e of E.entities) {
        if (!E.enemies.has(e.type) || e.dead || Math.hypot(e.x - f.cx, e.y - f.cy) > f.r + e.r) continue;
        if (isShot(e)) { e.dead = true; E.burst(e.x, e.y, '#6b3fa0', 8, 90); continue; }
        if (!e.stunned) { e.stunned = true; e.skStun = 2.5; E.addScore(15); E.track && E.track('stun_day', 1); if (e.type === 'shark') { e.warn = 0; e.sp *= 0.35; } }
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
    } else if (f.kind === 'slam') { // dokunaç darbesi / dev darbe: uzanır, değdiğini iter (dev darbe yok eder)
      const ext = Math.sin(Math.min(1, f.t / f.life) * Math.PI), len = f.len * ext;
      for (const e of E.entities) {
        if (e.dead || f.hit.has(e) || !(E.enemies.has(e.type)) || !inLane(P, f.dx, f.dy, len, f.w, e.x, e.y, e.r)) continue;
        f.hit.add(e);
        if (isShot(e) || f.kill) { e.dead = true; E.burst(e.x, e.y, f.giga ? '#ffd23f' : '#ff9fc9', 12, 150); E.addScore(20); continue; }
        if (e.type === 'shark') { e.warn = 0; e.sp *= 0.5; }
        stun(E, e, 1.2); kick(e, f.dx * f.push * S, f.dy * f.push * S); E.burst(e.x, e.y, '#ff9fc9', 6, 90);
      }
      if (!f.grp.hitBoss && bossIn(E, P.x + f.dx * len, P.y + f.dy * len, f.w)) { f.grp.hitBoss = true; E.damageBoss(f.dmg); } // dört darbe canavara bir kez
    } else if (f.kind === 'wave') { // akıntı itişi: geniş dalga ilerler, küçük düşmanları savurur
      const k = Math.min(1, f.t / f.life), front = f.reach * (1 - Math.pow(1 - k, 2));
      f.cx = P.x + f.dx * front; f.cy = P.y + f.dy * front;
      for (const e of E.entities) {
        if (e.dead || f.hit.has(e)) continue;
        const ax = e.x - P.x, ay = e.y - P.y, a = ax * f.dx + ay * f.dy, p = Math.abs(ax * -f.dy + ay * f.dx);
        if (a < 0 || a > front + e.r || p > f.w + front * 0.35) continue;
        if (isShot(e)) { e.dead = true; E.burst(e.x, e.y, '#7fd8ff', 8, 90); continue; }
        if (!isSmall(E, e)) continue;
        f.hit.add(e); kick(e, f.dx * 520 * S, f.dy * 520 * S); stun(E, e, 0.8);
      }
    } else if (f.kind === 'bubble') { // kabarcık kapanı: ilk küçük düşmanı içine alır
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < -30 || f.x > E.W + 30 || f.y < -30 || f.y > E.H + 30) { f.done = true; continue; }
      for (const e of E.entities) {
        if (e.dead || Math.hypot(e.x - f.x, e.y - f.y) > e.r + f.r) continue;
        if (isShot(e)) { e.dead = true; f.done = true; E.burst(f.x, f.y, '#bff3ff', 10, 110); break; }
        if (!isSmall(E, e) || e.trapped) continue;
        e.trapped = true; stun(E, e, 3); f.done = true; E.sound.tone(500, 0.2, 'sine', 0.07, 300); E.floater(e.x, e.y - 24 * S, 'yakalandı!', '#bff3ff'); break;
      }
    } else if (f.kind === 'lantern') { // fener nabzı: dört huzme; karanlık mağarayı aydınlatır, değdiği düşmanları gösterir
      for (const e of E.entities) if (E.enemies.has(e.type) && !e.dead && DIRS.some(([dx, dy]) => inLane(P, dx, dy, f.len, f.w, e.x, e.y, e.r))) e.seenT = 0.3;
    } else if (f.kind === 'hook') { // resif kancası: uzanır, ilk küçük düşmanı yakalar ve uzakta tutar
      const ext = Math.min(1, f.t / 0.25), len = f.len * ext;
      if (!f.held && f.t < 0.6) for (const e of E.entities) if (isSmall(E, e) && inLane(P, f.dx, f.dy, len, f.w, e.x, e.y, e.r)) { f.held = e; stun(E, e, 3.2); E.sound.tone(400, 0.12, 'square', 0.05); break; }
      if (f.held) { if (f.held.dead) f.held = null; else { f.held.x = P.x + f.dx * f.len; f.held.y = P.y + f.dy * f.len; } }
      else if (f.t > 0.6) f.done = true; // boşa uzandı: geri çekil
    } else if (f.kind === 'light') { // ışık dalgası: ilerleyen yay, değdiği düşmanı yok eder
      const k = Math.min(1, f.t / f.life), front = f.reach * k;
      f.cx = P.x + f.dx * front; f.cy = P.y + f.dy * front;
      for (const e of E.entities) {
        if (e.dead || f.hit.has(e) || !E.enemies.has(e.type)) continue;
        const ax = e.x - P.x, ay = e.y - P.y, a = ax * f.dx + ay * f.dy, p = Math.abs(ax * -f.dy + ay * f.dx);
        if (Math.abs(a - front) > 22 * S + e.r || p > 40 * S + front * 0.5) continue;
        f.hit.add(e); e.dead = true; E.burst(e.x, e.y, '#fff3a0', 12, 150); E.addScore(20);
      }
      if (!f.grp.hitBoss && bossIn(E, f.cx, f.cy, 24 * S)) { f.grp.hitBoss = true; E.damageBoss(1); }
    } else if (f.kind === 'spin') { // dönen dokunaçlar: dört dokunaç Okto'nun çevresini süpürür (çaprazlar dahil)
      const ang = (f.t / f.life) * Math.PI * 0.75;
      for (const e of E.entities) {
        if (e.dead || f.hit.has(e) || !E.enemies.has(e.type)) continue;
        const ax = e.x - P.x, ay = e.y - P.y, d = Math.hypot(ax, ay);
        if (d > f.R + e.r || d < 4) continue;
        const ea = Math.atan2(ay, ax); let hitNow = false;
        for (let i = 0; i < 4; i++) { let diff = ((ea - (i * Math.PI / 2 + ang)) % TAU + TAU) % TAU; if (diff > Math.PI) diff -= TAU; if (Math.abs(diff) < 0.35) hitNow = true; }
        if (!hitNow) continue;
        f.hit.add(e);
        if (isShot(e)) { e.dead = true; E.burst(e.x, e.y, '#ff9fc9', 8, 90); continue; }
        stun(E, e, 1.5); kick(e, ax / d * 380 * S, ay / d * 380 * S);
      }
      if (!f.bossHit && bossIn(E, P.x, P.y, f.R)) { f.bossHit = true; E.damageBoss(1); }
    } else if (f.kind === 'vortex') { // girdap çekişi: çevredeki küçük düşmanları Okto'nun etrafında döndürür
      const pull = f.t < f.life - 0.4;
      for (const e of E.entities) {
        if (!isSmall(E, e)) continue;
        const ax = e.x - P.x, ay = e.y - P.y, d = Math.hypot(ax, ay) || 1;
        if (!f.caught.has(e) && d < f.R && pull) { f.caught.add(e); stun(E, e, f.life - f.t + 1); }
        if (!f.caught.has(e)) continue;
        if (pull) { const a = Math.atan2(ay, ax) + dt * 3.2, rr = d + (f.orbit - d) * Math.min(1, dt * 4); e.x = P.x + Math.cos(a) * rr; e.y = P.y + Math.sin(a) * rr; }
        else if (!e.flung) { e.flung = true; kick(e, ax / d * 300 * S, ay / d * 300 * S); }
      }
      for (const e of E.entities) if (isShot(e) && !e.dead && Math.hypot(e.x - P.x, e.y - P.y) < f.orbit + 20 * S) { e.dead = true; E.burst(e.x, e.y, '#8fd8ff', 6, 80); }
    }
    if (f.t >= f.life) f.done = true;
  }
  st.fx = st.fx.filter(f => !f.done);
}
// karanlık mağara için ışıklar (fener nabzının huzmeleri)
function lights(E) {
  const L = [], P = E.player, S = E.S;
  for (const f of st.fx) if (f.kind === 'lantern') {
    const a = f.t < 0.3 ? f.t / 0.3 : f.life - f.t < 0.6 ? (f.life - f.t) / 0.6 : 1;
    for (const [dx, dy] of DIRS) for (let k = 1; k <= 5; k++) L.push({ x: P.x + dx * f.len * k / 5, y: P.y + dy * f.len * k / 5, r: f.w * 1.6, a: 0.9 * a });
  }
  return L;
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
    } else if (f.kind === 'slam') {
      const ext = Math.sin(Math.min(1, f.t / f.life) * Math.PI), len = f.len * ext, w = f.w;
      c.save(); c.translate(P.x, P.y); c.rotate(Math.atan2(f.dy, f.dx));
      c.fillStyle = f.giga ? '#ffd23f' : '#ff7eb6'; c.strokeStyle = f.giga ? '#a86a00' : '#7a1c4f'; c.lineWidth = 2.5 * S;
      c.beginPath(); c.moveTo(P.r * 0.6, -w * 0.55); c.quadraticCurveTo(len * 0.6, -w * 0.8, len, 0); c.quadraticCurveTo(len * 0.6, w * 0.8, P.r * 0.6, w * 0.55); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = f.giga ? '#fff3b0' : '#ffe3f0'; for (let k = 1; k <= 4; k++) { c.beginPath(); c.arc(len * (0.25 + k * 0.15), 0, w * 0.13 * (1.2 - k * 0.15), 0, TAU); c.fill(); }
      c.restore();
    } else if (f.kind === 'wave') {
      const a = 1 - f.t / f.life, front = Math.hypot(f.cx - P.x, f.cy - P.y);
      c.save(); c.translate(P.x, P.y); c.rotate(Math.atan2(f.dy, f.dx)); c.lineCap = 'round';
      for (const [off, al] of [[0, 0.8], [-18 * S, 0.45], [-34 * S, 0.25]]) { c.strokeStyle = `rgba(190,240,255,${al * a})`; c.lineWidth = 6 * S; c.beginPath(); c.arc(off, 0, Math.max(10, front), -0.35 - f.w / (front + 60 * S) * 0.6, 0.35 + f.w / (front + 60 * S) * 0.6); c.stroke(); }
      c.restore();
    } else if (f.kind === 'bubble') {
      c.save(); c.translate(f.x, f.y); c.fillStyle = 'rgba(160,230,255,.3)'; c.strokeStyle = '#dff8ff'; c.lineWidth = 2 * S;
      c.beginPath(); c.arc(0, 0, f.r, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-f.r * 0.35, -f.r * 0.35, f.r * 0.18, 0, TAU); c.fill(); c.restore();
    } else if (f.kind === 'lantern') {
      const a = f.t < 0.3 ? f.t / 0.3 : f.life - f.t < 0.6 ? (f.life - f.t) / 0.6 : 1;
      c.save(); c.globalCompositeOperation = 'lighter'; c.translate(P.x, P.y);
      for (const [dx, dy] of DIRS) {
        const g = c.createLinearGradient(0, 0, dx * f.len, dy * f.len); g.addColorStop(0, `rgba(255,240,150,${0.35 * a})`); g.addColorStop(1, 'rgba(255,240,150,0)');
        const px = -dy, py = dx; c.fillStyle = g; c.beginPath(); c.moveTo(px * 10 * S, py * 10 * S); c.lineTo(dx * f.len + px * f.w, dy * f.len + py * f.w); c.lineTo(dx * f.len - px * f.w, dy * f.len - py * f.w); c.lineTo(-px * 10 * S, -py * 10 * S); c.fill();
      }
      c.restore();
    } else if (f.kind === 'hook') {
      const ext = f.held ? 1 : f.t < 0.25 ? f.t / 0.25 : Math.max(0, 1 - (f.t - 0.25) / 0.35), len = f.len * ext;
      c.save(); c.translate(P.x, P.y); c.rotate(Math.atan2(f.dy, f.dx)); c.lineCap = 'round';
      c.strokeStyle = '#ff7eb6'; c.lineWidth = 7 * S; c.beginPath(); c.moveTo(P.r * 0.6, 0);
      for (let k = 0; k <= 10; k++) { const x = P.r * 0.6 + (len - P.r * 0.6) * k / 10; c.lineTo(x, Math.sin(k * 1.3 + f.t * 8) * 3 * S); } c.stroke();
      c.strokeStyle = '#ffe3f0'; c.lineWidth = 3 * S; c.beginPath(); c.arc(len, 0, 8 * S, -1.2, 1.8); c.stroke();
      c.restore();
    } else if (f.kind === 'light') {
      const a = 1 - f.t / f.life, front = Math.hypot(f.cx - P.x, f.cy - P.y), half = Math.min(0.55, (40 * S + front * 0.5) / Math.max(front, 1)); // dört ayrı yay
      c.save(); c.globalCompositeOperation = 'lighter'; c.translate(P.x, P.y); c.rotate(Math.atan2(f.dy, f.dx)); c.lineCap = 'round';
      c.strokeStyle = `rgba(255,246,176,${0.9 * a})`; c.lineWidth = 9 * S; c.beginPath(); c.arc(0, 0, Math.max(10, front), -half, half); c.stroke();
      c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 3 * S; c.beginPath(); c.arc(0, 0, Math.max(10, front), -half * 0.8, half * 0.8); c.stroke();
      c.restore();
    } else if (f.kind === 'spin') {
      const ang = (f.t / f.life) * Math.PI * 0.75, a = 1 - Math.max(0, f.t - f.life * 0.7) / (f.life * 0.3);
      c.save(); c.translate(P.x, P.y); c.globalAlpha = a; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const b = i * Math.PI / 2 + ang;
        c.strokeStyle = 'rgba(255,126,182,.35)'; c.lineWidth = 16 * S; c.beginPath(); c.arc(0, 0, f.R * 0.75, b - 0.6, b); c.stroke();
        c.strokeStyle = '#ff7eb6'; c.lineWidth = 9 * S; c.beginPath(); c.moveTo(Math.cos(b) * P.r * 0.6, Math.sin(b) * P.r * 0.6); c.lineTo(Math.cos(b) * f.R, Math.sin(b) * f.R); c.stroke();
        c.fillStyle = '#ffe3f0'; c.beginPath(); c.arc(Math.cos(b) * f.R, Math.sin(b) * f.R, 5 * S, 0, TAU); c.fill();
      }
      c.restore();
    } else if (f.kind === 'vortex') {
      const a = f.t < 0.3 ? f.t / 0.3 : f.life - f.t < 0.5 ? (f.life - f.t) / 0.5 : 1;
      c.save(); c.translate(P.x, P.y); c.globalAlpha = 0.7 * a; c.lineCap = 'round';
      for (let arm = 0; arm < 3; arm++) { c.beginPath(); for (let k = 0; k <= 40; k++) { const s2 = k / 40, ang = arm * TAU / 3 + s2 * 4 - f.t * 6, r = f.orbit * 0.5 + s2 * (f.R - f.orbit * 0.5); c.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); } c.strokeStyle = 'rgba(143,216,255,.6)'; c.lineWidth = 4 * S; c.stroke(); }
      c.restore();
    }
  }
  // kabarcığa yakalanan / fenerle görülen düşmanlar
  for (const e of E.entities) {
    if (e.trapped && !e.dead) { c.save(); c.translate(e.x, e.y); c.fillStyle = 'rgba(160,230,255,.25)'; c.strokeStyle = '#dff8ff'; c.lineWidth = 2 * S; c.beginPath(); c.arc(0, 0, e.r * 1.5, 0, TAU); c.fill(); c.stroke(); c.restore(); }
    if (e.seenT > 0) { e.seenT -= 1 / 60; c.save(); c.strokeStyle = 'rgba(255,240,150,.8)'; c.lineWidth = 2 * S; c.setLineDash([5 * S, 4 * S]); c.beginPath(); c.arc(e.x, e.y, e.r * 1.4, 0, TAU); c.stroke(); c.restore(); }
  }
}

// ---------- Çizim: yeni halka "inci kabarcık halkası" (s38, test adresinde) ----------
// Okto'nun çevresinde yarı saydam cam halka; beceriler halkanın üstünde inci gibi parlayan kabarcıklarda.
// Seçilen kabarcık büyür, altın parlar, adı altında yazar; Okto'dan ona küçük bir ok uzanır. Bekleme: kabarcıkta kararan dilim + saniye.
let ringStyle = 'klasik';
function drawRingPearl(c, E) {
  const h = st.hold; if (!h || !h.open) return;
  const P = E.player, S = E.S, R = 92 * S, n = st.equipped.length, ANG = slotAng(n);
  const cx = clamp(P.x, R + 46 * S, E.W - R - 46 * S), cy = clamp(P.y, R + 80 * S, E.H - R - 110 * S), t = E.time || 0;
  c.save();
  const vg = c.createRadialGradient(cx, cy, R * 0.6, cx, cy, Math.max(E.W, E.H) * 0.8); vg.addColorStop(0, 'rgba(2,12,34,.15)'); vg.addColorStop(1, 'rgba(2,12,34,.55)');
  c.fillStyle = vg; c.fillRect(0, 0, E.W, E.H); // kenarlara doğru kararan arka plan
  c.translate(cx, cy);
  c.strokeStyle = 'rgba(190,240,255,.28)'; c.lineWidth = 18 * S; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke(); // cam halka
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2 * S; c.beginPath(); c.arc(0, 0, R + 9 * S, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(0, 0, R - 9 * S, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + t * 0.4; c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(Math.cos(a) * R, Math.sin(a) * R, 1.8 * S, 0, Math.PI * 2); c.fill(); } // halkada dönen kabarcıklar
  const hv = h.hover; // Okto'dan seçilen kabarcığa ok
  if (hv != null && n > 1) { const a = ANG[hv], l = R - 40 * S; c.strokeStyle = 'rgba(255,215,90,.9)'; c.lineWidth = 4 * S; c.lineCap = 'round'; c.beginPath(); c.moveTo(Math.cos(a) * 34 * S, Math.sin(a) * 34 * S); c.lineTo(Math.cos(a) * l, Math.sin(a) * l); c.stroke();
    c.fillStyle = 'rgba(255,215,90,.95)'; c.beginPath(); c.moveTo(Math.cos(a) * (l + 10 * S), Math.sin(a) * (l + 10 * S)); c.lineTo(Math.cos(a + 0.35) * (l - 6 * S), Math.sin(a + 0.35) * (l - 6 * S)); c.lineTo(Math.cos(a - 0.35) * (l - 6 * S), Math.sin(a - 0.35) * (l - 6 * S)); c.closePath(); c.fill(); }
  for (let i = 0; i < n; i++) {
    const a = ANG[i], on = i === hv, id = st.equipped[i], d = byId(id), cdl = st.cd[id] || 0;
    const x = n === 1 ? 0 : Math.cos(a) * R, y = n === 1 ? -R : Math.sin(a) * R, r = (on ? 40 : 31) * S;
    if (on) { const g = c.createRadialGradient(x, y, r * 0.6, x, y, r * 1.7); g.addColorStop(0, 'rgba(255,215,90,.55)'); g.addColorStop(1, 'rgba(255,215,90,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.7, 0, Math.PI * 2); c.fill(); }
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, on ? '#fff6d8' : '#e9f6ff'); g.addColorStop(0.55, on ? '#f3c95a' : '#3c6fa8'); g.addColorStop(1, on ? '#b07a00' : '#16345e');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = on ? '#fff3c4' : 'rgba(255,255,255,.6)'; c.lineWidth = (on ? 4 : 2.5) * S; c.stroke();
    c.save(); c.translate(x, y); (ICONS[id] || ICONS.generic)(c, r * 0.72); c.restore();
    if (cdl > 0) { c.fillStyle = 'rgba(5,15,35,.62)'; c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cdl / d.cd)); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.font = `700 ${16 * S}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(Math.ceil(cdl), x, y); }
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.45, r * 0.22, r * 0.11, -0.5, 0, Math.PI * 2); c.fill(); // inci parıltısı
    if (on) { // ad etiketi
      c.font = `700 ${13 * S}px Fredoka, sans-serif`; const label = d.name, tw = c.measureText(label).width + 18 * S, ly = y + r + 16 * S;
      c.fillStyle = 'rgba(40,24,0,.85)'; c.beginPath(); c.roundRect(x - tw / 2, ly - 11 * S, tw, 22 * S, 11 * S); c.fill(); c.strokeStyle = '#ffd36b'; c.lineWidth = 1.5 * S; c.stroke();
      c.fillStyle = '#ffe9a8'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x, ly);
    }
  }
  c.restore();
}
// ---------- Çizim: halka (Okto'nun çevresinde) ----------
function drawRing(c, E) {
  if (ringStyle === 'inci') return drawRingPearl(c, E);
  const h = st.hold; if (!h || !h.open) return;
  const P = E.player, S = E.S, R0 = 36 * S, R1 = 104 * S;
  c.save();
  c.fillStyle = 'rgba(2,10,30,.35)'; c.fillRect(0, 0, E.W, E.H); // arka plan biraz kararır
  c.translate(clamp(P.x, R1 + 8, E.W - R1 - 8), clamp(P.y, R1 + 70 * S, E.H - R1 - 90 * S));
  const n = st.equipped.length, ANG = slotAng(n), half = n >= 3 ? Math.PI / 3 : n === 2 ? Math.PI / 2 : Math.PI;
  for (let i = 0; i < n; i++) {
    const a = ANG[i], on = i === h.hover, id = st.equipped[i], d = byId(id), cdl = st.cd[id] || 0;
    c.beginPath(); c.arc(0, 0, R1 + (on ? 6 * S : 0), a - half + 0.04, a + half - 0.04); c.arc(0, 0, R0, a + half - 0.04, a - half + 0.04, true); c.closePath();
    c.fillStyle = on ? 'rgba(255,215,90,.92)' : 'rgba(20,40,80,.82)'; c.fill();
    c.lineWidth = 3 * S; c.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.35)'; c.stroke();
    const mx = n === 1 ? 0 : Math.cos(a) * (R0 + R1) / 2, my = Math.sin(a) * (R0 + R1) / 2;
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
  for (let i = 0; i < st.equipped.length; i++) { c.fillStyle = i === st.sel ? '#ffd36b' : 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(cx + (i - 1) * 16, s - 26, 5, 0, TAU); c.fill(); }
  if (!ready) { c.fillStyle = '#fff'; c.font = '700 30px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(Math.ceil(cdl), cx, cx - 2); }
}

function reset() { st.cd = {}; st.fx = []; st.pushes = []; st.hold = null; st.lock = 0; if (st.sel >= st.equipped.length) st.sel = 0; }
// ---------- Açılma (Kaşif Puanı) ----------
const unlockedIds = xp => DEFS.filter(d => d.xp <= xp).map(d => d.id);
const nextUnlock = xp => DEFS.filter(d => d.xp > xp).sort((a, b) => a.xp - b.xp)[0] || null;
// kayıtlı profil: { xp, equipped } → durumu yükle (kuşanılmış ama açılmamış/çalışmayan beceriler çıkarılır)
function load(prof) {
  const ok = new Set(unlockedIds(prof.xp)), eq = (prof.equipped || []).filter(id => ok.has(id) && byId(id) && byId(id).ready).slice(0, 3);
  st.equipped = eq.length ? eq : ['inkFan']; prof.equipped = st.equipped.slice(); if (st.sel >= st.equipped.length) st.sel = 0;
}
// puan ekle; yeni açılan becerileri döndür (boş yuva varsa otomatik kuşanılır)
function addXp(prof, n) {
  const before = new Set(unlockedIds(prof.xp)); prof.xp = Math.max(0, Math.round(prof.xp + n));
  const fresh = DEFS.filter(d => d.xp <= prof.xp && !before.has(d.id));
  for (const d of fresh) if (d.ready && st.equipped.length < 3 && !st.equipped.includes(d.id)) st.equipped.push(d.id);
  prof.equipped = st.equipped.slice();
  return fresh;
}
function toggleEquip(prof, id) { // menüden kuşan / çıkar; en az bir beceri kalır, en fazla üç
  const d = byId(id); if (!d || !d.ready || d.xp > prof.xp) return 'kilitli';
  const i = st.equipped.indexOf(id);
  if (i >= 0) { if (st.equipped.length === 1) return 'enaz'; st.equipped.splice(i, 1); if (st.sel >= st.equipped.length) st.sel = 0; }
  else { if (st.equipped.length >= 3) return 'dolu'; st.equipped.push(id); }
  prof.equipped = st.equipped.slice(); return 'tamam';
}
window.OktoSkills = {
  DEFS, ICONS, state: st, byId, unlockedIds, nextUnlock, load, addXp, toggleEquip,
  get selected() { return st.equipped[st.sel]; }, get ringOpen() { return !!(st.hold && st.hold.open); },
  refill() { st.cd = {}; }, // deniz yıldızı: bütün bekleme süreleri dolar
  setEquipped(list) { if (Array.isArray(list) && list.length === 3) st.equipped = list.slice(); },
  select(i) { st.sel = clamp(i | 0, 0, 2); },
  setRingStyle(v) { ringStyle = v === 'inci' ? 'inci' : 'klasik'; }, get ringStyle() { return ringStyle; },
  lights, down, move, up, cancel, activate, update, drawFx, drawRing, drawButton, shielding, timeScale, reset,
};
})();

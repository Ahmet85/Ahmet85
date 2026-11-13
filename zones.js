/* OKTO özel bölgeleri: Güçlü Akıntı, Karanlık Mağara, Batık Gemi, Sıcak Bacalar, Yosun Ormanı, Mayın Tarlası, Kaçış Sahnesi;
   s46 Buzul Denizi: Buz Sarkıtları (sarkit), Kayan Buzdağları (buzdag), Kaygan Buz Akıntısı (kaygan), Kuzey Işığı Çukuru (isik).
   Mantık ve çizimler burada; game.js her karede bir "env" (ortam) nesnesi verir:
   env = { W, H, S, dt, time, scroll, tier, player, target, entities, rocks,
           hurt(), push(dx,dy), burst(x,y,col,n,sp), floater(x,y,txt,col), toast(t), banner(t,sub,col),
           addScore(n), pearls(x,y,n,spread), gift(x,y), sound, freeAt(x,y,r), big, ink }
   OktoZones.enter(type, env) / exit(env) / update(env) / drawBack(ctx, env) / drawMid(ctx, env) / drawFront(ctx, env)
   OktoZones.overlay(ctx, env, lights) / collide(env) / onInk(x, y, R, env) / onBomb(env) / speed() / slow() */
(() => {
'use strict';
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

let Z = null; // etkin bölge durumu
const NAMES = {
  akinti: 'Güçlü Akıntı', magara: 'Karanlık Mağara', gemi: 'Batık Gemi', baca: 'Sıcak Bacalar',
  yosun: 'Yosun Ormanı', mayin: 'Mayın Tarlası', kacis: 'KAÇ! Fener Balığı Geliyor',
  sarkit: 'Buz Sarkıtları', buzdag: 'Kayan Buzdağları', kaygan: 'Kaygan Buz Akıntısı', isik: 'Kuzey Işığı Çukuru',
};
const HINTS = {
  akinti: 'Akıntı seni sürüklüyor, karşı koy!', magara: 'Işığı takip et, fener balıklarına dikkat!',
  gemi: 'Gemi kapısından içeri gir: gizli oda!', baca: 'Titreyen bacadan uzak dur!',
  yosun: 'Yosunlar yavaşlatır ama saklar', mayin: 'Mürekkeple patlat, zincirleme bonus!', kacis: 'Aşağıda kal, ağzına yakalanma!',
  sarkit: 'Tepede gölge büyürse çekil, sarkıt düşüyor!', buzdag: 'Buz blokları kayıyor, boşluktan geç!',
  kaygan: 'Buz kaygan: Okto kayar, erken dön!', isik: 'Işık hüzmelerindeki incileri topla!',
};

function enter(type, env) {
  Z = { type, t: 0, items: [], streaks: [], dir: Math.random() < 0.5 ? -1 : 1, spawnT: 0.4, dark: 0, chase: null, ship: null };
  const { W, H, S } = env;
  if (type === 'akinti') for (let i = 0; i < 26; i++) Z.streaks.push({ x: rand(0, W), y: rand(0, H), len: rand(30, 70) * S, sp: rand(0.8, 1.4) });
  if (type === 'kacis') Z.chase = { y: -260 * S, target: 110 * S + env.safeTop, hitT: 0, eye: 0 };
  if (type === 'kaygan') for (let i = 0; i < 18; i++) Z.streaks.push({ x: rand(0, W), y: rand(0, H), len: rand(40, 110) * S, sp: rand(0.6, 1.2) });
  if (type === 'isik') Z.beams = [0.2, 0.5, 0.8].map((k, i) => ({ k, x: W * k, ph: rand(0, TAU), col: ['120,255,200', '180,140,255', '120,200,255'][i] }));
  env.toast(NAMES[type] + ': ' + HINTS[type]);
  if (type === 'kacis') { env.banner('KAÇ!', 'Kocaman fener balığı kovalıyor', '#ff8a8a', 2.4); env.sound.bossWarn(); }
}
function exit() { Z = null; }
const active = () => Z && Z.type;
// dünya kayma hızı çarpanı (kaçışta hızlanır) ve Okto hareket çarpanı (yosunda yavaş)
function speed() { return Z && Z.type === 'kacis' ? 1.6 : 1; }
function slow() { return Z && Z.type === 'yosun' ? 0.5 : Z && Z.type === 'kaygan' ? 0.28 : 1; } // kaygan buzda Okto geç döner

// ---------- Güncelleme ----------
function update(env) {
  if (!Z) return;
  const { W, H, S, dt, scroll } = env, p = env.player;
  Z.t += dt; Z.spawnT -= dt;
  for (const it of Z.items) { if (!it.fixed) it.y -= scroll * dt; it.t = (it.t || 0) + dt; }

  if (Z.type === 'akinti') {
    // akıntı Okto'yu ve serbest nesneleri yana sürükler (Dev Okto'yu daha az)
    const f = Z.dir * 75 * S * (env.big ? 0.4 : 1);
    env.push(f * dt, 0);
    for (const e of env.entities) if (!e.fixed && e.type !== 'pearl') e.x += Z.dir * 45 * S * dt;
    for (const s of Z.streaks) { s.x += Z.dir * 260 * S * s.sp * dt; s.y -= scroll * dt * 0.6; if (s.x > W + 80 || s.x < -80) s.x = Z.dir > 0 ? -60 : W + 60; if (s.y < -10) s.y += H + 20; }
    if (Z.spawnT <= 0) { // akıntı boyunca inci şeridi
      Z.spawnT = rand(1.6, 2.4); const y = H + 30 * S, x0 = Z.dir > 0 ? W * 0.15 : W * 0.85;
      env.pearls(x0, y, 5, Z.dir * 34 * S);
    }
  }
  if (Z.type === 'magara') {
    Z.dark = Math.min(1, Z.dark + dt * 0.8);
    if (Z.spawnT <= 0) { Z.spawnT = rand(0.15, 0.3); Z.items.push({ kind: 'plankton', x: rand(0, W), y: H + 10, r: rand(1.5, 3.5) * S, ph: rand(0, TAU) }); }
  }
  if (Z.type === 'gemi') {
    if (!Z.ship && Z.t > 0.8) { // tek büyük batık gemi geçer
      const w = W * 0.95, side = Math.random() < 0.5 ? -1 : 1;
      Z.ship = { x: W / 2, y: H + w * 0.5, w, side, door: { dx: side * w * 0.12, dy: w * 0.05, r: 34 * S, used: false }, cannonT: 1.5 };
    }
    const sh = Z.ship;
    if (sh) {
      sh.y -= scroll * dt;
      // kapı: içeri girince gizli oda hazinesi
      const dx = sh.x + sh.door.dx, dy = sh.y + sh.door.dy;
      if (!sh.door.used && Math.hypot(p.x - dx, p.y - dy) < sh.door.r + p.r * 0.6) {
        sh.door.used = true; env.sound.giftOpen(); env.addScore(150);
        env.banner('GİZLİ ODA!', '+150 puan ve hazine', '#ffcf6b', 2);
        env.pearls(dx, dy - 40 * S, 12, 0); env.gift(dx, dy - 90 * S); env.burst(dx, dy, '#ffe28a', 26, 200);
      }
      // gemi topları: yan taraftan uyarılı gülle
      sh.cannonT -= dt;
      if (sh.cannonT <= 0 && sh.y > H * 0.2 && sh.y < H * 1.1) {
        sh.cannonT = rand(1.6, 2.4);
        const y = clamp(p.y + rand(-40, 40) * S, 120 * S + env.safeTop, H - 60 * S), from = Math.random() < 0.5 ? -1 : 1;
        Z.items.push({ kind: 'ball', fixed: true, x: from < 0 ? -30 * S : W + 30 * S, y, vx: -from * 260 * S, warn: 0.85, r: 11 * S, from });
      }
      if (sh.y < -sh.w) Z.ship = null;
    }
    for (const b of Z.items) if (b.kind === 'ball') { if (b.warn > 0) b.warn -= dt; else b.x += b.vx * dt; }
  }
  if (Z.type === 'baca') {
    if (Z.spawnT <= 0 && Z.items.filter(v => v.kind === 'vent').length < 3) { // bacalar aşağıdan gelir
      const lanes = [0.18, 0.5, 0.82], x = W * lanes[Math.floor(Math.random() * 3)] + rand(-20, 20) * S;
      if (env.freeAt(x, H + 40 * S, 30 * S) && !Z.items.some(v => v.kind === 'vent' && Math.abs(v.x - x) < 70 * S && v.y > H * 0.6)) {
        Z.items.push({ kind: 'vent', x, y: H + 50 * S, r: 18 * S, cycle: rand(0, 1.5), state: 'idle' });
        Z.spawnT = rand(1.4, 2.2);
      } else Z.spawnT = 0.3;
    }
    for (const v of Z.items) if (v.kind === 'vent') { // döngü: bekle 1.4 sn → titre 0.8 sn → püskür 0.9 sn
      v.cycle += dt; const c = v.cycle % 3.1;
      const st = c < 1.4 ? 'idle' : c < 2.2 ? 'warn' : 'jet';
      if (st === 'jet' && v.state !== 'jet') env.sound.noise(0.7, 0.12, 1200);
      v.state = st;
    }
  }
  if (Z.type === 'yosun') {
    if (Z.spawnT <= 0) {
      Z.spawnT = rand(0.35, 0.6);
      Z.items.push({ kind: 'kelp', x: rand(0, 1) < 0.5 ? rand(0, W * 0.35) : rand(W * 0.65, W), y: H + 220 * S, h: rand(220, 380) * S, ph: rand(0, TAU), front: Math.random() < 0.3 });
      if (Math.random() < 0.3) env.pearls(rand(W * 0.1, W * 0.9), H + 40 * S, 3, 0); // yosunlar arasında saklı inciler
    }
    // köpekbalıkları ve fener balıkları Okto'yu yosunda göremez
    for (const e of env.entities) if ((e.type === 'shark' && e.warn > 0) || e.type === 'angler') e.blind = true;
  }
  if (Z.type === 'mayin') {
    if (Z.spawnT <= 0) {
      Z.spawnT = rand(0.7, 1.1);
      const x = rand(30, W - 30), y = H + 30 * S;
      if (env.freeAt(x, y, 30 * S) && !Z.items.some(m => m.kind === 'mine' && Math.hypot(m.x - x, m.y - y) < 90 * S)) Z.items.push({ kind: 'mine', x, y, r: 16 * S, ph: rand(0, TAU), boom: -1 });
    }
    for (const m of Z.items) if (m.kind === 'mine' && m.boom > 0) { m.boom -= dt; if (m.boom <= 0) explode(m, env, true); }
  }
  if (Z.type === 'kacis') {
    const c = Z.chase;
    c.y = lerp(c.y, c.target, dt * 0.8);
    c.target = Math.min(c.target + 9 * S * dt, H * 0.5); // yavaş yavaş aşağı sokulur
    if (c.hitT > 0) c.hitT -= dt;
    c.eye += dt;
  }
  // ---- s46 Buzul Denizi ----
  if (Z.type === 'sarkit') { // tepeden düşen buz sarkıtları: önce gölge/işaret, sonra düşüş
    if (Z.spawnT <= 0) {
      Z.spawnT = rand(0.9, 1.4);
      const x = Math.random() < 0.55 ? clamp(p.x + rand(-50, 50) * S, 24 * S, W - 24 * S) : rand(24 * S, W - 24 * S);
      Z.items.push({ kind: 'icicle', fixed: true, x, y: env.safeTop + 18 * S, vy: 0, warn: 0.9, l: rand(34, 48) * S });
      if (Math.random() < 0.35) env.pearls(rand(W * 0.15, W * 0.85), H + 30 * S, 3, 22 * S);
    }
    for (const ic of Z.items) if (ic.kind === 'icicle') { if (ic.warn > 0) ic.warn -= dt; else { ic.vy += 900 * S * dt; ic.y += ic.vy * dt; if (ic.y > H + 60 * S) ic.dead = true; } }
  }
  if (Z.type === 'buzdag') { // yana kayan buz blokları: her sırada tek blok, kenarlarda seker
    if (Z.spawnT <= 0) {
      Z.spawnT = rand(1.3, 1.9);
      const w = rand(0.32, 0.46) * W, dir = Math.random() < 0.5 ? -1 : 1;
      Z.items.push({ kind: 'berg', x: rand(w / 2, W - w / 2), y: H + 40 * S, w, h: rand(34, 48) * S, vx: dir * rand(50, 85) * S });
    }
    for (const b of Z.items) if (b.kind === 'berg') { b.x += b.vx * dt; if (b.x < b.w / 2 || b.x > W - b.w / 2) { b.vx = -b.vx; b.x = clamp(b.x, b.w / 2, W - b.w / 2); } }
  }
  if (Z.type === 'kaygan') { // kaygan buz: parıltı çizgileri ve inci şeritleri; hareket çarpanı slow() ile
    for (const st of Z.streaks) { st.y -= scroll * dt * 1.2 * st.sp; if (st.y < -10) { st.y += H + 20; st.x = rand(0, W); } }
    if (Z.spawnT <= 0) { Z.spawnT = rand(1.4, 2.0); env.pearls(rand(W * 0.15, W * 0.55), H + 30 * S, 5, 30 * S); }
  }
  if (Z.type === 'isik') { // kuzey ışığı: hüzmeler süzülür; inciler hüzmelerin içinde doğar
    Z.dark = Math.min(1, Z.dark + dt * 0.8);
    for (const b of Z.beams) b.x = W * (b.k + Math.sin(env.time * 0.35 + b.ph) * 0.08);
    if (Z.spawnT <= 0) { Z.spawnT = rand(0.7, 1.1); const b = Z.beams[Math.floor(Math.random() * 3)]; env.pearls(b.x + rand(-14, 14) * S, H + 20 * S, 2, 0); }
  }
  Z.items = Z.items.filter(it => !it.dead && it.y > -400 * S && it.x > -120 * S && it.x < W + 120 * S);
}

function explode(m, env, chain) {
  if (m.dead) return; m.dead = true;
  env.burst(m.x, m.y, '#ffb347', 22, 220); env.burst(m.x, m.y, '#fff3a0', 10, 120); env.sound.bomb();
  const p = env.player;
  if (!chain && Math.hypot(p.x - m.x, p.y - m.y) < 60 * env.S) env.hurt();
  if (chain) { env.addScore(30); env.floater(m.x, m.y, '+30 zincir!', '#ffcf6b'); }
  for (const o of Z.items) if (o.kind === 'mine' && !o.dead && o.boom < 0 && Math.hypot(o.x - m.x, o.y - m.y) < 110 * env.S) o.boom = 0.18; // zincirleme
}

// ---------- Çarpışmalar ----------
function collide(env) {
  if (!Z) return;
  const p = env.player, S = env.S;
  if (Z.type === 'gemi') for (const b of Z.items) if (b.kind === 'ball' && b.warn <= 0 && Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r * 0.6) { if (!env.big) env.hurt(); b.dead = true; env.burst(b.x, b.y, '#555', 10, 120); }
  if (Z.type === 'baca') for (const v of Z.items) if (v.kind === 'vent') {
    if (v.state === 'jet' && Math.abs(p.x - v.x) < 26 * S + p.r * 0.5 && p.y < v.y && p.y > v.y - env.H * 0.55 && !env.big) env.hurt();
    if (Math.hypot(p.x - v.x, p.y - v.y) < v.r + p.r * 0.6 && !env.big) { env.hurt(); env.push((p.x - v.x) > 0 ? 40 * S : -40 * S, -30 * S); }
  }
  if (Z.type === 'mayin') for (const m of Z.items) if (m.kind === 'mine' && !m.dead && Math.hypot(p.x - m.x, p.y - m.y) < m.r + p.r * 0.6) {
    if (env.big) { explode(m, env, true); } else { explode(m, env, false); }
  }
  if (Z.type === 'sarkit' || Z.type === 'buzdag') collideIce(env);
  if (Z.type === 'kacis') {
    const c = Z.chase, mouth = c.y + 60 * S;
    if (p.y < mouth && c.hitT <= 0) { c.hitT = 1.2; if (!env.big) env.hurt(); env.push(0, 140 * S); c.target = Math.max(c.target - 80 * S, 80 * S + env.safeTop); env.sound.crush(); }
  }
}
function collideIce(env) { // s46: buz sarkıtı ve buz bloğu çarpışmaları
  const p = env.player, S = env.S;
  for (const it of Z.items) {
    if (it.kind === 'icicle' && it.warn <= 0 && Math.abs(p.x - it.x) < 9 * S + p.r * 0.55 && p.y > it.y - it.l && p.y < it.y + p.r * 0.5) {
      it.dead = true; env.burst(it.x, it.y, '#e6f8ff', 12, 140); env.sound.noise(0.2, 0.1, 3000); if (!env.big) env.hurt();
    }
    if (it.kind === 'berg' && Math.abs(p.x - it.x) < it.w / 2 + p.r * 0.5 && Math.abs(p.y - it.y) < it.h / 2 + p.r * 0.5) {
      if (env.big) { it.dead = true; env.burst(it.x, it.y, '#e6f8ff', 20, 180); env.addScore(25); continue; }
      env.hurt(); env.push(0, (p.y < it.y ? -1 : 1) * 60 * S);
    }
  }
}
function onInk(x, y, R, env) { // mürekkep bulutu mayınları güvenle patlatır
  if (!Z || Z.type !== 'mayin') return;
  for (const m of Z.items) if (m.kind === 'mine' && !m.dead && Math.hypot(m.x - x, m.y - y) < R + m.r) { m.boom = 0.05; }
}
function onBomb(env) { // ışık bombası: mayınları ve gülleleri temizler
  if (!Z) return;
  for (const it of Z.items) { if (it.kind === 'mine' && !it.dead) explode(it, env, true); if (it.kind === 'ball' || it.kind === 'icicle') it.dead = true; }
}
function freeOf(x, y, r) { // yeni nesneler mayın/baca içine doğmasın
  if (!Z) return true;
  for (const it of Z.items) {
    if ((it.kind === 'mine' || it.kind === 'vent') && Math.hypot(it.x - x, it.y - y) < (it.r || 16) + r + 10) return false;
    if (it.kind === 'berg' && Math.abs(it.x - x) < it.w / 2 + r && Math.abs(it.y - y) < it.h / 2 + r + 10) return false;
  }
  return true;
}

// ---------- Çizim ----------
function drawBack(ctx, env) {
  if (!Z) return;
  const { W, H, S, time } = env;
  if (Z.type === 'akinti') {
    ctx.save(); ctx.fillStyle = 'rgba(180,240,255,.06)'; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (const s of Z.streaks) { ctx.strokeStyle = `rgba(225,252,255,${0.32 + 0.25 * s.sp})`; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - Z.dir * s.len, s.y); ctx.stroke(); }
    ctx.restore();
  }
  if (Z.type === 'gemi' && Z.ship) drawShip(ctx, Z.ship, env);
  if (Z.type === 'yosun') for (const k of Z.items) if (k.kind === 'kelp' && !k.front) drawKelp(ctx, k, env, 1);
  if (Z.type === 'kaygan') { // buz yüzeyi parıltıları
    ctx.save(); ctx.fillStyle = 'rgba(220,245,255,.07)'; ctx.fillRect(0, 0, W, H); ctx.lineCap = 'round';
    for (const st of Z.streaks) { ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.25 * st.sp})`; ctx.lineWidth = 2.5 * S; ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.lineTo(st.x + st.len, st.y + st.len * 0.08); ctx.stroke(); }
    ctx.restore();
  }
  if (Z.type === 'isik') { // kuzey ışığı hüzmeleri
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of Z.beams) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(${b.col},.32)`); g.addColorStop(1, `rgba(${b.col},0)`); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(b.x - 24 * S, 0); ctx.lineTo(b.x + 24 * S, 0); ctx.lineTo(b.x + 58 * S, H); ctx.lineTo(b.x - 58 * S, H); ctx.fill(); }
    ctx.restore();
  }
}
function drawMid(ctx, env) {
  if (!Z) return;
  const { W, H, S, time } = env;
  for (const it of Z.items) {
    if (it.kind === 'ball') {
      if (it.warn > 0) {
        const wx = it.from < 0 ? 26 * S : W - 26 * S; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 18);
        ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(wx, it.y, 16 * S, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(wx - 2 * S, it.y - 9 * S, 4 * S, 11 * S); ctx.fillRect(wx - 2 * S, it.y + 4 * S, 4 * S, 4 * S); ctx.globalAlpha = 1;
      } else {
        const g = ctx.createRadialGradient(it.x - 4 * S, it.y - 4 * S, 1, it.x, it.y, it.r); g.addColorStop(0, '#8a8f99'); g.addColorStop(1, '#23262d');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(it.x + Math.sign(it.vx) * -i * 10 * S, it.y, 3 * S / i, 0, TAU); ctx.fill(); }
      }
    }
    if (it.kind === 'icicle') drawIcicle(ctx, it, env);
    if (it.kind === 'berg') drawBerg(ctx, it, env);
    if (it.kind === 'vent') drawVent(ctx, it, env);
    if (it.kind === 'mine') drawMine(ctx, it, env);
    if (it.kind === 'plankton') { const a = 0.5 + 0.5 * Math.sin(time * 3 + it.ph); ctx.fillStyle = `rgba(120,255,230,${0.4 + a * 0.6})`; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, TAU); ctx.fill(); }
  }
}
function drawFront(ctx, env) {
  if (!Z) return;
  if (Z.type === 'yosun') for (const k of Z.items) if (k.kind === 'kelp' && k.front) drawKelp(ctx, k, env, 0.55);
  if (Z.type === 'kacis') drawChaser(ctx, Z.chase, env);
  if (Z.type === 'sarkit') { // tepede buz saçağı
    const { W, S, safeTop } = env; ctx.save(); ctx.fillStyle = 'rgba(230,248,255,.92)'; ctx.strokeStyle = '#7ec4e6'; ctx.lineWidth = 2 * S; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, safeTop + 10 * S);
    for (let x = 0, i = 0; x <= W + 20 * S; x += 20 * S, i++) ctx.lineTo(x + 10 * S, safeTop + (10 + (i * 37 % 4 === 0 ? 22 : 8 + (i * 13) % 9)) * S), ctx.lineTo(x + 20 * S, safeTop + 10 * S);
    ctx.lineTo(W, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}
let darkCv = null, darkCx = null;
function overlay(ctx, env, lights) { // karanlık mağara: sadece ışıklar görünür (kuzey ışığı çukurunda yarı karanlık + hüzmeler)
  if (!Z || (Z.type !== 'magara' && Z.type !== 'isik') || Z.dark <= 0.01) return;
  const { W, H, S } = env, k = 0.5; // yarım çözünürlük yeterli
  if (!darkCv || darkCv.width !== Math.ceil(W * k) || darkCv.height !== Math.ceil(H * k)) { darkCv = document.createElement('canvas'); darkCv.width = Math.ceil(W * k); darkCv.height = Math.ceil(H * k); darkCx = darkCv.getContext('2d'); }
  const c = darkCx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, darkCv.width, darkCv.height);
  c.fillStyle = Z.type === 'isik' ? `rgba(4,14,40,${0.62 * Z.dark})` : `rgba(1,6,16,${0.9 * Z.dark})`; c.fillRect(0, 0, darkCv.width, darkCv.height);
  c.globalCompositeOperation = 'destination-out'; c.scale(k, k);
  const hole = (x, y, r, a = 1) => { const g = c.createRadialGradient(x, y, r * 0.15, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  const p = env.player; hole(p.x, p.y, 130 * S * (env.big ? 1.5 : 1));
  for (const L of lights) hole(L.x, L.y, L.r, L.a);
  for (const it of Z.items) if (it.kind === 'plankton') hole(it.x, it.y, 14 * S, 0.7);
  if (Z.type === 'isik') for (const b of Z.beams) for (let y = 0; y < H; y += 60 * S) hole(b.x, y, 70 * S, 0.8); // hüzmeler aydınlık
  ctx.drawImage(darkCv, 0, 0, W, H);
}

function drawShip(ctx, sh, env) {
  const { S, time } = env, w = sh.w;
  ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(-0.08 * sh.side);
  // gövde
  ctx.fillStyle = '#5a3a20'; ctx.strokeStyle = '#2a170a'; ctx.lineWidth = 4 * S; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-w * 0.5, -w * 0.12); ctx.quadraticCurveTo(-w * 0.42, w * 0.2, 0, w * 0.22); ctx.quadraticCurveTo(w * 0.42, w * 0.2, w * 0.5, -w * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#3e2611'; ctx.lineWidth = 2 * S; for (let y = -w * 0.06; y < w * 0.2; y += w * 0.06) { ctx.beginPath(); ctx.moveTo(-w * 0.47, y); ctx.lineTo(w * 0.47, y); ctx.stroke(); }
  // direk ve yırtık yelken
  ctx.fillStyle = '#4a2f18'; ctx.fillRect(-w * 0.02, -w * 0.55, w * 0.035, w * 0.45);
  ctx.fillStyle = 'rgba(230,220,190,.65)'; ctx.beginPath(); ctx.moveTo(w * 0.015, -w * 0.52); ctx.quadraticCurveTo(w * 0.2, -w * 0.4, w * 0.02, -w * 0.25); ctx.lineTo(w * 0.07, -w * 0.33); ctx.closePath(); ctx.fill();
  // yosun ve mercan
  ctx.fillStyle = 'rgba(100,210,110,.7)'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(-w * 0.4 + i * w * 0.13, -w * 0.1 + (i % 2) * 6 * S, 12 * S, 5 * S, 0, 0, TAU); ctx.fill(); }
  // top delikleri
  ctx.fillStyle = '#1a0e05'; for (const x of [-0.32, 0.32]) { ctx.beginPath(); ctx.arc(w * x, w * 0.03, 9 * S, 0, TAU); ctx.fill(); }
  // gizli oda kapısı (parlar)
  const d = sh.door, a = d.used ? 0.15 : 0.55 + 0.35 * Math.sin(time * 4);
  ctx.fillStyle = '#0d1a2b'; ctx.beginPath(); ctx.roundRect(d.dx - 22 * S, d.dy - 30 * S, 44 * S, 52 * S, [22 * S, 22 * S, 4 * S, 4 * S]); ctx.fill();
  const g = ctx.createRadialGradient(d.dx, d.dy, 2, d.dx, d.dy, 46 * S); g.addColorStop(0, `rgba(255,220,120,${a})`); g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.dx, d.dy, 46 * S, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  if (!d.used) { ctx.fillStyle = '#ffe28a'; ctx.font = `700 ${12 * S}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('GİZLİ ODA', d.dx, d.dy - 38 * S); }
  ctx.restore();
}
function drawIcicle(ctx, ic, env) { // düşen sarkıt; uyarıda tepede titreyen sarkıt ve aşağıda büyüyen gölge
  const { S, H, time } = env, x = ic.x + (ic.warn > 0 ? Math.sin(time * 40) * 1.5 * S : 0);
  if (ic.warn > 0) { const k = 1 - ic.warn / 0.9; ctx.fillStyle = `rgba(10,40,80,${0.15 + 0.25 * k})`; ctx.fillRect(x - 10 * S, ic.y, 20 * S, H); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `700 ${18 * S}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('!', x, ic.y + ic.l + 22 * S); }
  ctx.fillStyle = 'rgba(235,250,255,.96)'; ctx.strokeStyle = '#6ab8e0'; ctx.lineWidth = 2 * S; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - 10 * S, ic.y - ic.l * 0.15); ctx.lineTo(x, ic.y + ic.l); ctx.lineTo(x + 10 * S, ic.y - ic.l * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.moveTo(x - 4 * S, ic.y); ctx.lineTo(x - 1 * S, ic.y + ic.l * 0.6); ctx.stroke();
}
function drawBerg(ctx, b, env) { // yüzen buz bloğu: köşeli üst, açık mavi gövde, parlak kenar
  const { S } = env, x0 = b.x - b.w / 2, y0 = b.y - b.h / 2;
  ctx.save(); ctx.lineJoin = 'round';
  const g = ctx.createLinearGradient(0, y0, 0, y0 + b.h); g.addColorStop(0, '#f4fcff'); g.addColorStop(1, '#a8daf0');
  ctx.fillStyle = g; ctx.strokeStyle = '#5aa8d4'; ctx.lineWidth = 2.5 * S;
  ctx.beginPath(); ctx.moveTo(x0 + 8 * S, y0); ctx.lineTo(x0 + b.w * 0.35, y0 - 8 * S); ctx.lineTo(x0 + b.w * 0.7, y0 + 2 * S); ctx.lineTo(x0 + b.w - 6 * S, y0 - 4 * S); ctx.lineTo(x0 + b.w, y0 + b.h * 0.5); ctx.lineTo(x0 + b.w - 10 * S, y0 + b.h); ctx.lineTo(x0 + 10 * S, y0 + b.h); ctx.lineTo(x0, y0 + b.h * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(120,190,230,.45)'; ctx.fillRect(x0 + 12 * S, y0 + b.h - 10 * S, b.w - 24 * S, 5 * S);
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3 * S; ctx.lineCap = 'round'; const d = Math.sign(b.vx); // kayma oku
  ctx.beginPath(); ctx.moveTo(b.x - d * 12 * S, b.y); ctx.lineTo(b.x + d * 10 * S, b.y); ctx.lineTo(b.x + d * 3 * S, b.y - 7 * S); ctx.moveTo(b.x + d * 10 * S, b.y); ctx.lineTo(b.x + d * 3 * S, b.y + 7 * S); ctx.stroke();
  ctx.restore();
}
function drawVent(ctx, v, env) {
  const { S, H, time } = env, shakeX = v.state === 'warn' ? Math.sin(time * 50) * 2 * S : 0;
  if (v.state === 'jet') { // kaynar su sütunu
    const top = v.y - H * 0.55, g = ctx.createLinearGradient(0, v.y, 0, top); g.addColorStop(0, 'rgba(255,150,70,.8)'); g.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(v.x - 12 * S, v.y - 10 * S); ctx.lineTo(v.x - 30 * S, top); ctx.lineTo(v.x + 30 * S, top); ctx.lineTo(v.x + 12 * S, v.y - 10 * S); ctx.fill();
    ctx.strokeStyle = 'rgba(255,245,230,.7)'; ctx.lineWidth = 1.5 * S;
    for (let i = 0; i < 8; i++) { const yy = v.y - ((time * 260 * S + i * 47 * S) % (H * 0.5)); ctx.beginPath(); ctx.arc(v.x + Math.sin(i * 2.3 + time * 3) * 14 * S, yy, (3 + i % 3 * 2) * S, 0, TAU); ctx.stroke(); }
  }
  if (v.state === 'warn') { ctx.fillStyle = `rgba(255,190,60,${0.18 + 0.12 * Math.sin(time * 20)})`; ctx.fillRect(v.x - 26 * S, v.y - H * 0.55, 52 * S, H * 0.55); }
  ctx.save(); ctx.translate(v.x + shakeX, v.y);
  ctx.fillStyle = '#3a3a44'; ctx.strokeStyle = '#121218'; ctx.lineWidth = 3 * S; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-24 * S, 22 * S); ctx.lineTo(-11 * S, -14 * S); ctx.lineTo(11 * S, -14 * S); ctx.lineTo(24 * S, 22 * S); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = v.state === 'idle' ? '#a8502a' : '#ff7a2f'; ctx.beginPath(); ctx.ellipse(0, -13 * S, 10 * S, 4 * S, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(120,220,110,.6)'; ctx.beginPath(); ctx.ellipse(-12 * S, 14 * S, 8 * S, 3 * S, 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawMine(ctx, m, env) {
  const { S, H, time } = env, bob = Math.sin(time * 2 + m.ph) * 4 * S, x = m.x, y = m.y + bob;
  ctx.strokeStyle = 'rgba(70,80,90,.8)'; ctx.lineWidth = 2 * S; ctx.setLineDash([5 * S, 4 * S]); ctx.beginPath(); ctx.moveTo(x, y + m.r); ctx.lineTo(x, H + 20); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#0d0e12'; ctx.lineWidth = 3 * S; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * m.r * 0.9, y + Math.sin(a) * m.r * 0.9); ctx.lineTo(x + Math.cos(a) * m.r * 1.45, y + Math.sin(a) * m.r * 1.45); ctx.stroke(); }
  const g = ctx.createRadialGradient(x - m.r * 0.3, y - m.r * 0.3, 1, x, y, m.r); g.addColorStop(0, '#5a5f6b'); g.addColorStop(1, '#1d1f25');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill();
  const blink = m.boom > 0 ? 1 : 0.5 + 0.5 * Math.sin(time * 6 + m.ph);
  ctx.fillStyle = `rgba(255,60,60,${blink})`; ctx.beginPath(); ctx.arc(x, y - m.r * 0.3, m.r * 0.22, 0, TAU); ctx.fill();
}
function drawKelp(ctx, k, env, alpha) {
  const { S, time } = env, N = 12;
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, k.y, 0, k.y - k.h); g.addColorStop(0, '#11663a'); g.addColorStop(1, '#6ee08a');
  ctx.fillStyle = g; ctx.beginPath();
  for (let i = 0; i <= N; i++) { const s = i / N; ctx.lineTo(k.x - 10 * S * (1 - s * 0.6) + Math.sin(time * 1.5 + k.ph + s * 4) * 16 * S * s, k.y - s * k.h); }
  for (let i = N; i >= 0; i--) { const s = i / N; ctx.lineTo(k.x + 10 * S * (1 - s * 0.6) + Math.sin(time * 1.5 + k.ph + s * 4) * 16 * S * s, k.y - s * k.h); }
  ctx.fill();
  ctx.fillStyle = 'rgba(150,240,140,.5)'; for (let i = 2; i < N; i += 3) { const s = i / N; ctx.beginPath(); ctx.ellipse(k.x + 12 * S + Math.sin(time * 1.5 + k.ph + s * 4) * 16 * S * s, k.y - s * k.h, 9 * S, 4 * S, 0.6, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawChaser(ctx, c, env) { // yukarıdan kovalayan kocaman fener balığı
  const { W, S, time } = env, y = c.y;
  ctx.save();
  ctx.fillStyle = '#1b2b46'; ctx.beginPath(); ctx.ellipse(W / 2, y - 120 * S, W * 0.75, 190 * S, 0, 0, TAU); ctx.fill();
  // fener
  const lx = W / 2 + Math.sin(time * 1.5) * 40 * S, ly = y + 30 * S;
  ctx.strokeStyle = '#2c3d5a'; ctx.lineWidth = 4 * S; ctx.beginPath(); ctx.moveTo(W / 2, y - 60 * S); ctx.quadraticCurveTo(lx + 30 * S, y - 40 * S, lx, ly); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 40 * S); g.addColorStop(0, 'rgba(200,255,240,1)'); g.addColorStop(1, 'rgba(80,255,220,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 40 * S, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  // ağız ve dişler
  ctx.fillStyle = '#0a1426'; ctx.beginPath(); ctx.moveTo(W * 0.08, y + 20 * S); ctx.quadraticCurveTo(W / 2, y + 75 * S, W * 0.92, y + 20 * S); ctx.quadraticCurveTo(W / 2, y + 40 * S, W * 0.08, y + 20 * S); ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  for (let i = 0; i < 11; i++) { const t = i / 10, x = W * (0.12 + t * 0.76), yy = y + 20 * S + Math.sin(t * Math.PI) * 30 * S; ctx.beginPath(); ctx.moveTo(x - 8 * S, yy); ctx.lineTo(x, yy + 16 * S); ctx.lineTo(x + 8 * S, yy); ctx.fill(); }
  // gözler
  const blink = Math.sin(c.eye * 2) > 0.95 ? 0.2 : 1;
  for (const sx of [-1, 1]) { ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.ellipse(W / 2 + sx * W * 0.22, y - 30 * S, 16 * S, 16 * S * blink, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(W / 2 + sx * W * 0.22 + 3 * S, y - 28 * S, 5 * S, 9 * S * blink, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

window.OktoZones = { NAMES, enter, exit, active, update, collide, onInk, onBomb, freeOf, drawBack, drawMid, drawFront, overlay, speed, slow, get state() { return Z; } };
})();

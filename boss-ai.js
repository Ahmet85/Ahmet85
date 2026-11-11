/* OKTO canavar sistemi: tüm bölüm sonu canavarlarının tanımları, ortak saldırı kütüphanesi ve aşama (faz) desteği.
   game.js ortak işleri yapar (giriş, sersemleme, hasar, ölüm, can barı); canavara özel hareket ve saldırılar burada.

   Yeni canavar eklemek için çoğu zaman yalnızca bir tanım yeterli (kod gerekmez):
   OktoBossAI.register({
     id: 'ornek', name: 'ÖRNEK CANAVAR', size: 'mini' | 'big',
     hp: 4, r: 60, restY: 140, color: '#ffb0c0',          // can, yarıçap (nokta), dinlenme yüksekliği (alttan), vuruş rengi
     contact: 0.85, contactY: 0.2,                         // gövde çarpışma dairesi: r * contact, merkez r * contactY yukarıda
     look: { body: '#ff7aa0', line: '#5a1030', iris: '#ffd000', shape: 'blob' },  // görsel yoksa kullanılan geçici çizim
     move: { type: 'sway', amp: 0.26, speed: 0.6, bob: 10 },  // sway | follow | hover
     attacks: [{ id: 'aimed', w: 1, count: 3 }, { id: 'zap', w: 1, count: 2 }],
     phases: [{ below: 0.5, name: 'Öfkelendi!', rate: 0.75, attacks: [...], move: {...} }],  // canı yarıya inince değişir
   });
   Saldırı kütüphanesi (ATTACKS): spikeFan, dash, zap, minions, aimed, tentacle. Yeni saldırı türü eklemek kod ister.
   Özel davranış gereken canavarlar tanımda tick(b, E, dt) verir (mevcut üç canavar böyle, s21 davranışı birebir korunur). */
(() => {
'use strict';
const DEFS = {};

// ---------- Ortak saldırı kütüphanesi ----------
// start(b, E, a): saldırıyı başlatır. Süren saldırılar b.act'a bir nesne koyar: step(b, E, dt) true dönerse biter;
// block: true ise saldırı sürerken canavar dolaşmaz.
const ATTACKS = {
  spikeFan: { // şişip yelpaze şeklinde diken atar (Dev Balon Balığı)
    start(b, E, a) {
      b.puffT = a.warn || 0.7; E.sound.tone(200, 0.6, 'sine', 0.1, 300);
      b.act = { step(b, E, dt) {
        b.puffT -= dt; b.puff = 1 - b.puffT / (a.warn || 0.7);
        if (b.puffT > 0) return false;
        const n = a.count || 8 + Math.min(b.lv, 4);
        for (let i = 0; i < n; i++) {
          const ang = -Math.PI * (0.06 + 0.88 * i / (n - 1)), sp = (a.speed || 210 + b.lv * 15) * E.S;
          E.entities.push({ type: a.shot || 'spike', fixed: true, x: b.x + Math.cos(ang) * b.r, y: b.y + Math.sin(ang) * b.r, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 7 * E.S, t: 0 });
        }
        E.sound.tone(700, 0.18, 'square', 0.07, -400); E.sound.noise(0.2, 0.15, 2500);
        return true;
      } };
    },
  },
  dash: { // titreyerek uyarır, Okto'ya doğru yukarı hamle yapar, yerine döner
    start(b, E, a) {
      b.dash = { stage: 'tele', t: 0, toY: Math.max(E.H * 0.32, E.player.y + 10 * E.S) }; E.sound.tone(150, 0.5, 'sawtooth', 0.08, 120);
      b.act = { block: true, step(b, E, dt) {
        const d = b.dash; if (!d) return true; d.t += dt;
        if (d.stage === 'tele') { b.x += Math.sin(b.t * 60) * 2 * E.S; if (d.t > (a.warn || 0.65)) { d.stage = 'up'; d.t = 0; } }
        else if (d.stage === 'up') { b.y -= (a.speed || 560) * E.S * dt; b.puff = 1; if (b.y <= d.toY) { d.stage = 'down'; d.t = 0; } }
        else { b.y = E.lerp(b.y, E.restY, dt * 2.5); if (Math.abs(b.y - E.restY) < 6) { b.dash = null; return true; } }
        return false;
      } };
    },
  },
  zap: { // uyarılı dikey yıldırım sütunları; ilki Okto'nun üstüne
    start(b, E, a) {
      const { S, W, player, clamp, rand } = E;
      const n = a.count || 1 + Math.min(2, Math.floor(b.lv / 2) + 1), xs = [Number.isFinite(player.x) ? clamp(player.x, 30 * S, W - 30 * S) : W / 2];
      for (let tries = 0; xs.length < n && tries < 30; tries++) { const x = rand(30 * S, W - 30 * S); if (xs.every(o => !(Math.abs(o - x) <= 90 * S))) xs.push(x); }
      for (const x of xs) E.slams.push({ kind: 'zap', x, t: 0, warn: a.warn || 1.0, w: 24 * S });
      E.sound.tone(900, 0.12, 'square', 0.05, 0, 0, true); E.sound.tone(900, 0.12, 'square', 0.05, 0, 0.3, true);
    },
  },
  minions: { // yavru çağırır (şimdilik yukarı yüzen denizanaları)
    start(b, E, a) {
      const { S, W, clamp, rand } = E, n = a.count || 3;
      for (let i = 0; i < n; i++) E.entities.push({ type: 'jelly', x: clamp(b.x + (i - (n - 1) / 2) * 60 * S, 20, W - 20), y: b.y - b.r, r: 14 * S, t: Math.random() * 9, hue: a.hue != null ? a.hue + rand(-20, 20) : rand(180, 220), rise: rand(60, 90) * S });
      E.sound.tone(500, 0.3, 'sine', 0.08, 400);
    },
  },
  aimed: { // Okto'ya nişanlı yelpaze mermi (mürekkep lekesi)
    start(b, E, a) {
      const { S, player } = E, n = a.count || 2 + Math.min(b.lv, 3);
      for (let i = 0; i < n; i++) {
        const ang = Math.atan2(player.y - b.y, player.x - b.x) + (i - (n - 1) / 2) * (a.spread || 0.28), sp = (a.speed || 150 + b.lv * 12) * S;
        E.entities.push({ type: a.shot || 'blob', fixed: true, x: b.x, y: b.y - b.r * 0.8, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 11 * S, t: Math.random() * 9 });
      }
      E.sound.tone(220, 0.2, 'sine', 0.1, 220);
    },
  },
  tentacle: { // Okto'nun altından uyarılı dokunaç darbesi
    start(b, E, a) {
      const { S, W, player, clamp, rand } = E, n = a.count || 1;
      for (let i = 0; i < n; i++) E.slams.push({ kind: 'tentacle', x: i === 0 ? clamp(player.x + rand(-20, 20) * S, 30 * S, W - 30 * S) : rand(30 * S, W - 30 * S), t: 0, warn: a.warn || 1.0, w: 30 * S });
      E.sound.tone(300, 0.15, 'square', 0.06, 0, 0, true); E.sound.tone(300, 0.15, 'square', 0.06, 0, 0.25, true);
    },
  },
};

// ---------- Veriyle tanımlanan canavarlar için ortak davranış ----------
function phaseOf(b) { // canın oranına göre geçerli aşama (tanımda phases yoksa temel tanım)
  const def = b.def, list = def.phases || [];
  let cur = null;
  for (const p of list) if (b.hp / b.maxHp <= p.below && (!cur || p.below < cur.below)) cur = p;
  return cur;
}
function genericTick(b, E, dt) {
  const def = b.def, ph = b.ph || {}, mv = Object.assign({ type: 'sway', amp: 0.26, speed: 0.6, bob: 8 }, def.move, ph.move);
  if (b.act && b.act.block) { if (b.act.step(b, E, dt)) b.act = null; return; }
  if (mv.type === 'follow') { b.x = E.lerp(b.x, E.clamp(E.player.x, b.r, E.W - b.r), dt * (mv.speed || 0.9)); b.y = E.restY + Math.sin(b.t * 2) * mv.bob * E.S; }
  else if (mv.type === 'hover') { b.x = E.lerp(b.x, E.W / 2, dt); b.y = E.restY + Math.sin(b.t * 1.5) * mv.bob * E.S; }
  else { b.x = E.W / 2 + Math.sin(b.t * mv.speed) * E.W * mv.amp; b.y = E.restY + Math.sin(b.t * 2) * mv.bob * E.S; }
  if (b.act) { if (b.act.step(b, E, dt)) b.act = null; return; }
  b.attackT -= dt;
  if (b.attackT > 0) return;
  b.attackT = E.interval * (ph.rate || def.rate || 1);
  const list = ph.attacks || def.attacks || [];
  let sum = 0; for (const a of list) sum += a.w || 1;
  let r = Math.random() * sum;
  for (const a of list) { r -= a.w || 1; if (r <= 0) { ATTACKS[a.id] && ATTACKS[a.id].start(b, E, a); break; } }
}

// ---------- Mevcut üç canavar (s21 davranışı birebir) ----------
const register = def => { DEFS[def.id] = Object.assign({ size: 'mini', contact: 0.85, contactY: 0.2, restY: 130, color: '#ffffff' }, def); return DEFS[def.id]; };
register({
  id: 'puffer', name: 'DEV BALON BALIĞI', hp: 3, r: 54, restY: 130, color: '#ffe28a', contactY: 0,
  contactR: b => 0.9 + b.puff * 0.35,
  tick(b, E, dt) { // dikenli balon balığı: Okto'nun altına süzülür, şişip diken atar ya da yukarı hamle yapar
    if (b.dash) { if (b.act && b.act.step(b, E, dt)) b.act = null; return; }
    b.x = E.lerp(b.x, E.clamp(E.player.x, b.r, E.W - b.r), dt * 0.9);
    b.y = E.restY + Math.sin(b.t * 2) * 6 * E.S;
    if (b.puffT > 0) { if (b.act && b.act.step(b, E, dt)) b.act = null; return; }
    b.attackT -= dt;
    if (b.attackT <= 0) {
      b.attackT = E.interval;
      if (Math.random() < 0.55) ATTACKS.spikeFan.start(b, E, {});
      else ATTACKS.dash.start(b, E, {});
    }
  },
});
register({
  id: 'jelly', name: 'ELEKTRİKLİ DENİZANASI', hp: 4, r: 60, restY: 150, color: '#c7a8ff', contactY: 0.3,
  tick(b, E, dt) { // elektrikli denizanası: uyarılı yıldırım sütunları ve yavru denizanaları
    b.x = E.W / 2 + Math.sin(b.t * 0.55) * E.W * 0.26;
    b.y = E.restY + Math.sin(b.t * 2.2) * 10 * E.S;
    b.attackT -= dt;
    if (b.attackT <= 0) {
      b.attackT = E.interval;
      if (Math.random() < 0.6) ATTACKS.zap.start(b, E, {});
      else ATTACKS.minions.start(b, E, {});
    }
  },
});
register({
  id: 'squid', name: 'DEV KALAMAR', hp: 5, r: 64, restY: 130, color: '#ff9ab0', contactY: 0.2,
  tick(b, E, dt) { // dev kalamar: mürekkep lekeleri ve dokunaç darbesi
    b.x = E.W / 2 + Math.sin(b.t * 0.7) * E.W * 0.28;
    b.y = E.restY + Math.sin(b.t * 1.7) * 8 * E.S;
    b.attackT -= dt;
    if (b.attackT <= 0) {
      b.attackT = E.interval;
      if (Math.random() < 0.5) ATTACKS.aimed.start(b, E, {});
      else ATTACKS.tentacle.start(b, E, {});
    }
  },
});

// ---------- Güneşli Sular mini canavarları (pilot; kullanıcının bölüm planı) ----------
// Görseller kodla çizilir (bosses.js); tasarım PNG'leri model alınır.
register({ // Dikenli Kestane: turuncu noktaları parlar, sonra halka biçiminde diken atar
  id: 'kestane', name: 'DİKENLİ KESTANE', hp: 3, r: 46, restY: 140, color: '#c58bff', contactY: 0,
  tick(b, E, dt) {
    b.x = E.W / 2 + Math.sin(b.t * 0.5) * E.W * 0.22; b.y = E.restY + Math.sin(b.t * 1.8) * 8 * E.S;
    if (b.glowT > 0) { // uyarı: noktalar parlıyor
      b.glowT -= dt;
      if (b.glowT <= 0) {
        const n = 12 + Math.min(4, b.lv), sp = (170 + b.lv * 10) * E.S, off = Math.random() * Math.PI;
        for (let i = 0; i < n; i++) { const a = off + i * Math.PI * 2 / n; E.entities.push({ type: 'spike', fixed: true, x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7 * E.S, t: 0 }); }
        E.sound.tone(700, 0.18, 'square', 0.07, -400); E.sound.noise(0.2, 0.15, 2500);
      }
      return;
    }
    b.attackT -= dt;
    if (b.attackT <= 0) { b.attackT = E.interval * 1.1; b.glowT = 0.9; E.sound.tone(520, 0.8, 'sine', 0.07, 260); }
  },
});
register({ // Resif Yengeci: yan duvardan çıkar, kıskacını kaldırıp haber verir, koridoru yatay keser
  id: 'yengec', name: 'RESİF YENGECİ', hp: 4, r: 50, restY: 190, color: '#ff8a6a', contactY: 0.1,
  tick(b, E, dt) {
    if (b.side == null) b.side = Math.random() < 0.5 ? -1 : 1;
    const wallX = b.side < 0 ? b.r * 0.9 : E.W - b.r * 0.9;
    b.x = E.lerp(b.x, wallX, dt * 2);
    const ty = E.clamp(E.player.y + 40 * E.S, E.H * 0.42, E.H - 120 * E.S);
    if (!(b.clawT > 0)) b.y = E.lerp(b.y, ty, dt * 0.8);
    if (b.clawT > 0) { // kıskaç kalkık: uyarı süresi
      b.clawT -= dt;
      if (b.clawT <= 0) { E.slams.push({ kind: 'claw', y: b.y - b.r * 0.2, h: 26 * E.S, side: -b.side, t: 0, warn: 0, w: 0, x: 0 }); E.sound.noise(0.35, 0.16, 900); b.swapT = 1.4; }
      return;
    }
    if (b.swapT > 0) { b.swapT -= dt; if (b.swapT <= 0 && Math.random() < 0.5) b.side = -b.side; return; } // bazen karşı duvara geçer
    b.attackT -= dt;
    if (b.attackT <= 0) {
      b.attackT = E.interval * 1.15;
      E.slams.push({ kind: 'claw', y: b.y - b.r * 0.2, h: 26 * E.S, side: -b.side, t: 0, warn: 1.0, w: 0, x: 0, warnOnly: true }); // koridorda uyarı şeridi
      b.clawT = 1.0; E.sound.tone(300, 0.15, 'square', 0.06, 0, 0, true); E.sound.tone(300, 0.15, 'square', 0.06, 0, 0.3, true);
    }
  },
});
register({ // Akıntı Vatozu: kanatlarını toplar, yan akıntı gönderir, sonra kısa süre açık verir (çift hasar)
  id: 'vatoz', name: 'AKINTI VATOZU', hp: 4, r: 56, restY: 150, color: '#7fe3d8', contactY: 0.05,
  tick(b, E, dt) {
    if (b.openT > 0) { b.openT -= dt; b.y = E.lerp(b.y, E.restY + 20 * E.S, dt * 2); return; } // açık: yavaş, savunmasız
    if (b.current) { // yan akıntı Okto'yu sürükler
      b.current.t -= dt; E.push(b.current.dir * 230 * E.S * dt, 0);
      if (b.current.t <= 0) { b.current = null; b.openT = 1.8; E.floater(b.x, b.y - b.r * 1.3, 'Şimdi!', '#7dffb0'); }
      return;
    }
    b.x = E.W / 2 + Math.sin(b.t * 0.65) * E.W * 0.25; b.y = E.restY + Math.sin(b.t * 2.4) * 10 * E.S;
    if (b.foldT > 0) { b.foldT -= dt; if (b.foldT <= 0) { b.current = { dir: E.player.x < E.W / 2 ? 1 : -1, t: 1.6, dur: 1.6 }; E.sound.noise(1.4, 0.14, 500); } return; }
    b.attackT -= dt;
    if (b.attackT <= 0) {
      b.attackT = E.interval * 1.2;
      if (Math.random() < 0.6) { b.foldT = 0.8; E.sound.tone(240, 0.7, 'sine', 0.08, -120); }
      else ATTACKS.aimed.start(b, E, { count: 3, shot: 'blob', speed: (140 + b.lv * 10) });
    }
  },
});
// büyük canavar olarak Dev Balon Balığı (grup sonu): aynı davranış, daha büyük ve dayanıklı, sinematik girişli
register(Object.assign({}, DEFS.puffer, { id: 'puffer-big', size: 'big', hp: 7, r: 66, restY: 150 }));
register(Object.assign({}, DEFS.jelly, { id: 'jelly-big', size: 'big', hp: 8, r: 72, restY: 170 }));
register(Object.assign({}, DEFS.squid, { id: 'squid-big', size: 'big', hp: 9, r: 76, restY: 160 }));
// 2. ve 3. grubun mini canavarları: görseller gelene kadar geçici çizimli, veriyle tanımlı
// Her mini canavarın kendine özgü saldırısı var (aynı saldırıyı iki canavar paylaşmaz).
const sway = (b, E, amp, sp, bob) => { b.x = E.W / 2 + Math.sin(b.t * sp) * E.W * amp; b.y = E.restY + Math.sin(b.t * 2) * bob * E.S; };
register({ // Baca Yengeci: bacaları parlar, Okto'nun altından ve yanından lav sütunları fışkırır; sonra yana seker
  id: 'baca-yengeci', name: 'BACA YENGECİ', hp: 4, r: 50, restY: 140, color: '#ff8a3a', contactY: 0,
  tick(b, E, dt) {
    if (b.hop) { b.hop.t += dt; b.x = E.lerp(b.hop.x0, b.hop.x1, Math.min(1, b.hop.t / 0.5)); b.y = E.restY - Math.sin(Math.min(1, b.hop.t / 0.5) * Math.PI) * 40 * E.S; if (b.hop.t >= 0.5) b.hop = null; return; }
    b.y = E.restY + Math.sin(b.t * 3) * 3 * E.S;
    if (b.ventT > 0) { b.ventT -= dt; if (b.ventT <= 0) {
      const xs = [E.clamp(E.player.x, 30 * E.S, E.W - 30 * E.S)]; xs.push(E.clamp(xs[0] + (Math.random() < 0.5 ? -1 : 1) * E.rand(110, 150) * E.S, 30 * E.S, E.W - 30 * E.S));
      for (const x of xs) E.slams.push({ kind: 'lava', x, t: 0, warn: 0.9, w: 30 * E.S, maxReach: 0.7 });
      E.sound.tone(120, 0.6, 'sawtooth', 0.07, -40); b.hopNext = true; } return; }
    if (b.hopNext) { b.hopNext = false; const x1 = E.clamp(b.x + (b.x < E.W / 2 ? 1 : -1) * E.rand(90, 140) * E.S, b.r, E.W - b.r); b.hop = { t: 0, x0: b.x, x1 }; return; }
    b.attackT -= dt;
    if (b.attackT <= 0) { b.attackT = E.interval * 1.1; b.ventT = 0.6; E.sound.tone(90, 0.6, 'sine', 0.1, 40); }
  },
});
register({ // Zırhlı Balon Balığı: pullu zırhına saklanır (vurulmaz), sonra top gibi duvarlardan sekerek yuvarlanır
  id: 'zirhli-balon', name: 'ZIRHLI BALON BALIĞI', hp: 4, r: 50, restY: 150, color: '#ffd23a', contactY: 0,
  contactR: b => (b.roll ? 0.95 : 0.85),
  tick(b, E, dt) {
    if (b.roll) { // yuvarlanma: alt yarıda duvarlardan seker
      const R = b.roll; R.t += dt; b.rollA = (b.rollA || 0) + R.vx / b.r * dt;
      b.x += R.vx * dt; b.y += R.vy * dt;
      if (b.x < b.r || b.x > E.W - b.r) { R.vx = -R.vx; b.x = E.clamp(b.x, b.r, E.W - b.r); E.sound.tone(160, 0.08, 'square', 0.05); }
      if (b.y < E.H * 0.45 || b.y > E.restY + 10 * E.S) { R.vy = -R.vy; b.y = E.clamp(b.y, E.H * 0.45, E.restY + 10 * E.S); }
      if (R.t > 2.6) { b.roll = null; b.backT = 1; }
      return;
    }
    if (b.backT > 0) { b.backT -= dt; b.y = E.lerp(b.y, E.restY, dt * 3); b.rollA = E.lerp(b.rollA || 0, 0, dt * 4); return; }
    if (b.armorT > 0) { b.armorT -= dt; if (b.armorT <= 0) { const sp = (230 + b.lv * 10) * E.S, a = E.rand(-2.5, -0.6); b.roll = { t: 0, vx: Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(a) * sp }; E.sound.noise(0.3, 0.12, 700); } return; }
    sway(b, E, 0.2, 0.55, 6);
    b.attackT -= dt;
    if (b.attackT <= 0) { b.attackT = E.interval * 1.2; b.armorT = 1.4; E.floater(b.x, b.y - b.r * 1.5, 'Zırh!', '#9fd6ff'); E.sound.tone(400, 0.3, 'triangle', 0.07, -200); }
  },
});
register({ // Mayın Yengeci: kabuğundaki mayınları bırakır; mayınlar yukarı süzülür, yanıp söner ve patlar
  id: 'mayin-yengeci', name: 'MAYIN YENGECİ', hp: 4, r: 50, restY: 140, color: '#8a8af0', contactY: 0,
  tick(b, E, dt) {
    if (!(b.dropT > 0)) sway(b, E, 0.28, 0.5, 5);
    if (b.dropT > 0) { b.dropT -= dt; if (b.dropT <= 0) {
      const n = 3 + Math.min(2, Math.floor(b.lv / 2));
      for (let i = 0; i < n; i++) E.slams.push({ kind: 'mine', x: E.clamp(b.x + (i - (n - 1) / 2) * 70 * E.S, 24 * E.S, E.W - 24 * E.S), y: b.y - b.r, vx: (i - (n - 1) / 2) * 20 * E.S, vy: -E.rand(70, 110) * E.S, t: 0, warn: 0, fuse: E.rand(2.2, 3.0), r: 70 * E.S });
      E.sound.tone(300, 0.2, 'square', 0.05, -100); } return; }
    b.attackT -= dt;
    if (b.attackT <= 0) { b.attackT = E.interval * 1.3; b.dropT = 0.6; E.sound.tone(500, 0.12, 'square', 0.05, 0, 0, true); E.sound.tone(500, 0.12, 'square', 0.05, 0, 0.2, true); }
  },
});
register({ // Mağara Mürekkepçisi: mürekkep bulutuyla ekranı karartır (yalnızca Okto'nun çevresi görünür), karanlıkta mürekkep atar
  id: 'murekkepci', name: 'MAĞARA MÜREKKEPÇİSİ', hp: 4, r: 50, restY: 140, color: '#9a7ae0',
  look: { body: '#5a4a8a', line: '#140a30', iris: '#ffe14d', shape: 'blob' },
  tick(b, E, dt) {
    sway(b, E, 0.3, 0.45, 10);
    if (b.darkShots > 0) { b.shotT -= dt; if (b.shotT <= 0) { b.shotT = 0.9; b.darkShots--; ATTACKS.aimed.start(b, E, { count: 2, spread: 0.35, speed: 130 }); } return; }
    b.attackT -= dt;
    if (b.attackT <= 0) { b.attackT = E.interval * 1.4; E.slams.push({ kind: 'dark', t: 0, warn: 0, dur: 3.2 }); b.darkShots = 3; b.shotT = 0.8; E.sound.tone(150, 0.8, 'sine', 0.1, -60); E.sound.noise(0.6, 0.12, 500); }
  },
});
register({ // Hayalet Denizanası: kaybolur (vurulmaz), Okto'nun altında belirir ve genişleyen hayalet halka yayar
  id: 'hayalet-denizanasi', name: 'HAYALET DENİZANASI', hp: 4, r: 50, restY: 150, color: '#e2b8ff', contactY: 0.3,
  tick(b, E, dt) {
    if (b.vis == null) b.vis = 1;
    if (b.fade) { // kaybol → yer değiştir → belir
      const F = b.fade; F.t += dt;
      if (F.t < 0.6) b.vis = 1 - F.t / 0.6;
      else if (!F.moved) { F.moved = true; b.x = E.clamp(E.player.x + E.rand(-40, 40) * E.S, b.r, E.W - b.r); }
      else if (F.t < 1.3) b.vis = (F.t - 0.6) / 0.7;
      else { b.vis = 1; b.fade = null; E.slams.push({ kind: 'ring', x: b.x, y: b.y - b.r * 0.2, t: 0, warn: 0, speed: 170 * E.S, maxR: 330 * E.S, w: 12 * E.S }); E.sound.tone(700, 0.6, 'sine', 0.07, -300); }
      return;
    }
    b.x = E.lerp(b.x, E.W / 2 + Math.sin(b.t * 0.4) * E.W * 0.2, dt); b.y = E.restY + Math.sin(b.t * 1.6) * 12 * E.S;
    b.attackT -= dt;
    if (b.attackT <= 0) { b.attackT = E.interval * 1.15; b.fade = { t: 0 }; E.sound.tone(900, 0.5, 'sine', 0.05, -500); }
  },
});
register({ // İri Fener Balığı: feneri parlar ve Okto'yu kendine çeker, sonra ağzını açıp ileri atılır
  id: 'iri-fener', name: 'İRİ FENER BALIĞI', hp: 4, r: 50, restY: 145, color: '#5ff5e0', contactY: 0,
  tick(b, E, dt) {
    if (b.lunge) { const L = b.lunge; L.t += dt;
      if (L.t < 0.35) { b.x = E.lerp(b.x, L.x, dt * 6); b.y -= 520 * E.S * dt; } else { b.y = E.lerp(b.y, E.restY, dt * 3); b.x = E.lerp(b.x, L.x, dt * 2); if (L.t > 1.2) b.lunge = null; }
      return; }
    if (b.lureT > 0) { b.lureT -= dt; // fener çekimi: Okto canavara doğru sürüklenir
      const dx = b.x - E.player.x, dy = b.y - E.player.y, d = Math.hypot(dx, dy) || 1; E.push(dx / d * 120 * E.S * dt, dy / d * 120 * E.S * dt);
      if (b.lureT <= 0) { b.lunge = { t: 0, x: E.clamp(E.player.x, b.r, E.W - b.r) }; E.sound.tone(110, 0.3, 'sawtooth', 0.09, 80); } return; }
    b.x = E.lerp(b.x, E.clamp(E.player.x, b.r, E.W - b.r), dt * 0.6); b.y = E.restY + Math.sin(b.t * 2) * 6 * E.S;
    b.attackT -= dt;
    if (b.attackT <= 0) { b.attackT = E.interval * 1.2; b.lureT = 1.4; E.floater(b.x, b.y - b.r * 1.6, 'Fener!', '#5ff5e0'); E.sound.tone(1100, 1.2, 'sine', 0.04, -300, 0, true); }
  },
});

// ---------- Örnek (yer tutucu) canavarlar: yalnızca test düzeninde (?plan=grup) görünür ----------
// Kullanıcının görselleri ve bölüm planı gelince bunların yerini gerçek canavarlar alacak.
register({
  id: 'ornek-mini', name: 'ÖRNEK MİNİ CANAVAR', hp: 3, r: 50, restY: 135, color: '#9effc9', placeholder: true,
  look: { body: '#4fd1a5', line: '#0d4a3a', iris: '#ffe14d', shape: 'blob' },
  move: { type: 'follow', speed: 0.8, bob: 6 },
  attacks: [{ id: 'aimed', w: 1, count: 3 }, { id: 'dash', w: 1 }],
  phases: [{ below: 0.5, name: 'Hızlandı!', rate: 0.8, attacks: [{ id: 'aimed', w: 1, count: 4 }, { id: 'dash', w: 1 }] }],
});
register({
  id: 'ornek-buyuk', name: 'ÖRNEK BÜYÜK CANAVAR', size: 'big', hp: 9, r: 82, restY: 165, color: '#ffd36b', placeholder: true,
  contact: 0.8, contactY: 0.15,
  look: { body: '#7b5cff', line: '#21106b', iris: '#ff5d73', shape: 'crown' },
  move: { type: 'sway', amp: 0.2, speed: 0.45, bob: 10 },
  attacks: [{ id: 'aimed', w: 2, count: 3 }, { id: 'tentacle', w: 1 }],
  phases: [
    { below: 0.66, name: 'Öfkelendi!', rate: 0.85, attacks: [{ id: 'aimed', w: 1, count: 4 }, { id: 'tentacle', w: 1 }, { id: 'zap', w: 1, count: 2 }] },
    { below: 0.33, name: 'Son güç!', rate: 0.7, move: { type: 'sway', amp: 0.3, speed: 0.8 }, attacks: [{ id: 'zap', w: 1, count: 3 }, { id: 'tentacle', w: 1, count: 2 }, { id: 'minions', w: 1, count: 3, hue: 280 }] },
  ],
});

window.OktoBossAI = {
  DEFS, ATTACKS, register,
  get: id => DEFS[id] || null,
  // her karede çağrılır (giriş/ölüm/sersemleme dışında)
  tick(b, E, dt) { const def = b.def; if (def.tick) def.tick(b, E, dt); else genericTick(b, E, dt); },
  // hasar sonrası: aşama değiştiyse yeni aşamayı döndürür
  checkPhase(b) { const p = phaseOf(b); if (p !== (b.ph || null)) { b.ph = p; return p; } return null; },
  // gövde çarpışma yarıçapı ve merkezi
  contactR: b => b.r * (b.def.contactR ? b.def.contactR(b) : b.def.contact),
  contactY: b => b.y - b.r * b.def.contactY,
};
})();

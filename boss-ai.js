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

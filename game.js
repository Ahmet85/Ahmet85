/* OKTO: Derinlerin Kaşifi — mobil öncelikli HTML5 canvas oyunu */
(() => {
'use strict';

// ---------- Yardımcılar ----------
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
function lerpColor(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const r = Math.round(lerp(a >> 16, b >> 16, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
  return `rgb(${r},${g},${bl})`;
}

// ---------- Tuval ----------
const cvs = $('c'), ctx = cvs.getContext('2d');
let W = 0, H = 0, DPR = 1, S = 1, safeTop = 0; // S: ekran boyutuna göre ölçek birimi
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  S = clamp(Math.min(W, H) / 400, 0.75, 1.6);
  safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
}
window.addEventListener('resize', resize);
resize();

// ---------- Ses (WebAudio ile küçük sentezleyici) ----------
const Sound = {
  ctx: null, muted: store.get('okto_muted', false),
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, freq = 800) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime, len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(120, t + dur);
    g.gain.setValueAtTime(vol, t);
    src.buffer = buf; src.connect(f).connect(g).connect(this.ctx.destination); src.start(t);
  },
  pearl(combo) { this.tone(660 + combo * 90, 0.12, 'sine', 0.12); this.tone(990 + combo * 120, 0.1, 'triangle', 0.06); },
  eat() { this.tone(300, 0.1, 'square', 0.06, 300); },
  hit() { this.tone(180, 0.35, 'sawtooth', 0.15, -120); this.noise(0.25, 0.15, 600); },
  ink() { this.noise(0.6, 0.3, 1400); this.tone(140, 0.4, 'sine', 0.15, -80); },
  power() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'triangle', 0.1), i * 70)); },
  over() { [440, 370, 311, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.12), i * 160)); },
};
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

// ---------- Oyun durumu ----------
let state = 'menu';           // menu | play | pause | over
let player, entities, particles, floaters, inkClouds;
let depth, score, pearls, lives, combo, comboTimer, spawnTimer, inkCharge, shieldTime, invuln, time, shake;
let best = store.get('okto_best', 0);
const snow = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + 0.4, s: Math.random() * 0.5 + 0.3 }));
const bgBubbles = [];

const pointer = { down: false, x: 0, y: 0, type: 'mouse' };
const keys = {};

function reset() {
  player = { x: W / 2, y: H * 0.3, vx: 0, vy: 0, r: 22 * S, blink: 0, face: 1, squash: 0 };
  entities = []; particles = []; floaters = []; inkClouds = [];
  depth = 0; score = 0; pearls = 0; lives = 3; combo = 0; comboTimer = 0;
  spawnTimer = 0.5; inkCharge = 0.5; shieldTime = 0; invuln = 1.5; time = 0; shake = 0;
}

// ---------- Girdi ----------
function setPointer(e) {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.type = e.pointerType || 'mouse';
}
cvs.addEventListener('pointerdown', e => { Sound.init(); if (state === 'menu') { if (hitPlay(e.clientX, e.clientY)) startGame(); return; } pointer.down = true; setPointer(e); cvs.setPointerCapture && cvs.setPointerCapture(e.pointerId); });
cvs.addEventListener('pointermove', e => { setPointer(e); if (state === 'menu') { cvs.style.cursor = hitPlay(e.clientX, e.clientY) ? 'pointer' : 'default'; return; } cvs.style.cursor = 'default'; if (e.pointerType === 'mouse') pointer.down = true; });
cvs.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') pointer.down = false; });
cvs.addEventListener('pointercancel', () => { pointer.down = false; });
cvs.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pointer.down = false; });
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ' && state === 'play') { useInk(); e.preventDefault(); }
  if ((e.key === 'p' || e.key === 'Escape') && (state === 'play' || state === 'pause')) togglePause();
  if (e.key === 'Enter' && (state === 'menu' || state === 'over')) startGame();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- Arayüz ----------
const ui = { menu: $('menu'), over: $('over'), pause: $('pauseMenu'), ink: $('inkBtn'), pauseBtn: $('pauseBtn'), mute: $('muteBtn') };
const inkCtx = $('inkCanvas').getContext('2d');
function show(el, v) { el.classList.toggle('hidden', !v); }
function refreshMute() {
  ui.mute.textContent = Sound.muted ? '🔇' : '🔊';
  const mb = $('musicBtn'), M = window.OktoMusic;
  if (!mb) return;
  const on = M && M.playing && !Sound.muted;
  mb.textContent = !M || (!M.playing && !Sound.muted) ? '🎵 Müziği aç' : (Sound.muted ? '🔇' : '🔊');
  mb.classList.toggle('icon', !!(M && M.playing) || Sound.muted);
  mb.classList.toggle('hint', !(M && M.playing) && !Sound.muted);
  void on;
}
function menuMusic() { // açılış ekranındayken müziği başlat (ilk dokunuşla)
  const M = window.OktoMusic; if (!M || state !== 'menu') return;
  M.setMuted(Sound.muted); if (!M.playing) M.start(); setTimeout(refreshMute, 50);
}
document.addEventListener('pointerdown', e => { if (state === 'menu' && !Sound.muted && e.target.id !== 'musicBtn') menuMusic(); }, true);
document.addEventListener('keydown', () => { if (state === 'menu' && !Sound.muted) menuMusic(); }, true);
function refreshMenuBest() { $('menuBest').textContent = best > 0 ? `🏆 En iyi puan: ${best}` : ''; }
refreshMute(); refreshMenuBest();

$('helpBtn').onclick = () => show($('help'), true);
$('helpClose').onclick = () => show($('help'), false);
function hitPlay(x, y) { const r = window.OktoTitle && OktoTitle.playRect; return r && x >= r.x - 10 && x <= r.x + r.w + 10 && y >= r.y - 10 && y <= r.y + r.h + 16; }
$('againBtn').onclick = () => startGame();
$('homeBtn').onclick = () => toMenu();
$('quitBtn').onclick = () => toMenu();
$('resumeBtn').onclick = () => togglePause();
ui.pauseBtn.onclick = () => togglePause();
ui.mute.onclick = () => { Sound.muted = !Sound.muted; store.set('okto_muted', Sound.muted); window.OktoMusic && OktoMusic.setMuted(Sound.muted); refreshMute(); };
$('musicBtn').onclick = e => {
  const M = window.OktoMusic;
  if (M && !M.playing && !Sound.muted) { e.stopPropagation(); menuMusic(); return; } // ilk dokunuş: müziği aç
  Sound.muted = !Sound.muted; store.set('okto_muted', Sound.muted);
  if (M) { M.setMuted(Sound.muted); if (!Sound.muted && !M.playing) M.start(); }
  refreshMute();
};
ui.ink.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sound.init(); useInk(); });

function startGame() {
  Sound.init(); reset(); state = 'play';
  window.OktoMusic && OktoMusic.stop(0.8);
  show(ui.menu, false); show(ui.over, false); show(ui.pause, false);
  show(ui.ink, true); show(ui.pauseBtn, true); show(ui.mute, true);
}
function toMenu() {
  state = 'menu'; refreshMenuBest();
  if (Sound.ctx && !Sound.muted) menuMusic(); // ses zaten açıldıysa menüye dönünce müzik tekrar başlar
  refreshMute();
  show(ui.menu, true); show(ui.over, false); show(ui.pause, false);
  show(ui.ink, false); show(ui.pauseBtn, false); show(ui.mute, false);
}
function togglePause() {
  if (state === 'play') { state = 'pause'; show(ui.pause, true); }
  else if (state === 'pause') { state = 'play'; show(ui.pause, false); last = performance.now(); }
}
function gameOver() {
  state = 'over'; Sound.over(); vibrate([80, 60, 160]);
  const isBest = score > best;
  if (isBest) { best = score; store.set('okto_best', best); }
  $('oScore').textContent = score; $('oDepth').textContent = Math.floor(depth); $('oPearls').textContent = pearls;
  $('oBest').textContent = `🏆 En iyi puan: ${best}`;
  show($('newBest'), isBest);
  show(ui.ink, false); show(ui.pauseBtn, false);
  setTimeout(() => { if (state === 'over') show(ui.over, true); }, 700);
}

// ---------- Varlıklar ----------
const ENEMIES = new Set(['jelly', 'urchin', 'puffer', 'shark', 'angler']);
function spawn() {
  const d = depth;
  const table = [
    ['pearl', 38], ['pearlRow', 10], ['fish', 14], ['jelly', 18 + d * 0.02], ['urchin', 9],
    ['puffer', d > 40 ? 12 : 0], ['shark', d > 120 ? 5 + d * 0.006 : 0], ['angler', d > 250 ? 6 : 0],
    ['shield', 2.2], ['star', 3], ['heart', lives < 3 ? 1.6 : 0],
  ];
  const total = table.reduce((s, t) => s + t[1], 0);
  let roll = Math.random() * total, type = 'pearl';
  for (const [t, w] of table) { roll -= w; if (roll <= 0) { type = t; break; } }

  const x = rand(30 * S, W - 30 * S), y = H + 40 * S;
  switch (type) {
    case 'pearlRow': {
      const n = 5, cx = rand(60 * S, W - 60 * S), amp = rand(20, 50) * S;
      for (let i = 0; i < n; i++) entities.push({ type: 'pearl', x: cx + Math.sin(i * 0.9) * amp, y: y + i * 34 * S, r: 8 * S, t: Math.random() * 9 });
      break;
    }
    case 'pearl': entities.push({ type, x, y, r: 8 * S, t: Math.random() * 9 }); break;
    case 'fish': {
      const dir = Math.random() < 0.5 ? 1 : -1;
      entities.push({ type, x: dir > 0 ? -20 * S : W + 20 * S, y: rand(H * 0.45, H), r: 10 * S, dir, sp: rand(60, 110) * S, t: Math.random() * 9, hue: rand(20, 60) });
      break;
    }
    case 'jelly': entities.push({ type, x, y, r: 18 * S, t: Math.random() * 9, hue: rand(260, 330) }); break;
    case 'urchin': entities.push({ type, x, y, r: 15 * S, t: Math.random() * 9 }); break;
    case 'puffer': entities.push({ type, x, y, r: 14 * S, base: 14 * S, t: Math.random() * 9, puff: 0 }); break;
    case 'angler': entities.push({ type, x, y, r: 20 * S, t: Math.random() * 9 }); break;
    case 'shark': {
      const dir = Math.random() < 0.5 ? 1 : -1;
      entities.push({ type, fixed: true, x: dir > 0 ? -90 * S : W + 90 * S, y: clamp(player.y + rand(-80, 80) * S, 60 * S, H - 60 * S), r: 26 * S, dir, warn: 1.1, sp: (360 + depth * 0.25) * S, t: 0 });
      break;
    }
    default: entities.push({ type, x, y, r: 13 * S, t: Math.random() * 9 }); // shield, star, heart
  }
}

function addFloater(x, y, text, color = '#fff') { floaters.push({ x, y, text, color, life: 1 }); }
function burst(x, y, color, n = 10, sp = 120) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rand(0.3, 1) * sp * S;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: rand(1.2, 2.2), r: rand(1.5, 4) * S, color });
  }
}

function useInk() {
  if (state !== 'play' || inkCharge < 1) return;
  inkCharge = 0; Sound.ink(); vibrate(30); shake = 6;
  const R = 170 * S;
  inkClouds.push({ x: player.x, y: player.y, r: 10 * S, maxR: R, life: 1 });
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * TAU, v = rand(40, 220) * S;
    particles.push({ x: player.x, y: player.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: rand(0.5, 0.9), r: rand(8, 20) * S, color: 'ink' });
  }
  let stunned = 0;
  for (const e of entities) {
    if (ENEMIES.has(e.type) && !e.stunned && Math.hypot(e.x - player.x, e.y - player.y) < R + e.r) {
      e.stunned = true; stunned++;
      if (e.type === 'shark') { e.warn = 0; e.sp *= 0.35; }
    }
  }
  if (stunned) { const p = stunned * 15; score += p; addFloater(player.x, player.y - 40 * S, `+${p} sersem!`, '#c9b6ff'); }
  // kaçış hızı
  const sp = Math.hypot(player.vx, player.vy) || 1;
  player.vx += (player.vx / sp) * 250 * S; player.vy += (player.vy / sp) * 250 * S;
}

function hurt() {
  if (invuln > 0) return;
  if (shieldTime > 0) { shieldTime = 0; invuln = 1; burst(player.x, player.y, '#9ee8ff', 22, 200); Sound.tone(500, 0.2, 'triangle', 0.12, -300); addFloater(player.x, player.y - 40 * S, 'Kalkan!', '#9ee8ff'); return; }
  lives--; invuln = 1.6; shake = 14; combo = 0;
  Sound.hit(); vibrate(120);
  burst(player.x, player.y, '#ff7eb6', 18, 180);
  if (lives <= 0) gameOver();
}

function collect(e) {
  switch (e.type) {
    case 'pearl': {
      combo = Math.min(combo + 1, 10); comboTimer = 1.6;
      const mult = 1 + Math.floor(combo / 3);
      const p = 10 * mult; score += p; pearls++;
      Sound.pearl(Math.min(combo, 8)); burst(e.x, e.y, '#fff7d6', 8, 90);
      addFloater(e.x, e.y, mult > 1 ? `+${p} x${mult}` : `+${p}`, mult > 1 ? '#ffe066' : '#fff');
      break;
    }
    case 'fish': score += 25; Sound.eat(); burst(e.x, e.y, '#ffb347', 8, 90); addFloater(e.x, e.y, '+25 nam!', '#ffb347'); break;
    case 'shield': shieldTime = 10; Sound.power(); addFloater(e.x, e.y, 'Kalkan!', '#9ee8ff'); break;
    case 'star': inkCharge = 1; score += 20; Sound.power(); addFloater(e.x, e.y, 'Mürekkep dolu!', '#ffe066'); break;
    case 'heart': lives = Math.min(lives + 1, 3); Sound.power(); addFloater(e.x, e.y, '+1 can', '#ff6b8a'); break;
  }
}

// ---------- Güncelleme ----------
function update(dt) {
  time += dt;
  const scroll = (70 + Math.min(depth, 900) * 0.18) * S; // piksel/sn
  depth += scroll * dt / (22 * S);

  // Oyuncu hareketi
  const p = player;
  let ax = 0, ay = 0;
  if (pointer.down) {
    const offY = pointer.type === 'touch' ? -70 * S : 0; // parmak ahtapotu kapatmasın
    const tx = pointer.x, ty = clamp(pointer.y + offY, p.r, H - p.r);
    ax = (tx - p.x) * 14; ay = (ty - p.y) * 14;
  }
  const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  const ky = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  if (kx || ky) { ax += kx * 1500 * S; ay += ky * 1500 * S; }
  p.vx += ax * dt; p.vy += ay * dt;
  const damp = Math.pow(0.02, dt);
  p.vx *= damp; p.vy *= damp;
  const maxV = 520 * S, v = Math.hypot(p.vx, p.vy);
  if (v > maxV) { p.vx *= maxV / v; p.vy *= maxV / v; }
  p.x = clamp(p.x + p.vx * dt, p.r, W - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r + 50 * S, H - p.r);
  if (Math.abs(p.vx) > 20 * S) p.face = Math.sign(p.vx);
  p.blink -= dt; if (p.blink < -3.5) p.blink = 0.15;
  if (v > 120 * S && Math.random() < dt * 14) bgBubbles.push({ x: p.x + rand(-6, 6) * S, y: p.y + p.r * 0.2, r: rand(2, 5) * S, vy: -rand(30, 70) * S, life: 1 });

  if (invuln > 0) invuln -= dt;
  if (shieldTime > 0) shieldTime -= dt;
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
  if (inkCharge < 1) inkCharge = Math.min(1, inkCharge + dt / 7);
  if (shake > 0) shake = Math.max(0, shake - dt * 40);

  // Doğurma
  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawn(); spawnTimer = Math.max(0.32, 1.0 - depth * 0.0013) * rand(0.7, 1.3); }

  // Varlıklar
  for (const e of entities) {
    e.t += dt;
    if (!e.fixed) e.y -= scroll * dt;
    switch (e.type) {
      case 'fish': e.x += e.dir * e.sp * dt; e.y += Math.sin(e.t * 3) * 10 * S * dt; break;
      case 'jelly': if (!e.stunned) { e.x += Math.sin(e.t * 0.9) * 25 * S * dt; e.y -= Math.max(0, Math.sin(e.t * 2.2)) * 40 * S * dt; } break;
      case 'puffer': {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        e.puff = lerp(e.puff, !e.stunned && d < 110 * S ? 1 : 0, dt * 5);
        e.r = e.base * (1 + e.puff * 0.8);
        e.x += Math.sin(e.t * 1.3) * 18 * S * dt;
        break;
      }
      case 'angler': if (!e.stunned) { // yavaşça oyuncuya yönelir
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        e.x += dx / d * 40 * S * dt; e.y += dy / d * 25 * S * dt;
      } break;
      case 'shark':
        if (e.warn > 0) e.warn -= dt;
        else { e.x += e.dir * e.sp * dt; e.y += Math.sin(e.t * 4) * 20 * S * dt; e.t += dt; }
        break;
    }
    if (e.stunned) e.y -= 60 * S * dt;
  }

  // Çarpışmalar
  for (const e of entities) {
    if (e.dead) continue;
    if (e.type === 'shark' && e.warn > 0) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    const isEnemy = ENEMIES.has(e.type);
    if (isEnemy) {
      if (!e.stunned && d < e.r * 0.85 + p.r * 0.7) hurt();
    } else if (d < e.r + p.r * 0.9) { e.dead = true; collect(e); }
  }
  entities = entities.filter(e => !e.dead && e.y > -120 * S && e.y < H + 400 * S && e.x > -200 * S && e.x < W + 200 * S);

  // Parçacıklar
  for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= Math.pow(0.1, dt); q.vy *= Math.pow(0.1, dt); q.life -= q.decay * dt; }
  particles = particles.filter(q => q.life > 0);
  for (const f of floaters) { f.y -= 40 * S * dt; f.life -= dt * 0.9; }
  floaters = floaters.filter(f => f.life > 0);
  for (const c of inkClouds) { c.r = lerp(c.r, c.maxR, dt * 6); c.life -= dt * 0.7; c.y -= scroll * dt * 0.5; }
  inkClouds = inkClouds.filter(c => c.life > 0);

  score = Math.max(score, 0);
}

function updateAmbient(dt, scroll) {
  for (const s of snow) { s.y -= (s.s * 0.04 + scroll / H * 0.6) * dt; if (s.y < 0) { s.y += 1; s.x = Math.random(); } }
  for (const b of bgBubbles) { b.y += b.vy * dt; b.x += Math.sin(b.y * 0.05) * 0.3; b.life -= dt * 0.6; }
  for (let i = bgBubbles.length - 1; i >= 0; i--) if (bgBubbles[i].life <= 0) bgBubbles.splice(i, 1);
}

// ---------- Çizim ----------
function drawBackground() {
  const t = clamp(depth / 600, 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, lerpColor('#3cc7f0', '#06223f', t));
  g.addColorStop(1, lerpColor('#0b5d8f', '#010a18', t));
  ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);

  // Işık huzmeleri
  const rayA = (1 - t) * 0.12;
  if (rayA > 0.005) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = W * (0.1 + i * 0.22) + Math.sin(time * 0.3 + i) * 30 * S;
      const gr = ctx.createLinearGradient(0, 0, 0, H * 0.9);
      gr.addColorStop(0, `rgba(255,255,255,${rayA})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.beginPath();
      ctx.moveTo(x - 20 * S, 0); ctx.lineTo(x + 30 * S, 0); ctx.lineTo(x + 120 * S, H * 0.9); ctx.lineTo(x + 20 * S, H * 0.9); ctx.fill();
    }
    ctx.restore();
  }
  // Deniz karı / derinlerde biyolüminesans
  const glow = clamp((depth - 200) / 300, 0, 1);
  for (const s of snow) {
    const a = 0.25 + 0.35 * s.s;
    ctx.fillStyle = glow > 0 && s.r > 1.6 ? `rgba(120,255,230,${a * (0.5 + glow)})` : `rgba(255,255,255,${a * 0.6})`;
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r * S, 0, TAU); ctx.fill();
  }
  for (const b of bgBubbles) {
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * b.life})`; ctx.lineWidth = 1.2 * S;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
  }
}

function drawOcto(p, x, y, r, opts = {}) {
  const t = time;
  const vx = opts.vx ?? p.vx, vy = opts.vy ?? p.vy;
  const speed = Math.hypot(vx, vy);
  ctx.save(); ctx.translate(x, y);
  ctx.rotate(clamp(vx / (900 * S), -0.35, 0.35));

  // Dokunaçlar — hareketin tersine doğru savrulur
  const trailX = clamp(-vx / (400 * S), -1, 1), trailY = clamp(-vy / (400 * S), -1, 1);
  const stretch = 1 + clamp(speed / (500 * S), 0, 0.5);
  const tentacleColors = ['#c04dff', '#d65cf0'];
  for (let i = 0; i < 8; i++) {
    const side = i / 7 - 0.5;            // -0.5..0.5
    const bx = side * r * 1.35, by = r * 0.55;
    const N = 14, L = r * 1.9 * stretch, w0 = r * 0.27;
    const pts = [];
    let px = bx, py = by;
    let ang = Math.PI / 2 - side * 2.0 + trailX * 0.5;
    for (let k = 0; k <= N; k++) {
      pts.push([px, py, ang]);
      const f = k / N;
      // dalgalanma + uçlarda dışa doğru kıvrılma
      ang += Math.sin(t * 5 + i * 0.9 - k * 0.5) * 0.14 * (0.3 + f) + (side >= 0 ? -1 : 1) * (0.25 + Math.abs(side)) * 0.25 * f * f + trailX * 0.04;
      const ty = 1 + trailY * 0.5;
      px += Math.cos(ang) * L / N; py += Math.sin(ang) * L / N * ty;
    }
    // sivrilen gövde
    ctx.fillStyle = tentacleColors[i % 2];
    ctx.beginPath();
    for (let k = 0; k <= N; k++) { const [qx, qy, a] = pts[k], w = w0 * (1 - k / N) + 0.6 * S; ctx.lineTo(qx + Math.cos(a + Math.PI / 2) * w, qy + Math.sin(a + Math.PI / 2) * w); }
    for (let k = N; k >= 0; k--) { const [qx, qy, a] = pts[k], w = w0 * (1 - k / N) + 0.6 * S; ctx.lineTo(qx + Math.cos(a - Math.PI / 2) * w, qy + Math.sin(a - Math.PI / 2) * w); }
    ctx.closePath(); ctx.fill();
    // vantuzlar
    ctx.fillStyle = 'rgba(255,214,240,.85)';
    for (let k = 2; k < N - 2; k += 2) { const [qx, qy] = pts[k]; ctx.beginPath(); ctx.arc(qx, qy, w0 * (1 - k / N) * 0.45, 0, TAU); ctx.fill(); }
  }

  // Manto (baş)
  const breath = 1 + Math.sin(t * 3) * 0.03;
  const mg = ctx.createRadialGradient(-r * 0.3, -r * 0.6, r * 0.1, 0, -r * 0.1, r * 1.3);
  mg.addColorStop(0, '#ffc2df'); mg.addColorStop(0.55, '#ff7eb6'); mg.addColorStop(1, '#d9468f');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.ellipse(0, -r * 0.15, r * 1.05 / breath, r * 1.12 * breath, 0, 0, TAU); ctx.fill();
  // benekler
  ctx.fillStyle = 'rgba(192,77,255,.35)';
  [[-0.5, -0.65, 0.13], [0.35, -0.8, 0.1], [0.62, -0.35, 0.08], [-0.15, -1.0, 0.07]].forEach(([sx, sy, sr]) => { ctx.beginPath(); ctx.arc(sx * r, sy * r, sr * r, 0, TAU); ctx.fill(); });
  // parlama
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.7, r * 0.28, r * 0.16, -0.5, 0, TAU); ctx.fill();

  // Gözler
  const lookX = clamp(vx / (300 * S), -1, 1) * r * 0.08, lookY = clamp(vy / (300 * S), -1, 1) * r * 0.08;
  const blinking = opts.blink ?? (p.blink > 0);
  for (const ex of [-0.38, 0.38]) {
    const cx = ex * r, cy = r * 0.08;
    if (blinking || opts.dizzy) {
      ctx.strokeStyle = '#1b1033'; ctx.lineWidth = 2.4 * S; ctx.lineCap = 'round';
      ctx.beginPath();
      if (opts.dizzy) { ctx.moveTo(cx - r * 0.12, cy - r * 0.12); ctx.lineTo(cx + r * 0.12, cy + r * 0.12); ctx.moveTo(cx + r * 0.12, cy - r * 0.12); ctx.lineTo(cx - r * 0.12, cy + r * 0.12); }
      else { ctx.moveTo(cx - r * 0.18, cy); ctx.quadraticCurveTo(cx, cy + r * 0.1, cx + r * 0.18, cy); }
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.24, r * 0.27, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b1033'; ctx.beginPath(); ctx.arc(cx + lookX, cy + lookY + r * 0.03, r * 0.14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + lookX + r * 0.05, cy + lookY - r * 0.04, r * 0.05, 0, TAU); ctx.fill();
    }
  }
  // yanaklar ve ağız
  ctx.fillStyle = 'rgba(255,79,154,.5)';
  ctx.beginPath(); ctx.ellipse(-r * 0.68, r * 0.38, r * 0.15, r * 0.09, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.68, r * 0.38, r * 0.15, r * 0.09, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1b1033'; ctx.lineWidth = 2 * S; ctx.lineCap = 'round';
  ctx.beginPath();
  if (opts.dizzy || invuln > 1.2) { ctx.arc(0, r * 0.52, r * 0.09, 0, TAU); }
  else { ctx.moveTo(-r * 0.13, r * 0.42); ctx.quadraticCurveTo(0, r * 0.56, r * 0.13, r * 0.42); }
  ctx.stroke();
  ctx.restore();
}

function drawEntity(e) {
  const r = e.r;
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.stunned) ctx.globalAlpha = 0.45;
  switch (e.type) {
    case 'pearl': {
      const pulse = 1 + Math.sin(e.t * 4) * 0.08;
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.9 * pulse);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#fff2d9'); g.addColorStop(0.55, 'rgba(255,240,210,.35)'); g.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.9 * pulse, 0, TAU); ctx.fill();
      break;
    }
    case 'fish': {
      ctx.scale(e.dir, 1);
      const wag = Math.sin(e.t * 12) * 0.35;
      ctx.fillStyle = `hsl(${e.hue},95%,60%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.8, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(-r * 1.2, 0); ctx.rotate(wag);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.9, -r * 0.7); ctx.lineTo(-r * 0.9, r * 0.7); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-r * 0.2, -r * 0.75, r * 0.25, r * 1.5);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 0.6, -r * 0.15, r * 0.28, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(r * 0.68, -r * 0.15, r * 0.14, 0, TAU); ctx.fill();
      break;
    }
    case 'jelly': {
      const pulse = Math.sin(e.t * 2.2);
      const col = e.stunned ? '150,150,170' : `${hsl2rgb(e.hue)}`;
      ctx.strokeStyle = `rgba(${col},.7)`; ctx.lineWidth = 2 * S;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * r * 0.3, r * 0.1);
        for (let k = 1; k <= 6; k++) ctx.lineTo(i * r * 0.3 + Math.sin(e.t * 3 + k + i) * 4 * S, r * 0.1 + k * r * 0.32);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(0, -r * 0.3, 1, 0, 0, r * 1.2);
      g.addColorStop(0, `rgba(255,255,255,.9)`); g.addColorStop(0.5, `rgba(${col},.75)`); g.addColorStop(1, `rgba(${col},.2)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, r * (1 + pulse * 0.08), r * (0.8 - pulse * 0.08), 0, Math.PI, 0); ctx.quadraticCurveTo(0, r * 0.35, -r * (1 + pulse * 0.08), 0); ctx.fill();
      if (!e.stunned) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${col},.15)`; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.fill(); }
      break;
    }
    case 'urchin': {
      ctx.rotate(e.t * 0.4);
      ctx.strokeStyle = e.stunned ? '#777' : '#3a1450'; ctx.lineWidth = 2.2 * S; ctx.lineCap = 'round';
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, l = r * (1.25 + (i % 2) * 0.3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke(); }
      ctx.fillStyle = e.stunned ? '#888' : '#5b1f7a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.1, r * 0.15, 0, TAU); ctx.arc(r * 0.2, -r * 0.1, r * 0.15, 0, TAU); ctx.fill();
      break;
    }
    case 'puffer': {
      ctx.fillStyle = e.stunned ? '#aaa' : '#ffd23f';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      if (e.puff > 0.2) {
        ctx.strokeStyle = '#b07d00'; ctx.lineWidth = 1.6 * S;
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * r * (1 + 0.3 * e.puff), Math.sin(a) * r * (1 + 0.3 * e.puff)); ctx.stroke(); }
      }
      ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.7, r * 0.45, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.2, r * 0.25, 0, TAU); ctx.arc(r * 0.35, -r * 0.2, r * 0.25, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.18, r * 0.12, 0, TAU); ctx.arc(r * 0.38, -r * 0.18, r * 0.12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff7a5c'; ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.12, 0, TAU); ctx.fill();
      break;
    }
    case 'angler': {
      const lure = Math.sin(e.t * 3) * 0.5 + 0.5;
      ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.quadraticCurveTo(r * 0.3, -r * 1.8, r * 0.9, -r * 1.4); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(r * 0.9, -r * 1.4, 1, r * 0.9, -r * 1.4, r * (0.8 + lure * 0.5));
      lg.addColorStop(0, 'rgba(180,255,240,1)'); lg.addColorStop(1, 'rgba(80,255,220,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(r * 0.9, -r * 1.4, r * 1.3, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = e.stunned ? '#666' : '#2b3a4a'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.85, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0f18'; ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.1); ctx.lineTo(r * 1.1, -r * 0.1); ctx.lineTo(r * 1.1, r * 0.6); ctx.fill();
      ctx.fillStyle = '#eee';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(r * (0.35 + i * 0.18), r * 0.05); ctx.lineTo(r * (0.43 + i * 0.18), r * 0.3); ctx.lineTo(r * (0.51 + i * 0.18), r * 0.05); ctx.fill(); }
      ctx.fillStyle = '#d6ff6b'; ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.35, r * 0.18, 0, TAU); ctx.fill();
      break;
    }
    case 'shark': {
      if (e.warn > 0) {
        ctx.restore(); ctx.save();
        const wx = e.dir > 0 ? 28 * S : W - 28 * S;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 20);
        ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(wx, e.y, 18 * S, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${24 * S}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', wx, e.y + 1);
        break;
      }
      ctx.scale(e.dir, 1);
      ctx.fillStyle = e.stunned ? '#8a95a0' : '#5d7487';
      ctx.beginPath(); ctx.moveTo(r * 2.2, 0); ctx.quadraticCurveTo(r * 1.2, -r * 0.9, -r * 1.4, -r * 0.3); ctx.lineTo(-r * 2.4, -r * 1.0); ctx.lineTo(-r * 2.1, 0); ctx.lineTo(-r * 2.4, r * 0.9); ctx.lineTo(-r * 1.4, r * 0.3); ctx.quadraticCurveTo(r * 1.2, r * 0.8, r * 2.2, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(-r * 0.6, -r * 1.4); ctx.lineTo(-r * 0.7, -r * 0.45); ctx.fill();
      ctx.fillStyle = '#dfe8ee'; ctx.beginPath(); ctx.moveTo(r * 2.1, r * 0.08); ctx.quadraticCurveTo(r * 0.8, r * 0.75, -r * 1.2, r * 0.25); ctx.quadraticCurveTo(r * 0.8, r * 0.3, r * 2.1, r * 0.08); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(r * 1.35, -r * 0.2, r * 0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.4 * S;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r * (0.7 - i * 0.18), -r * 0.2); ctx.lineTo(r * (0.6 - i * 0.18), r * 0.2); ctx.stroke(); }
      break;
    }
    case 'shield': {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.2);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.6, 'rgba(120,220,255,.35)'); g.addColorStop(1, 'rgba(120,220,255,.8)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, Math.sin(e.t * 3) * 3 * S, r * 1.15, 0, TAU); ctx.fill();
      ctx.font = `${r * 1.1}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🛡️', 0, 1);
      break;
    }
    case 'star': {
      ctx.rotate(Math.sin(e.t * 2) * 0.3);
      ctx.fillStyle = '#ff9f43'; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, l = i % 2 ? r * 0.5 : r * 1.25; ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd38a'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 1.8 * S, 0, TAU); ctx.fill(); }
      break;
    }
    case 'heart': {
      const s = r * (1 + Math.sin(e.t * 6) * 0.08) / 16;
      ctx.scale(s, s); ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-26, -4, -12, -22, 0, -8); ctx.bezierCurveTo(12, -22, 26, -4, 0, 14); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-8, -8, 3.5, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
  if (e.stunned && e.type !== 'pearl') {
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `bold ${12 * S}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('z z', e.x + r * 0.8, e.y - r * 1.1 - Math.sin(e.t * 3) * 3 * S);
  }
}
const hslCache = {};
function hsl2rgb(h) {
  const k = Math.round(h); if (hslCache[k]) return hslCache[k];
  const s = 0.85, l = 0.68, a = s * Math.min(l, 1 - l);
  const f = n => { const kk = (n + k / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1)))); };
  return (hslCache[k] = `${f(0)},${f(8)},${f(4)}`);
}

function drawPlayer() {
  const p = player;
  if (invuln > 0 && state === 'play' && Math.floor(invuln * 12) % 2 === 0) return drawShield();
  drawOcto(p, p.x, p.y, p.r, { dizzy: state === 'over' });
  drawShield();
}
function drawShield() {
  if (shieldTime <= 0) return;
  const p = player, a = shieldTime < 2 ? 0.5 + 0.5 * Math.sin(time * 20) : 1;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(p.x, p.y, p.r * 0.8, p.x, p.y, p.r * 2.4);
  g.addColorStop(0, 'rgba(150,230,255,0)'); g.addColorStop(0.85, 'rgba(150,230,255,.25)'); g.addColorStop(1, 'rgba(200,245,255,.7)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const c of inkClouds) {
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    g.addColorStop(0, `rgba(20,8,35,${0.75 * c.life})`); g.addColorStop(1, 'rgba(20,8,35,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
  }
  for (const q of particles) {
    ctx.globalAlpha = Math.max(0, q.life);
    ctx.fillStyle = q.color === 'ink' ? '#170a26' : q.color;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (q.color === 'ink' ? (1.6 - q.life) : 1), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of floaters) {
    ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
    ctx.font = `bold ${16 * S}px "Trebuchet MS",sans-serif`;
    ctx.lineWidth = 3 * S; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  const top = 14 + safeTop;
  // canlar
  for (let i = 0; i < 3; i++) {
    const x = 22 + i * 30, y = top + 14;
    ctx.save(); ctx.translate(x, y); ctx.scale(0.8, 0.8);
    ctx.fillStyle = i < lives ? '#ff4d6d' : 'rgba(255,255,255,.2)';
    ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-26, -4, -12, -22, 0, -8); ctx.bezierCurveTo(12, -22, 26, -4, 0, 14); ctx.fill();
    ctx.restore();
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = 'bold 15px "Trebuchet MS",sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText(`${Math.floor(depth)} m ⬇`, 12, top + 34);
  // puan
  ctx.textAlign = 'center'; ctx.font = 'bold 30px "Trebuchet MS",sans-serif';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.strokeText(score, W / 2, top);
  ctx.fillStyle = '#fff'; ctx.fillText(score, W / 2, top);
  if (combo >= 3) {
    ctx.font = 'bold 15px "Trebuchet MS",sans-serif'; ctx.fillStyle = '#ffe066';
    ctx.fillText(`KOMBO x${1 + Math.floor(combo / 3)}`, W / 2, top + 36);
  }
  // mürekkep düğmesi
  const c = inkCtx, s = 168, cx = s / 2, rr = s / 2 - 10, ready = inkCharge >= 1;
  c.clearRect(0, 0, s, s);
  c.fillStyle = ready ? 'rgba(40,16,70,.85)' : 'rgba(20,10,35,.55)';
  c.beginPath(); c.arc(cx, cx, rr, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 10; c.beginPath(); c.arc(cx, cx, rr - 2, 0, TAU); c.stroke();
  c.strokeStyle = ready ? `hsl(${290 + Math.sin(time * 6) * 20},90%,70%)` : '#b48cff'; c.lineWidth = 10; c.lineCap = 'round';
  c.beginPath(); c.arc(cx, cx, rr - 2, -Math.PI / 2, -Math.PI / 2 + TAU * inkCharge); c.stroke();
  c.fillStyle = ready ? '#fff' : 'rgba(255,255,255,.45)';
  c.beginPath(); c.moveTo(cx, cx - 34); c.bezierCurveTo(cx + 30, cx + 6, cx + 22, cx + 30, cx, cx + 30); c.bezierCurveTo(cx - 22, cx + 30, cx - 30, cx + 6, cx, cx - 34); c.fill();
  ui.ink.style.transform = ready ? `scale(${1 + Math.sin(time * 6) * 0.05})` : 'none';
}

// ---------- Ana döngü ----------
let last = performance.now();
function frame(now) {
  let dt = Math.min((now - last) / 1000, 1 / 20); last = now;
  if (state === 'play') update(dt);
  else if (state === 'over') { time += dt; for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= q.decay * dt; } particles = particles.filter(q => q.life > 0); player.vy = 40 * S; player.y = Math.min(player.y + 40 * S * dt, H + 80 * S); }
  else if (state === 'menu') { time += dt; }
  const scroll = state === 'play' ? (70 + Math.min(depth, 900) * 0.18) * S : 20 * S;
  if (state !== 'pause' && state !== 'menu') updateAmbient(dt, scroll);

  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  if (state === 'menu' && window.OktoTitle) OktoTitle.draw(ctx, W, H, time, { variant: 'pink', top: safeTop });
  else drawBackground();
  if (state !== 'menu') {
    for (const e of entities) drawEntity(e);
    drawParticles();
    drawPlayer();
  }
  ctx.restore();
  if (state === 'play' || state === 'pause') drawHUD();
  requestAnimationFrame(frame);
}

reset();
toMenu();
requestAnimationFrame(frame);

// Test/hata ayıklama için
window.__okto = { get state() { return state; }, get score() { return score; }, get depth() { return depth; }, get lives() { return lives; }, startGame, useInk, get entities() { return entities; } };
})();

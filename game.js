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
const FONT = 'Fredoka, "Trebuchet MS", sans-serif';

// ---------- Tuval ----------
const cvs = $('c'), ctx = cvs.getContext('2d');
let W = 0, H = 0, DPR = 1, S = 1, safeTop = 0; // S: ekran boyutuna göre ölçek birimi
function resize() {
  // Boyutu tuvalin ekrandaki gerçek alanından al: iPhone'da innerHeight bazen yanlış (kısa) gelir
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const r = cvs.getBoundingClientRect();
  W = Math.round(r.width) || window.innerWidth; H = Math.round(r.height) || window.innerHeight;
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  S = clamp(Math.min(W, H) / 400, 0.75, 1.6);
  safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
  layoutMenuButtons();
}
function checkSize() { // olay gelmese bile boyut değiştiyse yakala
  const r = cvs.getBoundingClientRect();
  if (Math.abs(r.width - W) > 1 || Math.abs(r.height - H) > 1) resize();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));
window.addEventListener('pageshow', () => setTimeout(resize, 50));
if (window.visualViewport) visualViewport.addEventListener('resize', () => setTimeout(checkSize, 50));
window.addEventListener('scroll', () => { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); });

// ---------- Profil (cüzdan, kostümler, günlük görevler) ----------
const Profile = {
  data: Object.assign({
    wallet: 0, best: store.get('okto_best', 0),
    owned: { colors: ['pink'], accessories: ['goggles', 'none'] },
    palette: 'pink', accessory: 'goggles',
    daily: null, login: { last: '', streak: 0 },
  }, store.get('okto_profile', {})),
  save() { store.set('okto_profile', this.data); },
};
const look = () => ({ palette: Profile.data.palette, accessory: Profile.data.accessory });

// ---------- Ses (WebAudio, derinliğe göre 3 kademe) ----------
const TIERS = [null,
  { name: 'Güneşli Sular', pitch: 1.0, lp: 14000, echo: 0.1, delay: 0.16 },
  { name: 'Alacakaranlık Bölgesi', pitch: 0.8, lp: 4200, echo: 0.32, delay: 0.27 },
  { name: 'Karanlık Derinlikler', pitch: 0.6, lp: 1800, echo: 0.5, delay: 0.42 },
];
const Sound = {
  ctx: null, muted: store.get('okto_muted', false), tier: 1, buses: [],
  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
        this.buildBuses(this.ctx);
      } catch {}
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  buildBuses(c) {
    for (let i = 1; i <= 3; i++) {
      const T = TIERS[i], inp = c.createGain(), lp = c.createBiquadFilter(), dl = c.createDelay(1), fb = c.createGain(), wet = c.createGain();
      lp.type = 'lowpass'; lp.frequency.value = T.lp; dl.delayTime.value = T.delay; fb.gain.value = T.echo; wet.gain.value = T.echo * 0.9;
      inp.connect(lp).connect(c.destination); inp.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(c.destination);
      this.buses[i] = inp;
    }
  },
  get out() { return this.buses[this.tier] || this.ctx.destination; },
  // ---- dalgıç sesleri ----
  blip(delay = 0, vol = 0.05) { // tek kabarcık: hızla yükselen kısa "blup"
    if (this.muted || !this.ctx) return;
    const k = TIERS[this.tier].pitch, t = this.ctx.currentTime + delay, f0 = rand(160, 380) * k, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * rand(2.6, 4), t + rand(0.03, 0.06));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.09);
  },
  filtered(dur, vol, type, freq, q, delay = 0, attack = 0.1) { // şekillendirilmiş gürültü (nefes / köpük)
    if (this.muted || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay, len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type; f.frequency.value = freq * TIERS[this.tier].pitch; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.buffer = buf; src.connect(f).connect(g).connect(this.out); src.start(t); src.stop(t + dur + 0.02);
  },
  inhale(delay = 0, vol = 0.05) { this.filtered(0.75, vol, 'highpass', 2800, 0.7, delay, 0.25); this.filtered(0.75, vol * 0.6, 'bandpass', 1400, 1.2, delay, 0.3); },
  exhale(delay = 0, vol = 1) { // regülatörden çıkan kabarcık patlaması
    this.filtered(0.9, 0.05 * vol, 'lowpass', 520, 0.8, delay, 0.05);
    let tt = delay;
    for (let i = 0; i < 16; i++) { tt += rand(0.025, 0.07); this.blip(tt, (0.05 + Math.random() * 0.04) * vol * (1 - i / 22)); }
  },
  tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0, raw = false) {
    if (this.muted || !this.ctx) return;
    const k = raw ? 1 : TIERS[this.tier].pitch;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq * k, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, (freq + slide) * k), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.2, freq = 800, delay = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay, len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq * TIERS[this.tier].pitch, t); f.frequency.exponentialRampToValueAtTime(120, t + dur);
    g.gain.setValueAtTime(vol, t);
    src.buffer = buf; src.connect(f).connect(g).connect(this.out); src.start(t);
  },
  // her kademede farklı karakter: 1 parlak çıngırak, 2 yumuşak marimba, 3 sonar yankısı
  pearl(c) {
    const f = 660 * Math.pow(2, Math.min(c, 8) / 12);
    if (this.tier === 1) { this.tone(f, 0.12, 'sine', 0.12); this.tone(f * 1.5, 0.1, 'triangle', 0.06); this.tone(f * 2, 0.08, 'sine', 0.04, 0, 0.04); }
    else if (this.tier === 2) { this.tone(f, 0.25, 'sine', 0.13); this.tone(f * 4, 0.05, 'sine', 0.03); }
    else { this.tone(f, 0.5, 'sine', 0.12, -f * 0.03); this.tone(f * 1.5, 0.35, 'sine', 0.04, 0, 0.09); }
  },
  eat() { this.tier === 3 ? this.tone(220, 0.25, 'sine', 0.12, 180) : this.tone(300, 0.1, this.tier === 1 ? 'square' : 'triangle', 0.07, 300); },
  hit() { this.tone(180, 0.35, this.tier === 1 ? 'sawtooth' : 'triangle', 0.15, -120); this.noise(0.25, 0.15, 600); },
  ink() { this.noise(0.6, 0.3, 1400); this.tone(140, 0.4, 'sine', 0.15, -80); },
  power() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.1, 0, i * 0.07)); },
  bomb() {
    this.noise(0.9, 0.35, 3000);
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.09, 0, i * 0.04));
    this.tone(80, 0.6, 'sine', 0.25, -40);
  },
  tierUp(n) { const base = n === 2 ? 392 : 262; [0, 4, 7, 12].forEach((s, i) => this.tone(base * Math.pow(2, s / 12), 0.9, 'sine', 0.08, 0, i * 0.12, true)); this.tone(base / 2, 1.6, 'sine', 0.12, -base / 4, 0, true); },
  bossWarn() { for (let i = 0; i < 3; i++) { this.tone(110, 0.5, 'sawtooth', 0.1, -30, i * 0.55); this.tone(55, 0.5, 'sine', 0.2, 0, i * 0.55); } },
  bossHit() { this.tone(160, 0.3, 'square', 0.12, -90); this.noise(0.3, 0.2, 900); },
  bossDown() { [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.12, 0, i * 0.1, true)); this.noise(1.2, 0.25, 2000); },
  vortex() { // girdaba dalış: alçalan uğultu + kabarcıklar + çıkışta parlama
    this.filtered(1.6, 0.12, 'lowpass', 900, 1, 0, 0.6); this.tone(420, 1.5, 'sine', 0.12, -340, 0, true);
    for (let i = 0; i < 24; i++) this.blip(rand(0.1, 1.5), 0.05);
    [523, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.08, 0, 1.6 + i * 0.08, true));
  },
  mission() { [880, 1175].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.1, 0, i * 0.09, true)); },
  coin() { [988, 1319].forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, 0, i * 0.07, true)); },
  over() { [440, 370, 311, 262].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, 0, i * 0.16)); },
};
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

// ---------- Günlük görevler ----------
const MISSION_POOL = [
  { id: 'pearls_run', text: n => `Tek dalışta ${n} inci topla`, n: [20, 35, 50], reward: [20, 35, 50], kind: 'max' },
  { id: 'pearls_day', text: n => `Bugün toplam ${n} inci topla`, n: [60, 120], reward: [30, 50], kind: 'sum' },
  { id: 'depth_run', text: n => `${n} m derinliğe in`, n: [150, 300, 450], reward: [25, 40, 60], kind: 'max' },
  { id: 'stun_day', text: n => `Mürekkeple ${n} düşman sersemlet`, n: [5, 10], reward: [25, 40], kind: 'sum' },
  { id: 'bomb_day', text: n => `${n} ışık bombası patlat`, n: [1, 2], reward: [30, 50], kind: 'sum' },
  { id: 'fish_day', text: n => `${n} balık ye`, n: [3, 6], reward: [20, 30], kind: 'sum' },
  { id: 'combo_run', text: n => `x${n} komboya ulaş`, n: [3, 4], reward: [30, 50], kind: 'max' },
  { id: 'boss_day', text: () => 'Bir bölüm sonu canavarını yen', n: [1], reward: [60], kind: 'sum' },
  { id: 'runs_day', text: n => `${n} dalış yap`, n: [3, 5], reward: [15, 25], kind: 'sum' },
];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const Missions = {
  ensure() {
    const day = today(), D = Profile.data;
    if (D.daily && D.daily.date === day) return;
    let seed = [...day].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
    const pool = MISSION_POOL.slice(), list = [];
    while (list.length < 3) {
      const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0], k = Math.floor(rnd() * m.n.length);
      list.push({ id: m.id, n: m.n[k], reward: m.reward[k], progress: 0, done: false, claimed: false });
    }
    D.daily = { date: day, list };
    Profile.save();
  },
  track(id, v) {
    this.ensure();
    for (const m of Profile.data.daily.list) {
      if (m.id !== id || m.done) continue;
      const kind = MISSION_POOL.find(p => p.id === id).kind;
      const np = kind === 'max' ? Math.max(m.progress, v) : m.progress + v;
      if (np === m.progress) continue;
      m.progress = np;
      if (m.progress >= m.n) {
        m.done = true; m.progress = m.n;
        if (state === 'play') { Sound.mission(); toast(`✅ Görev tamam: ${this.text(m)}`); }
      }
      Profile.save();
    }
  },
  text(m) { return MISSION_POOL.find(p => p.id === m.id).text(m.n); },
  loginGift() {
    const L = Profile.data.login, day = today();
    if (L.last === day) return null;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yest = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    const streak = L.last === yest ? L.streak + 1 : 1;
    return { streak, reward: Math.min(10 + (streak - 1) * 5, 40) };
  },
  claimable() { this.ensure(); return !!this.loginGift() || Profile.data.daily.list.some(m => m.done && !m.claimed); },
};

// ---------- Oyun durumu ----------
let state = 'menu';           // menu | play | pause | clear | transition | over
let player, entities, particles, floaters, inkClouds, rings, banners, slams, shots;
let depth, score, pearls, lives, combo, comboTimer, spawnTimer, inkCharge, shieldTime, invuln, time, shake, flash, winkT;
let tier, boss, bossesBeaten, bonusPearls, breathT, blipT, banked;
let levelN = 1, phase = 'dive', levelHits = 0, levelPearls = 0;
const snow = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + 0.4, s: Math.random() * 0.5 + 0.3 }));
const bgBubbles = [];
const keys = {};
const target = { x: 0, y: 0 };
const drag = { active: false, id: null, ax: 0, ay: 0, px: 0, py: 0, lx: 0, ly: 0 };
const SENS = 1.5; // parmak hareketi → Okto hareketi oranı

function reset() {
  player = { x: W / 2, y: H * 0.3, vx: 0, vy: 0, r: 22 * S, blink: 0 };
  target.x = player.x; target.y = player.y;
  entities = []; particles = []; floaters = []; inkClouds = []; rings = []; banners = []; slams = []; shots = [];
  depth = 0; score = 0; pearls = 0; lives = 3; combo = 0; comboTimer = 0; bonusPearls = 0;
  spawnTimer = 0.5; inkCharge = 0.5; shieldTime = 0; invuln = 1.5; time = 0; shake = 0; flash = 0; winkT = 0;
  tier = 1; Sound.tier = 1; boss = null; bossesBeaten = 0; breathT = 1.2; blipT = 0; banked = false;
  levelN = 1; phase = 'dive'; levelHits = 0; levelPearls = 0; trans = null;
}

// ---------- Girdi ----------
const bounds = () => ({ x0: player.r, x1: W - player.r, y0: player.r + 50 * S + safeTop, y1: H - player.r });
cvs.addEventListener('pointerdown', e => {
  Sound.init();
  if (state === 'menu') { if (hitPlay(e.clientX, e.clientY)) startGame(); return; }
  if (state !== 'play') return;
  drag.active = true; drag.id = e.pointerId; drag.ax = drag.lx = e.clientX; drag.ay = drag.ly = e.clientY; drag.px = target.x; drag.py = target.y;
  cvs.setPointerCapture && cvs.setPointerCapture(e.pointerId);
});
cvs.addEventListener('pointermove', e => {
  if (state === 'menu') { cvs.style.cursor = hitPlay(e.clientX, e.clientY) ? 'pointer' : 'default'; return; }
  cvs.style.cursor = 'default';
  if (!drag.active || e.pointerId !== drag.id) return;
  drag.lx = e.clientX; drag.ly = e.clientY;
  const b = bounds();
  const tx = drag.px + (e.clientX - drag.ax) * SENS, ty = drag.py + (e.clientY - drag.ay) * SENS;
  target.x = clamp(tx, b.x0, b.x1); target.y = clamp(ty, b.y0, b.y1);
  // kenara dayanınca yeniden çapala: geri dönüş hemen tepki versin
  if (target.x !== tx) { drag.ax = e.clientX; drag.px = target.x; }
  if (target.y !== ty) { drag.ay = e.clientY; drag.py = target.y; }
});
const endDrag = e => { if (e.pointerId === drag.id) drag.active = false; };
cvs.addEventListener('pointerup', endDrag);
cvs.addEventListener('pointercancel', endDrag);
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ' && state === 'play') { useInk(); e.preventDefault(); }
  if ((e.key === 'p' || e.key === 'Escape') && (state === 'play' || state === 'pause')) togglePause();
  if (e.key === 'Enter' && (state === 'menu' || state === 'over') && !anyPanelOpen()) startGame();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- Arayüz ----------
const ui = { menu: $('menu'), over: $('over'), pause: $('pauseMenu'), ink: $('inkBtn'), pauseBtn: $('pauseBtn'), mute: $('muteBtn'), shop: $('shop'), missions: $('missions'), help: $('help'), clear: $('clear') };
const inkCtx = $('inkCanvas').getContext('2d');
function show(el, v) { el.classList.toggle('hidden', !v); }
const anyPanelOpen = () => [ui.shop, ui.missions, ui.help].some(p => !p.classList.contains('hidden'));
function refreshMute() {
  ui.mute.textContent = Sound.muted ? '🔇' : '🔊';
  const mb = $('musicBtn'), M = window.OktoMusic;
  mb.textContent = !M || (!M.playing && !Sound.muted) ? '🎵 Müziği aç' : (Sound.muted ? '🔇' : '🔊');
  mb.classList.toggle('icon', !!(M && M.playing) || Sound.muted);
  mb.classList.toggle('hint', !(M && M.playing) && !Sound.muted);
}
function menuMusic() {
  const M = window.OktoMusic; if (!M || state !== 'menu') return;
  M.setMuted(Sound.muted); if (!M.playing) M.start(); setTimeout(refreshMute, 50);
}
document.addEventListener('pointerdown', e => { if (state === 'menu' && !Sound.muted && e.target.id !== 'musicBtn') menuMusic(); }, true);
document.addEventListener('keydown', () => { if (state === 'menu' && !Sound.muted) menuMusic(); }, true);
function startLevel() { const D = Profile.data; return clamp(D.startLevel || 1, 1, D.checkpoint || 1); }
function refreshMenu() {
  const lp = $('levelPick'), cp = Profile.data.checkpoint || 1, sl = startLevel();
  lp.classList.toggle('hidden', cp < 2);
  lp.innerHTML = sl > 1 ? `▶ Bölüm ${ablative(sl)} başla <small>(değiştir)</small>` : `▶ Baştan başla <small>(değiştir)</small>`;
  $('menuBest').textContent = `⚪ ${Profile.data.wallet} inci` + (Profile.data.best > 0 ? `   🏆 ${Profile.data.best}` : '');
  $('missionBadge').classList.toggle('hidden', !Missions.claimable());
}
function layoutMenuButtons() { // mağaza ve görev düğmeleri oyna düğmesinin iki yanında
  const u = Math.min(W / 390, H / 720), y = H * 0.865, dx = 75 * u + 46;
  for (const [id, sx] of [['shopBtn', -1], ['missionBtn', 1]]) {
    const el = $(id); if (!el) continue;
    el.style.left = (W / 2 + sx * dx - 30) + 'px'; el.style.top = (y - 30) + 'px';
  }
  const lp = $('levelPick'); if (lp) lp.style.top = (y - 32 * u - 50) + 'px';
}
function hitPlay(x, y) { const r = window.OktoTitle && OktoTitle.playRect; return r && x >= r.x - 10 && x <= r.x + r.w + 10 && y >= r.y - 10 && y <= r.y + r.h + 16; }

$('helpBtn').onclick = () => show(ui.help, true);
$('helpClose').onclick = () => show(ui.help, false);
$('againBtn').onclick = () => startGame(levelN);
$('clearNext').onclick = () => startTransition();
$('levelPick').onclick = () => { const D = Profile.data, cp = D.checkpoint || 1; D.startLevel = startLevel() >= cp ? 1 : startLevel() + 1; Profile.save(); refreshMenu(); };
$('homeBtn').onclick = () => toMenu();
$('quitBtn').onclick = () => { bankRun(); toMenu(); };
$('resumeBtn').onclick = () => togglePause();
ui.pauseBtn.onclick = () => togglePause();
ui.mute.onclick = () => { Sound.muted = !Sound.muted; store.set('okto_muted', Sound.muted); window.OktoMusic && OktoMusic.setMuted(Sound.muted); refreshMute(); };
$('musicBtn').onclick = e => {
  const M = window.OktoMusic;
  if (M && !M.playing && !Sound.muted) { e.stopPropagation(); menuMusic(); return; }
  Sound.muted = !Sound.muted; store.set('okto_muted', Sound.muted);
  if (M) { M.setMuted(Sound.muted); if (!Sound.muted && !M.playing) M.start(); }
  refreshMute();
};
ui.ink.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sound.init(); useInk(); });

function startGame(n = startLevel()) {
  Sound.init(); reset(); state = 'play'; Missions.ensure();
  levelN = n; const L = levelInfo(n);
  depth = L.start; tier = L.tier; Sound.tier = L.tier; inkCharge = n > 1 ? 1 : 0.5;
  banner(`BÖLÜM ${n}`, L.name, '#ffe066', 2.6);
  if (n > 1) toast(L.news);
  window.OktoMusic && OktoMusic.stop(0.8);
  for (const p of [ui.menu, ui.over, ui.pause, ui.shop, ui.missions, ui.help, ui.clear]) show(p, false);
  show(ui.ink, true); show(ui.pauseBtn, true); show(ui.mute, true);
}
function toMenu() {
  state = 'menu'; Missions.ensure(); refreshMenu();
  if (Sound.ctx && !Sound.muted) menuMusic();
  refreshMute();
  show(ui.menu, true); show(ui.over, false); show(ui.pause, false);
  show(ui.ink, false); show(ui.pauseBtn, false); show(ui.mute, false);
}
function togglePause() {
  if (state === 'play') { state = 'pause'; show(ui.pause, true); }
  else if (state === 'pause') { state = 'play'; show(ui.pause, false); last = performance.now(); }
}
function bankRun() { // dalıştan kazanılan incileri cüzdana bir kez ekle
  if (banked || !player) return 0;
  banked = true;
  const D = Profile.data, earned = pearls + bonusPearls;
  if (score > D.best) D.best = score;
  D.wallet += earned; Profile.save();
  Missions.track('runs_day', 1);
  return earned;
}
function gameOver() {
  state = 'over'; Sound.over(); vibrate([80, 60, 160]); drag.active = false;
  const D = Profile.data, isBest = score > D.best;
  const earned = bankRun();
  $('againBtn').textContent = levelN > 1 ? `Bölüm ${ablative(levelN)} devam` : 'Tekrar Dal';
  $('oLevel').textContent = `Bölüm ${levelN} · ${levelInfo(levelN).name}`;
  $('oScore').textContent = score; $('oDepth').textContent = Math.floor(depth); $('oPearls').textContent = pearls;
  $('oEarned').textContent = `+${earned} inci kazandın` + (bonusPearls ? ` (${bonusPearls} kalamar ödülü)` : '') + ` · cüzdan: ⚪ ${D.wallet}`;
  $('oBest').textContent = `🏆 En iyi puan: ${D.best}`;
  show($('newBest'), isBest);
  show(ui.ink, false); show(ui.pauseBtn, false);
  setTimeout(() => { if (state === 'over') show(ui.over, true); }, 700);
}

// ---------- Duyurular ----------
function banner(text, sub = '', color = '#ffe066', dur = 2.4) { banners.push({ text, sub, color, life: dur, dur }); }
function toast(text) { banners.push({ text, sub: '', color: '#b8ffb0', life: 2.2, dur: 2.2, small: true }); }

// ---------- Varlıklar ----------
const ENEMIES = new Set(['jelly', 'urchin', 'puffer', 'shark', 'angler', 'blob', 'spike']);
function spawn() {
  const d = depth;
  const calm = boss || phase !== 'dive' || levelInfo(levelN).end - d < 14;
  const table = calm ? [
    ['pearl', 30], ['star', boss ? 6 : 1], ['glow', boss && boss.phase === 'fight' ? 5 : 0], ['heart', lives < 3 ? 3 : 0], ['shield', boss ? 2 : 0],
  ] : [
    ['pearl', 38], ['pearlRow', 10], ['fish', 14], ['jelly', 18 + d * 0.02], ['urchin', 9],
    ['puffer', d > 40 ? 12 : 0], ['shark', d > 150 ? 5 + d * 0.006 : 0], ['angler', d > 400 ? 6 : 0],
    ['shield', 2.2], ['star', 3], ['heart', lives < 3 ? 1.6 : 0], ['glow', d > 30 ? 1.3 : 0],
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
    case 'glow': entities.push({ type, x, y, r: 15 * S, t: Math.random() * 9 }); break;
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
function pushTarget(dx, dy) { // hedefi it, sürüklemeyi parmağın son konumuna yeniden çapala
  const b = bounds(); target.x = clamp(target.x + dx, b.x0, b.x1); target.y = clamp(target.y + dy, b.y0, b.y1);
  drag.px = target.x; drag.py = target.y; drag.ax = drag.lx; drag.ay = drag.ly;
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
      if (e.type === 'blob' || e.type === 'spike') { e.dead = true; burst(e.x, e.y, '#6b3fa0', 8, 90); continue; }
      e.stunned = true; stunned++;
      if (e.type === 'shark') { e.warn = 0; e.sp *= 0.35; }
    }
  }
  if (stunned) { const p = stunned * 15; score += p; addFloater(player.x, player.y - 40 * S, `+${p} sersem!`, '#c9b6ff'); Missions.track('stun_day', stunned); }
  // dev kalamar varsa ona mürekkep topu fırlat
  if (boss && boss.phase === 'fight') shots.push({ x: player.x, y: player.y, vx: 0, vy: 260 * S, life: 3 });
  // kaçış itişi
  const sp = Math.hypot(player.vx, player.vy) || 1;
  pushTarget(player.vx / sp * 60 * S, player.vy / sp * 60 * S);
}

function lightBomb(x, y) {
  Sound.bomb(); vibrate([40, 30, 80]); shake = 12; flash = 1;
  rings.push({ x, y, r: 0, life: 1 });
  let n = 0;
  for (const e of entities) {
    if (!ENEMIES.has(e.type) || e.dead) continue;
    if (e.type === 'shark' && e.warn > 0) { e.dead = true; continue; }
    if (e.y < -60 * S || e.y > H + 60 * S || e.x < -100 * S || e.x > W + 100 * S) continue;
    e.dead = true; n++;
    burst(e.x, e.y, '#fff3a0', 14, 160); burst(e.x, e.y, '#ffffff', 6, 80);
  }
  for (const s of slams) s.cancel = true;
  if (n) { score += n * 20; addFloater(x, y - 60 * S, `+${n * 20} ışık!`, '#fff3a0'); }
  banner('IŞIK BOMBASI!', n ? `${n} düşman yok oldu` : '', '#fff3a0', 1.6);
  Missions.track('bomb_day', 1);
  if (boss && boss.phase === 'fight') damageBoss(2);
  winkT = 1.2;
}

function hurt() {
  if (invuln > 0) return;
  if (shieldTime > 0) { shieldTime = 0; invuln = 1; burst(player.x, player.y, '#9ee8ff', 22, 200); Sound.tone(500, 0.2, 'triangle', 0.12, -300); addFloater(player.x, player.y - 40 * S, 'Kalkan!', '#9ee8ff'); return; }
  lives--; levelHits++; invuln = 1.6; shake = 14; combo = 0;
  Sound.hit(); vibrate(120);
  burst(player.x, player.y, '#ff7eb6', 18, 180);
  if (lives <= 0) gameOver();
}

function collect(e) {
  switch (e.type) {
    case 'pearl': {
      combo = Math.min(combo + 1, 15); comboTimer = 1.6;
      const mult = 1 + Math.floor(combo / 3);
      const p = 10 * mult; score += p; pearls++; levelPearls++;
      Sound.pearl(Math.min(combo, 8)); burst(e.x, e.y, '#fff7d6', 8, 90);
      addFloater(e.x, e.y, mult > 1 ? `+${p} x${mult}` : `+${p}`, mult > 1 ? '#ffe066' : '#fff');
      Missions.track('pearls_run', pearls); Missions.track('pearls_day', 1); Missions.track('combo_run', mult);
      if (mult > 1 && combo % 3 === 0) winkT = 0.8;
      break;
    }
    case 'fish': score += 25; Sound.eat(); burst(e.x, e.y, '#ffb347', 8, 90); addFloater(e.x, e.y, '+25 nam!', '#ffb347'); Missions.track('fish_day', 1); break;
    case 'shield': shieldTime = 10; Sound.power(); addFloater(e.x, e.y, 'Kalkan!', '#9ee8ff'); break;
    case 'star': inkCharge = 1; score += 20; Sound.power(); addFloater(e.x, e.y, 'Mürekkep dolu!', '#ffe066'); break;
    case 'heart': lives = Math.min(lives + 1, 3); Sound.power(); addFloater(e.x, e.y, '+1 can', '#ff6b8a'); break;
    case 'glow': lightBomb(e.x, e.y); break;
  }
}

// ---------- Bölümler ----------
const LEVELS = [
  { name: 'Güneşli Sular', start: 0, end: 150, tier: 1, boss: 'puffer', news: '🪼 Denizanaları ve 🐡 balon balıklarına dikkat!' },
  { name: 'Alacakaranlık Bölgesi', start: 150, end: 400, tier: 2, boss: 'jelly', news: '🦈 Köpekbalıkları geliyor: kırmızı ❗ uyarısına bak!' },
  { name: 'Karanlık Derinlikler', start: 400, end: 700, tier: 3, boss: 'squid', news: '🏮 Fener balıkları seni takip ediyor!' },
];
const BOSS_NAMES = { puffer: 'DEV BALON BALIĞI', jelly: 'ELEKTRİKLİ DENİZANASI', squid: 'DEV KALAMAR' };
function levelInfo(n) {
  if (n <= LEVELS.length) return Object.assign({ n }, LEVELS[n - 1]);
  const start = 700 + (n - 4) * 300;
  return { n, name: `Sonsuz Derinlik ${n - 3}`, start, end: start + 300, tier: 3, boss: ['puffer', 'jelly', 'squid'][(n - 4) % 3], news: '💪 Canavarlar artık daha güçlü!' };
}
const pearlGoal = n => Math.min(15 + n * 8, 50);
// Türkçe -den/-dan eki: "Bölüm 2'den", "Bölüm 3'ten"
function ablative(n) {
  const one = ['dan', 'den', 'den', 'ten', 'ten', 'ten', 'dan', 'den', 'den', 'dan'];
  const ten = { 1: 'dan', 2: 'den', 3: 'dan', 4: 'tan', 5: 'den', 6: 'tan', 7: 'ten', 8: 'den', 9: 'dan' };
  return `${n}'${n % 10 ? one[n % 10] : ten[Math.floor(n / 10) % 10] || 'den'}`;
}

// ---------- Bölüm sonu canavarları ----------
function startBoss(kind) {
  const lv = levelN, extra = Math.max(0, lv - 3);
  const hp = { puffer: 3, jelly: 4, squid: 5 }[kind] + extra;
  boss = { kind, x: W / 2, y: H + 170 * S, hp, maxHp: hp, lv, t: 0, phase: 'enter', attackT: 2.0, stun: 0, flashT: 0, r: { puffer: 54, jelly: 60, squid: 64 }[kind] * S, puff: 0, dash: null, puffT: 0 };
  banner(`⚠️ ${BOSS_NAMES[kind]}!`, 'Mürekkep düğmesi ona mürekkep topu atar', '#ff8a8a', 3);
  Sound.bossWarn(); vibrate([100, 80, 100]); shake = 10;
  for (const e of entities) if (ENEMIES.has(e.type)) e.dead = true; // sahneyi canavara bırak
}
function damageBoss(n) {
  if (!boss || boss.phase !== 'fight') return;
  boss.hp -= n; boss.flashT = 0.3; boss.stun = 1.2; boss.dash = null; boss.puffT = 0; shake = 9;
  Sound.bossHit(); vibrate(60);
  burst(boss.x, boss.y - boss.r * 0.6, boss.kind === 'puffer' ? '#ffe28a' : boss.kind === 'jelly' ? '#c7a8ff' : '#ff9ab0', 20, 220);
  addFloater(boss.x, boss.y - boss.r * 1.3, `-${n}`, '#ff8a8a');
  if (boss.hp <= 0) {
    boss.phase = 'dying'; boss.t = 0; slams.length = 0;
    for (const e of entities) if (ENEMIES.has(e.type)) e.dead = true;
    score += 300 * boss.lv; bossesBeaten++;
    banner(`🎉 ${BOSS_NAMES[boss.kind]} YENİLDİ!`, `+${300 * boss.lv} puan`, '#7dffb0', 2.2);
    Sound.bossDown(); Missions.track('boss_day', 1);
    for (let i = 0; i < 14; i++) entities.push({ type: 'pearl', x: clamp(boss.x + rand(-140, 140) * S, 20, W - 20), y: boss.y - boss.r + rand(-60, 160) * S, r: 8 * S, t: Math.random() * 9 });
  }
}
function bossContactR() { return boss.r * (boss.kind === 'puffer' ? 0.9 + boss.puff * 0.35 : 0.85); }
function updateBoss(dt) {
  const b = boss; b.t += dt;
  if (b.flashT > 0) b.flashT -= dt;
  const restY = H - (b.kind === 'jelly' ? 150 : 130) * S;
  if (b.phase === 'enter') {
    b.y = lerp(b.y, restY, dt * 1.5);
    if (Math.abs(b.y - restY) < 4) { b.phase = 'fight'; b.t = 0; }
    return;
  }
  if (b.phase === 'dying') {
    b.y += 120 * S * dt; b.puff = Math.max(0, b.puff - dt);
    if (Math.random() < dt * 20) burst(b.x + rand(-60, 60) * S, b.y - rand(0, 80) * S, '#ffffff', 4, 120);
    if (b.t > 2.4) { boss = null; levelClear(); }
    return;
  }
  b.puff = Math.max(0, b.puff - dt * 1.5);
  if (b.stun > 0) { b.stun -= dt; b.y = lerp(b.y, restY, dt * 3); return; }
  const interval = Math.max(1.3, 2.8 - b.lv * 0.2) * rand(0.85, 1.15);

  if (b.kind === 'puffer') {
    // dikenli balon balığı: Okto'nun altına süzülür, şişip diken atar ya da yukarı hamle yapar
    if (b.dash) {
      const d = b.dash; d.t += dt;
      if (d.stage === 'tele') { b.x += Math.sin(b.t * 60) * 2 * S; if (d.t > 0.65) { d.stage = 'up'; d.t = 0; } }
      else if (d.stage === 'up') { b.y -= 560 * S * dt; b.puff = 1; if (b.y <= d.toY) { d.stage = 'down'; d.t = 0; } }
      else { b.y = lerp(b.y, restY, dt * 2.5); if (Math.abs(b.y - restY) < 6) b.dash = null; }
      return;
    }
    b.x = lerp(b.x, clamp(player.x, b.r, W - b.r), dt * 0.9);
    b.y = restY + Math.sin(b.t * 2) * 6 * S;
    if (b.puffT > 0) { // şişme uyarısı, sonra diken yağmuru
      b.puffT -= dt; b.puff = 1 - b.puffT / 0.7;
      if (b.puffT <= 0) {
        const n = 8 + Math.min(b.lv, 4);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI * (0.06 + 0.88 * i / (n - 1)), sp = (210 + b.lv * 15) * S;
          entities.push({ type: 'spike', fixed: true, x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7 * S, t: 0 });
        }
        Sound.tone(700, 0.18, 'square', 0.07, -400); Sound.noise(0.2, 0.15, 2500);
      }
      return;
    }
    b.attackT -= dt;
    if (b.attackT <= 0) {
      b.attackT = interval;
      if (Math.random() < 0.55) { b.puffT = 0.7; Sound.tone(200, 0.6, 'sine', 0.1, 300); }
      else { b.dash = { stage: 'tele', t: 0, toY: Math.max(H * 0.32, player.y + 10 * S) }; Sound.tone(150, 0.5, 'sawtooth', 0.08, 120); }
    }
  } else if (b.kind === 'jelly') {
    // elektrikli denizanası: uyarılı yıldırım sütunları ve yavru denizanaları
    b.x = W / 2 + Math.sin(b.t * 0.55) * W * 0.26;
    b.y = restY + Math.sin(b.t * 2.2) * 10 * S;
    b.attackT -= dt;
    if (b.attackT <= 0) {
      b.attackT = interval;
      if (Math.random() < 0.6) {
        const n = 1 + Math.min(2, Math.floor(b.lv / 2) + 1), xs = [clamp(player.x, 30 * S, W - 30 * S)];
        while (xs.length < n) { const x = rand(30 * S, W - 30 * S); if (xs.every(o => Math.abs(o - x) > 90 * S)) xs.push(x); }
        for (const x of xs) slams.push({ kind: 'zap', x, t: 0, warn: 1.0, w: 24 * S });
        Sound.tone(900, 0.12, 'square', 0.05, 0, 0, true); Sound.tone(900, 0.12, 'square', 0.05, 0, 0.3, true);
      } else {
        for (let i = 0; i < 3; i++) entities.push({ type: 'jelly', x: clamp(b.x + (i - 1) * 60 * S, 20, W - 20), y: b.y - b.r, r: 14 * S, t: Math.random() * 9, hue: rand(180, 220), rise: rand(60, 90) * S });
        Sound.tone(500, 0.3, 'sine', 0.08, 400);
      }
    }
  } else {
    // dev kalamar: mürekkep lekeleri ve dokunaç darbesi
    b.x = W / 2 + Math.sin(b.t * 0.7) * W * 0.28;
    b.y = restY + Math.sin(b.t * 1.7) * 8 * S;
    b.attackT -= dt;
    if (b.attackT <= 0) {
      b.attackT = interval;
      if (Math.random() < 0.5) {
        const n = 2 + Math.min(b.lv, 3);
        for (let i = 0; i < n; i++) {
          const a = Math.atan2(player.y - b.y, player.x - b.x) + (i - (n - 1) / 2) * 0.28, sp = (150 + b.lv * 12) * S;
          entities.push({ type: 'blob', fixed: true, x: b.x, y: b.y - b.r * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 11 * S, t: Math.random() * 9 });
        }
        Sound.tone(220, 0.2, 'sine', 0.1, 220);
      } else {
        slams.push({ kind: 'tentacle', x: clamp(player.x + rand(-20, 20) * S, 30 * S, W - 30 * S), t: 0, warn: 1.0, w: 30 * S });
        Sound.tone(300, 0.15, 'square', 0.06, 0, 0, true); Sound.tone(300, 0.15, 'square', 0.06, 0, 0.25, true);
      }
    }
  }
}
function updateSlams(dt) {
  for (const s of slams) {
    s.t += dt;
    if (s.cancel && s.t < s.warn) s.done = true;
    const up = s.t - s.warn;
    if (s.kind === 'zap') { s.reach = up >= 0 && up < 0.55 ? 1 : 0; if (up >= 0 && !s.zapped) { s.zapped = true; Sound.noise(0.4, 0.2, 4000); Sound.tone(80, 0.4, 'sawtooth', 0.1); } if (up > 0.55) s.done = true; }
    else { s.reach = up < 0 ? 0 : up < 0.3 ? up / 0.3 : up < 0.9 ? 1 : Math.max(0, 1 - (up - 0.9) / 0.3); if (up > 1.2) s.done = true; }
    if (s.reach > 0.3 && !s.cancel) {
      const tipY = H - s.reach * H * (s.kind === 'zap' ? 1.05 : 0.92);
      if (Math.abs(player.x - s.x) < s.w + player.r * 0.6 && player.y > tipY) hurt();
    }
  }
  slams = slams.filter(s => !s.done);
  for (const sh of shots) {
    sh.life -= dt;
    if (boss && boss.phase === 'fight') {
      const dx = boss.x - sh.x, dy = (boss.y - boss.r * 0.4) - sh.y, d = Math.hypot(dx, dy) || 1, sp = 420 * S;
      sh.vx = lerp(sh.vx, dx / d * sp, dt * 4); sh.vy = lerp(sh.vy, dy / d * sp, dt * 4);
      if (d < boss.r * 0.9) { sh.life = 0; damageBoss(1); burst(sh.x, sh.y, '#2a1047', 14, 140); }
    }
    sh.x += sh.vx * dt; sh.y += sh.vy * dt;
    if (Math.random() < dt * 30) particles.push({ x: sh.x, y: sh.y, vx: rand(-20, 20) * S, vy: rand(-20, 20) * S, life: 0.7, decay: 1.5, r: rand(4, 8) * S, color: 'ink' });
  }
  shots = shots.filter(s => s.life > 0);
}

// ---------- Bölüm sonu: özet kartı ve girdap geçişi ----------
let trans = null;
function levelClear() {
  state = 'clear'; drag.active = false;
  const n = levelN, goal = pearlGoal(n);
  const stars = 1 + (levelHits <= 1 ? 1 : 0) + (levelPearls >= goal ? 1 : 0);
  const reward = 10 + 5 * n + stars * 10;
  bonusPearls += reward;
  const D = Profile.data;
  D.checkpoint = Math.max(D.checkpoint || 1, n + 1); D.startLevel = n + 1; Profile.save();
  $('clTitle').textContent = `Bölüm ${n} Tamamlandı!`;
  $('clName').textContent = levelInfo(n).name;
  const st = $('clStars'); st.innerHTML = '';
  for (let i = 0; i < 3; i++) { const sp = document.createElement('span'); sp.textContent = '★'; sp.className = i < stars ? 'on' : ''; sp.style.animationDelay = `${0.3 + i * 0.35}s`; st.append(sp); }
  for (let i = 0; i < stars; i++) Sound.tone(880 * Math.pow(2, i * 4 / 12), 0.3, 'triangle', 0.1, 0, 0.6 + i * 0.35, true);
  $('clStats').innerHTML = `<div>⚪ İnci: <b>${levelPearls}</b> / ${goal} ${levelPearls >= goal ? '✓' : ''}</div><div>💥 Aldığın hasar: <b>${levelHits}</b> ${levelHits <= 1 ? '✓' : ''}</div><div class="rw">Bölüm ödülü: +${reward} inci</div>`;
  $('clNext').textContent = `Sıradaki: Bölüm ${n + 1} · ${levelInfo(n + 1).name}`;
  show(ui.ink, false); show(ui.pauseBtn, false);
  setTimeout(() => { if (state === 'clear') show(ui.clear, true); }, 400);
}
function startTransition() {
  show(ui.clear, false);
  state = 'transition';
  trans = { t: 0, fx: player.x, fy: player.y, switched: false };
  Sound.vortex();
}
function updateTransition(dt) {
  const T = trans; T.t += dt; time += dt;
  const cx = W / 2, cy = H * 0.5;
  if (T.t < 1.5) { // girdaba çekilme: sarmal yol
    const a = T.t / 1.5, e = a * a, ang = Math.atan2(T.fy - cy, T.fx - cx) + e * 4 * Math.PI, d = Math.hypot(T.fx - cx, T.fy - cy) * (1 - e);
    player.x = cx + Math.cos(ang) * d; player.y = cy + Math.sin(ang) * d;
    player.vx = -Math.sin(ang) * 300 * S; player.vy = Math.cos(ang) * 300 * S;
    if (Math.random() < dt * 30) bgBubbles.push({ x: player.x, y: player.y, r: rand(2, 5) * S, vy: -rand(40, 90) * S, life: 1 });
    for (const en of entities) { en.x = lerp(en.x, cx, dt * 2.5); en.y = lerp(en.y, cy, dt * 2.5); }
  } else if (!T.switched) { // karanlıkta yeni bölüme geç
    T.switched = true; levelN++;
    const L = levelInfo(levelN);
    depth = L.start; tier = L.tier; Sound.tier = L.tier;
    entities = []; slams = []; shots = []; inkClouds = []; particles = [];
    levelHits = 0; levelPearls = 0; inkCharge = 1; phase = 'dive';
  } else { // girdaptan fırlayış
    const a = clamp((T.t - 1.5) / 1.0, 0, 1), e = 1 - Math.pow(1 - a, 3);
    player.x = cx; player.y = lerp(cy, H * 0.35, e); player.vx = 0; player.vy = -200 * S * (1 - a);
    target.x = player.x; target.y = player.y;
    if (a >= 1) {
      state = 'play'; trans = null; invuln = 1.5;
      const L = levelInfo(levelN);
      banner(`BÖLÜM ${levelN}`, L.name, levelN === 2 ? '#9fd6ff' : '#c9b6ff', 3);
      toast(L.news);
      Sound.tierUp(Math.min(L.tier, 3));
      show(ui.ink, true); show(ui.pauseBtn, true);
    }
  }
}
function drawTransition() {
  const T = trans; if (!T) return;
  const cx = W / 2, cy = H * 0.5, t = T.t;
  const k = t < 1.5 ? t / 1.5 : Math.max(0, 1 - (t - 1.5) / 1.0); // girdap gücü
  ctx.save();
  // sarmal kollar
  ctx.translate(cx, cy);
  const R = Math.max(W, H) * 0.8;
  for (let arm = 0; arm < 5; arm++) {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const s = i / 60, ang = arm * TAU / 5 + s * 5 - t * 7, r = s * R; ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); }
    ctx.strokeStyle = `rgba(160,230,255,${0.35 * k})`; ctx.lineWidth = 18 * S * k; ctx.stroke();
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.7 * k + 1);
  g.addColorStop(0, `rgba(0,5,20,${0.95 * k})`); g.addColorStop(0.5, `rgba(5,30,70,${0.5 * k})`); g.addColorStop(1, 'rgba(5,30,70,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.restore();
  // geçiş anında ekranı kapatan karanlık
  const cover = clamp(1 - Math.abs(t - 1.5) / 0.35, 0, 1);
  if (cover > 0) { ctx.fillStyle = `rgba(0,4,15,${cover})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- Güncelleme ----------
function update(dt) {
  time += dt;
  let scroll = (70 + Math.min(depth, 900) * 0.18) * S; // piksel/sn
  if (boss) scroll *= 0.35;
  // bölüm ilerleyişi: sona gelince canavar çıkar, derinlik canavar yenilene kadar durur
  const L = levelInfo(levelN);
  if (phase === 'dive') {
    depth = Math.min(depth + scroll * dt / (22 * S), L.end);
    if (depth >= L.end) { phase = 'boss'; startBoss(L.boss); }
  }

  // Oyuncu hareketi (göreli sürükleme hedefe gider)
  const p = player, b = bounds();
  const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  const ky = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  if (kx || ky) { target.x = clamp(target.x + kx * 430 * S * dt, b.x0, b.x1); target.y = clamp(target.y + ky * 430 * S * dt, b.y0, b.y1); }
  const ox = p.x, oy = p.y, k = 1 - Math.pow(0.0005, dt);
  p.x = clamp(lerp(p.x, target.x, k), b.x0, b.x1); p.y = clamp(lerp(p.y, target.y, k), b.y0, b.y1);
  p.vx = lerp(p.vx, (p.x - ox) / Math.max(dt, 1e-3), 0.3); p.vy = lerp(p.vy, (p.y - oy) / Math.max(dt, 1e-3), 0.3);
  const v = Math.hypot(p.vx, p.vy);
  p.blink -= dt; if (p.blink < -3.5) p.blink = 0.15;
  if (v > 120 * S && Math.random() < dt * 14) bgBubbles.push({ x: p.x + rand(-6, 6) * S, y: p.y + p.r * 0.2, r: rand(2, 5) * S, vy: -rand(30, 70) * S, life: 1 });
  // dalgıç gibi nefes: tıslayarak nefes al, sonra kabarcık bulutu halinde ver
  breathT -= dt;
  if (breathT <= 0) {
    const moving = clamp(v / (260 * S), 0, 1);
    Sound.inhale(0, 0.035 + moving * 0.02);
    Sound.exhale(0.95, 0.75 + moving * 0.35);
    p.exhaleAt = time + 0.95;
    breathT = rand(3.6, 4.6) - moving * 0.8;
  }
  if (p.exhaleAt && time >= p.exhaleAt) { // ses ile aynı anda görünen kabarcık bulutu
    p.exhaleAt = 0;
    for (let i = 0; i < 14; i++) bgBubbles.push({ x: p.x + rand(-10, 10) * S, y: p.y - p.r * 0.7 - rand(0, 12) * S, r: rand(2, 7) * S, vy: -rand(50, 130) * S, life: rand(0.8, 1.2) });
  }
  // hızlı yüzerken ara ara küçük kabarcık sesleri
  blipT -= dt;
  if (blipT <= 0 && v > 140 * S) { Sound.blip(0, 0.03 + clamp(v / (520 * S), 0, 1) * 0.03); blipT = rand(0.22, 0.5) * (1.6 - clamp(v / (520 * S), 0, 1)); }

  if (invuln > 0) invuln -= dt;
  if (winkT > 0) winkT -= dt;
  if (shieldTime > 0) shieldTime -= dt;
  if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
  if (inkCharge < 1) inkCharge = Math.min(1, inkCharge + dt / (boss ? 4 : 7));
  if (shake > 0) shake = Math.max(0, shake - dt * 40);
  if (Math.floor(depth) % 5 === 0) Missions.track('depth_run', Math.floor(depth));

  // Doğurma
  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawn(); spawnTimer = (boss ? 1.3 : Math.max(0.32, 1.0 - depth * 0.0013)) * rand(0.7, 1.3); }
  if (boss) updateBoss(dt);
  updateSlams(dt);

  // Varlıklar
  for (const e of entities) {
    e.t += dt;
    if (!e.fixed) e.y -= scroll * dt;
    switch (e.type) {
      case 'fish': e.x += e.dir * e.sp * dt; e.y += Math.sin(e.t * 3) * 10 * S * dt; break;
      case 'jelly': if (!e.stunned) { e.x += Math.sin(e.t * 0.9) * 25 * S * dt; e.y -= Math.max(0, Math.sin(e.t * 2.2)) * 40 * S * dt + (e.rise || 0) * dt; } break;
      case 'puffer': {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        e.puff = lerp(e.puff, !e.stunned && d < 110 * S ? 1 : 0, dt * 5);
        e.r = e.base * (1 + e.puff * 0.8);
        e.x += Math.sin(e.t * 1.3) * 18 * S * dt;
        break;
      }
      case 'angler': if (!e.stunned) {
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        e.x += dx / d * 40 * S * dt; e.y += dy / d * 25 * S * dt;
      } break;
      case 'shark':
        if (e.warn > 0) e.warn -= dt;
        else { e.x += e.dir * e.sp * dt; e.y += Math.sin(e.t * 4) * 20 * S * dt; e.t += dt; }
        break;
      case 'blob': case 'spike': e.x += e.vx * dt; e.y += e.vy * dt; break;
    }
    if (e.stunned) e.y -= 60 * S * dt;
  }

  // Çarpışmalar
  for (const e of entities) {
    if (e.dead) continue;
    if (e.type === 'shark' && e.warn > 0) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (ENEMIES.has(e.type)) {
      if (!e.stunned && d < e.r * 0.85 + p.r * 0.7) hurt();
    } else if (d < e.r + p.r * 0.9) { e.dead = true; collect(e); }
  }
  if (boss && boss.phase === 'fight') { const cy = boss.y - boss.r * (boss.kind === 'puffer' ? 0 : boss.kind === 'jelly' ? 0.3 : 0.2); if (Math.hypot(boss.x - p.x, cy - p.y) < bossContactR() + p.r * 0.6) hurt(); }
  entities = entities.filter(e => !e.dead && e.y > -120 * S && e.y < H + 400 * S && e.x > -200 * S && e.x < W + 200 * S);

  // Efektler
  for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= Math.pow(0.1, dt); q.vy *= Math.pow(0.1, dt); q.life -= q.decay * dt; }
  particles = particles.filter(q => q.life > 0);
  for (const f of floaters) { f.y -= 40 * S * dt; f.life -= dt * 0.9; }
  floaters = floaters.filter(f => f.life > 0);
  for (const c of inkClouds) { c.r = lerp(c.r, c.maxR, dt * 6); c.life -= dt * 0.7; c.y -= scroll * dt * 0.5; }
  inkClouds = inkClouds.filter(c => c.life > 0);
  updateFx(dt);
}
function updateFx(dt) {
  for (const r of rings) { r.r += Math.max(W, H) * 2.2 * dt; r.life -= dt * 1.6; }
  rings = rings.filter(r => r.life > 0);
  for (const b of banners) b.life -= dt;
  banners = banners.filter(b => b.life > 0);
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
    case 'glow': { // Işık Midyesi: yenince ışık bombası
      const pulse = 0.5 + 0.5 * Math.sin(e.t * 5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.2);
      gg.addColorStop(0, `rgba(255,245,170,${0.55 + pulse * 0.3})`); gg.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, r * 3.2, 0, TAU); ctx.fill();
      ctx.rotate(e.t * 0.8); ctx.fillStyle = `rgba(255,250,200,${0.25 + pulse * 0.2})`;
      for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.35, r * 3); ctx.lineTo(-r * 0.35, r * 3); ctx.fill(); }
      ctx.restore();
      const open = 0.35 + pulse * 0.15;
      ctx.lineJoin = 'round'; ctx.strokeStyle = '#7a3a8c'; ctx.lineWidth = 1.6 * S;
      const shell = (dir) => {
        ctx.save(); ctx.scale(1, dir);
        const sg = ctx.createLinearGradient(0, 0, 0, r * 1.1); sg.addColorStop(0, '#ffd6f2'); sg.addColorStop(1, '#c27adf');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-r * 1.15, 0);
        for (let i = 0; i <= 6; i++) { const a = Math.PI + i / 6 * Math.PI, rr = r * (1.05 + (i % 2) * 0.08); ctx.lineTo(Math.cos(a) * rr * 1.1, -Math.sin(a) * rr * 0.95); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(122,58,140,.5)';
        for (let i = 1; i < 6; i++) { const a = Math.PI + i / 6 * Math.PI; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, -Math.sin(a) * r * 0.85); ctx.stroke(); }
        ctx.restore();
      };
      ctx.save(); ctx.rotate(-open * 0.5); ctx.translate(0, -r * 0.05); shell(-1); ctx.restore();
      const pg = ctx.createRadialGradient(-r * 0.15, -r * 0.2, 1, 0, 0, r * 0.55);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#ffe46b');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.5, 0, TAU); ctx.fill();
      shell(1);
      break;
    }
    case 'spike': {
      ctx.rotate(Math.atan2(e.vy, e.vx));
      ctx.fillStyle = '#e8a400'; ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1.5 * S;
      ctx.beginPath(); ctx.moveTo(r * 1.8, 0); ctx.lineTo(-r, -r * 0.6); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r, r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'blob': {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.2);
      g.addColorStop(0, '#7a4fb8'); g.addColorStop(1, '#1d0b33');
      ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU, rr = r * (1 + Math.sin(e.t * 8 + i * 2) * 0.12); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.1, r * 0.22, 0, TAU); ctx.arc(r * 0.3, -r * 0.1, r * 0.22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c0213a'; ctx.beginPath(); ctx.arc(-r * 0.27, -r * 0.05, r * 0.11, 0, TAU); ctx.arc(r * 0.33, -r * 0.05, r * 0.11, 0, TAU); ctx.fill();
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
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, `rgba(${col},.75)`); g.addColorStop(1, `rgba(${col},.2)`);
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
      ctx.fillText(s.kind === 'zap' ? '⚡' : '!', s.x, H * 0.5);
      continue;
    }
    if (s.kind === 'zap') { // yıldırım
      if (!s.reach) continue;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,245,150,.25)'; ctx.fillRect(s.x - s.w, 0, s.w * 2, H);
      for (const [lw, col] of [[10 * S, 'rgba(200,170,255,.6)'], [4 * S, '#fffbe0']]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
        let x = s.x; ctx.moveTo(x, H);
        for (let y = H; y > -20; y -= 26 * S) { x = s.x + rand(-s.w, s.w) * 0.8; ctx.lineTo(x, y); }
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

function drawPlayer() {
  const p = player;
  if (invuln > 0 && state === 'play' && Math.floor(invuln * 12) % 2 === 0) return drawShield();
  const expr = {
    look: clamp(p.vx / (300 * S), -1, 1), lookY: clamp(p.vy / (300 * S), -1, 1),
    blink: p.blink > 0 ? 1 : 0, wink: winkT > 0 ? 1 : 0,
    ouch: state === 'play' && invuln > 1.15 ? 1 : 0, dizzy: state === 'over' ? 1 : 0,
  };
  let R = p.r, spin = 0;
  if (trans) { const a = trans.t < 1.5 ? trans.t / 1.5 : 1 - clamp((trans.t - 1.5) / 0.6, 0, 1); R = p.r * (1 - a * 0.85); spin = trans.t * (trans.t < 1.5 ? 9 : 3) * a; }
  OktoChar.draw(ctx, p.x, p.y, R, time, Object.assign(look(), {
    expr, trailX: clamp(-p.vx / (400 * S), -1, 1), trailY: clamp(-p.vy / (400 * S), -1, 1),
    rot: clamp(p.vx / (900 * S), -0.3, 0.3) + spin, bob: Math.sin(time * 3) * 0.6,
  }));
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
    ctx.font = `700 ${16 * S}px ${FONT}`;
    ctx.lineWidth = 3 * S; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
function drawFx() {
  // ışık bombası halkası + ekran parlaması
  for (const r of rings) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,245,170,${r.life})`; ctx.lineWidth = 26 * S * r.life;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${r.life * 0.8})`; ctx.lineWidth = 6 * S;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.8, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,250,215,${flash * 0.75})`; ctx.fillRect(0, 0, W, H); }
}
function drawBanners() {
  let y = H * 0.3, ys = safeTop + 96;
  for (const b of banners) {
    const age = b.dur - b.life, a = clamp(Math.min(age * 4, b.life * 2), 0, 1), sc = 0.7 + 0.3 * Math.min(1, age * 5);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (b.small) {
      ctx.font = `700 ${15 * S}px ${FONT}`;
      const w = ctx.measureText(b.text).width + 28 * S;
      ctx.fillStyle = 'rgba(10,40,30,.75)'; ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, ys - 16 * S, w, 32 * S, 16 * S); ctx.fill();
      ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, ys + 1); ys += 40 * S;
    } else {
      ctx.translate(W / 2, y);
      ctx.font = `700 ${38 * S}px ${FONT}`;
      const fit = Math.min(1, (W * 0.92) / (ctx.measureText(b.text).width + 18 * S)); // ekrana sığdır
      ctx.scale(sc * fit, sc * fit);
      ctx.lineWidth = 9 * S; ctx.strokeStyle = 'rgba(6,20,50,.85)'; ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
      if (b.sub) { ctx.font = `700 ${18 * S}px ${FONT}`; ctx.lineWidth = 6 * S; ctx.strokeText(b.sub, 0, 36 * S); ctx.fillStyle = '#fff'; ctx.fillText(b.sub, 0, 36 * S); }
      y += 90 * S;
    }
    ctx.restore();
  }
}

function drawHUD() {
  const top = 14 + safeTop;
  for (let i = 0; i < 3; i++) {
    const x = 22 + i * 30, y = top + 14;
    ctx.save(); ctx.translate(x, y); ctx.scale(0.8, 0.8);
    ctx.fillStyle = i < lives ? '#ff4d6d' : 'rgba(255,255,255,.2)';
    ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-26, -4, -12, -22, 0, -8); ctx.bezierCurveTo(12, -22, 26, -4, 0, 14); ctx.fill();
    ctx.restore();
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `700 15px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.fillText(`${Math.floor(depth)} m ⬇`, 12, top + 34);
  const LI = levelInfo(levelN), prog = clamp((depth - LI.start) / (LI.end - LI.start), 0, 1);
  ctx.font = `700 12px ${FONT}`; ctx.fillStyle = tier === 1 ? '#bff3ff' : tier === 2 ? '#9fd6ff' : '#c9b6ff';
  ctx.fillText(`Bölüm ${levelN}`, 12, top + 54);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.roundRect(12, top + 71, 80, 6, 3); ctx.fill();
  ctx.fillStyle = prog >= 1 ? '#ff8a8a' : '#7be35a'; ctx.beginPath(); ctx.roundRect(12, top + 71, 80 * prog, 6, 3); ctx.fill();
  ctx.textAlign = 'center'; ctx.font = `700 30px ${FONT}`;
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.strokeText(score, W / 2, top);
  ctx.fillStyle = '#fff'; ctx.fillText(score, W / 2, top);
  ctx.font = `700 14px ${FONT}`; ctx.fillStyle = '#fff7d6'; ctx.fillText(`⚪ ${pearls}`, W / 2, top + 36);
  if (combo >= 3) { ctx.fillStyle = '#ffe066'; ctx.fillText(`KOMBO x${1 + Math.floor(combo / 3)}`, W / 2, top + 54); }
  // dev kalamar can barı
  if (boss && boss.phase !== 'dying') {
    const bw = Math.min(260, W - 140), bx = W / 2 - bw / 2, by = top + 76;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.roundRect(bx - 4, by - 4, bw + 8, 22, 11); ctx.fill();
    ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.roundRect(bx, by, bw * Math.max(0, boss.hp) / boss.maxHp, 14, 7); ctx.fill();
    ctx.font = `700 12px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(`${BOSS_NAMES[boss.kind]}  ${Math.max(0, boss.hp)}/${boss.maxHp}`, W / 2, by + 7);
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

// ---------- Mağaza ----------
const shopState = { tab: 'colors', sel: null };
const shopPrev = $('shopPreview'), shopPrevCtx = shopPrev.getContext('2d');
function openShop() { shopState.sel = { tab: 'colors', id: Profile.data.palette }; shopState.tab = 'colors'; renderShop(); show(ui.shop, true); }
function previewLook() {
  const L = look();
  if (shopState.sel) L[shopState.sel.tab === 'colors' ? 'palette' : 'accessory'] = shopState.sel.id;
  return L;
}
function renderShop() {
  const D = Profile.data, tab = shopState.tab, items = OktoChar.CATALOG[tab];
  $('shopWallet').textContent = `⚪ ${D.wallet}`;
  for (const b of document.querySelectorAll('#shop .tab')) b.classList.toggle('on', b.dataset.tab === tab);
  const grid = $('shopGrid'); grid.innerHTML = '';
  const ownedList = D.owned[tab], cur = tab === 'colors' ? D.palette : D.accessory;
  for (const it of items) {
    const btn = document.createElement('button'); btn.className = 'item';
    if (shopState.sel && shopState.sel.id === it.id && shopState.sel.tab === tab) btn.classList.add('sel');
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160;
    const c = cv.getContext('2d'); c.scale(2, 2);
    const L = look(); L[tab === 'colors' ? 'palette' : 'accessory'] = it.id;
    OktoChar.draw(c, 40, 34, 17, 0.4, L);
    const owned = ownedList.includes(it.id);
    const lbl = document.createElement('div'); lbl.className = 'nm'; lbl.textContent = it.name;
    const pr = document.createElement('div'); pr.className = 'pr';
    pr.textContent = cur === it.id ? '✓ Giyili' : owned ? 'Sende' : `⚪ ${it.price}`;
    if (!owned && D.wallet < it.price) btn.classList.add('poor');
    btn.append(cv, lbl, pr);
    btn.onclick = () => { shopState.sel = { tab, id: it.id }; renderShop(); };
    grid.append(btn);
  }
  // seçili ürün için işlem düğmesi
  const act = $('shopAction'), sel = shopState.sel && shopState.sel.tab === tab ? items.find(i => i.id === shopState.sel.id) : null;
  if (!sel) { act.textContent = 'Bir ürün seç'; act.disabled = true; return; }
  const owned = ownedList.includes(sel.id);
  act.disabled = false;
  if (owned && cur === sel.id) { act.textContent = '✓ Giyili'; act.disabled = true; }
  else if (owned) act.textContent = `${sel.name} — Giy`;
  else if (D.wallet >= sel.price) act.textContent = `Satın al ⚪ ${sel.price}`;
  else { act.textContent = `${sel.price - D.wallet} inci daha lazım`; act.disabled = true; }
}
$('shopAction').onclick = () => {
  const D = Profile.data, tab = shopState.tab, sel = shopState.sel; if (!sel) return;
  const it = OktoChar.CATALOG[tab].find(i => i.id === sel.id);
  if (!D.owned[tab].includes(it.id)) {
    if (D.wallet < it.price) return;
    D.wallet -= it.price; D.owned[tab].push(it.id); Sound.init(); Sound.coin();
  }
  if (tab === 'colors') D.palette = it.id; else D.accessory = it.id;
  Profile.save(); renderShop(); refreshMenu();
};
for (const b of document.querySelectorAll('#shop .tab')) b.onclick = () => {
  shopState.tab = b.dataset.tab;
  shopState.sel = { tab: b.dataset.tab, id: b.dataset.tab === 'colors' ? Profile.data.palette : Profile.data.accessory };
  renderShop();
};
$('shopBtn').onclick = () => openShop();
$('shopClose').onclick = () => { show(ui.shop, false); refreshMenu(); };

// ---------- Görevler paneli ----------
function renderMissions() {
  Missions.ensure();
  const D = Profile.data, box = $('missionList'); box.innerHTML = '';
  $('missionWallet').textContent = `⚪ ${D.wallet}`;
  const gift = Missions.loginGift();
  const g = document.createElement('div'); g.className = 'mission gift';
  g.innerHTML = gift ? `<div class="mt">🎁 Günlük hediye</div><div class="ms">${gift.streak}. gün serisi · her gün gel, hediye büyüsün!</div>`
    : `<div class="mt">🎁 Günlük hediye alındı</div><div class="ms">Yarın yine gel! Seri: ${D.login.streak} gün</div>`;
  const gb = document.createElement('button'); gb.className = 'claim'; gb.textContent = gift ? `Al +${gift.reward} ⚪` : '✓'; gb.disabled = !gift;
  gb.onclick = () => { const G = Missions.loginGift(); if (!G) return; D.wallet += G.reward; D.login = { last: today(), streak: G.streak }; Profile.save(); Sound.init(); Sound.coin(); renderMissions(); refreshMenu(); };
  g.append(gb); box.append(g);
  for (const m of D.daily.list) {
    const row = document.createElement('div'); row.className = 'mission' + (m.claimed ? ' claimed' : '');
    const pct = Math.round(100 * Math.min(1, m.progress / m.n));
    row.innerHTML = `<div class="mt">${Missions.text(m)}</div><div class="bar"><i style="width:${pct}%"></i></div><div class="ms">${Math.min(m.progress, m.n)} / ${m.n} · ödül ⚪ ${m.reward}</div>`;
    const b = document.createElement('button'); b.className = 'claim';
    b.textContent = m.claimed ? '✓ Alındı' : m.done ? `Al +${m.reward} ⚪` : '…'; b.disabled = !m.done || m.claimed;
    b.onclick = () => { if (!m.done || m.claimed) return; m.claimed = true; D.wallet += m.reward; Profile.save(); Sound.init(); Sound.coin(); renderMissions(); refreshMenu(); };
    row.append(b); box.append(row);
  }
}
$('missionBtn').onclick = () => { renderMissions(); show(ui.missions, true); };
$('missionClose').onclick = () => { show(ui.missions, false); refreshMenu(); };

// ---------- Ana döngü ----------
let last = performance.now();
let sizeCheckT = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
  if ((sizeCheckT += dt) > 0.5) { sizeCheckT = 0; checkSize(); }
  if (state === 'play') update(dt);
  else if (state === 'transition') { updateTransition(dt); updateFx(dt); for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= q.decay * dt; } particles = particles.filter(q => q.life > 0); }
  else if (state === 'clear') { time += dt; updateFx(dt); }
  else if (state === 'over') {
    time += dt;
    for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= q.decay * dt; }
    particles = particles.filter(q => q.life > 0);
    player.vx = 0; player.vy = 40 * S; player.y = Math.min(player.y + 40 * S * dt, H + 80 * S);
    updateFx(dt);
  } else if (state === 'menu') time += dt;
  const scroll = state === 'play' ? (70 + Math.min(depth, 900) * 0.18) * S : 20 * S;
  if (state !== 'pause' && state !== 'menu') updateAmbient(dt, scroll);

  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  if (state === 'menu' && window.OktoTitle) OktoTitle.draw(ctx, W, H, time, Object.assign(look(), { top: safeTop }));
  else {
    drawBackground();
    if (boss) drawBoss();
    drawSlams();
    for (const e of entities) drawEntity(e);
    drawParticles();
    drawPlayer();
    drawFx();
    if (state === 'transition') drawTransition();
  }
  ctx.restore();
  if (state === 'play' || state === 'pause') { drawHUD(); drawBanners(); }
  // mağaza önizlemesi
  if (!ui.shop.classList.contains('hidden')) {
    const c = shopPrevCtx, w = shopPrev.width, h = shopPrev.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    c.scale(w / 200, h / 160);
    OktoChar.draw(c, 100, 58, 36, time, Object.assign(previewLook(), { expr: { wink: Math.sin(time * 1.3) > 0.85 ? 1 : 0, blink: (time % 4) < 0.12 ? 1 : 0 }, bob: Math.sin(time * 3) }));
  }
  requestAnimationFrame(frame);
}

resize();
reset();
toMenu();
requestAnimationFrame(frame);

// Test/hata ayıklama için
window.__okto = {
  get state() { return state; }, get score() { return score; }, get depth() { return depth; }, set depth(v) { depth = v; },
  get lives() { return lives; }, set lives(v) { lives = v; }, set invuln(v) { invuln = v; }, get boss() { return boss; }, get tier() { return tier; }, get levelN() { return levelN; }, get phase() { return phase; }, damageBoss, startTransition,
  Sound, TIERS, startGame, useInk, lightBomb: () => lightBomb(player.x, player.y), get entities() { return entities; }, get player() { return player; }, get target() { return target; },
  Profile, Missions, spawnGlow: () => entities.push({ type: 'glow', x: player.x, y: player.y + 80 * S, r: 15 * S, t: 0 }),
};
})();

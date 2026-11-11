/* OKTO: Derinlerin Kaşifi — mobil öncelikli HTML5 canvas oyunu */
(() => {
'use strict';

// ---------- Yardımcılar ----------
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
// Test adresi (yalnızca geliştirme): ?plan=grup  ?bolum=N  ?boss=kimlik  ?test
// Böyle açılınca hiçbir şey kaydedilmez; normal açılışta (parametresiz) hiçbir etkisi yoktur.
const TEST = (() => {
  const q = new URLSearchParams(location.search), on = ['plan', 'bolum', 'boss', 'test', 'beceri', 'murekkep', 'xp', 'halka'].some(k => q.has(k));
  return { on, plan: q.get('plan'), level: parseInt(q.get('bolum'), 10) || 0, boss: q.get('boss') || '', oldInk: q.has('murekkep') };
})();
// Beceri halkası (s27'den beri normal oyunda; kullanıcı onayladı): mürekkep düğmesinin yerini beceri düğmesi aldı.
// Eski mürekkep düğmesi yalnızca test adresinde: ?murekkep
const SK = !TEST.oldInk && window.OktoSkills ? window.OktoSkills : null;
if (SK) SK.setRingStyle(new URLSearchParams(location.search).get('halka') === 'klasik' ? 'klasik' : 'inci'); // s40: yeni inci kabarcık halkası her yerde; eski görünüm: ?halka=klasik
// s44: normal oyun grup düzeniyle oynanır; eski (klasik, s21) düzen yalnızca test adresinde: ?plan=klasik
if (window.OktoCampaign) OktoCampaign.setMode(TEST.plan === 'klasik' ? 'klasik' : 'grup');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { if (TEST.on) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
function lerpColor(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const r = Math.round(lerp(a >> 16, b >> 16, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
  return `rgb(${r},${g},${bl})`;
}
const FONT = 'Fredoka, "Trebuchet MS", sans-serif';
const BOOT = performance.now(); // açılış anı: Okto menüde kumdan yükselerek belirir (açılış görselinde Okto yok)

// ---------- Tuval ----------
const cvs = $('c'), ctx = cvs.getContext('2d');
let W = 0, H = 0, DPR = 1, S = 1, safeTop = 0; // S: ekran boyutuna göre ölçek birimi
function resize() {
  // İlk sürümdeki basit ve kararlı ölçüm (deneysel ölçümler titremeye yol açtı, geri alındı)
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  S = clamp(Math.min(W, H) / 400, 0.75, 1.6);
  safeTop = readSafeTop();
  layoutMenuButtons();
}
// Çentik payı: iPhone ilk açılışta geç bildirebiliyor; gizli bir kutunun yüksekliğinden okunur, yarım saniyede bir yenilenir
function readSafeTop() { const el = document.getElementById('safeProbe'); return el ? Math.round(el.getBoundingClientRect().height) : 0; }
function refreshSafeTop() { const v = readSafeTop(); if (v !== safeTop) { safeTop = v; layoutMenuButtons(); } }
// iPhone'un oyuna vermediği en alt şerit, sayfanın zemin rengiyle boyanır: sahnenin alt rengine eşitle
let edgeColor = '';
function setEdgeColor(c) { if (c !== edgeColor) { edgeColor = c; document.documentElement.style.background = c; document.body.style.background = c; } }
function sceneBottomColor() {
  if (state === 'menu') return '#d9a95f';
  return lerpColor('#0b5d8f', '#010a18', clamp(visD() / 600, 0, 1));
}
// Sayfanın yakınlaşmasını engelle (iki parmak / çift dokunuş): sahne kaymasın
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));

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
// Eski kaydı grup düzenine taşı (yalnızca bir kez; bayrak D.gver = 45):
// - klasik (s43 ve öncesi): bölüm 1→1, 2→6, 3→11, 4+→16 (aynı derinlik)
// - s44 grup kaydı (grup başına 4 bölüm): aynı grup ve aynı sıra (OktoCampaign.migrate44)
// inci, kostüm, beceri, Kaşif Puanı ve kupalar ayrı alanlarda olduğu için olduğu gibi kalır; klasik alanlara dokunulmaz.
function gMigrate(D) {
  if (D.gver >= 45) return false;
  if (D.gmigrated) { // s44 kaydı
    D.gcheck = OktoCampaign.migrate44(D.gcheck || 1);
    D.gstart = Math.min(OktoCampaign.migrate44(D.gstart || 1), D.gcheck);
  } else { // klasik kayıt
    const cp = Math.max(1, D.checkpoint | 0 || 1), sl = Math.min(Math.max(1, D.startLevel | 0 || 1), cp);
    D.gcheck = Math.max(1, OktoCampaign.migrate(cp));
    D.gstart = Math.min(OktoCampaign.migrate(sl), D.gcheck);
  }
  D.gmigrated = true; D.gver = 45; return true;
}
if (gMigrate(Profile.data)) Profile.save();
const look = () => ({ palette: Profile.data.palette, accessory: Profile.data.accessory });
// Beceri ilerlemesi (Kaşif Puanı ve kuşanılan beceriler) profilde saklanır; test adresinde ?xp=N ile başlangıç puanı verilebilir
function skProf() { // ilk kez: şimdiye kadarki en iyi puan Kaşif Puanı olarak sayılır (eski oyuncular sıfırdan başlamasın)
  const D = Profile.data;
  if (!D.skills) { D.skills = { xp: 0, equipped: ['inkFan'], seen: 1 }; if (window.OktoSkills && D.best > 0) OktoSkills.addXp(D.skills, D.best); }
  return D.skills;
}
if (SK) { const q = new URLSearchParams(location.search); SK.load(skProf()); if (q.has('xp')) { skProf().xp = 0; SK.addXp(skProf(), +q.get('xp') || 0); } }

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
    if (this.ctx && this.ctx.state !== 'running' && !document.hidden) this.ctx.resume().catch(() => {});
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
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return; // duraklatılmışken ses biriktirme
    const k = TIERS[this.tier].pitch, t = this.ctx.currentTime + delay, f0 = rand(160, 380) * k, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * rand(2.6, 4), t + rand(0.03, 0.06));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.09);
  },
  filtered(dur, vol, type, freq, q, delay = 0, attack = 0.1) { // şekillendirilmiş gürültü (nefes / köpük)
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return; // duraklatılmışken ses biriktirme
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
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return; // duraklatılmışken ses biriktirme
    const k = raw ? 1 : TIERS[this.tier].pitch;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq * k, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, (freq + slide) * k), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.2, freq = 800, delay = 0) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return; // duraklatılmışken ses biriktirme
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
  cineRumble() { this.tone(45, 2.2, 'sine', 0.22, -10); this.filtered(2.0, 0.12, 'lowpass', 300, 1, 0, 0.8); },
  cineRise() { this.tone(70, 1.8, 'sawtooth', 0.06, 120, 0, true); this.filtered(1.6, 0.1, 'bandpass', 600, 0.7, 0.2, 0.6); },
  fanfare() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, i > 4 ? 0.5 : 0.22, 'triangle', 0.11, 0, i * 0.13 + (i > 4 ? 0.1 : 0), true)); this.noise(1.5, 0.18, 3000, 0.3); },
  bossDown() { [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.12, 0, i * 0.1, true)); this.noise(1.2, 0.25, 2000); },
  vortex() { // girdaba dalış: alçalan uğultu + kabarcıklar + çıkışta parlama
    this.filtered(1.6, 0.12, 'lowpass', 900, 1, 0, 0.6); this.tone(420, 1.5, 'sine', 0.12, -340, 0, true);
    for (let i = 0; i < 24; i++) this.blip(rand(0.1, 1.5), 0.05);
    [523, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.08, 0, 1.6 + i * 0.08, true));
  },
  giftOpen() { [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.08, 0, i * 0.05, true)); this.filtered(0.25, 0.08, 'highpass', 3000, 0.7, 0, 0.01); },
  chomp() { [0, 0.12, 0.24].forEach(d => { this.tone(180, 0.08, 'square', 0.07, -80, d); this.filtered(0.07, 0.1, 'lowpass', 900, 1, d, 0.005); }); },
  grow() { this.tone(160, 0.8, 'sawtooth', 0.06, 500, 0.3, true); [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.07, 0, 0.35 + i * 0.08, true)); },
  shrink() { this.tone(700, 0.5, 'triangle', 0.07, -500, 0, true); },
  crush() { this.tone(120, 0.18, 'square', 0.09, -60); this.filtered(0.15, 0.12, 'lowpass', 1500, 1, 0, 0.005); },
  giggle() { // kıkırdama: hızlı, inen-çıkan minik sesler
    [0, 0.11, 0.22, 0.31].forEach((d, i) => this.tone(880 + i * 90, 0.09, 'sine', 0.09, -260, d, true));
    this.tone(1320, 0.12, 'triangle', 0.04, 300, 0.36, true);
  },
  splash() { this.filtered(0.35, 0.18, 'bandpass', 1800, 0.9, 0, 0.01); for (let i = 0; i < 5; i++) this.blip(0.03 + i * 0.05, 0.06); },
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
// resif dünyası: çarpışılabilir kayalar (orta katman), uzak silüetler, ön plan mercanları, bölge planı
let rocks = [], farL = [], nearL = [], plan = [], zone = 'open', worldY = 0, rockT = 0, farT = 0, nearT = 0, canyonAmt = 0, seabedAmt = 0, lastLane = 0, ledgeSide = 1;
let levelN = 1, phase = 'dive', levelHits = 0, levelPearls = 0, lastDepthMark = -1;
const snow = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + 0.4, s: Math.random() * 0.5 + 0.3 }));
const bgBubbles = [];
const keys = {};
const target = { x: 0, y: 0 };
const drag = { active: false, id: null, ax: 0, ay: 0, px: 0, py: 0, lx: 0, ly: 0 };
const SENS = 1.5; // parmak hareketi → Okto hareketi oranı

function reset() {
  player = { x: W / 2, y: H * 0.3, vx: 0, vy: 0, r: 22 * S, blink: 0, big: 0, bigT: 0, bossBumpT: 0 };
  target.x = player.x; target.y = player.y;
  entities = []; particles = []; floaters = []; inkClouds = []; rings = []; banners = []; slams = []; shots = [];
  rocks = []; farL = []; nearL = []; plan = []; zone = 'open'; worldY = 0; rockT = 1.5; farT = 0; nearT = 0.5; canyonAmt = 0; seabedAmt = 0;
  depth = 0; score = 0; pearls = 0; lives = 3; combo = 0; comboTimer = 0; bonusPearls = 0;
  spawnTimer = 0.5; inkCharge = 0.5; shieldTime = 0; invuln = 1.5; time = 0; shake = 0; flash = 0; winkT = 0;
  if (window.OktoZones) OktoZones.exit();
  tier = 1; Sound.tier = 1; boss = null; bossesBeaten = 0; breathT = 1.2; blipT = 0; banked = false;
  levelN = 1; phase = 'dive'; levelHits = 0; levelPearls = 0; trans = null; cine = null; victory = null;
  if (SK) SK.reset();
  xpBase = 0; lastUnlocks = [];
}

// ---------- Girdi ----------
const bounds = () => ({ x0: player.r, x1: W - player.r, y0: player.r + 50 * S + safeTop, y1: H - player.r });
cvs.addEventListener('pointerdown', e => {
  Sound.init();
  if (state === 'cinema') { if (cine && cine.t > 1.2) cine.t = Math.max(cine.t, cine.dur - 0.5); return; } // sinematiği geç
  if (state === 'map') { mapTap(e.clientX, e.clientY); return; } // haritada adaya dokunma
  if (state === 'menu') {
    if (hitPlay(e.clientX, e.clientY)) { startGame(); return; }
    const T = window.OktoTitle, r = T && (T.down ? T.down(e.clientX, e.clientY, time) : T.tap(e.clientX, e.clientY, time));
    if (r === 'grab') { cvs.setPointerCapture && cvs.setPointerCapture(e.pointerId); return; } // Okto tutuldu: itme mi dokunma mı, bırakınca/itince belli olur
    if (r === 'okto') { Sound.giggle(); vibrate(15); }
    else if (r === 'fish') { Sound.splash(); setTimeout(() => Sound.giggle(), 180); }
    return;
  }
  if (state !== 'play') return;
  drag.active = true; drag.id = e.pointerId; drag.ax = drag.lx = e.clientX; drag.ay = drag.ly = e.clientY; drag.px = target.x; drag.py = target.y;
  cvs.setPointerCapture && cvs.setPointerCapture(e.pointerId);
});
cvs.addEventListener('pointermove', e => {
  if (state === 'menu') {
    cvs.style.cursor = hitPlay(e.clientX, e.clientY) ? 'pointer' : 'default';
    const T = window.OktoTitle; if (!T) return;
    if (T.move) { if (T.move(e.clientX, e.clientY, time) === 'spin') { Sound.giggle(); Sound.tone(500, 0.4, 'triangle', 0.06, 700, 0, true); vibrate(20); } }
    else T.pointer && T.pointer(e.clientX, e.clientY, time);
    return;
  }
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
cvs.addEventListener('pointerup', e => {
  if (state === 'menu') { const T = window.OktoTitle; if (T && T.up && T.up(e.clientX, e.clientY, time) === 'okto') { Sound.giggle(); vibrate(15); } return; }
  endDrag(e);
});
cvs.addEventListener('pointercancel', endDrag);
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ' && state === 'play') { if (SK) SK.activate(skEnv()); else useInk(); e.preventDefault(); }
  if ((e.key === 'p' || e.key === 'Escape') && (state === 'play' || state === 'pause')) togglePause();
  if (e.key === 'Enter' && (state === 'menu' || state === 'over') && !anyPanelOpen()) startGame();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });
// Arka plana geçince (uygulama değiştirici, ana ekran, kilit): oyunu duraklat, TÜM sesleri sustur
let bgAway = false, musicWasOn = false;
function goBackground() {
  if (bgAway) return; bgAway = true;
  if (state === 'cinema') { cine.t = cine.dur; updateCinema(0); } // sinematik yarıda kalırsa savaşı başlat ve duraklat
  if (state === 'play') togglePause();
  drag.active = false;
  const M = window.OktoMusic;
  musicWasOn = !!(M && M.playing);
  if (musicWasOn) M.stop(0.04); // ses motorunu dondurmadan, çok kısa kısarak sustur
}
function goForeground() {
  if (!bgAway) return; bgAway = false;
  last = performance.now();
  if (Sound.ctx && Sound.ctx.state !== 'running') Sound.ctx.resume().catch(() => {});
  if (musicWasOn && state === 'menu' && !Sound.muted) setTimeout(() => { if (state === 'menu' && !bgAway) menuMusic(); }, 250);
  musicWasOn = false;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) goBackground(); else goForeground(); });
window.addEventListener('pagehide', goBackground);
window.addEventListener('pageshow', () => { if (!document.hidden) goForeground(); });
window.addEventListener('blur', () => { if (document.hidden || state === 'play') goBackground(); });
window.addEventListener('focus', () => { if (!document.hidden) goForeground(); });
document.addEventListener('contextmenu', e => e.preventDefault());

// ---------- Arayüz ----------
const ui = { menu: $('menu'), over: $('over'), pause: $('pauseMenu'), ink: $('inkBtn'), pauseBtn: $('pauseBtn'), mute: $('muteBtn'), shop: $('shop'), missions: $('missions'), help: $('help'), clear: $('clear') };
const inkCtx = $('inkCanvas').getContext('2d');
function show(el, v) { el.classList.toggle('hidden', !v); }
const anyPanelOpen = () => [ui.shop, ui.missions, ui.help, $('skills')].some(p => !p.classList.contains('hidden'));
function refreshMute() {
  ui.mute.textContent = Sound.muted ? '🔇' : '🔊';
  const mb = $('musicBtn'), M = window.OktoMusic;
  mb.textContent = !M || (!M.playing && !Sound.muted) ? '🎵 Müziği aç' : (Sound.muted ? '🔇' : '🔊');
  mb.classList.toggle('icon', !!(M && M.playing) || Sound.muted);
  mb.classList.toggle('hint', !(M && M.playing) && !Sound.muted);
}
function menuMusic() {
  const M = window.OktoMusic; if (!M || state !== 'menu') return;
  M.setMuted(Sound.muted); if (!M.playing || M.current !== 'menu') M.play('menu'); setTimeout(refreshMute, 50);
}
document.addEventListener('pointerdown', e => { if (state === 'menu' && !Sound.muted && e.target.id !== 'musicBtn') menuMusic(); }, true);
document.addEventListener('keydown', () => { if (state === 'menu' && !Sound.muted) menuMusic(); }, true);
function startLevel() {
  if (TEST.level) return TEST.level; const D = Profile.data, n = clamp(D.startLevel || 1, 1, D.checkpoint || 1);
  if (OktoCampaign.mode === 'grup') return clamp(D.gstart || 1, 1, gUnlocked()); // grup düzeni: kendi kaydı (eski kayıt bir kez taşındı)
  return n;
}
// grup düzeninde açılmış en büyük bölüm (harita için): kendi kaydı ile taşınmış eski kayıttan büyüğü
function gUnlocked() { return Math.max(1, Profile.data.gcheck || 1); }
function refreshMenu() {
  const lp = $('levelPick'), cp = Profile.data.checkpoint || 1, sl = startLevel();
  lp.classList.toggle('hidden', cp < 2);
  lp.innerHTML = sl > 1 ? `▶ Bölüm ${ablative(sl)} başla <small>(değiştir)</small>` : `▶ Baştan başla <small>(değiştir)</small>`;
  $('menuBest').textContent = `⚪ ${Profile.data.wallet} inci` + (Profile.data.best > 0 ? `   🏆 ${Profile.data.best}` : '');
  $('missionBadge').classList.toggle('hidden', !Missions.claimable());
  if (OktoCampaign.mode === 'grup') { lp.classList.toggle('hidden', gUnlocked() < 2); lp.innerHTML = `▶ Bölüm ${sl} · ${levelInfo(sl).name} <small>(değiştir)</small>`; } // yeni bölüm numaraları
  show($('skillBtn'), !!SK); show($('mapBtn'), OktoCampaign.mode === 'grup' && !!window.OktoMap);
  if (SK) { const P = skProf(); $('skillBadge').classList.toggle('hidden', SK.unlockedIds(P.xp).length <= (P.seen || 1)); }
}
function layoutMenuButtons() { // mağaza ve görev düğmeleri oyna düğmesinin iki yanında
  const u = Math.min(W / 390, H / 720), y = H * 0.865, dx = 75 * u + 46;
  for (const [id, sx] of [['shopBtn', -1], ['missionBtn', 1]]) {
    const el = $(id); if (!el) continue;
    el.style.left = (W / 2 + sx * dx - 30) + 'px'; el.style.top = (y - 30) + 'px';
  }
  const mb = $('mapBtn'); if (mb) { mb.style.left = (W / 2 + dx - 30) + 'px'; mb.style.top = (y - 30 - 96 * u) + 'px'; } // harita: görevlerin üstünde
  const sb = $('skillBtn'); if (sb) { sb.style.left = (W / 2 - dx - 30) + 'px'; sb.style.top = (y - 30 - 96 * u) + 'px'; } // beceriler: mağazanın üstünde
  const lp = $('levelPick'); if (lp) lp.style.top = (y - 30 - 96 * u - 46) + 'px'; // s44: beceri/harita sırasının üstünde (eskiden onların altında kalıyordu)
}
function hitPlay(x, y) { const r = window.OktoTitle && OktoTitle.playRect; return r && x >= r.x - 10 && x <= r.x + r.w + 10 && y >= r.y - 10 && y <= r.y + r.h + 16; }

$('helpBtn').onclick = () => show(ui.help, true);
$('diffBtn').onclick = () => { const k = ['kolay', 'normal', 'zor'], i = k.indexOf(Profile.data.difficulty || 'normal'); Profile.data.difficulty = k[(i + 1) % 3]; Profile.save(); refreshDiffBtn(); };
$('helpClose').onclick = () => show(ui.help, false);
// ---------- Kayıt kodu: inci, kostüm, bölüm ve beceri ilerlemesini başka kuruluma taşımak için ----------
// (iPhone ana ekrandan silinen uygulamanın kaydını da silebilir; silmeden önce kod kopyalanır, yeni kurulumda yapıştırılır)
const SAVE_KEYS = ['wallet', 'best', 'owned', 'palette', 'accessory', 'checkpoint', 'startLevel', 'difficulty', 'skills', 'trophies', 'gcheck', 'gstart', 'gmigrated', 'gver'];
function saveCode() {
  const D = Profile.data, o = {}; for (const k of SAVE_KEYS) if (D[k] !== undefined) o[k] = D[k];
  return 'OKTO-' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function loadCode(code) {
  try {
    const t = String(code).trim().replace(/^OKTO-/, ''), o = JSON.parse(decodeURIComponent(escape(atob(t))));
    if (!o || typeof o !== 'object' || typeof o.wallet !== 'number') return false;
    const D = Profile.data; for (const k of SAVE_KEYS) if (o[k] !== undefined) D[k] = o[k];
    if (!o.gver) { D.gver = 0; if (!o.gmigrated) { delete D.gcheck; delete D.gstart; D.gmigrated = false; } gMigrate(D); } // eski kod (s43 klasik / s44 grup): yeni düzene taşı
    Profile.save(); if (SK) SK.load(skProf()); return true;
  } catch { return false; }
}
$('saveCopy').onclick = async () => {
  const code = saveCode(), box = $('saveBox'); box.value = code; show(box, true); box.select();
  let ok = false; try { await navigator.clipboard.writeText(code); ok = true; } catch {}
  $('saveMsg').textContent = ok ? 'Kayıt kodu kopyalandı! Notlar uygulamasına yapıştırıp sakla.' : 'Aşağıdaki kodu seçip kopyala ve sakla.';
};
$('saveLoad').onclick = () => {
  const box = $('saveBox');
  if (box.classList.contains('hidden') || !box.value.trim() || box.value === saveCode()) { box.value = ''; show(box, true); box.focus(); $('saveMsg').textContent = 'Kayıt kodunu kutuya yapıştır, sonra yine Kaydı yükle düğmesine bas.'; return; }
  if (loadCode(box.value)) { $('saveMsg').textContent = 'Kayıt yüklendi!'; Sound.coin(); refreshMenu(); refreshDiffBtn(); }
  else $('saveMsg').textContent = 'Bu kod okunamadı. Tamamını kopyaladığından emin ol.';
};
$('againBtn').onclick = () => startGame(levelN);
$('clearNext').onclick = () => (OktoCampaign.mode === 'grup' && window.OktoMap ? openMap('progress') : startTransition());
$('levelPick').onclick = () => {
  const D = Profile.data;
  if (OktoCampaign.mode === 'grup') { const u = gUnlocked(); D.gstart = startLevel() >= u ? 1 : startLevel() + 1; }
  else { const cp = D.checkpoint || 1; D.startLevel = startLevel() >= cp ? 1 : startLevel() + 1; }
  Profile.save(); refreshMenu();
};
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
ui.ink.addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation(); Sound.init();
  if (!SK) return useInk();
  if (state !== 'play') return;
  try { ui.ink.setPointerCapture(e.pointerId); } catch {} // halka açıkken bu parmağın hareketi yalnızca beceri seçer
  SK.down(e.pointerId, e.clientX, e.clientY, performance.now());
});
if (SK) {
  ui.ink.addEventListener('pointermove', e => { e.preventDefault(); SK.move(e.pointerId, e.clientX, e.clientY); });
  ui.ink.addEventListener('pointerup', e => { e.preventDefault(); if (state === 'play') SK.up(e.pointerId, skEnv()); else SK.cancel(); });
  ui.ink.addEventListener('pointercancel', () => SK.cancel());
}
function skEnv() {
  return { W, H, S, time, now: performance.now(), player, entities, boss, enemies: ENEMIES, damageBoss, burst, floater: addFloater, sound: Sound,
    addScore: n => { score += n; }, vibrate, track: (id, n) => Missions.track(id, n), shake: n => { shake = Math.max(shake, n); },
    onFire: id => { TLOG.uses[id] = (TLOG.uses[id] || 0) + 1; },
    inkShot: () => { if (boss && boss.phase === 'fight') shots.push({ x: player.x, y: player.y, vx: 0, vy: 260 * S, life: 3 }); } };
}

function startGame(n = startLevel()) {
  Sound.init(); reset(); state = 'play'; Missions.ensure();
  levelN = n; const L = levelInfo(n); plan = makePlan(L);
  depth = L.start; tier = L.tier; Sound.tier = L.tier; inkCharge = n > 1 ? 1 : 0.5;
  if (TEST.boss) depth = L.end - 3; // test: canavara hemen gel
  banner(`BÖLÜM ${n}`, L.name, '#ffe066', 2.6);
  gameMusic();
  if (n > 1) toast(L.news);

  for (const p of [ui.menu, ui.over, ui.pause, ui.shop, ui.missions, ui.help, ui.clear, $('skills')]) show(p, false);
  show(ui.ink, true); show(ui.pauseBtn, true); show(ui.mute, true);
}
function toMenu() {
  state = 'menu'; shake = 0; flash = 0; Missions.ensure(); refreshMenu(); refreshDiffBtn();
  if (Sound.ctx && !Sound.muted) menuMusic();
  refreshMute();
  show(ui.menu, true); show(ui.over, false); show(ui.pause, false);
  show(ui.ink, false); show(ui.pauseBtn, false); show(ui.mute, false);
}
function togglePause() {
  if (state === 'play') {
    if (SK) SK.cancel();
    state = 'pause'; show(ui.pause, true); window.OktoMusic && OktoMusic.stop(0.3);
    const e = store.get('okto_lasterr', null), el = $('errInfo');
    el.textContent = e ? `Son hata (${e.at}, bölüm ${e.level}, ${e.where}): ${e.msg} — ${e.line}` : '';
    show(el, !!e);
  }
  else if (state === 'pause') { state = 'play'; show(ui.pause, false); last = performance.now(); gameMusic(); }
}
let xpBase = 0, lastUnlocks = [];
// ---------- Test kaydı (yalnızca test adresinde): denge testi için karşılaşma süreleri, beceri kullanımı, açılma derinliği ----------
const TLOG = { t: 0, enc: [], uses: {}, unlocks: [] };
function tlogText() {
  const f = x => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
  const L = ['OKTO test kaydı · ' + (OktoCampaign.mode === 'grup' ? 'grup düzeni' : 'klasik') + ' · zorluk ' + diff().name, 'Toplam süre: ' + f(TLOG.t) + ' sn'];
  L.push('Karşılaşmalar:'); for (const e of TLOG.enc) L.push(`  ${e.name} (${e.big ? 'büyük' : 'mini'}, bölüm ${e.level}): ${e.dur != null ? f(e.dur) + ' sn' : 'bitmedi'}, ${e.hits} isabet, Okto ${e.hurt} hasar`);
  L.push('Beceri kullanımı:'); const u = Object.entries(TLOG.uses); if (!u.length) L.push('  (yok)'); for (const [id, n] of u) L.push(`  ${SK ? SK.byId(id).name : id}: ${n} kez`);
  L.push('Açılan beceriler:'); if (!TLOG.unlocks.length) L.push('  (yok)'); for (const x of TLOG.unlocks) L.push(`  ${x.name}: ${x.depth} m, Kaşif Puanı ${x.xp}`);
  return L.join('\n');
}
function showTlog(where) {
  if (!TEST.on) return;
  let box = $('tlog_' + where);
  if (!box) { box = document.createElement('div'); box.id = 'tlog_' + where; box.className = 'tlog'; box.innerHTML = '<pre></pre><button class="tab">Test kaydını kopyala</button>'; $(where).append(box);
    box.querySelector('button').onclick = async () => { const t = box.querySelector('pre').textContent; try { await navigator.clipboard.writeText(t); box.querySelector('button').textContent = 'Kopyalandı'; } catch { const r = document.createRange(); r.selectNodeContents(box.querySelector('pre')); getSelection().removeAllRanges(); getSelection().addRange(r); } }; }
  box.querySelector('pre').textContent = tlogText(); box.querySelector('button').textContent = 'Test kaydını kopyala';
}
function awardXp() { // bu dalışta kazanılan puanlar Kaşif Puanı'na eklenir (yalnızca beceri denemesinde)
  if (!SK) return [];
  const n = Math.max(0, score - xpBase); xpBase = score;
  const fresh = SK.addXp(skProf(), n); Profile.save();
  for (const d of fresh) TLOG.unlocks.push({ name: d.name, depth: Math.round(depth), xp: skProf().xp });
  return fresh;
}
const unlockText = list => list.length ? `Yeni beceri açıldı: ${list.map(d => d.name + (d.ready ? '' : ' (yakında)')).join(', ')}!` : '';
function bankRun() { // dalıştan kazanılan incileri cüzdana bir kez ekle
  if (banked || !player) return 0;
  banked = true; lastUnlocks = awardXp();
  const D = Profile.data, earned = pearls + bonusPearls;
  if (score > D.best) D.best = score;
  D.wallet += earned; Profile.save();
  Missions.track('runs_day', 1);
  return earned;
}
function gameOver() {
  state = 'over'; Sound.over(); vibrate([80, 60, 160]); drag.active = false; window.OktoMusic && OktoMusic.stop(1.2);
  const D = Profile.data, isBest = score > D.best;
  const earned = bankRun();
  $('oUnlock').textContent = unlockText(lastUnlocks); show($('oUnlock'), lastUnlocks.length > 0);
  showTlog('over');
  $('againBtn').textContent = levelN > 1 ? `Bölüm ${ablative(levelN)} devam` : 'Tekrar Dal';
  $('oLevel').textContent = `Bölüm ${levelN} · ${levelInfo(levelN).name}`;
  $('oScore').textContent = score; $('oDepth').textContent = Math.floor(depth); $('oPearls').textContent = pearls;
  $('oEarned').textContent = `+${earned} inci kazandın` + (bonusPearls ? ` (${bonusPearls} kalamar ödülü)` : '') + ` · cüzdan: ⚪ ${D.wallet}`;
  $('oBest').textContent = `🏆 En iyi puan: ${D.best}`;
  show($('newBest'), isBest);
  show(ui.ink, false); show(ui.pauseBtn, false);
  setTimeout(() => { if (state === 'over') show(ui.over, true); }, 700);
}

// ---------- Oyun içi müzik: kademeye göre parça ----------
function gameMusic() { const M = window.OktoMusic; if (M) { M.setMuted(Sound.muted); M.play(boss && boss.big && boss.phase !== 'dying' ? 'boss' : 'g' + Math.min(3, tier)); } }

// ---------- Zorluk ----------
const DIFF = {
  kolay:  { name: 'Kolay',  spawn: 1.3, scroll: 0.85, bossHp: -1, invuln: 2.2, ink: 5.5 },
  normal: { name: 'Normal', spawn: 1.0, scroll: 1.0,  bossHp: 0,  invuln: 1.6, ink: 7 },
  zor:    { name: 'Zor',    spawn: 0.8, scroll: 1.12, bossHp: 1,  invuln: 1.3, ink: 8.5 },
};
const diff = () => DIFF[Profile.data.difficulty] || DIFF.normal;
function refreshDiffBtn() { const b = $('diffBtn'); if (b) b.textContent = `Zorluk: ${diff().name}`; }

// ---------- Duyurular ----------
// Tuvale çizilen yazılarda emoji kullanma: iPhone bunların genişliğini ölçemiyor, yazı kayıyor ve taşıyor
const plain = t => String(t).replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u2600-\u27BF]/gu, '').replace(/\s+/g, ' ').trim();
function textW(text, size) { const m = ctx.measureText(text).width, est = text.length * size * 0.56; return m > est * 0.5 ? m : est; }
function banner(text, sub = '', color = '#ffe066', dur = 2.4) { banners.push({ text: plain(text), sub: plain(sub), color, life: dur, dur }); }
function toast(text) { banners.push({ text: plain(text), sub: '', color: '#b8ffb0', life: 2.2, dur: 2.2, small: true }); }

// ---------- Varlıklar ----------
const ENEMIES = new Set(['jelly', 'urchin', 'puffer', 'shark', 'angler', 'blob', 'spike']);
function spawn() {
  const d = depth;
  const calm = boss || phase !== 'dive' || levelInfo(levelN).end - d < 14;
  const table = calm ? [
    ['pearl', 30], ['star', boss ? 6 : 1], ['glow', boss && boss.phase === 'fight' && !entities.some(e => e.type === 'glow') ? 2 : 0], ['heart', lives < 3 ? 3 : 0], ['shield', boss ? 2 : 0],
  ] : [
    ['pearl', 38], ['pearlRow', 10], ['fish', 14], ['jelly', 18 + d * 0.02], ['urchin', 9],
    ['puffer', d > 40 ? 12 : 0], ['shark', d > 150 ? 5 + d * 0.006 : 0], ['angler', d > 400 ? 6 : 0],
    ['shield', 2.2], ['star', 3], ['heart', lives < 3 ? 1.6 : 0], ['glow', d > 30 ? 1.3 : 0],
  ];
  // özel bölgelerde düşman karışımı değişir
  const zk = { yosun: { shark: 0, angler: 0.3 }, magara: { angler: 3, jelly: 0.6 }, mayin: { jelly: 0.5, urchin: 0.3, puffer: 0.5 }, kacis: { jelly: 0.6, urchin: 0.4, shark: 0.3 }, baca: { urchin: 0.4 }, gemi: { shark: 0.5 } }[zone];
  if (zk && !calm) for (const row of table) if (zk[row[0]] !== undefined) row[1] = row[1] * zk[row[0]] + (row[0] === 'angler' && zone === 'magara' ? 8 : 0);
  const total = table.reduce((s, t) => s + t[1], 0);
  let roll = Math.random() * total, type = 'pearl';
  for (const [t, w] of table) { roll -= w; if (roll <= 0) { type = t; break; } }

  let x = rand(30 * S, W - 30 * S); const y = H + 40 * S;
  for (let k = 0; k < 6 && !freeAt(x, y, 20 * S); k++) x = rand(30 * S, W - 30 * S); // kayanın içine doğma
  if (!freeAt(x, y, 20 * S)) return;
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
      entities.push({ type, fixed: true, x: dir > 0 ? -90 * S : W + 90 * S, y: clamp(player.y + rand(-80, 80) * S, 60 * S, H - 60 * S), r: 26 * S, dir, warn: 1.1, sp: (360 + diffD() * 0.25) * S, t: 0 });
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

// ---------- Hediyeler ve Dev Okto ----------
const BIG_TIME = 6;
function maybeGift(x, y, chance) {
  if (Math.random() > chance) return;
  if (entities.filter(e => e.type === 'gift' || e.type === 'treat').length >= 2) return;
  entities.push({ type: 'gift', x: clamp(x, 24 * S, W - 24 * S), y, r: 14 * S, t: 0, hue: [330, 200, 45, 140][Math.floor(Math.random() * 4)] });
}
function openGift(e) {
  Sound.giftOpen(); burst(e.x, e.y, `hsl(${e.hue},90%,65%)`, 16, 160); burst(e.x, e.y, '#fff3a0', 10, 120);
  if (Math.random() < 0.72) {
    entities.push({ type: 'treat', x: e.x, y: e.y - 6 * S, r: 14 * S, t: 0 });
    addFloater(e.x, e.y - 30 * S, 'Altın Karides!', '#ffd23f');
  } else {
    for (let i = 0; i < 8; i++) entities.push({ type: 'pearl', x: clamp(e.x + Math.cos(i / 8 * TAU) * 40 * S, 16, W - 16), y: e.y + Math.sin(i / 8 * TAU) * 40 * S, r: 8 * S, t: Math.random() * 9 });
    addFloater(e.x, e.y - 30 * S, 'İnci yağmuru!', '#fff7d6');
  }
}
function eatTreat(e) {
  player.bigT = BIG_TIME; invuln = 0;
  Sound.chomp(); Sound.grow(); vibrate([30, 40, 60]); shake = 8; winkT = 1.2;
  burst(e.x, e.y, '#ffd23f', 20, 200);
  banner('DEV OKTO!', 'Dokunduğun düşmanları ez!', '#ffd23f', 2);
}
function crush(e) {
  e.dead = true; score += 25;
  burst(e.x, e.y, '#ffffff', 10, 180); burst(e.x, e.y, '#ffd23f', 8, 140);
  addFloater(e.x, e.y, '+25 ezildi!', '#ffd23f'); Sound.crush(); shake = Math.max(shake, 5);
  maybeGift(e.x, e.y, 0.12);
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
      e.stunned = true; stunned++; maybeGift(e.x, e.y, 0.12);
      if (e.type === 'shark') { e.warn = 0; e.sp *= 0.35; }
    }
  }
  if (window.OktoZones && OktoZones.active()) OktoZones.onInk(player.x, player.y, R, zoneEnv(0, 0));
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
    e.dead = true; n++; maybeGift(e.x, e.y, 0.25);
    burst(e.x, e.y, '#fff3a0', 14, 160); burst(e.x, e.y, '#ffffff', 6, 80);
  }
  for (const s of slams) s.cancel = true;
  if (window.OktoZones && OktoZones.active()) OktoZones.onBomb(zoneEnv(0, 0));
  if (n) { score += n * 20; addFloater(x, y - 60 * S, `+${n * 20} ışık!`, '#fff3a0'); }
  banner('IŞIK BOMBASI!', n ? `${n} düşman yok oldu` : '', '#fff3a0', 1.6);
  Missions.track('bomb_day', 1);
  if (boss && boss.phase === 'fight') damageBoss(2);
  winkT = 1.2;
}

function hurt() {
  if (invuln > 0 || player.bigT > 0) return; // dev Okto'ya hiçbir şey işlemez
  if (shieldTime > 0) { shieldTime = 0; invuln = 1; burst(player.x, player.y, '#9ee8ff', 22, 200); Sound.tone(500, 0.2, 'triangle', 0.12, -300); addFloater(player.x, player.y - 40 * S, 'Kalkan!', '#9ee8ff'); return; }
  lives--; levelHits++; invuln = diff().invuln; shake = 14; combo = 0;
  if (boss) { const e = TLOG.enc[TLOG.enc.length - 1]; if (e && e.dur == null) e.hurt++; }
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
    case 'star': inkCharge = 1; score += 20; Sound.power(); if (SK) SK.refill(); addFloater(e.x, e.y, SK ? 'Beceriler hazır!' : 'Mürekkep dolu!', '#ffe066'); break;
    case 'heart': lives = Math.min(lives + 1, 3); Sound.power(); addFloater(e.x, e.y, '+1 can', '#ff6b8a'); break;
    case 'glow': lightBomb(e.x, e.y); break;
    case 'gift': openGift(e); break;
    case 'treat': eatTreat(e); break;
  }
}

// ---------- Bölümler ----------
// Bölüm düzeni campaign.js'te (varsayılan 'klasik' = s21). Test adresinde ?boss= ile bölüm canavarı değiştirilebilir.
function levelInfo(n) {
  const L = OktoCampaign.level(n);
  if (TEST.boss && OktoBossAI.get(TEST.boss)) L.boss = TEST.boss;
  return L;
}
const bossDef = id => OktoBossAI.get(id) || OktoBossAI.get('puffer');
const pearlGoal = n => Math.min(15 + n * 8, 50);
// Türkçe -den/-dan eki: "Bölüm 2'den", "Bölüm 3'ten"
function ablative(n) {
  const one = ['dan', 'den', 'den', 'ten', 'ten', 'ten', 'dan', 'den', 'den', 'dan'];
  const ten = { 1: 'dan', 2: 'den', 3: 'dan', 4: 'tan', 5: 'den', 6: 'tan', 7: 'ten', 8: 'den', 9: 'dan' };
  return `${n}'${n % 10 ? one[n % 10] : ten[Math.floor(n / 10) % 10] || 'den'}`;
}

// ---------- Resif dünyası: bölge planı, kayalar, parallax ----------
const ZONE_NAMES = { reefs: 'Resif Adacıkları', canyon: 'Mercan Kanyonu' };
function makePlan(L) { // bölüm: açık su ile başlar, özel bölgeler arasına sakin "dinlenme" parçaları girer
  const segs = [], end = L.end - 16; let d = L.start, last = '';
  const add = (type, len) => { const b = Math.min(d + len, end); if (b > d) segs.push({ type, a: d, b }); d = b; };
  add('open', 18);
  // bölüme göre açılan bölgeler; her bölümde karışık sırayla, aynısı arka arkaya gelmez
  if (L.zones && !L.zones.length) { segs.push({ type: 'open', a: d, b: L.end + 1000 }); return segs; } // arena: sakin açık su
  if (L.zones && L.zones.length === 1) { // grup düzeni: bölümün ortamı baştan sona sürer (kısa giriş ve canavar öncesi nefes)
    add('open', 5); const b2 = L.end - 8; if (b2 > d) { segs.push({ type: L.zones[0], a: d, b: b2 }); d = b2; }
    segs.push({ type: 'open', a: d, b: L.end + 1000 }); return segs;
  }
  if (L.zones && L.dd) { // s45 grup düzeni: açık su arasında 2–3 karışık bölge; ilki bölümün adını veren bölge, aynısı arka arkaya gelmez
    const len = L.end - L.start, e2 = L.end - 12; d = L.start; segs.length = 0; last = '';
    const put = (type, n) => { const b = Math.min(d + n, e2); if (b > d) segs.push({ type, a: d, b }); d = b; };
    put('open', len * 0.1); let bag = L.zones.slice(1).sort(() => Math.random() - 0.5), first = true;
    while (e2 - d > len * 0.15) {
      if (!bag.length) bag = L.zones.slice().sort(() => Math.random() - 0.5);
      let i = bag.findIndex(t => t !== last); if (i < 0) i = 0;
      const type = first ? L.zones[0] : bag.splice(i, 1)[0]; first = false;
      put(type, len * (type === 'kacis' ? rand(0.3, 0.34) : rand(0.2, 0.28))); last = type;
      put('open', len * rand(0.05, 0.08));
    }
    segs.push({ type: 'open', a: d, b: L.end + 1000 }); return segs;
  }
  const pool = L.zones ? L.zones : L.n === 1 ? ['reefs', 'canyon', 'akinti', 'yosun']
    : L.n === 2 ? ['reefs', 'canyon', 'akinti', 'yosun', 'baca', 'gemi', 'mayin']
    : ['reefs', 'canyon', 'akinti', 'yosun', 'baca', 'gemi', 'mayin', 'magara', 'kacis'];
  let bag = [];
  while (d < end) {
    if (!bag.length) bag = pool.slice().sort(() => Math.random() - 0.5);
    let i = bag.findIndex(t => t !== last); if (i < 0) i = 0;
    const type = L.n === 1 && !last ? 'reefs' : bag.splice(i, 1)[0];
    add(type, type === 'kacis' ? rand(60, 75) : rand(45, 65)); last = type;
    add('open', rand(14, 22));
  }
  segs.push({ type: 'open', a: d, b: L.end + 1000 });
  return segs;
}
function zoneEnv(dt, scroll) {
  return {
    W, H, S, dt, time, scroll, tier, safeTop, player, target, entities, rocks, sound: Sound, big: player.bigT > 0,
    hurt: () => hurt(), push: (dx, dy) => pushTarget(dx, dy), burst, floater: addFloater, toast, banner,
    addScore: n => { score += n; }, freeAt,
    pearls: (x, y, n, sp) => { for (let i = 0; i < n; i++) entities.push({ type: 'pearl', x: clamp(sp ? x + i * sp : x + rand(-40, 40) * S, 16, W - 16), y: sp ? y : y + rand(-30, 30) * S, r: 8 * S, t: Math.random() * 9 }); },
    gift: (x, y) => entities.push({ type: 'gift', x: clamp(x, 24 * S, W - 24 * S), y, r: 14 * S, t: 0, hue: 45 }),
  };
}
function zoneAt(d) { for (const s of plan) if (d >= s.a && d < s.b) return s.type; return 'open'; }
function freeAt(x, y, r) {
  if (window.OktoZones && !OktoZones.freeOf(x, y, r)) return false;
  for (const k of rocks) for (const h of k.hit) if (Math.hypot(x - (k.x + h.x), y - (k.y + h.y)) < h.r + r + 8 * S) return false;
  return true;
}
// ---- Kurallar: ekranda en fazla 3 çarpışılabilir kaya (çıkıntılar dahil) ve her yükseklikte açık koridor ----
const MAX_ROCKS = 3;
const onScreen = k => k.y - k.a.oy < H + 8 && k.y + (k.a.ch - k.a.oy) > -8;
// henüz ekrana girmemiş ama girecek olanlar da sayılır (ekranın hemen altındakiler)
const collidableCount = () => rocks.filter(k => k.y - k.a.oy < H + k.a.ch && k.y + (k.a.ch - k.a.oy) > -8).length;
function blockedAt(y, list) { // y yüksekliğinde kayaların kapattığı x aralıkları (Okto'nun çarpışma payı dahil)
  const pad = player.r * 0.62 + 6 * S, out = [];
  for (const k of list) for (const h of k.hit) {
    const dy = y - (k.y + h.y), r = h.r + pad;
    if (Math.abs(dy) < r) { const half = Math.sqrt(r * r - dy * dy), cx = k.x + h.x; out.push([cx - half, cx + half]); }
  }
  return out;
}
function widestGap(intervals) {
  const a = intervals.concat([[-1e4, player.r], [W - player.r, 1e4]]).sort((p, q) => p[0] - q[0]);
  let best = 0, edge = -1e4;
  for (const [l, r] of a) { if (l > edge) best = Math.max(best, l - edge); edge = Math.max(edge, r); }
  return best;
}
function corridorOK(cand) { // adayın kapladığı her yükseklikte en az bir geçit kalmalı
  const list = rocks.concat([cand]);
  let y0 = Infinity, y1 = -Infinity;
  for (const h of cand.hit) { y0 = Math.min(y0, cand.y + h.y - h.r - player.r); y1 = Math.max(y1, cand.y + h.y + h.r + player.r); }
  for (let y = y0; y <= y1; y += 6 * S) if (widestGap(blockedAt(y, list)) < 14 * S) return false;
  return true;
}
function tryAddRock(r) {
  if (collidableCount() >= MAX_ROCKS) return false;
  if (!corridorOK(r)) return false;
  rocks.push(r); return true;
}
// Boyutlar bölüm bölüm değişir: Bölüm 1 küçük ve seyrek (brif %12–18), sonra küçük-büyük karışık
function reefSize(kind) {
  const n = levelN, r = Math.random();
  let f = n === 1 ? rand(0.12, 0.18) : n === 2 ? (r < 0.6 ? rand(0.13, 0.19) : rand(0.2, 0.25)) : (r < 0.4 ? rand(0.12, 0.17) : r < 0.8 ? rand(0.18, 0.23) : rand(0.24, 0.28));
  if (kind === 'cave') f = Math.max(f * 1.1, 0.18); // mağara ağzı seçilebilsin
  return W * f;
}
function ledgeSize() { return W * (levelN === 1 ? rand(0.16, 0.22) : Math.random() < 0.5 ? rand(0.16, 0.24) : rand(0.25, 0.32)); }
function spawnReef(edgeOnly) {
  if (collidableCount() >= MAX_ROCKS) return;
  const lanes = edgeOnly ? [-1, 1] : [-1, 0, 1].filter(l => l !== lastLane);
  const lane = lanes[Math.floor(Math.random() * lanes.length)]; lastLane = lane;
  const roll = Math.random(), kind = roll < 0.5 ? 'mossy' : roll < 0.75 ? 'spiky' : 'cave';
  const w = reefSize(kind);
  const x = lane === 0 ? W / 2 + rand(-0.06, 0.06) * W : lane < 0 ? rand(0.12, 0.26) * W : rand(0.74, 0.88) * W;
  const a = OktoReef.make(kind, w, tier, Math.floor(Math.random() * 1e6));
  tryAddRock({ kind, x, y: H + a.ch * 0.6, a, hit: a.hit, mouth: a.mouth, used: false, safeT: 0 });
}
function spawnLedge() {
  ledgeSide = -ledgeSide;
  const len = ledgeSize(), a = OktoReef.make('ledge', len, tier, Math.floor(Math.random() * 1e6), ledgeSide);
  tryAddRock({ kind: 'ledge', x: ledgeSide < 0 ? 0 : W, y: H + a.ch * 0.6, a, hit: a.hit, mouth: null, used: false, safeT: 0 });
}
const FAR_COL = () => lerpColor('#1d6ea8', '#0a1c3a', clamp(visD() / 700, 0, 1));
function updateWorld(dt, scroll) {
  worldY += scroll * dt;
  // bölge değişimi
  const z = phase === 'dive' ? zoneAt(depth) : 'open';
  if (z !== zone) {
    if (window.OktoZones && OktoZones.active()) OktoZones.exit();
    zone = z;
    if (ZONE_NAMES[z]) toast(ZONE_NAMES[z]);
    else if (window.OktoZones && OktoZones.NAMES[z]) OktoZones.enter(z, zoneEnv(dt, scroll));
  }
  canyonAmt = lerp(canyonAmt, zone === 'canyon' ? 1 : 0, 1 - Math.pow(0.25, dt));
  seabedAmt = lerp(seabedAmt, boss && boss.phase !== 'dying' ? 1 : 0, 1 - Math.pow(0.3, dt));
  // kaya doğurma (canavar sahnesinde yok)
  rockT -= dt;
  if (rockT <= 0 && phase === 'dive' && levelInfo(levelN).end - depth > 18) {
    if (zone === 'reefs') { spawnReef(false); rockT = rand(1.0, 1.6); }
    else if (zone === 'canyon') { spawnLedge(); if (Math.random() < 0.25) spawnReef(true); rockT = rand(1.1, 1.6); }
    else { if (Math.random() < 0.35) spawnReef(true); rockT = rand(2.2, 3.2); }
  }
  const rockScroll = boss ? Math.max(scroll, 160 * S) : scroll; // canavar gelince eski kayalar arenadan hızla çıksın
  for (const k of rocks) { k.y -= rockScroll * dt; if (k.safeT > 0) k.safeT -= dt; }
  rocks = rocks.filter(k => k.y > -k.a.ch);
  // uzak katman: resif silüetleri, balık sürüleri, nadiren batık gemi (yavaş kayar)
  farT -= dt;
  if (farT <= 0) {
    const r = Math.random(), kind = r < 0.6 ? 'reef' : r < 0.93 ? 'school' : 'wreck', w = W * (kind === 'wreck' ? 0.55 : kind === 'school' ? 0.32 : rand(0.25, 0.4));
    const a = OktoReef.silhouette(kind, w, Math.floor(Math.random() * 1e6), FAR_COL());
    farL.push({ a, x: rand(0.05, 0.95) * W, y: H + a.ch, vx: kind === 'school' ? rand(-12, 12) * S : 0, alpha: kind === 'school' ? 0.5 : 0.45 });
    farT = rand(1.6, 2.8);
  }
  for (const f of farL) { f.y -= scroll * 0.35 * dt; f.x += f.vx * dt; }
  farL = farL.filter(f => f.y > -f.a.ch);
  // ön katman: kenarlardan geçen mercan/yosun (hızlı kayar)
  nearT -= dt;
  if (nearT <= 0) {
    const side = Math.random() < 0.5 ? -1 : 1, a = OktoReef.frond(W * rand(0.12, 0.18), Math.floor(Math.random() * 1e6), side);
    nearL.push({ a, x: side < 0 ? 0 : W, y: H + 10 });
    nearT = zone === 'canyon' ? rand(0.8, 1.3) : rand(1.8, 3);
  }
  for (const f of nearL) f.y -= scroll * 1.6 * dt;
  nearL = nearL.filter(f => f.y > -f.a.ch);
}
function rockCollisions() {
  const p = player;
  for (const k of rocks) {
    // mağara ağzı: içine yüzen Okto ödül kazanır
    if (k.mouth && !k.used && Math.hypot(p.x - (k.x + k.mouth.x), p.y - (k.y + k.mouth.y)) < k.mouth.r + p.r * 0.55) {
      k.used = true; k.safeT = 1.2;
      Sound.giftOpen(); score += 50; addFloater(k.x, k.y - k.a.w * 0.5, 'Mağara hazinesi! +50', '#7fe7ff');
      for (let i = 0; i < 6; i++) entities.push({ type: 'pearl', x: clamp(k.x + (i - 2.5) * 16 * S, 16, W - 16), y: k.y - k.a.w * 0.55 - (i % 2) * 18 * S, r: 8 * S, t: Math.random() * 9 });
      burst(k.x + k.mouth.x, k.y + k.mouth.y, '#bff8ff', 16, 150);
    }
    if (k.safeT > 0 || p.bigT > 0) continue; // Dev Okto kayalardan etkilenmez
    for (const h of k.hit) {
      const hx = k.x + h.x, hy = k.y + h.y, d = Math.hypot(p.x - hx, p.y - hy), lim = h.r + p.r * 0.62;
      if (d < lim) {
        const nx = (p.x - hx) / (d || 1), ny = (p.y - hy) / (d || 1);
        pushTarget(nx * (lim - d + 34 * S), ny * (lim - d + 34 * S)); // kayadan geri sektir
        p.x += nx * (lim - d); p.y += ny * (lim - d);
        if (invuln <= 0) { hurt(); Sound.crush(); addFloater(p.x, p.y - 36 * S, 'Kaya!', '#ffb0b0'); }
        break;
      }
    }
  }
}
function drawRockAsset(k) { ctx.drawImage(k.a.img, k.x - k.a.ox, k.y - k.a.oy, k.a.cw, k.a.ch); }
function drawWorldBack() {
  for (const f of farL) { ctx.globalAlpha = f.alpha; ctx.drawImage(f.a.img, f.x - f.a.ox, f.y - f.a.oy, f.a.cw, f.a.ch); }
  ctx.globalAlpha = 1;
  if (window.OktoReef) { OktoReef.drawCanyon(ctx, W, H, worldY, canyonAmt, tier, W * 0.13); OktoReef.drawSeabed(ctx, W, H, seabedAmt, tier, time); }
}
function drawRocks() {
  for (const k of rocks) {
    drawRockAsset(k);
    if (k.mouth) { // mağara ağzı parıltısı (ödül alınınca söner)
      const mx = k.x + k.mouth.x, my = k.y + k.mouth.y, a = k.used ? 0.1 : 0.35 + 0.25 * Math.sin(time * 4 + k.x);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(mx, my, 1, mx, my, k.mouth.r * 2.2); g.addColorStop(0, `rgba(150,240,255,${a})`); g.addColorStop(1, 'rgba(150,240,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, k.mouth.r * 2.2, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
}
function zoneLights() { // karanlık mağarada ışık saçan şeyler
  const L = [];
  for (const e of entities) {
    if (e.type === 'pearl') L.push({ x: e.x, y: e.y, r: 34 * S, a: 0.7 });
    else if (e.type === 'glow' || e.type === 'treat' || e.type === 'gift') L.push({ x: e.x, y: e.y, r: 80 * S, a: 0.9 });
    else if (e.type === 'angler') L.push({ x: e.x + e.r * 0.9, y: e.y - e.r * 1.4, r: 55 * S, a: 0.9 });
    else if (e.type === 'jelly') L.push({ x: e.x, y: e.y, r: 40 * S, a: 0.5 });
  }
  for (const r of rings) L.push({ x: r.x, y: r.y, r: Math.max(10, r.r), a: r.life });
  if (SK) for (const l of SK.lights(skEnv())) L.push(l); // fener nabzı huzmeleri
  return L;
}
function drawWorldFront() { for (const f of nearL) ctx.drawImage(f.a.img, f.x - f.a.ox, f.y - f.a.oy, f.a.cw, f.a.ch); }

// ---------- Bölüm sonu canavarları ----------
function startBoss(kind) {
  const def = bossDef(kind); kind = def.id;
  const lv = levelInfo(levelN).power || levelN, extra = Math.max(0, lv - 3);
  const hp = Math.max(2, def.hp + extra + diff().bossHp);
  TLOG.enc.push({ name: def.name, big: def.size === 'big', level: levelN, start: TLOG.t, dur: null, hits: 0, hurt: 0 });
  boss = { kind, def, big: def.size === 'big', x: W / 2, y: H + 170 * S, hp, maxHp: hp, lv, t: 0, phase: 'enter', attackT: 2.0, stun: 0, flashT: 0, r: def.r * S, puff: 0, dash: null, puffT: 0, act: null, ph: null };
  const hint = SK ? 'Mürekkep ve İnci Atışı ona vurur' : 'Mürekkep düğmesi ona mürekkep topu atar';
  if (def.size === 'big') toast(hint); // adı sinematikte zaten göründü
  else banner(`⚠️ ${def.name}!`, hint, '#ff8a8a', 3);
  Sound.bossWarn(); vibrate([100, 80, 100]); shake = 10;
  for (const e of entities) if (ENEMIES.has(e.type)) e.dead = true; // sahneyi canavara bırak
}
function damageBoss(n) {
  if (!boss || boss.phase !== 'fight') return;
  if (boss.armorT > 0 || (boss.vis != null && boss.vis < 0.5)) { addFloater(boss.x, boss.y - boss.r * 1.4, boss.armorT > 0 ? 'Zırh!' : 'Görünmez!', '#9fd6ff'); return; } // zırhlı / kaybolmuş: vurulmaz
  const te = TLOG.enc[TLOG.enc.length - 1]; if (te && te.dur == null) te.hits++;
  if (boss.openT > 0) { n += 1; addFloater(boss.x, boss.y - boss.r * 1.6, 'Çift vuruş!', '#7dffb0'); } // vatoz açık verdi
  boss.hp -= n; boss.flashT = 0.3; boss.stun = 1.2; boss.dash = null; boss.puffT = 0; boss.act = null; boss.glowT = 0; boss.clawT = 0; boss.foldT = 0; boss.current = null; boss.ventT = 0; boss.dropT = 0; boss.lureT = 0; boss.lunge = null; boss.fade = null; boss.vis = 1; boss.spinT = 0; if (boss.zig) { boss.zig = null; boss.backT = 1; } shake = 9;
  Sound.bossHit(); vibrate(60);
  burst(boss.x, boss.y - boss.r * 0.6, boss.def.color, 20, 220);
  addFloater(boss.x, boss.y - boss.r * 1.3, `-${n}`, '#ff8a8a');
  if (boss.hp <= 0) {
    boss.phase = 'dying'; boss.t = 0; slams.length = 0;
    { const e = TLOG.enc[TLOG.enc.length - 1]; if (e && e.dur == null) e.dur = TLOG.t - e.start; }
    for (const e of entities) if (ENEMIES.has(e.type)) e.dead = true;
    score += 300 * boss.lv * (boss.big ? 3 : 1); bossesBeaten++;
    if (boss.big) bigVictory();
    else banner(`🎉 ${boss.def.name} YENİLDİ!`, `+${300 * boss.lv} puan`, '#7dffb0', 2.2);
    Sound.bossDown(); Missions.track('boss_day', 1);
    for (let i = 0; i < (boss.big ? 30 : 14); i++) entities.push({ type: 'pearl', x: clamp(boss.x + rand(-140, 140) * S, 20, W - 20), y: boss.y - boss.r + rand(-60, 160) * S, r: 8 * S, t: Math.random() * 9 });
  } else {
    const ph = OktoBossAI.checkPhase(boss); // canı azalınca yeni aşama (yalnızca aşaması tanımlı canavarlarda)
    if (ph) { banner(`${boss.def.name}`, ph.name || 'Öfkelendi!', '#ff9a6b', 2); Sound.bossWarn(); shake = 12; boss.stun = 0.6; }
  }
}
function bossContactR() { return OktoBossAI.contactR(boss); }
function updateBoss(dt) {
  const b = boss; b.t += dt;
  if (b.flashT > 0) b.flashT -= dt;
  const restY = H - b.def.restY * S;
  if (b.phase === 'enter') {
    b.y = lerp(b.y, restY, dt * 1.5);
    if (Math.abs(b.y - restY) < 4) { b.phase = 'fight'; b.t = 0; }
    return;
  }
  if (b.phase === 'dying') {
    b.y += 120 * S * dt; b.puff = Math.max(0, b.puff - dt);
    if (Math.random() < dt * 20) burst(b.x + rand(-60, 60) * S, b.y - rand(0, 80) * S, '#ffffff', 4, 120);
    if (b.t > (b.big ? 3.6 : 2.4)) { boss = null; levelClear(); }
    return;
  }
  b.puff = Math.max(0, b.puff - dt * 1.5);
  if (b.stun > 0) { b.stun -= dt; b.y = lerp(b.y, restY, dt * 3); return; }
  const interval = Math.max(1.3, 2.8 - b.lv * 0.2) * rand(0.85, 1.15);
  // canavara özel hareket ve saldırılar boss-ai.js'te
  OktoBossAI.tick(b, { W, H, S, player, entities, slams, sound: Sound, rand, clamp, lerp, interval, restY,
    push: (dx, dy) => pushTarget(dx, dy), floater: addFloater }, dt);
}
function updateSlams(dt) {
  for (const s of slams) {
    s.t += dt;
    if (s.cancel && s.t < s.warn) s.done = true;
    const up = s.t - s.warn;
    // ---- büyük canavar saldırıları ----
    if (s.kind === 'drop') { // diken yağmuru: uyarı bitince tepeden diken düşer
      if (s.cancel && s.t < s.warn) { s.done = true; continue; }
      if (s.t >= s.warn) { entities.push({ type: 'spike', fixed: true, x: s.x, y: -10 * S, vx: 0, vy: s.sp, r: 7 * S, t: 0 }); s.done = true; }
      continue;
    }
    // ---- s45: 4. mini canavarların saldırıları ----
    if (s.kind === 'boomer') { // kabarcık bumerang: elips çizip canavara döner
      if (s.cancel || s.t > s.dur) { s.done = true; burst(s.x, s.y, '#ffd9ef', 8, 80); continue; }
      const th = s.t / s.dur * TAU; s.x = clamp(s.bx + s.side * s.ax * Math.sin(th), s.r, W - s.r); s.y = s.by - s.ay + s.ay * Math.cos(th);
      if (Math.hypot(player.x - s.x, player.y - s.y) < s.r + player.r * 0.6) { hurt(); s.done = true; burst(s.x, s.y, '#ffd9ef', 10, 120); }
      continue;
    }
    if (s.kind === 'star') { // yıldız: saçılır, durur, Okto'nun yerine kilitlenir, fırlar
      if (s.cancel || s.x < -40 * S || s.x > W + 40 * S || s.y < -40 * S || s.y > H + 40 * S) { s.done = true; continue; }
      if (s.st === 'out') { const k = Math.exp(-3.2 * dt); s.vx *= k; s.vy *= k; s.x = clamp(s.x + s.vx * dt, s.r, W - s.r); s.y = clamp(s.y + s.vy * dt, s.r + safeTop, H - s.r); if (s.t >= s.stopT) { s.st = 'hold'; s.ht = 0; s.tx = player.x; s.ty = player.y; Sound.tone(1200, 0.06, 'square', 0.03); } }
      else if (s.st === 'hold') { s.ht += dt; if (s.ht >= s.hold) { const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy) || 1; s.vx = dx / d * s.go; s.vy = dy / d * s.go; s.st = 'go'; } }
      else { s.x += s.vx * dt; s.y += s.vy * dt; }
      if (Math.hypot(player.x - s.x, player.y - s.y) < s.r + player.r * 0.55) { hurt(); s.done = true; burst(s.x, s.y, '#ffb08a', 10, 120); }
      continue;
    }
    if (s.kind === 'zigline') { // kılıç balığının yol işareti: atılış bitince kaybolur
      if (s.cancel || !boss || !boss.zig) s.done = true;
      continue;
    }
    if (s.kind === 'hbub') { // kovalayan dikenli kabarcık: önce saydam ve zararsız, sonra Okto'ya doğru süzülür
      if (s.cancel || s.t > s.life) { s.done = true; burst(s.x, s.y, '#bff3ff', 8, 90); continue; }
      const dx = player.x - s.x, dy = player.y - s.y, d = Math.hypot(dx, dy) || 1;
      s.x += dx / d * s.sp * dt; s.y += (dy / d * s.sp - (s.t < s.arm ? 40 * S : 0)) * dt;
      if (s.t >= s.arm && d < s.r + player.r * 0.6) { hurt(); s.done = true; burst(s.x, s.y, '#bff3ff', 10, 120); }
      continue;
    }
    if (s.kind === 'wall') { // diken duvarı: yalnızca boşluktan geçilir
      if (s.t < 0) continue;
      if (s.cancel && s.t < s.warn) { s.done = true; continue; }
      if (s.t >= s.warn) { s.y -= s.sp * dt; if (s.y < -30 * S) s.done = true;
        if (Math.abs(player.y - s.y) < 12 * S + player.r * 0.5 && Math.abs(player.x - s.gx) > s.gw / 2 - player.r * 0.4) hurt(); }
      continue;
    }
    if (s.kind === 'hzap') { // yatay şimşek
      if (s.cancel && s.t < s.warn) { s.done = true; continue; }
      const up2 = s.t - s.warn; if (up2 >= 0 && !s.zapped) { s.zapped = true; Sound.noise(0.4, 0.2, 4000); Sound.tone(80, 0.4, 'sawtooth', 0.1); }
      if (up2 >= 0 && up2 < 0.5 && Math.abs(player.y - s.y) < s.w + player.r * 0.6) hurt();
      if (up2 > 0.5) s.done = true;
      continue;
    }
    if (s.kind === 'orb') { // elektrik küresi: önce canavarın çevresinde yüklenir, sonra döne döne dağılır
      if (s.cancel || s.t > s.warn + s.life) { s.done = true; continue; }
      const a = s.a0 + s.t * s.spin * 2.5;
      if (s.t < s.warn) { s.x = s.bx + Math.cos(a) * 60 * S; s.y = s.by + Math.sin(a) * 60 * S; }
      else { const k = (s.t - s.warn) * s.sp + 60 * S; s.x = s.bx + Math.cos(a) * k; s.y = s.by + Math.sin(a) * k;
        if (Math.hypot(player.x - s.x, player.y - s.y) < s.r + player.r * 0.6) { hurt(); s.done = true; } }
      continue;
    }
    if (s.kind === 'zone') { // şok halkası: dolunca içi çarpar
      if (s.cancel && s.t < s.warn) { s.done = true; continue; }
      const up2 = s.t - s.warn; if (up2 >= 0 && !s.zapped) { s.zapped = true; Sound.noise(0.3, 0.15, 3500); }
      if (up2 >= 0 && up2 < 0.35 && Math.hypot(player.x - s.x, player.y - s.y) < s.r + player.r * 0.3) hurt();
      if (up2 > 0.4) s.done = true;
      continue;
    }
    if (s.kind === 'inkbomb') { // mürekkep bombası: yay çizerek işaretli yere gider, orada patlar
      if (s.cancel) { s.done = true; continue; }
      const k = Math.min(1, s.t / s.dur); s.x = s.x0 + (s.tx - s.x0) * k; s.y = s.y0 + (s.ty - s.y0) * k - Math.sin(k * Math.PI) * 120 * S;
      if (k >= 1) { s.done = true; Sound.noise(0.3, 0.15, 900); burst(s.tx, s.ty, '#2a1047', 14, 140);
        for (let i = 0; i < s.n; i++) { const a = i * TAU / s.n; entities.push({ type: 'blob', fixed: true, x: s.tx, y: s.ty, vx: Math.cos(a) * s.sp, vy: Math.sin(a) * s.sp, r: 10 * S, t: Math.random() * 9 }); } }
      continue;
    }
    if (s.kind === 'toptent') { // tepeden inen yakalayıcı dokunaç
      if (s.cancel && s.t < s.warn) { s.done = true; continue; }
      const up2 = s.t - s.warn; s.reach = up2 < 0 ? 0 : up2 < 0.3 ? up2 / 0.3 : up2 < 0.9 ? 1 : Math.max(0, 1 - (up2 - 0.9) / 0.3);
      if (up2 > 1.2) s.done = true;
      if (s.reach > 0.3 && Math.abs(player.x - s.x) < s.w + player.r * 0.6 && player.y < s.reach * H * 0.62) hurt();
      continue;
    }
    if (s.kind === 'mine') { // mayın yengecinin mayını: yukarı süzülür, sonunda patlar
      if (s.cancel) { s.done = true; burst(s.x, s.y, '#ff8a8a', 10, 120); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy *= Math.pow(0.5, dt); s.vx *= Math.pow(0.5, dt);
      if (s.t >= s.fuse && !s.boom) { s.boom = true; burst(s.x, s.y, '#ffb070', 22, 220); Sound.noise(0.35, 0.18, 900); shake = Math.max(shake, 6); if (Math.hypot(player.x - s.x, player.y - s.y) < s.r + player.r * 0.5) hurt(); }
      if (s.t > s.fuse + 0.35) s.done = true;
      continue;
    }
    if (s.kind === 'dark') { if (s.cancel || s.t > s.dur) s.done = true; continue; } // mürekkep karartması (yalnızca görüş)
    if (s.kind === 'ring') { // hayalet halka: genişler; halkanın çizgisine değen Okto hasar alır
      const r = s.t * s.speed; if (s.cancel || r > s.maxR) { s.done = true; continue; }
      if (Math.abs(Math.hypot(player.x - s.x, player.y - s.y) - r) < s.w + player.r * 0.5) hurt();
      continue;
    }
    if (s.kind === 'claw') { // yengeç kıskacı: yatay şerit; önce uyarı, sonra kıskaç kenardan kenara süpürür
      if (s.warnOnly) { if (s.t >= s.warn) s.done = true; continue; }
      s.reach = Math.min(1, s.t / 0.55); if (s.t > 0.8) s.done = true;
      const front = s.side > 0 ? s.reach * W : W - s.reach * W;
      const inX = s.side > 0 ? player.x < front + player.r : player.x > front - player.r;
      if (!s.cancel && inX && Math.abs(player.y - s.y) < s.h + player.r * 0.6) hurt();
      continue;
    }
    if (s.kind === 'zap') { s.reach = up >= 0 && up < 0.55 ? 1 : 0; if (up >= 0 && !s.zapped) { s.zapped = true; Sound.noise(0.4, 0.2, 4000); Sound.tone(80, 0.4, 'sawtooth', 0.1); } if (up > 0.55) s.done = true; }
    else { s.reach = up < 0 ? 0 : up < 0.3 ? up / 0.3 : up < 0.9 ? 1 : Math.max(0, 1 - (up - 0.9) / 0.3); if (up > 1.2) s.done = true; }
    if (s.reach > 0.3 && !s.cancel) {
      const tipY = H - s.reach * H * (s.maxReach || (s.kind === 'zap' ? 1.05 : 0.92));
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

// ---------- Büyük canavar: sinematik giriş ve büyük zafer ----------
let cine = null, victory = null;
function startCinema(L) {
  const def = bossDef(L.boss), I = L.intro || {};
  state = 'cinema'; drag.active = false;
  cine = { t: 0, dur: 5.2, kind: def.id, def, title: I.title || def.name, sub: I.sub || '', color: I.color || '#ffd36b', fx: player.x, fy: player.y, cues: {} };
  for (const e of entities) if (ENEMIES.has(e.type)) e.dead = true;
  slams = []; shots = [];
  window.OktoMusic && OktoMusic.stop(0.8);
  Sound.cineRumble();
  show(ui.ink, false); show(ui.pauseBtn, false);
}
function updateCinema(dt) {
  const C = cine; C.t += dt; time += dt;
  const a = clamp(C.t / 1.5, 0, 1), e = a * a * (3 - 2 * a); // Okto yukarıda, ortada bekler
  player.x = lerp(C.fx, W / 2, e); player.y = lerp(C.fy, H * 0.28, e); player.vx = 0; player.vy = 0;
  target.x = player.x; target.y = player.y;
  if (C.t > 1.2 && !C.cues.rise) { C.cues.rise = 1; Sound.cineRise(); shake = 4; }
  if (C.t > 3.0 && !C.cues.reveal) { C.cues.reveal = 1; Sound.bossWarn(); vibrate([80, 60, 80]); shake = 8; }
  if (C.t >= C.dur) {
    state = 'play'; cine = null; startBoss(C.kind);
    boss.y = H - boss.def.restY * S + 30 * S; // sinematikte zaten yükseldi: hemen savaşa
    gameMusic(); show(ui.ink, true); show(ui.pauseBtn, true); last = performance.now();
  }
}
let silCvs = null;
function drawCinema() {
  const C = cine; if (!C) return;
  OktoCinema.drawIntro({
    ctx, W, H, S, FONT, time, t: C.t, dur: C.dur, title: C.title, sub: C.sub, color: C.color,
    drawBoss: (y, dark) => { // canavar, karanlık silüetten aydınlığa
      const fake = { kind: C.kind, def: C.def, big: true, x: W / 2, y, r: C.def.r * S, hp: 1, maxHp: 1, t: C.t, flashT: 0, stun: 0, puff: 0, puffT: 0 };
      if (dark <= 0.01) { OktoBosses.draw(Object.assign(gfx(), { boss: fake })); return; }
      if (!silCvs) silCvs = document.createElement('canvas');
      if (silCvs.width !== cvs.width || silCvs.height !== cvs.height) { silCvs.width = cvs.width; silCvs.height = cvs.height; }
      const c2 = silCvs.getContext('2d');
      c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, silCvs.width, silCvs.height); c2.setTransform(DPR, 0, 0, DPR, 0, 0);
      OktoBosses.draw(Object.assign(gfx(), { ctx: c2, boss: fake }));
      c2.globalCompositeOperation = 'source-atop'; c2.fillStyle = `rgba(4,8,28,${0.92 * dark})`; c2.fillRect(0, 0, W, H); c2.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(silCvs, 0, 0); ctx.restore();
    },
  });
}
function bigVictory() {
  banners.length = 0; // zafer yazısı başka yazıyla üst üste binmesin
  victory = { t: 0, x: boss.x, y: boss.y - boss.r * 0.5, title: 'BÜYÜK ZAFER!', sub: `${boss.def.name} yenildi` };
  Sound.fanfare(); vibrate([60, 40, 60, 40, 120]);
  const D = Profile.data; D.trophies = D.trophies || {}; D.trophies[boss.kind] = (D.trophies[boss.kind] || 0) + 1; Profile.save();
}

// ---------- Bölüm haritası (grup düzeni; map.js) ----------
// 'progress': bölüm sonu kartından sonra açılır, Okto bir sonraki adaya yüzer, sonra Dal! → girdap
// 'menu': menüden açılır; açık bir adaya dokununca o bölüm başlar; önceki/sonraki grup düğmeleri
let mapV = null;
function openMap(mode, group) {
  const prog = mode === 'progress', groups = OktoCampaign.GROUPS.length;
  // büyük canavar yenildiyse yeni grubun haritası açılır: Okto yukarıdan ilk adaya yüzer, "Yeni bölge açıldı!" yazısı çıkar
  const cur = prog ? levelN + 1 : startLevel(), fresh = prog && levelInfo(levelN).arena;
  const g = group != null ? group : OktoMap.groupOf(prog && !fresh ? levelN : cur);
  mapV = { mode, group: g, current: cur, unlocked: Math.max(gUnlocked(), cur), swim: prog ? { from: levelN, to: levelN + 1, t: 0 } : null, fresh: fresh ? 3.5 : 0 };
  state = 'map'; drag.active = false; window.OktoMusic && prog && OktoMusic.stop(0.6);
  for (const el of [ui.clear, ui.menu, ui.ink, ui.pauseBtn, ui.mute]) show(el, false);
  show($('mapUi'), true); show($('mapGo'), false); show($('mapClose'), !prog); show($('mapPrev'), !prog); show($('mapNext'), !prog);
  if (prog) Sound.tone(500, 0.6, 'sine', 0.05, 300);
}
function closeMap() { show($('mapUi'), false); mapV = null; }
function mapGo() { if (!mapV) return; closeMap(); startTransition(); } // haritadan girdaba
function mapTap(x, y) {
  if (!mapV) return;
  const h = OktoMap.hit(x, y); if (!h) return;
  if (h.locked) { Sound.tone(200, 0.12, 'square', 0.05); return; }
  if (mapV.mode === 'progress') { if (h.n === mapV.current && !(mapV.swim && mapV.swim.t < 1)) mapGo(); return; }
  closeMap(); startGame(h.n); // menüden: açık adaya dokununca o bölüm başlar
}
$('mapGo').onclick = () => mapGo();
$('mapClose').onclick = () => { closeMap(); toMenu(); };
// gruplar tekrar turlarıyla sürer: önceki/sonraki, açık son grubun bir ötesine kadar (kilitli önizleme)
$('mapPrev').onclick = () => { if (mapV) mapV.group = Math.max(0, mapV.group - 1); };
$('mapNext').onclick = () => { if (mapV) mapV.group = Math.min(OktoMap.groupOf(mapV.unlocked) + 1, mapV.group + 1); };
$('mapBtn').onclick = () => { if (OktoCampaign.mode === 'grup' && window.OktoMap) openMap('menu'); };

// ---------- Bölüm sonu: özet kartı ve girdap geçişi ----------
let trans = null;
function levelClear() {
  if (SK) SK.cancel();
  const fresh = awardXp(); // bölüm sonunda Kaşif Puanı ve açılan beceriler
  $('clUnlock').textContent = unlockText(fresh); show($('clUnlock'), fresh.length > 0); show($('clSkills'), !!SK);
  showTlog('clear');
  state = 'clear'; drag.active = false; window.OktoMusic && OktoMusic.stop(1.0);
  const n = levelN, goal = pearlGoal(n);
  const stars = 1 + (levelHits <= 1 ? 1 : 0) + (levelPearls >= goal ? 1 : 0);
  const reward = 10 + 5 * n + stars * 10;
  bonusPearls += reward;
  const D = Profile.data;
  if (OktoCampaign.mode === 'grup') { D.gcheck = Math.max(gUnlocked(), n + 1); D.gstart = n + 1; } // grup düzeni kendi kaydını tutar
  else { D.checkpoint = Math.max(D.checkpoint || 1, n + 1); D.startLevel = n + 1; }
  Profile.save();
  const LI = levelInfo(n), bigWin = LI.arena;
  $('clTitle').textContent = bigWin ? `${LI.groupName} Tamamlandı!` : `Bölüm ${n} Tamamlandı!`;
  $('clName').textContent = bigWin ? `Büyük canavar yenildi · Kupa kazandın` : LI.name;
  const st = $('clStars'); st.innerHTML = '';
  for (let i = 0; i < 3; i++) { const sp = document.createElement('span'); sp.textContent = '★'; sp.className = i < stars ? 'on' : ''; sp.style.animationDelay = `${0.3 + i * 0.35}s`; st.append(sp); }
  for (let i = 0; i < stars; i++) Sound.tone(880 * Math.pow(2, i * 4 / 12), 0.3, 'triangle', 0.1, 0, 0.6 + i * 0.35, true);
  $('clStats').innerHTML = `<div>⚪ İnci: <b>${levelPearls}</b> / ${goal} ${levelPearls >= goal ? '✓' : ''}</div><div>💥 Aldığın hasar: <b>${levelHits}</b> ${levelHits <= 1 ? '✓' : ''}</div><div class="rw">Bölüm ödülü: +${reward} inci</div>`;
  $('clNext').textContent = `Sıradaki: Bölüm ${n + 1} · ${levelInfo(n + 1).name}`;
  show(ui.ink, false); show(ui.pauseBtn, false);
  setTimeout(() => { if (state === 'clear') show(ui.clear, true); }, 400);
}
function startTransition() {
  show(ui.clear, false); show($('mapUi'), false); mapV = null;
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
    for (const en of entities.concat(rocks)) { en.x = lerp(en.x, cx, dt * 2.5); en.y = lerp(en.y, cy, dt * 2.5); }
  } else if (!T.switched) { // karanlıkta yeni bölüme geç
    T.switched = true; levelN++;
    const L = levelInfo(levelN);
    depth = L.start; tier = L.tier; Sound.tier = L.tier;
    if (window.OktoZones) OktoZones.exit();
    entities = []; slams = []; shots = []; inkClouds = []; particles = []; rocks = []; nearL = []; plan = makePlan(L); zone = 'open'; canyonAmt = 0; seabedAmt = 0;
    levelHits = 0; levelPearls = 0; inkCharge = 1; phase = 'dive'; gameMusic();
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
  time += dt; TLOG.t += dt;
  let scroll = (70 + Math.min(diffD(), 900) * 0.18) * S * diff().scroll; // piksel/sn
  if (boss) scroll *= 0.35;
  if (window.OktoZones) scroll *= OktoZones.speed();
  // bölüm ilerleyişi: sona gelince canavar çıkar, derinlik canavar yenilene kadar durur
  const L = levelInfo(levelN);
  if (phase === 'dive') {
    depth = Math.min(depth + scroll * dt / (22 * S), L.end);
    if (depth >= L.end) { phase = 'boss'; if (bossDef(L.boss).size === 'big') startCinema(L); else startBoss(L.boss); }
  }

  // Oyuncu hareketi (göreli sürükleme hedefe gider)
  const p = player, b = bounds();
  const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  const ky = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  if (kx || ky) { target.x = clamp(target.x + kx * 430 * S * dt, b.x0, b.x1); target.y = clamp(target.y + ky * 430 * S * dt, b.y0, b.y1); }
  const ox = p.x, oy = p.y, k = 1 - Math.pow(0.0005, dt * (window.OktoZones ? OktoZones.slow() : 1) * (p.bigT > 0 ? 1.4 : 1));
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
  if (p.bigT > 0) { p.bigT -= dt; if (p.bigT <= 0) { Sound.shrink(); addFloater(p.x, p.y - 50 * S, 'küçüldü!', '#fff'); } }
  p.big = lerp(p.big, p.bigT > 0 ? 1 : 0, 1 - Math.pow(0.002, dt));
  if (p.bossBumpT > 0) p.bossBumpT -= dt;
  if (winkT > 0) winkT -= dt;
  if (shieldTime > 0) shieldTime -= dt;
  if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
  if (inkCharge < 1) inkCharge = Math.min(1, inkCharge + dt / (boss ? 4 : diff().ink));
  if (shake > 0) shake = Math.max(0, shake - dt * 40);
  if (Math.floor(depth / 5) !== lastDepthMark) { lastDepthMark = Math.floor(depth / 5); Missions.track('depth_run', Math.floor(depth)); }

  updateWorld(dt, scroll);
  if (window.OktoZones && OktoZones.active()) OktoZones.update(zoneEnv(dt, scroll));
  // Doğurma
  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawn(); spawnTimer = (boss ? 1.3 : Math.max(0.32, 1.0 - diffD() * 0.0013)) * rand(0.7, 1.3) * diff().spawn; }
  if (boss) updateBoss(dt);
  if (SK) SK.update(skEnv(), dt); // beceri efektleri (çarpışmalardan önce: kalkan mermiyi durdurur)
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
        if (e.blind) { e.x += Math.sin(e.t * 0.8) * 20 * S * dt; break; } // yosunda Okto'yu göremez
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
      const pr = p.r * (0.7 + 0.85 * p.big);
      if (p.bigT > 0 && d < e.r * 0.9 + pr && !(e.type === 'shark' && e.warn > 0)) crush(e);
      else if (!e.stunned && d < e.r * 0.85 + pr) hurt();
    } else if (d < e.r + p.r * (0.9 + 0.8 * p.big) && !(e.type === 'treat' && e.t < 0.35)) { e.dead = true; collect(e); }
  }
  rockCollisions();
  if (window.OktoZones && OktoZones.active()) OktoZones.collide(zoneEnv(dt, scroll));
  if (boss && boss.phase === 'fight' && !(boss.vis != null && boss.vis < 0.5)) { const cy = OktoBossAI.contactY(boss); if (Math.hypot(boss.x - p.x, cy - p.y) < bossContactR() + p.r * (0.6 + 0.85 * p.big)) {
    if (p.bigT > 0) { if (p.bossBumpT <= 0) { p.bossBumpT = 1; damageBoss(1); pushTarget(0, -90 * S); } } else hurt();
  } }
  entities = entities.filter(e => !e.dead && Number.isFinite(e.x) && Number.isFinite(e.y) && e.y > -120 * S && e.y < H + 400 * S && e.x > -200 * S && e.x < W + 200 * S);

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
let envCache = { n: -1, env: null };
// s45: grup düzeninde bölümler uzun; zorluk ve su rengi klasik eşdeğer derinlikle (L.dd / L.vis) ilerler. Klasikte gerçek derinlik.
let ddCache = { n: -1, L: null };
function ddMap(key) { if (ddCache.n !== levelN) ddCache = { n: levelN, L: levelInfo(levelN) }; const L = ddCache.L, r = L && L[key]; if (!r) return depth; const k = clamp((depth - L.start) / ((L.end - L.start) || 1), 0, 1); return r[0] + (r[1] - r[0]) * k; }
const diffD = () => ddMap('dd'), visD = () => ddMap('vis');
function levelEnv() { if (envCache.n !== levelN) envCache = { n: levelN, env: (levelInfo(levelN).env || null) }; const e = envCache.env; return e && e.water ? e : null; }
function drawBackground() {
  const t = clamp(visD() / 600, 0, 1), env = levelEnv();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, env ? env.water[0] : lerpColor('#3cc7f0', '#06223f', t)); // bölüm grubunda ortamın kendi su rengi
  g.addColorStop(1, env ? env.water[1] : lerpColor('#0b5d8f', '#010a18', t));
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

// Varlık çizimleri ayrı dosyalarda: enemies.js (düşmanlar, toplanabilirler), bosses.js (canavarlar ve saldırıları)
const gfx = () => ({ ctx, S, W, H, time, FONT, boss, player, slams, shots, safeTop });
function drawEntity(e) { OktoEnemies.draw(gfx(), e); }
function drawBoss() { OktoBosses.draw(gfx()); }
function drawSlams() { OktoBosses.drawAttacks(gfx()); }

function drawPlayer() {
  const p = player;
  if (invuln > 0 && state === 'play' && Math.floor(invuln * 12) % 2 === 0) return drawShield();
  const expr = {
    look: clamp(p.vx / (300 * S), -1, 1), lookY: clamp(p.vy / (300 * S), -1, 1),
    blink: p.blink > 0 ? 1 : 0, wink: winkT > 0 ? 1 : 0,
    ouch: state === 'play' && invuln > 1.15 ? 1 : 0, dizzy: state === 'over' ? 1 : 0,
  };
  let R = p.r * (1 + 0.85 * p.big), spin = 0;
  if (p.big > 0.02) { // dev Okto parıltısı; bitmeye yakın yanıp söner
    const blinkOut = p.bigT > 0 && p.bigT < 1.5 && Math.floor(p.bigT * 8) % 2 === 0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = p.big * (blinkOut ? 0.3 : 0.7);
    const g = ctx.createRadialGradient(p.x, p.y, R * 0.4, p.x, p.y, R * 2.4);
    g.addColorStop(0, 'rgba(255,215,80,.6)'); g.addColorStop(1, 'rgba(255,215,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R * 2.4, 0, TAU); ctx.fill(); ctx.restore();
  }
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
  let y = Math.max(safeTop + 200, H * 0.26), ys = safeTop + 128; // ilerleme çubuğunun altında kalsın
  for (const b of banners) {
    const age = b.dur - b.life, a = clamp(Math.min(age * 4, b.life * 2), 0, 1), sc = 0.7 + 0.3 * Math.min(1, age * 5);
    // ortalamayı kendimiz yapıyoruz (textAlign center iPhone'da bazı yazılarda kayıyordu)
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (b.small) {
      const fs = 15 * S; ctx.font = `700 ${fs}px ${FONT}`;
      let tw = textW(b.text, fs); const k = Math.min(1, (W - 40) / (tw + 28 * S));
      ctx.translate(W / 2, ys); ctx.scale(k, k);
      const w = tw + 28 * S;
      ctx.fillStyle = 'rgba(10,40,30,.75)'; ctx.beginPath(); ctx.roundRect(-w / 2, -16 * S, w, 32 * S, 16 * S); ctx.fill();
      ctx.fillStyle = b.color; ctx.fillText(b.text, -tw / 2, 1); ys += 40 * S;
    } else {
      const fs = 38 * S; ctx.translate(W / 2, y);
      ctx.font = `700 ${fs}px ${FONT}`;
      const tw = textW(b.text, fs), fit = Math.min(1, (W * 0.92) / (tw + 18 * S)); // ekrana sığdır
      ctx.save(); ctx.scale(sc * fit, sc * fit);
      ctx.lineWidth = 9 * S; ctx.strokeStyle = 'rgba(6,20,50,.85)'; ctx.strokeText(b.text, -tw / 2, 0);
      ctx.fillStyle = b.color; ctx.fillText(b.text, -tw / 2, 0);
      ctx.restore();
      if (b.sub) {
        const ss = 18 * S; ctx.font = `700 ${ss}px ${FONT}`;
        const sw = textW(b.sub, ss), sf = Math.min(1, (W * 0.92) / (sw + 12 * S)) * sc;
        ctx.translate(0, 36 * S * sc); ctx.scale(sf, sf);
        ctx.lineWidth = 6 * S; ctx.strokeStyle = 'rgba(6,20,50,.85)'; ctx.strokeText(b.sub, -sw / 2, 0); ctx.fillStyle = '#fff'; ctx.fillText(b.sub, -sw / 2, 0);
      }
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

  ctx.textAlign = 'center'; ctx.font = `700 30px ${FONT}`;
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.strokeText(score, W / 2, top);
  ctx.fillStyle = '#fff'; ctx.fillText(score, W / 2, top);
  ctx.font = `700 14px ${FONT}`; ctx.fillStyle = '#fff7d6'; ctx.fillText(`⚪ ${pearls}`, W / 2, top + 36);
  if (combo >= 3) { ctx.fillStyle = '#ffe066'; ctx.fillText(`KOMBO x${1 + Math.floor(combo / 3)}`, W / 2, top + 54); }
  // bölüm ilerleme çubuğu: ucunda yıldız (canavar gelince yerini canavarın can barı alır)
  if (!boss) {
    const bw = Math.min(260, W - 140), bx = W / 2 - bw / 2, by = top + 78, fw = Math.max(14, bw * prog);
    ctx.fillStyle = 'rgba(0,20,45,.5)'; ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, bw + 6, 16, 8); ctx.fill();
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ff8fc2'); g.addColorStop(1, '#ff4d8d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(bx, by, fw, 10, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.roundRect(bx + 3, by + 2, Math.max(0, fw - 6), 3, 1.5); ctx.fill();
    // canavar simgesi (çubuğun sonu) ve yıldız (ilerleme ucu)
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(bx + bw + 2, by + 5, 5, 0, TAU); ctx.fill();
    const sx = bx + fw, sy = by + 5, sr = 11 + Math.sin(time * 4) * 0.8;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.sin(time * 2) * 0.15);
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a86a00'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, l = i % 2 ? sr * 0.45 : sr; ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // bölüm sonu canavarının can barı
  if (boss && boss.phase !== 'dying') {
    const bw = Math.min(boss.big ? 300 : 260, W - 140), bx = W / 2 - bw / 2, by = top + 76;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.roundRect(bx - 4, by - 4, bw + 8, 22, 11); ctx.fill();
    if (boss.big) { ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx - 5, by - 5, bw + 10, 24, 12); ctx.stroke(); } // büyük canavar: altın çerçeve
    ctx.fillStyle = boss.big ? '#ff8a3d' : '#ff4d6d'; ctx.beginPath(); ctx.roundRect(bx, by, bw * Math.max(0, boss.hp) / boss.maxHp, 14, 7); ctx.fill();
    ctx.font = `700 12px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(`${boss.def.name}  ${Math.max(0, boss.hp)}/${boss.maxHp}`, W / 2, by + 7);
  }
  // mürekkep düğmesi (beceri denemesinde beceri düğmesi)
  if (SK) { SK.drawButton(inkCtx, 168, skEnv()); ui.ink.style.transform = 'none'; return; }
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

// ---------- Beceriler paneli (deneme: ?beceri) ----------
function skillIcon(d, locked) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = 'rgba(20,40,90,.9)'; c.beginPath(); c.arc(64, 64, 60, 0, TAU); c.fill();
  c.save(); c.translate(64, 62);
  if (SK.ICONS[d.id]) SK.ICONS[d.id](c, 46);
  else { c.fillStyle = '#fff'; c.font = `700 40px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d.name.split(' ').map(w => w[0]).join('').slice(0, 2), 0, 2); }
  c.restore();
  if (locked) { // kilit
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(64, 64, 60, 0, TAU); c.fill();
    c.strokeStyle = '#ffd73a'; c.lineWidth = 7; c.beginPath(); c.arc(64, 58, 15, Math.PI, 0); c.stroke();
    c.fillStyle = '#ffd73a'; c.beginPath(); c.roundRect(42, 58, 44, 34, 6); c.fill();
  }
  return cv;
}
let skMsg = '';
function renderSkills() {
  const P = skProf(), xp = P.xp, nx = SK.nextUnlock(xp), prev = SK.DEFS.filter(d => d.xp <= xp).reduce((m, d) => Math.max(m, d.xp), 0);
  const k = nx ? (xp - prev) / Math.max(1, nx.xp - prev) : 1;
  $('skXp').innerHTML = `<b>Kaşif Puanı: ${xp}</b><br>` + (nx ? `Sıradaki beceri: <b>${nx.name}</b> · ${nx.xp} puanda açılır` : 'Bütün beceriler açık!') +
    `<div class="xpbar"><i style="width:${Math.round(clamp(k, 0, 1) * 100)}%"></i></div>` +
    `<small>Dalışta kazandığın her puan buraya eklenir. Canavar yenmek çok puan verir.</small>` + (skMsg ? `<br><b>${skMsg}</b>` : '');
  skMsg = '';
  const eq = $('skEquip'); eq.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const id = SK.state.equipped[i], d = id && SK.byId(id), b = document.createElement('button'); b.className = 'item' + (d ? ' eq' : '');
    if (d) { b.append(skillIcon(d, false)); b.insertAdjacentHTML('beforeend', `<div class="nm">${d.name}</div>`); b.onclick = () => tapSkill(id); }
    else b.innerHTML = '<div class="nm" style="padding:26px 0">Boş yuva</div>';
    eq.append(b);
  }
  const g = $('skGrid'); g.innerHTML = '';
  for (const d of SK.DEFS) {
    const open = d.xp <= xp, on = SK.state.equipped.includes(d.id), b = document.createElement('button');
    b.className = 'item' + (on ? ' eq' : '') + (!open ? ' lock' : !d.ready ? ' soon' : '');
    b.append(skillIcon(d, !open));
    b.insertAdjacentHTML('beforeend', `<div class="nm">${d.name}</div><div class="pr">${!open ? d.xp + ' puan' : !d.ready ? 'yakında' : on ? 'kuşanıldı ✓' : 'kuşan'}</div><div class="ds">${d.desc}</div>`);
    b.onclick = () => tapSkill(d.id);
    g.append(b);
  }
  P.seen = SK.unlockedIds(xp).length; Profile.save();
}
function tapSkill(id) {
  const r = SK.toggleEquip(skProf(), id), d = SK.byId(id);
  skMsg = r === 'kilitli' ? (d.xp > skProf().xp ? `${d.name} ${d.xp} puanda açılır` : `${d.name} yakında geliyor`) : r === 'dolu' ? 'En fazla 3 beceri: önce birini çıkar' : r === 'enaz' ? 'En az bir beceri kuşanılı kalmalı' : '';
  if (r === 'tamam') Sound.coin(); else Sound.tone(220, 0.1, 'square', 0.05);
  Profile.save(); renderSkills();
}
$('skillBtn').onclick = () => { if (!SK) return; renderSkills(); show($('skills'), true); };
$('clSkills').onclick = () => { if (!SK) return; renderSkills(); show($('skills'), true); };
$('skillsClose').onclick = () => { show($('skills'), false); if (state === 'menu') refreshMenu(); };
$('missionClose').onclick = () => { show(ui.missions, false); refreshMenu(); };

// ---------- Ana döngü ----------
let last = performance.now();
let sizeCheckT = 0, errCount = 0;
function reportError(where, err) {
  errCount++;
  const info = { where, msg: String(err && err.message || err), line: String(err && err.stack || '').split('\n').slice(0, 3).join(' / '), state, level: levelN, at: new Date().toLocaleString('tr-TR') };
  try { console.error('[Okto]', info); } catch {}
  if (errCount < 20) store.set('okto_lasterr', info);
}
function frame(now) {
  requestAnimationFrame(frame); // önce sıradaki kareyi iste: bir hata döngüyü asla durdurmasın
  const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
  try { stepFrame(now, dt); } catch (err) { reportError('güncelleme', err); }
  try { drawFrame(); } catch (err) { reportError('çizim', err); try { ctx.restore(); } catch {} }
}
function stepFrame(now, dt) {
  if (shake > 0 && state !== 'play') shake = Math.max(0, shake - dt * 40);
  if (victory && state !== 'pause') { victory.t += dt; if (victory.t > 3.8) victory = null; } // ölünce/menüde sarsıntı sönsün
  if ((sizeCheckT += dt) > 0.5) { sizeCheckT = 0; edgeDue = true; refreshSafeTop(); }
  if (state === 'play') update(SK ? dt * SK.timeScale() : dt); // beceri halkası açıkken oyun yavaşlar
  else if (state === 'cinema') { updateCinema(dt); updateFx(dt); for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= q.decay * dt; } particles = particles.filter(q => q.life > 0); }
  else if (state === 'transition') { updateTransition(dt); updateFx(dt); for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= q.decay * dt; } particles = particles.filter(q => q.life > 0); }
  else if (state === 'clear') { time += dt; updateFx(dt); }
  else if (state === 'map') { time += dt; if (mapV && mapV.fresh > 0) mapV.fresh = Math.max(0, mapV.fresh - dt); if (mapV && mapV.swim && mapV.swim.t < 1) { mapV.swim.t += dt / 1.6; if (mapV.swim.t >= 1) { show($('mapGo'), true); Sound.tone(880, 0.15, 'triangle', 0.06, 200, 0, true); } } }
  else if (state === 'over') {
    time += dt;
    for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= q.decay * dt; }
    particles = particles.filter(q => q.life > 0);
    player.vx = 0; player.vy = 40 * S; player.y = Math.min(player.y + 40 * S * dt, H + 80 * S);
    updateFx(dt);
  } else if (state === 'menu') time += dt;
  const scroll = state === 'play' ? (70 + Math.min(diffD(), 900) * 0.18) * S : 20 * S;
  if (state !== 'pause' && state !== 'menu') updateAmbient(dt, scroll);
}
let edgeDue = true;
// Panel açılıp kapanınca alt şerit rengi hemen güncellensin (eskiden en geç 0,5 sn sonra güncelleniyordu; arada kum rengi görünüyordu)
try { const mo = new MutationObserver(() => { edgeDue = true; try { updateEdge(); } catch {} });
  for (const el of document.querySelectorAll('.overlay, #menu')) mo.observe(el, { attributes: true, attributeFilter: ['class'] }); } catch {}
function updateEdge() { // şerit rengi sahnenin zemin renginden hesaplanır (anlık efektler etkilemez)
  edgeDue = false;
  const open = id => !$(id).classList.contains('hidden');
  if (open('shop') || open('missions') || open('skills') || open('help')) return setEdgeColor('#06223f'); // panellerin alt rengi
  if (state === 'map' && mapV && window.OktoMap) return setEdgeColor(OktoMap.THEMES[(mapV.group % OktoCampaign.GROUPS.length) % OktoMap.THEMES.length].bot); // haritanın alt rengi
  let c;
  if (state === 'menu') c = [173, 139, 86]; // açılış sahnesinin kararmış kum rengi (ölçülmüş)
  else {
    const t = clamp(visD() / 600, 0, 1), A = [0x0b, 0x5d, 0x8f], B = [0x01, 0x0a, 0x18], env = levelEnv();
    c = env ? [1, 3, 5].map(k => parseInt(env.water[1].slice(k, k + 2), 16)) : A.map((v, i) => lerp(v, B[i], t));
    if (seabedAmt > 0.01) { const sb = tier >= 3 ? [38, 38, 63] : [184, 138, 78]; c = c.map((v, i) => lerp(v, sb[i], seabedAmt)); }
  }
  if (open('pauseMenu') || open('over') || open('clear') || open('help')) c = c.map((v, i) => v * 0.2 + [2, 12, 26][i] * 0.8); // koyu perdeyle aynı oranda
  setEdgeColor(`rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`);
}
function drawFrame() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.save();
  if (shake > 0 && (state === 'play' || state === 'transition' || state === 'cinema')) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  if (state === 'map' && mapV && window.OktoMap) OktoMap.draw(ctx, { W, H, FONT, time, top: safeTop, group: mapV.group, unlocked: mapV.unlocked, current: mapV.current, swim: mapV.swim, fresh: mapV.fresh, look: look() });
  else if (state === 'menu' && window.OktoTitle) OktoTitle.draw(ctx, W, H, time, Object.assign(look(), { top: safeTop, intro: (performance.now() - BOOT) / 750 }));
  else {
    drawBackground();
    drawWorldBack();
    const zenv = window.OktoZones && OktoZones.active() ? zoneEnv(0, 0) : null;
    if (zenv) OktoZones.drawBack(ctx, zenv);
    drawRocks();
    if (zenv) OktoZones.drawMid(ctx, zenv);
    if (boss) drawBoss();
    drawSlams();
    for (const e of entities) { try { drawEntity(e); } catch (err) { e.dead = true; reportError('nesne çizimi ' + e.type, err); try { ctx.restore(); } catch {} } }
    drawParticles();
    drawPlayer();
    if (SK) SK.drawFx(ctx, skEnv());
    drawWorldFront();
    if (zenv) { OktoZones.drawFront(ctx, zenv); OktoZones.overlay(ctx, zenv, zoneLights()); }
    drawFx();
    if (state === 'transition') drawTransition();
    if (state === 'cinema') drawCinema();
    if (SK && state === 'play') SK.drawRing(ctx, skEnv());
    if (victory) OktoCinema.drawVictory(Object.assign({ ctx, W, H, S, FONT, time }, victory));
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
  if (edgeDue) updateEdge();
}

resize();
reset();
toMenu();
if (TEST.on) { const v = $('ver'); v.textContent += ' TEST'; v.style.color = '#ffb347'; } // test adresinde olduğumuz görünsün
requestAnimationFrame(frame);

// Test/hata ayıklama için
window.__okto = {
  get state() { return state; }, get score() { return score; }, get depth() { return depth; }, set depth(v) { depth = v; },
  get mapV() { return mapV; }, openMap, mapTap, TLOG, tlogText, step: dt => stepFrame(0, dt), SK, draw: () => drawFrame(), levelInfo: n => levelInfo(n), get cine() { return cine; }, get victory() { return victory; }, TEST,
  get lives() { return lives; }, diff: () => diff(), get safeTop() { return safeTop; }, get rocks() { return rocks; }, get zoneName() { return zone; }, setZone: z => { plan = [{ type: 'open', a: 0, b: depth + 1 }, { type: z, a: depth + 1, b: depth + 200 }, { type: 'open', a: depth + 200, b: 1e6 }]; }, rockStats: () => ({ onScreen: rocks.filter(onScreen).length, all: rocks.length }), corridorNow: () => { let worst = 1e9; for (let y = 0; y < H; y += 4) worst = Math.min(worst, widestGap(blockedAt(y, rocks))); return worst; }, get plan() { return plan; }, get zone() { return zone; }, get shake() { return shake; }, set lives(v) { lives = v; }, set invuln(v) { invuln = v; }, get boss() { return boss; }, get slams() { return slams; }, get tier() { return tier; }, get levelN() { return levelN; }, get phase() { return phase; }, damageBoss, startTransition,
  Sound, TIERS, startGame, useInk, lightBomb: () => lightBomb(player.x, player.y), get entities() { return entities; }, get player() { return player; }, get target() { return target; },
  Profile, Missions, spawnGift: () => entities.push({ type: 'gift', x: player.x, y: player.y + 70 * S, r: 14 * S, t: 0, hue: 330 }), spawnGlow: () => entities.push({ type: 'glow', x: player.x, y: player.y + 80 * S, r: 15 * S, t: 0 }),
};
})();

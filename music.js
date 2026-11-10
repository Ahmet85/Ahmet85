/* OKTO müzikleri: açılış ekranı + oyun içinde 3 kademe (hepsi kodla üretilir)
   Kendi müziğini koymak için: music/acilis.mp3 (açılış) ve music/oyun.mp3 (oyun içi). Sonra aşağıdaki HAS_CUSTOM içinde true yap.
   window.OktoMusic: play('menu' | 'g1' | 'g2' | 'g3' | 'boss'), start() (= play('menu')), stop(sönüm), setMuted(bool), renderWav(sn, parça) */
(() => {
'use strict';
const CUSTOM = { menu: 'music/acilis.mp3', game: 'music/oyun.mp3' };
// Kendi dosyanı music/ klasörüne koyunca burada true yap (yoksa dosya hiç aranmaz, konsolda 404 hatası çıkmaz)
const HAS_CUSTOM = { menu: false, game: false };
const BPM = 112, EIGHTH = 60 / BPM / 2, BAR = 8, BARS = 8, STEPS = BAR * BARS;
const VOLUME = 0.55;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;

// Ezgi (sekizlikler, MIDI nota numarası; _ = sus)
const MELODY = [
  72, 76, 79, 76, 84, _, 79, _,     // Do
  81, _, 79, 76, 72, _, 74, 76,     // La minör
  77, _, 81, 77, 72, _, 77, 79,     // Fa
  79, _, 74, 79, 83, 81, 79, _,     // Sol
  72, 76, 79, 84, 83, 84, 79, _,    // Do
  76, _, 81, 79, 76, 72, 76, _,     // La minör
  77, 81, 84, 81, 77, 76, 74, 72,   // Fa (aşağı inen merdiven)
  71, 74, 79, _, 78, 79, _, _,      // Sol (muzip kromatik kayma)
];
const CHORDS = [[60, 64, 67], [57, 60, 64], [57, 60, 65], [55, 59, 62]]; // C Am F G
const ROOTS = [48, 45, 41, 43];

// ---- Enstrümanlar (her biri verilen bağlamda ve hedefte çalışır) ----
function marimba(ac, out, t, midi, vol = 0.5) {
  const f = mtof(midi);
  for (const [ratio, v, dec] of [[1, 1, 0.55], [4, 0.28, 0.09], [10, 0.08, 0.03]]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f * ratio;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(out); o.start(t); o.stop(t + dec + 0.05);
  }
}
function pluck(ac, out, t, midi, vol = 0.12) {
  const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = mtof(midi);
  f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.2);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 0.3);
}
function bass(ac, out, t, midi, len, vol = 0.32) {
  const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = mtof(midi);
  f.type = 'lowpass'; f.frequency.value = 600;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + len + 0.05);
}
function kick(ac, out, t, vol = 0.35) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.2);
}
let noiseBuf = null;
function shaker(ac, out, t, vol = 0.05) {
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.1, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6000;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + 0.1);
}
function bubble(ac, out, t, vol = 0.12) {
  for (let i = 0; i < 3; i++) {
    const tt = t + i * 0.07, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(500 + i * 180, tt); o.frequency.exponentialRampToValueAtTime(1400 + i * 300, tt + 0.08);
    g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(vol, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.1);
    o.connect(g).connect(out); o.start(tt); o.stop(tt + 0.12);
  }
}

function bell(ac, out, t, midi, vol = 0.2, dec = 1.6) { // yumuşak, uzun sönümlü çan
  const f = mtof(midi);
  for (const [ratio, v, d] of [[1, 1, dec], [2.01, 0.35, dec * 0.6], [3.98, 0.12, dec * 0.3]]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f * ratio;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
  }
}
function pad(ac, out, t, notes, len, vol = 0.05) { // arka planda süren yumuşak akor
  for (const n of notes) for (const det of [-4, 4]) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = mtof(n); o.detune.value = det;
    f.type = 'lowpass'; f.frequency.value = 1200;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + len * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len);
    o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + len + 0.05);
  }
}
function sonar(ac, out, t, vol = 0.12) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(1180, t); o.frequency.exponentialRampToValueAtTime(1100, t + 1.2);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  o.connect(g).connect(out); o.start(t); o.stop(t + 1.5);
}

// ---- Oyun içi parçalar (8 ölçü, sekizlikler) ----
const G1 = { // Güneşli Sular: neşeli marimba arpeji, Fa majör (F Dm Bb C)
  chords: [[65, 69, 72], [62, 65, 69], [58, 62, 65], [60, 64, 67]], roots: [41, 38, 46, 48],
  motif: [77, _, 79, 81, _, 79, 77, 74],
};
const G2 = { chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]], roots: [45, 41, 48, 43] }; // Am F C G
const G3 = { scale: [62, 65, 67, 69, 72, 74, 77], roots: [38, 38, 34, 36] }; // Re minör pentatonik
function scheduleG1(ac, out, step, t, E) {
  const i = step % 64, bar = Math.floor(i / 8), pos = i % 8, ch = bar % 4, C = G1.chords[ch];
  if (pos % 2 === 0) marimba(ac, out, t, C[(pos / 2) % 3] + (pos === 6 ? 12 : 0), 0.3);
  if (bar % 2 === 1 && G1.motif[pos]) marimba(ac, out, t, G1.motif[pos] - (bar % 4 === 3 ? 2 : 0), 0.26);
  if (pos === 0 || pos === 4) bass(ac, out, t, G1.roots[ch], E * 1.5, 0.26);
  if (pos === 0) kick(ac, out, t, 0.14);
  if (pos % 2 === 1) shaker(ac, out, t, 0.022);
  if (bar === 7 && pos === 5) bubble(ac, out, t, 0.08);
}
function scheduleG2(ac, out, step, t, E) {
  const i = step % 64, bar = Math.floor(i / 8), pos = i % 8, ch = bar % 4, C = G2.chords[ch];
  if (pos === 0) { pad(ac, out, t, C, E * 8, 0.035); bass(ac, out, t, G2.roots[ch], E * 3, 0.24); }
  if (pos === 0 || pos === 3 || pos === 6) bell(ac, out, t, C[[0, 2, 1][pos / 3 | 0]] + 12, 0.11, 1.4);
  if (bar % 2 === 1 && pos === 4) bell(ac, out, t, C[2] + 19, 0.07, 2);
  if (pos === 4) kick(ac, out, t, 0.08);
}
function scheduleG3(ac, out, step, t, E) {
  const i = step % 64, bar = Math.floor(i / 8), pos = i % 8, sc = G3.scale;
  if (pos === 0) { bass(ac, out, t, G3.roots[bar % 4], E * 7, 0.3); pad(ac, out, t, [50, 57], E * 8, 0.03); }
  if (pos === 0 && bar % 2 === 0) sonar(ac, out, t + E * 2, 0.08);
  const k = (i * 7 + bar * 3) % 11; // seyrek, tekrar etmeyen çan ezgisi
  if ((pos === 3 || pos === 6) && k < 6) bell(ac, out, t, sc[k] + (k % 2 ? 0 : 12), 0.08, 2.2);
  if (pos === 4 && bar % 2 === 1) bubble(ac, out, t, 0.05);
}
const GB = { roots: [40, 40, 36, 38], ost: [52, 55, 59, 55, 52, 55, 60, 59] }; // Mi minör: büyük canavar savaşı
function scheduleBoss(ac, out, step, t, E) { // büyük canavar: davul + ısrarcı bas + gerilimli çanlar
  const i = step % 64, bar = Math.floor(i / 8), pos = i % 8, rt = GB.roots[bar % 4];
  if (pos % 2 === 0) bass(ac, out, t, rt + (pos === 6 ? 7 : 0), E * 1.6, 0.3);
  if (pos === 0 || pos === 3 || pos === 6) kick(ac, out, t, pos === 0 ? 0.2 : 0.12);
  if (pos % 2 === 1) shaker(ac, out, t, 0.028);
  if (bar % 2 === 1) marimba(ac, out, t, GB.ost[pos] + (bar % 4 === 3 ? -4 : 0), 0.16);
  if (pos === 0 && bar % 4 === 0) pad(ac, out, t, [rt + 24, rt + 27, rt + 31], E * 16, 0.035);
  if (pos === 4 && bar % 2 === 0) bell(ac, out, t, rt + 36, 0.07, 1.2);
}
const TRACKS = {
  menu: { bpm: 112, vol: 0.55, echo: 0.28, schedule: (ac, out, s, t) => scheduleStep(ac, out, s, t) },
  g1: { bpm: 100, vol: 0.4, echo: 0.25, schedule: scheduleG1 },
  g2: { bpm: 84, vol: 0.42, echo: 0.4, schedule: scheduleG2 },
  g3: { bpm: 70, vol: 0.45, echo: 0.5, schedule: scheduleG3 },
  boss: { bpm: 128, vol: 0.42, echo: 0.3, schedule: scheduleBoss },
};
const eighthOf = T => 60 / T.bpm / 2;

// Ana çıkış zinciri: hafif yankı (sualtı hissi) + yumuşak filtre
function buildBus(ac, dest, T = TRACKS.menu) {
  const master = ac.createGain(); master.gain.value = T.vol;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
  const delay = ac.createDelay(1); delay.delayTime.value = Math.min(0.95, eighthOf(T) * 1.5);
  const fb = ac.createGain(); fb.gain.value = T.echo;
  const wet = ac.createGain(); wet.gain.value = 0.22;
  master.connect(lp); lp.connect(dest);
  master.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(dest);
  return master;
}

// Bir adımı (sekizlik) planla
function scheduleStep(ac, out, step, t) {
  const i = step % STEPS, bar = Math.floor(i / BAR), pos = i % BAR, ch = bar % 4;
  const m = MELODY[i];
  if (m) marimba(ac, out, t, m, pos % 2 ? 0.38 : 0.48);
  if (pos % 2 === 1) for (const n of CHORDS[ch]) pluck(ac, out, t, n, 0.07);
  if (pos === 0 || pos === 4) bass(ac, out, t, ROOTS[ch], EIGHTH * 1.6);
  if (pos === 2 || pos === 6) bass(ac, out, t, ROOTS[ch] + 7, EIGHTH * 0.9, 0.22);
  if (pos === 7 && bar % 2 === 1) bass(ac, out, t, ROOTS[ch] + 12, EIGHTH * 0.8, 0.18);
  if (pos === 0 || pos === 4) kick(ac, out, t, 0.22);
  shaker(ac, out, t, pos % 2 ? 0.045 : 0.025);
  if ((bar === 3 || bar === 7) && pos === 6) bubble(ac, out, t);
}

// ---- Canlı çalma ----
let ac = null, bus = null, timer = null, nextStep = 0, nextTime = 0, playing = false, muted = false;
let cur = null, T = TRACKS.menu, customAudio = null;
const custom = {}; // { menu|game: { checked, ok, audio } }

function ensureCtx() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    // iPhone sessiz modundayken de müziğin duyulması için (destekleyen iOS sürümlerinde)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    bus = ac.createGain(); bus.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
}
async function checkCustom(key) {
  const c = custom[key] || (custom[key] = { checked: false, ok: false, audio: null });
  if (!c.checked) {
    c.checked = true;
    if (HAS_CUSTOM[key]) { try { const r = await fetch(CUSTOM[key], { method: 'HEAD' }); c.ok = r.ok; } catch { c.ok = false; } }
    if (c.ok) { c.audio = new Audio(CUSTOM[key]); c.audio.loop = true; c.audio.volume = 0.7; }
  }
  return c.ok ? c.audio : null;
}
function tick() {
  if (!runOut || ac.state !== 'running') return;
  // geride kaldıysak (sayaç yavaşladıysa) kaçan notaları üst üste çalma, ritmi şimdiden yeniden başlat
  if (nextTime < ac.currentTime - 0.05) nextTime = ac.currentTime + 0.05;
  const E = eighthOf(T);
  while (nextTime < ac.currentTime + 0.25) { T.schedule(ac, runOut, nextStep, nextTime, E); nextStep++; nextTime += E; }
}
// Her çalışta YENİ bir çıkış hattı kurulur. Durdurunca eski hat kısılıp kopartılır:
// böylece sıraya konmuş eski notalar yeni müzikle asla üst üste binmez (parça geçişleri de yumuşak olur).
let runOut = null;
async function play(name = 'menu') {
  if (playing && cur === name) return;
  if (playing) stop(0.8);
  playing = true; cur = name; T = TRACKS[name] || TRACKS.menu;
  ensureCtx();
  bus.gain.cancelScheduledValues(ac.currentTime);
  bus.gain.setValueAtTime(muted ? 0 : 1, ac.currentTime);
  const audio = await checkCustom(name === 'menu' ? 'menu' : 'game');
  if (!playing || cur !== name) return;
  if (audio) {
    customAudio = audio; audio.muted = muted; audio.currentTime = 0; audio.volume = 0.7;
    audio.play().catch(() => {});
    return;
  }
  runOut = buildBus(ac, bus, T);
  nextStep = 0; nextTime = ac.currentTime + 0.08;
  clearInterval(timer); tick(); timer = setInterval(tick, 50);
}
const start = () => play('menu');
function stop(fade = 0.6) {
  if (!playing) return;
  playing = false; cur = null;
  clearInterval(timer); timer = null;
  if (customAudio) {
    const a = customAudio, v0 = a.volume, t0 = performance.now(); customAudio = null;
    if (fade <= 0.1 || document.hidden) a.pause();
    else { const f = () => { const k = Math.min(1, (performance.now() - t0) / (fade * 1000)); a.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(f); else a.pause(); }; f(); }
  }
  const old = runOut; runOut = null;
  if (ac && old) {
    const now = ac.currentTime;
    old.gain.cancelScheduledValues(now); old.gain.setValueAtTime(old.gain.value, now); old.gain.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => { try { old.disconnect(); } catch {} }, (fade + 0.3) * 1000);
  }
}
function setMuted(m) {
  muted = m;
  for (const k in custom) if (custom[k].audio) custom[k].audio.muted = m;
  if (ac && playing) { const now = ac.currentTime; bus.gain.cancelScheduledValues(now); bus.gain.setTargetAtTime(m ? 0 : 1, now, 0.05); }
}

// ---- Çevrimdışı kayıt (önizleme dosyası üretmek için) ----
async function renderWav(seconds = STEPS * EIGHTH * 2, name = 'menu') {
  const TT = TRACKS[name] || TRACKS.menu, E = eighthOf(TT);
  const sr = 44100, oc = new OfflineAudioContext(2, Math.ceil(sr * (seconds + 1)), sr);
  const out = buildBus(oc, oc.destination, TT);
  for (let s = 0, t = 0.05; t < seconds; s++, t += E) TT.schedule(oc, out, s, t, E);
  const buf = await oc.startRendering();
  const n = buf.length, data = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, str) => [...str].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true);
  w(36, 'data'); data.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) { data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  return new Uint8Array(data.buffer);
}

window.OktoMusic = { play, start, stop, setMuted, renderWav, get playing() { return playing; }, get current() { return cur; }, LOOP_SECONDS: STEPS * EIGHTH };
})();

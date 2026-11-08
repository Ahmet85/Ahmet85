/* OKTO — açılış müziği
   Önce music/acilis.mp3 dosyası aranır; varsa o çalınır (kendi müziğini koymak için
   dosyayı bu adla music/ klasörüne koyman yeterli). Yoksa aşağıdaki kodla üretilmiş
   geçici müzik çalar: neşeli, muzip bir sualtı marimba ezgisi (112 BPM, 8 ölçü döngü).
   window.OktoMusic: start(), stop(), setMuted(bool), renderWav(saniye) */
(() => {
'use strict';
const CUSTOM_TRACK = 'music/acilis.mp3';
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

// Ana çıkış zinciri: hafif yankı (sualtı hissi) + yumuşak filtre
function buildBus(ac, dest) {
  const master = ac.createGain(); master.gain.value = VOLUME;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
  const delay = ac.createDelay(1); delay.delayTime.value = EIGHTH * 1.5;
  const fb = ac.createGain(); fb.gain.value = 0.28;
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
let customAudio = null, customChecked = false, customOk = false;

function ensureCtx() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    // iPhone sessiz modundayken de müziğin duyulması için (destekleyen iOS sürümlerinde)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    bus = ac.createGain(); bus.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
}
async function checkCustom() {
  if (customChecked) return customOk;
  customChecked = true;
  try { const r = await fetch(CUSTOM_TRACK, { method: 'HEAD' }); customOk = r.ok; } catch { customOk = false; }
  if (customOk) { customAudio = new Audio(CUSTOM_TRACK); customAudio.loop = true; customAudio.volume = 0.7; }
  return customOk;
}
function tick() {
  while (nextTime < ac.currentTime + 0.25) { scheduleStep(ac, synthOut, nextStep, nextTime); nextStep++; nextTime += EIGHTH; }
}
let synthOut = null;
async function start() {
  if (playing) return;
  playing = true;
  ensureCtx();
  bus.gain.cancelScheduledValues(ac.currentTime);
  bus.gain.setValueAtTime(muted ? 0 : 1, ac.currentTime);
  if (await checkCustom()) {
    if (!playing) return;
    customAudio.muted = muted; customAudio.currentTime = 0; customAudio.volume = 0.7;
    customAudio.play().catch(() => {});
    return;
  }
  if (!playing) return;
  if (!synthOut) synthOut = buildBus(ac, bus);
  nextStep = 0; nextTime = ac.currentTime + 0.08;
  tick(); timer = setInterval(tick, 50);
}
function stop(fade = 0.6) {
  if (!playing) return;
  playing = false;
  if (customAudio) {
    const a = customAudio, v0 = a.volume, t0 = performance.now();
    const f = () => { const k = Math.min(1, (performance.now() - t0) / (fade * 1000)); a.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(f); else a.pause(); };
    f();
  }
  if (ac) {
    clearInterval(timer); timer = null;
    const now = ac.currentTime;
    bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(bus.gain.value, now); bus.gain.linearRampToValueAtTime(0, now + fade);
  }
}
function setMuted(m) {
  muted = m;
  if (customAudio) customAudio.muted = m;
  if (ac && playing) { const now = ac.currentTime; bus.gain.cancelScheduledValues(now); bus.gain.setTargetAtTime(m ? 0 : 1, now, 0.05); }
}

// ---- Çevrimdışı kayıt (önizleme dosyası üretmek için) ----
async function renderWav(seconds = STEPS * EIGHTH * 2) {
  const sr = 44100, oc = new OfflineAudioContext(2, Math.ceil(sr * (seconds + 1)), sr);
  const out = buildBus(oc, oc.destination);
  for (let s = 0, t = 0.05; t < seconds; s++, t += EIGHTH) scheduleStep(oc, out, s, t);
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

window.OktoMusic = { start, stop, setMuted, renderWav, get playing() { return playing; }, LOOP_SECONDS: STEPS * EIGHTH };
})();

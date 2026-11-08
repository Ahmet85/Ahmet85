// Yumuşak sesler (WebAudio ile üretilir; ses dosyası gerekmez). İleride
// assets/sounds altındaki kayıtlar bunların yerini alabilir. iPhone'da sessiz
// moddayken WebAudio çalmaz (tarif: "telefon sessizdeyken çalmaz").
import type { AlarmPrefs } from '../../domain/types';
import { minutesOfDay } from '../../domain/time';
import { currentAppearance } from '../appearance';

let ctx: AudioContext | null = null;
const audio = () => {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

/** Kullanıcı ilk dokunduğunda ses motorunu hazırla (iOS bunu ister). */
export function unlockAudio() {
  const once = () => {
    audio();
    window.removeEventListener('pointerdown', once);
  };
  window.addEventListener('pointerdown', once);
}

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Küçük çan: temel ton + parlak üst harmonikler, uzun sönüm */
function bell(v: number) {
  [0, 0.42].forEach((d) => {
    tone(880, d, 1.6, 0.35 * v);
    tone(880 * 2.76, d, 0.9, 0.12 * v);
    tone(880 * 5.4, d, 0.4, 0.05 * v);
  });
}

/** Marimba: kısa, tahtamsı üç nota */
function marimba(v: number) {
  [523.25, 659.25, 783.99].forEach((f, i) => {
    tone(f, i * 0.16, 0.45, 0.4 * v);
    tone(f * 4, i * 0.16, 0.12, 0.08 * v, 'triangle');
  });
}

export function inQuietHours(p: AlarmPrefs, nowMin: number) {
  if (!p.quietFrom || !p.quietTo) return false;
  const a = minutesOfDay(p.quietFrom);
  const b = minutesOfDay(p.quietTo);
  return a <= b ? nowMin >= a && nowMin < b : nowMin >= a || nowMin < b;
}

export function playAlarm(p: AlarmPrefs, nowMin: number) {
  if (inQuietHours(p, nowMin)) return;
  if (p.sound === 'bell') bell(p.volume);
  if (p.sound === 'marimba') marimba(p.volume);
  if (p.vibrate) navigator.vibrate?.([120, 80, 120]);
}

/** Kısa, neşeli başarı sesi (kart mühürlenince) */
export function playSuccess(p: AlarmPrefs, big = false) {
  if (p.sound === 'silent') return;
  const v = p.volume * 0.7;
  const notes = big ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 987.77];
  notes.forEach((f, i) => tone(f, i * 0.09, big ? 0.7 : 0.35, 0.3 * v));
  navigator.vibrate?.(big ? [30, 40, 30] : 18);
}

// ---- Arayüz geçiş sesleri (abartısız; ayarlardan kapatılabilir) ----

/** Kâğıt çevirme: kısa, yumuşatılmış hışırtı */
function paper(v: number) {
  const a = audio();
  if (!a) return;
  const len = 0.16;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  f.Q.value = 0.7;
  const g = a.createGain();
  g.gain.value = 0.18 * v;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

/** Ahşap tık: çok kısa, sıcak bir vuruş */
function wood(v: number) {
  tone(1150, 0, 0.06, 0.22 * v, 'triangle');
  tone(620, 0, 0.09, 0.16 * v);
}

export function uiSound(kind: 'paper' | 'tick') {
  const a = currentAppearance;
  if (!a.uiSound) return;
  if (kind === 'paper') paper(a.uiVolume);
  else wood(a.uiVolume);
}

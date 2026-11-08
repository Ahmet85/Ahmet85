// Yumuşak sesler (WebAudio ile üretilir; ses dosyası gerekmez). İleride
// assets/sounds altındaki kayıtlar bunların yerini alabilir. iPhone'da sessiz
// moddayken WebAudio çalmaz (tarif: "telefon sessizdeyken çalmaz").
import type { AlarmPrefs } from '../../domain/types';
import { minutesOfDay } from '../../domain/time';

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

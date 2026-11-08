// Samimi, emir vermeyen bildirim metinleri (tarif bölüm 14). Aynı hatırlatma
// her seferinde farklı ama tutarlı bir cümle alır.
import type { FireTime } from '../../domain/reminders';

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

export function alarmMessage(t: (k: string, v?: Record<string, string | number>) => string, f: Pick<FireTime, 'title' | 'date' | 'reminderId'>, offsetMin: number) {
  const group = offsetMin === 0 ? 'now' : offsetMin >= 1440 ? 'dayBefore' : 'soon';
  const count = group === 'now' ? 4 : group === 'soon' ? 3 : 2;
  const i = Math.abs(hash(f.reminderId + f.date)) % count;
  return t(`alarm.msg.${group}.${i}`, { title: f.title, min: offsetMin });
}

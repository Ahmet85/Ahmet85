// Seri ve geri dönüş (tarif bölüm 1 ve 11): seri bozulunca ceza hissi yok;
// aradan sonra geri dönüş kutlanır. "Aktif gün": en az bir şey tamamlandı.
import { buildRange, isActive, isDone, type AgendaSource } from './agenda';
import { addDays } from './time';
import type { PlainDateStr } from './types';

export interface StreakInfo {
  /** Bugüne (bugün henüz bir şey yoksa düne) kadar art arda aktif gün sayısı */
  streak: number;
  /** Bugün aktif ve öncesinde en az 2 gün ara verilmişti */
  comeback: boolean;
  todayActive: boolean;
  /** Bugünkü tamamlanabilir her şey bitti mi (atlanan/iptal/ertelenen hariç) */
  dayComplete: boolean;
}

export function streakInfo(src: AgendaSource, today: PlainDateStr, lookback = 60): StreakInfo {
  const from = addDays(today, -lookback);
  const range = buildRange(src, from, today);
  const active = (d: PlainDateStr) => (range.get(d) ?? []).some((i) => !i.continues && isDone(i.status));
  const todayActive = active(today);
  let streak = 0;
  for (let d = todayActive ? today : addDays(today, -1); d >= from && active(d); d = addDays(d, -1)) streak++;
  let gap = 0;
  if (todayActive) for (let d = addDays(today, -1); d >= from && !active(d); d = addDays(d, -1)) gap++;
  const todays = (range.get(today) ?? []).filter((i) => !i.continues && i.kind !== 'task' && isActive(i.status));
  return {
    streak,
    comeback: todayActive && gap >= 2 && gap < lookback,
    todayActive,
    dayComplete: todays.length > 0 && todays.every((i) => isDone(i.status)),
  };
}

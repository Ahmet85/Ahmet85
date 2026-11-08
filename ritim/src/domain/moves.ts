// Taşıma ve "sonraki tüm tekrarlar" kuralları (tarif bölüm 7 ve 12).
// Tekrarlayan bloklarda varsayılan: yalnızca o tarih değişir (istisna kaydı).
// "Sonraki tüm tekrarlar" seçilirse seri o tarihten ikiye bölünür: geçmiş
// aynen kalır (karne bozulmaz), yeni seri yeni saat/günle devam eder.
import type { RecurrenceRule, Weekday } from './types';
import { addDays } from './time';

export type Scope = 'one' | 'future';

/** Hafta günlerini delta gün kaydırır (Pzt +1 → Sal, Paz +1 → Pzt). */
export const shiftWeekday = (w: Weekday, delta: number) => ((((w - 1 + delta) % 7) + 7) % 7 + 1) as Weekday;

/**
 * Seriyi fromDate'ten böler. old: fromDate'ten önceki kısım (hiç oluşumu
 * kalmıyorsa null); next: fromDate+delta'dan başlayan yeni kural.
 */
export function splitRule(rule: RecurrenceRule, fromDate: string, delta = 0): { old: RecurrenceRule | null; next: RecurrenceRule } {
  const oldEnd = addDays(fromDate, -1);
  const old = oldEnd < rule.startDate ? null : { ...rule, endDate: rule.endDate && rule.endDate < oldEnd ? rule.endDate : oldEnd };
  const next: RecurrenceRule = {
    ...rule,
    startDate: addDays(fromDate < rule.startDate ? rule.startDate : fromDate, delta),
    endDate: rule.endDate ? addDays(rule.endDate, delta) : undefined,
    byWeekday: rule.byWeekday?.map((w) => shiftWeekday(w, delta)),
  };
  if (!next.endDate) delete next.endDate;
  if (!next.byWeekday) delete next.byWeekday;
  return { old, next };
}

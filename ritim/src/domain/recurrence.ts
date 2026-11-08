// Tekrar kuralları ve oluşum (occurrence) üretimi.
import type {
  OccurrenceInstance,
  OccurrenceRecord,
  PlainDateStr,
  RecurrenceRule,
  Routine,
} from './types';
import { addDays, daysBetween, localEnd, startOfWeek, weekdayOf } from './time';

/** Kural bu tarihte bir oluşum üretiyor mu? */
export function occursOn(rule: RecurrenceRule, date: PlainDateStr): boolean {
  if (date < rule.startDate) return false;
  if (rule.endDate && date > rule.endDate) return false;
  const interval = Math.max(1, rule.interval || 1);

  if (rule.freq === 'daily') {
    return daysBetween(rule.startDate, date) % interval === 0;
  }
  // weekly
  const days = rule.byWeekday?.length ? rule.byWeekday : [weekdayOf(rule.startDate)];
  if (!days.includes(weekdayOf(date))) return false;
  if (interval === 1) return true;
  // Hafta sayımı başlangıç tarihinin haftasından (Pazartesi bazlı) yapılır.
  const weeks = daysBetween(startOfWeek(rule.startDate, 1), startOfWeek(date, 1)) / 7;
  return weeks % interval === 0;
}

export const occurrenceId = (routineId: string, originalDate: PlainDateStr) =>
  `${routineId}@${originalDate}`;

function instance(
  r: Routine,
  originalDate: PlainDateStr,
  rec: OccurrenceRecord | undefined,
): OccurrenceInstance {
  const date = rec?.date ?? originalDate;
  const startTime = rec?.startTime ?? r.startTime;
  const durationMin = rec?.durationMin ?? r.durationMin;
  const end = localEnd(date, startTime, durationMin);
  return {
    routineId: r.id,
    originalDate,
    date,
    startTime,
    durationMin,
    endDate: end.date,
    endTime: end.time,
    status: rec?.status ?? 'planned',
    moved: !!rec && (rec.date !== undefined || rec.startTime !== undefined),
    record: rec,
  };
}

/**
 * [from, to] aralığında (iki uç dahil) BAŞLAYAN tüm oluşumlar.
 * - Kuralın ürettiği tarihler + istisna kayıtları birleştirilir.
 * - Başka tarihe taşınan oluşum yeni tarihinde görünür, eski tarihinde görünmez.
 * - Şablon hiç değişmez.
 */
export function expandRange(
  routines: Routine[],
  records: OccurrenceRecord[],
  from: PlainDateStr,
  to: PlainDateStr,
): OccurrenceInstance[] {
  const recMap = new Map(records.map((r) => [occurrenceId(r.routineId, r.originalDate), r]));
  const byId = new Map(routines.map((r) => [r.id, r]));
  const out: OccurrenceInstance[] = [];
  const seen = new Set<string>();

  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const r of routines) {
      if (!occursOn(r.recurrence, d)) continue;
      const key = occurrenceId(r.id, d);
      const inst = instance(r, d, recMap.get(key));
      seen.add(key);
      if (inst.date >= from && inst.date <= to) out.push(inst);
    }
  }
  // Aralık dışından bu aralığa taşınmış olanlar
  for (const rec of records) {
    const key = occurrenceId(rec.routineId, rec.originalDate);
    if (seen.has(key) || !rec.date) continue;
    const r = byId.get(rec.routineId);
    if (!r || !occursOn(r.recurrence, rec.originalDate)) continue;
    if (rec.date >= from && rec.date <= to) out.push(instance(r, rec.originalDate, rec));
  }
  return out.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
}

/**
 * Bir günün ekranı için: o gün başlayanlar + önceki gün başlayıp bu güne
 * taşanlar (gece yarısını aşan bloklar, ör. 22:00–06:00 vardiya).
 */
export function occurrencesForDay(
  routines: Routine[],
  records: OccurrenceRecord[],
  date: PlainDateStr,
): { instance: OccurrenceInstance; continuesFromPrevDay: boolean }[] {
  const prev = addDays(date, -1);
  return expandRange(routines, records, prev, date)
    .filter(
      (o) =>
        o.date === date ||
        (o.date === prev && (o.endDate > date || (o.endDate === date && o.endTime > '00:00'))),
    )
    .map((o) => ({ instance: o, continuesFromPrevDay: o.date !== date }));
}

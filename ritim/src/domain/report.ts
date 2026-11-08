// Haftalık karne ve koçluk (tarif bölüm 11). Cihazdaki basit kurallarla,
// gözleme dayalı ve dayanağı gösterilen öneriler. Bilinçli plan değişikliği
// başarısızlık sayılmaz; yeterli veri yoksa kesin yorum yapılmaz.
import { buildRange, isDone, type AgendaItem, type AgendaSource } from './agenda';
import { freeStarts } from './conflicts';
import { addDays, clock, toDayNumber, weekdayOf } from './time';
import type { PlainDateStr, Weekday } from './types';

export type Outcome = 'done' | 'done_short' | 'postponed' | 'skipped' | 'conscious' | 'unmarked' | 'upcoming';

/** Bir öğenin karnedeki sonucu */
export function outcomeOf(i: AgendaItem, today: PlainDateStr, nowMin: number): Outcome | null {
  if (i.status === 'cancelled') return null;
  if (i.status === 'done') return 'done';
  if (i.status === 'done_short') return 'done_short';
  if (i.conscious && (i.status === 'skipped' || i.movedFromDate)) return 'conscious';
  if (i.status === 'postponed') return 'postponed';
  if (i.status === 'skipped') return 'skipped';
  if (i.date > today || (i.date === today && i.endMin > nowMin)) return 'upcoming';
  return 'unmarked';
}

const plannedMin = (i: AgendaItem) => Math.max(0, i.endMin - i.startMin);
const actualOf = (i: AgendaItem) =>
  i.status === 'done' ? (i.actualMin ?? plannedMin(i)) : i.status === 'done_short' ? (i.actualMin ?? i.plannedShort?.durationMin ?? plannedMin(i)) : 0;

export interface CategoryStat {
  categoryId: string | null;
  plannedMin: number;
  actualMin: number;
  done: number;
  total: number;
}

export interface Suggestion {
  kind: 'notEnoughData' | 'oftenPostponed' | 'usuallyShort' | 'strongCategory' | 'heavyWeek' | 'comebackKind';
  params: Record<string, string | number>;
  /** "Bu öneriyi dene": bir sonraki oluşumu yalnızca o tarih için taşı */
  tryMove?: { routineId: string; originalDate: PlainDateStr; date: PlainDateStr; startTime: string };
}

export interface WeeklyReport {
  days: PlainDateStr[];
  counts: Record<Outcome, number>;
  /** Tamamlama oranı: bilinçli değişiklikler ve henüz gelmeyenler hariç */
  ratio: number | null;
  done: number;
  denominator: number;
  plannedMin: number;
  actualMin: number;
  categories: CategoryStat[];
  bestDay: { date: PlainDateStr; actualMin: number; done: number; total: number } | null;
  oftenPostponed: { routineId: string; title: string; count: number; weekday?: Weekday; startTime: string }[];
  enoughData: boolean;
  suggestions: Suggestion[];
}

const EMPTY_COUNTS = (): Record<Outcome, number> => ({ done: 0, done_short: 0, postponed: 0, skipped: 0, conscious: 0, unmarked: 0, upcoming: 0 });
const BAD: Outcome[] = ['postponed', 'skipped', 'unmarked'];

/** Kullanıcının en az kaç gündür işaretleme yaptığına bakarak veri yeterli mi? */
function dataSpanDays(src: AgendaSource, today: PlainDateStr) {
  const dates = src.records.filter((r) => r.status && r.status !== 'planned').map((r) => r.originalDate);
  dates.push(...src.events.filter((e) => e.status !== 'planned').map((e) => e.startDate));
  if (!dates.length) return 0;
  const first = dates.reduce((a, b) => (a < b ? a : b));
  return toDayNumber(today) - toDayNumber(first);
}

export function weeklyReport(src: AgendaSource, weekStartDate: PlainDateStr, today: PlainDateStr, nowMin: number): WeeklyReport {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const range = buildRange(src, days[0], days[6]);
  const counts = EMPTY_COUNTS();
  const cats = new Map<string | null, CategoryStat>();
  const perDay = new Map<PlainDateStr, { actualMin: number; done: number; total: number }>();
  let planned = 0;
  let actual = 0;

  for (const d of days) {
    for (const i of range.get(d)!) {
      if (i.continues || i.kind === 'task') continue;
      const o = outcomeOf(i, today, nowMin);
      if (!o) continue;
      counts[o]++;
      if (o === 'upcoming' || o === 'conscious') continue;
      // Korunan zamanlar (uyku, aile, dinlenme) "çalışma süresi" sayılmaz
      const timed = !i.flex?.protected;
      const c = cats.get(i.categoryId ?? null) ?? { categoryId: i.categoryId ?? null, plannedMin: 0, actualMin: 0, done: 0, total: 0 };
      const a = timed ? actualOf(i) : 0;
      if (timed) c.plannedMin += plannedMin(i);
      c.actualMin += a;
      c.total++;
      if (isDone(i.status)) c.done++;
      cats.set(c.categoryId, c);
      if (timed) planned += plannedMin(i);
      actual += a;
      const pd = perDay.get(d) ?? { actualMin: 0, done: 0, total: 0 };
      pd.actualMin += a;
      pd.total++;
      if (isDone(i.status)) pd.done++;
      perDay.set(d, pd);
    }
  }
  const done = counts.done + counts.done_short;
  const denominator = done + BAD.reduce((s, k) => s + counts[k], 0);
  // En verimli gün: en çok tamamlanan (eşitlikte oran, sonra süre)
  const best = [...perDay.entries()]
    .filter(([, v]) => v.done > 0)
    .sort((a, b) => b[1].done - a[1].done || b[1].done / b[1].total - a[1].done / a[1].total || b[1].actualMin - a[1].actualMin)[0];

  // Son 3 haftada sık ertelenen / atlanan bloklar (bilinçli olanlar hariç)
  const lookFrom = addDays(days[6], -20);
  const hist = buildRange(src, lookFrom, days[6] < today ? days[6] : today);
  const per = new Map<
    string,
    { title: string; count: number; occ: number; weekdays: Map<Weekday, number>; startTime: string; short: number; full: number }
  >();
  for (const items of hist.values())
    for (const i of items) {
      if (i.kind !== 'routine' || i.continues) continue;
      const p = per.get(i.routineId!) ?? { title: i.title, count: 0, occ: 0, weekdays: new Map(), startTime: i.startTime!, short: 0, full: 0 };
      const o = outcomeOf(i, today, nowMin);
      if (o === 'upcoming') continue;
      p.occ++;
      if (o === 'postponed' || o === 'skipped' || (i.movedFromDate && !i.conscious)) {
        p.count++;
        const w = weekdayOf(i.originalDate!);
        p.weekdays.set(w, (p.weekdays.get(w) ?? 0) + 1);
      }
      if (o === 'done_short') p.short++;
      if (o === 'done') p.full++;
      per.set(i.routineId!, p);
    }
  // Gerçekten sık: en az 2 kez ve tekrarlarının en az %30'u
  const oftenPostponed = [...per.entries()]
    .filter(([, v]) => v.count >= 2 && v.count / v.occ >= 0.3)
    .sort((a, b) => b[1].count / b[1].occ - a[1].count / a[1].occ || b[1].count - a[1].count)
    .slice(0, 5)
    .map(([routineId, v]) => {
      // Ertelemeler tek bir güne yığılıyorsa o günü söyle
      const [w, n] = [...v.weekdays.entries()].sort((a, b) => b[1] - a[1])[0];
      return { routineId, title: v.title, count: v.count, weekday: n >= 2 ? w : undefined, startTime: v.startTime };
    });

  const enoughData = dataSpanDays(src, today) >= 14;
  const suggestions: Suggestion[] = [];
  if (!enoughData) suggestions.push({ kind: 'notEnoughData', params: { days: Math.max(0, 14 - dataSpanDays(src, today)) } });
  else {
    for (const op of oftenPostponed.slice(0, 2)) {
      const r = src.routines.find((x) => x.id === op.routineId);
      if (!r || !r.flex.movable) continue;
      // Bir sonraki oluşum için, önümüzdeki hafta tamamen boş bir saat
      const nextDates = Array.from({ length: 7 }, (_, k) => addDays(today, k + 1));
      const nextOcc = nextDates.find((d) => buildRange(src, d, d).get(d)!.some((i) => i.routineId === r.id && !i.continues));
      if (!nextOcc) continue;
      let alt: { date: string; start: number } | null = null;
      for (const d of nextDates) {
        if (op.weekday && weekdayOf(d) === op.weekday) continue;
        const [s] = freeStarts(src, d, r.durationMin, 14 * 60, { ignore: (i) => i.routineId === r.id, max: 1 });
        if (s !== undefined) {
          alt = { date: d, start: s };
          break;
        }
      }
      suggestions.push({
        kind: 'oftenPostponed',
        params: {
          title: op.title,
          weekday: op.weekday ?? 0,
          part: partOfDay(op.startTime),
          count: op.count,
          ...(alt ? { altWeekday: weekdayOf(alt.date), altPart: partOfDay(clock(alt.start)) } : {}),
        },
        tryMove: alt ? { routineId: r.id, originalDate: nextOcc, date: alt.date, startTime: clock(alt.start) } : undefined,
      });
    }
    for (const [, v] of per)
      if (v.short >= 3 && v.short > v.full) {
        suggestions.push({ kind: 'usuallyShort', params: { title: v.title, count: v.short } });
        break;
      }
    const ratio = denominator ? done / denominator : null;
    if (ratio !== null && ratio < 0.4 && denominator >= 5) suggestions.push({ kind: 'heavyWeek', params: {} });
  }
  const strong = [...cats.values()].filter((c) => c.categoryId && c.total >= 3).sort((a, b) => b.done / b.total - a.done / a.total)[0];
  if (strong && strong.done / strong.total >= 0.8)
    suggestions.push({ kind: 'strongCategory', params: { categoryId: strong.categoryId!, percent: Math.round((strong.done / strong.total) * 100) } });

  return {
    days,
    counts,
    ratio: denominator ? done / denominator : null,
    done,
    denominator,
    plannedMin: planned,
    actualMin: actual,
    categories: [...cats.values()].sort((a, b) => b.plannedMin - a.plannedMin),
    bestDay: best ? { date: best[0], ...best[1] } : null,
    oftenPostponed,
    enoughData,
    suggestions,
  };
}

/** Günün bölümü: sabah / öğleden sonra / akşam / gece */
export function partOfDay(time: string): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = +time.slice(0, 2);
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night';
}

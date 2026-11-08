// Çakışma yönetimi (tarif bölüm 7). Hiçbir blok sessizce silinmez veya
// kaydırılmaz: çakışmalar bulunur, yalnızca BOŞ ve uygun saatler önerilir,
// kullanıcı seçer, önizler, onaylar, sonra geri alabilir.
import { buildRange, isActive, type AgendaItem, type AgendaSource } from './agenda';
import { addDays, clock, toDayNumber } from './time';
import type { PlainDateStr } from './types';

/** Bir tarihin gece yarısına göre dakika aralığı (bitiş 1440'ı aşabilir). */
export interface Span {
  start: number;
  end: number;
}

export interface Placed {
  item: AgendaItem;
  /** Referans tarihin gece yarısına göre mutlak dakikalar */
  start: number;
  end: number;
}

export type Ignore = (i: AgendaItem) => boolean;

/** Öğelerin bir referans tarihe göre mutlak konumları (çok günlü öğeler bir kez). */
export function placedAround(src: AgendaSource, date: PlainDateStr, ignore: Ignore = () => false): Placed[] {
  const from = addDays(date, -1);
  const range = buildRange(src, from, addDays(date, 1));
  const seen = new Set<string>();
  const out: Placed[] = [];
  for (const [d, items] of range) {
    const off = (toDayNumber(d) - toDayNumber(date)) * 1440;
    for (const i of items) {
      if (seen.has(i.key)) continue;
      seen.add(i.key);
      if (i.kind === 'task' || !i.timed || !isActive(i.status) || ignore(i)) continue;
      out.push({ item: i, start: off + i.startMin, end: off + i.endMin });
    }
  }
  return out;
}

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/** Aday zaman aralığıyla çakışan bloklar ve randevular. */
export function findConflicts(src: AgendaSource, date: PlainDateStr, span: Span, ignore?: Ignore): Placed[] {
  return placedAround(src, date, ignore).filter((p) => overlaps(p, span));
}

export interface SlotOptions {
  /** Önerilerin aranacağı saat penceresi (gece önerisi yapılmaz) */
  window?: Span;
  /** Henüz kaydedilmemiş ama dolu sayılacak aralıklar (ör. yeni randevu) */
  extraBusy?: Span[];
  ignore?: Ignore;
  step?: number;
  max?: number;
}

export const DEFAULT_WINDOW: Span = { start: 6 * 60, end: 23 * 60 };

/**
 * Bir günde, verilen sürede tamamen boş başlangıç saatleri; tercih edilen
 * saate en yakın olandan başlayarak. Yeni çakışma yaratacak saat önerilmez.
 */
export function freeStarts(
  src: AgendaSource,
  date: PlainDateStr,
  durationMin: number,
  preferred: number,
  o: SlotOptions = {},
): number[] {
  const win = o.window ?? DEFAULT_WINDOW;
  const step = o.step ?? 15;
  const busy: Span[] = [...placedAround(src, date, o.ignore), ...(o.extraBusy ?? [])];
  const out: number[] = [];
  for (let s = Math.ceil(win.start / step) * step; s + durationMin <= win.end; s += step) {
    const span = { start: s, end: s + durationMin };
    if (!busy.some((b) => overlaps(b, span))) out.push(s);
  }
  // Art arda boş saatlerden yalnızca her boşluğun en iyi adayını değil, en yakın birkaçını ver
  return out.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b).slice(0, o.max ?? 3);
}

export interface DaySuggestion {
  date: PlainDateStr;
  startTime: string;
  sameTime: boolean;
}

/** Ertelemek için uygun günler: önce aynı saatin boş olduğu günler. */
export function suggestDays(
  src: AgendaSource,
  fromDate: PlainDateStr,
  durationMin: number,
  preferred: number,
  o: SlotOptions & { days?: number } = {},
): DaySuggestion[] {
  const out: DaySuggestion[] = [];
  for (let k = 1; k <= (o.days ?? 7) && out.length < (o.max ?? 3); k++) {
    const date = addDays(fromDate, k);
    const [best] = freeStarts(src, date, durationMin, preferred, { ...o, extraBusy: [], max: 1 });
    if (best !== undefined) out.push({ date, startTime: clock(best), sameTime: best === preferred });
  }
  return out;
}

/** Çakışma için kullanıcı seçimi. */
export type Resolution =
  | { action: 'move'; startTime: string } // aynı gün başka saate
  | { action: 'postpone'; date: PlainDateStr; startTime: string } // başka güne
  | { action: 'skip' } // yalnızca bugün atla
  | { action: 'keep' }; // bilerek koru

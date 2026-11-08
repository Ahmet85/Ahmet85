// Tarih/saat yardımcıları. Temporal kullanılır: yaz saati ve saat dilimi
// hesapları doğru yapılır. Bloklar yerel saat olarak saklanır; gerçek ana
// yalnızca burada, profilin saat dilimiyle çevrilir.
import { Temporal } from 'temporal-polyfill';
import type { PlainDateStr, PlainTimeStr, ProfileSettings, Weekday } from './types';

export { Temporal };

export const parseDate = (d: PlainDateStr) => Temporal.PlainDate.from(d);
export const parseTime = (t: PlainTimeStr) => Temporal.PlainTime.from(t);

export const fmtTime = (t: Temporal.PlainTime): PlainTimeStr =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

export const weekdayOf = (d: PlainDateStr): Weekday => parseDate(d).dayOfWeek as Weekday;

export const addDays = (d: PlainDateStr, n: number): PlainDateStr =>
  parseDate(d).add({ days: n }).toString();

export const daysBetween = (a: PlainDateStr, b: PlainDateStr): number =>
  parseDate(a).until(parseDate(b), { largestUnit: 'days' }).days;

/** Tarihin içinde bulunduğu haftanın ilk günü (weekStart'a göre). */
export function startOfWeek(d: PlainDateStr, weekStart: Weekday = 1): PlainDateStr {
  const date = parseDate(d);
  const diff = (date.dayOfWeek - weekStart + 7) % 7;
  return date.subtract({ days: diff }).toString();
}

/**
 * Yerel başlangıç + süre → yerel bitiş (duvar saati).
 * 22:00 + 480 dk → ertesi gün 06:00. Yaz saati gecesinde de bitiş 06:00
 * kalır (insanlar vardiyayı saat olarak düşünür); gerçek süre
 * realDurationMin ile ayrıca hesaplanır.
 */
export function localEnd(
  date: PlainDateStr,
  start: PlainTimeStr,
  durationMin: number,
): { date: PlainDateStr; time: PlainTimeStr } {
  const end = parseDate(date).toPlainDateTime(parseTime(start)).add({ minutes: durationMin });
  return { date: end.toPlainDate().toString(), time: fmtTime(end.toPlainTime()) };
}

/**
 * Yerel tarih+saati gerçek ana çevirir. Yaz saatinde var olmayan bir saat
 * (ör. 02:30, ileri alınan gece) bir sonraki geçerli saate kayar; iki kez
 * yaşanan saat (geri alınan gece) ilki seçilir. ("compatible" kuralı)
 */
export function toZoned(
  date: PlainDateStr,
  time: PlainTimeStr,
  timeZone: string,
): Temporal.ZonedDateTime {
  return parseDate(date)
    .toPlainDateTime(parseTime(time))
    .toZonedDateTime(timeZone, { disambiguation: 'compatible' });
}

/** Yerel başlangıç → yerel bitiş arasındaki gerçek geçen süre (dakika). */
export function realDurationMin(
  startDate: PlainDateStr,
  startTime: PlainTimeStr,
  endDate: PlainDateStr,
  endTime: PlainTimeStr,
  timeZone: string,
): number {
  const a = toZoned(startDate, startTime, timeZone);
  const b = toZoned(endDate, endTime, timeZone);
  return Math.round(a.until(b, { largestUnit: 'minutes' }).minutes);
}

/** Şu anki yerel tarih ve saat (verilen saat diliminde). */
export function nowLocal(timeZone: string, now: Temporal.Instant = Temporal.Now.instant()) {
  const z = now.toZonedDateTimeISO(timeZone);
  return { date: z.toPlainDate().toString(), time: fmtTime(z.toPlainTime()), zoned: z };
}

export const minutesOfDay = (t: PlainTimeStr) => {
  const p = parseTime(t);
  return p.hour * 60 + p.minute;
};

/** Cihazın varsayılan bölge ayarları (tarif bölüm 3). */
export function deviceDefaults() {
  const deviceLocale = (typeof navigator !== 'undefined' && navigator.language) || 'tr-TR';
  let region = 'TR';
  try {
    region = new Intl.Locale(deviceLocale).maximize().region ?? 'TR';
  } catch {
    /* varsayılan */
  }
  const language = 'tr'; // şimdilik tek dil
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let weekStart: Weekday = 1;
  try {
    const loc = new Intl.Locale(deviceLocale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info?.firstDay) weekStart = info.firstDay as Weekday;
  } catch {
    /* eski tarayıcı: Pazartesi */
  }
  const hc = new Intl.DateTimeFormat(deviceLocale, { hour: 'numeric' }).resolvedOptions().hourCycle;
  const hourCycle: 'h23' | 'h12' = hc === 'h11' || hc === 'h12' ? 'h12' : 'h23';
  return { language, region, timeZone, weekStart, hourCycle } satisfies ProfileSettings;
}

/** Biçimlendirme için BCP-47 dil etiketi, ör. "tr-TR". */
export const formatLocale = (s: { language: string; region: string }) => `${s.language}-${s.region}`;

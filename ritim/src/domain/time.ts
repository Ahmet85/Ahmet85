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

// ---- Hızlı takvim hesabı ----
// Takvim tarihleri (saat dilimsiz) için tam sayı "gün numarası" kullanılır.
// Temporal'den çok daha hızlıdır; Yıl görünümü 365 günü bir anda hesaplar.
// Algoritma: H. Hinnant, "days_from_civil" / "civil_from_days".
export function toDayNumber(d: PlainDateStr): number {
  let y = +d.slice(0, 4);
  const m = +d.slice(5, 7);
  const day = +d.slice(8, 10);
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromDayNumber(z: number): PlainDateStr {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** ISO hafta günü (1 = Pazartesi). 1970-01-01 bir Perşembe'dir. */
export const weekdayOf = (d: PlainDateStr): Weekday => ((((toDayNumber(d) + 3) % 7) + 7) % 7 + 1) as Weekday;

export const addDays = (d: PlainDateStr, n: number): PlainDateStr => fromDayNumber(toDayNumber(d) + n);

export const daysBetween = (a: PlainDateStr, b: PlainDateStr): number => toDayNumber(b) - toDayNumber(a);

export const daysInMonth = (year: number, month: number) =>
  toDayNumber(month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`) -
  toDayNumber(`${year}-${String(month).padStart(2, '0')}-01`);

export const monthKey = (d: PlainDateStr) => d.slice(0, 7);

/** Ay ekle (gün, hedef ayın son gününe sıkıştırılır). */
export function addMonths(d: PlainDateStr, n: number): PlainDateStr {
  let y = +d.slice(0, 4);
  let m = +d.slice(5, 7) - 1 + n;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12 + 1;
  const day = Math.min(+d.slice(8, 10), daysInMonth(y, m));
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Tarihin içinde bulunduğu haftanın ilk günü (weekStart'a göre). */
export function startOfWeek(d: PlainDateStr, weekStart: Weekday = 1): PlainDateStr {
  return addDays(d, -((weekdayOf(d) - weekStart + 7) % 7));
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
  const total = minutesOfDay(start) + durationMin;
  const days = Math.floor(total / 1440);
  const rest = total - days * 1440;
  return { date: addDays(date, days), time: clock(rest) };
}

/** Dakika → "HH:MM" */
export const clock = (min: number): PlainTimeStr =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

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

export const minutesOfDay = (t: PlainTimeStr) => +t.slice(0, 2) * 60 + +t.slice(3, 5);

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

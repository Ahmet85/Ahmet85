// Bölge ayarlarına göre tarih ve saat gösterimi (hiçbiri tek ülkeye sabit değil).
import type { PlainDateStr, PlainTimeStr, ProfileSettings, Weekday } from '../domain/types';
import { formatLocale, parseDate, parseTime } from '../domain/time';

const utcDate = (d: PlainDateStr, t: PlainTimeStr = '12:00') => {
  const pd = parseDate(d);
  const pt = parseTime(t);
  return new Date(Date.UTC(pd.year, pd.month - 1, pd.day, pt.hour, pt.minute));
};

export function formatClock(t: PlainTimeStr, s: ProfileSettings): string {
  return new Intl.DateTimeFormat(formatLocale(s), {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: s.hourCycle,
    timeZone: 'UTC',
  }).format(utcDate('2026-01-01', t));
}

export function formatLongDate(d: PlainDateStr, s: ProfileSettings): string {
  return new Intl.DateTimeFormat(formatLocale(s), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDate(d));
}

export function formatShortDate(d: PlainDateStr, s: ProfileSettings): string {
  return new Intl.DateTimeFormat(formatLocale(s), { dateStyle: 'short', timeZone: 'UTC' }).format(utcDate(d));
}

export function weekdayName(w: Weekday, s: ProfileSettings): string {
  // 2026-01-05 bir Pazartesi
  return new Intl.DateTimeFormat(formatLocale(s), { weekday: 'long', timeZone: 'UTC' }).format(
    utcDate(`2026-01-${String(4 + w).padStart(2, '0')}`),
  );
}

export function regionName(code: string, s: ProfileSettings): string {
  try {
    return new Intl.DisplayNames([s.language], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Tarayıcının bildiği saat dilimleri (eski tarayıcıda kısa liste). */
export function timeZones(current: string): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] };
  const list = intl.supportedValuesOf?.('timeZone') ?? [
    'Europe/Istanbul', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'UTC',
  ];
  return list.includes(current) ? list : [current, ...list];
}

export const REGIONS = [
  'TR', 'DE', 'NL', 'FR', 'GB', 'US', 'CA', 'AU', 'AT', 'CH', 'BE', 'SE', 'NO', 'DK', 'IT', 'ES', 'AZ', 'SA', 'AE', 'JP',
];

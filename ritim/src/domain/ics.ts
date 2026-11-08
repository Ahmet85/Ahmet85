// Alarmlı takvim dosyası (.ics, RFC 5545). Uygulama kapalıyken güvenilir
// alarm için yedek yol: telefonun kendi takvimi alarmı çalar (tarif bölüm 14).
// Sunucu yok; dosya cihazda üretilir, kişisel veri dışarı gönderilmez.
import type { FireTime, ReminderSources } from './reminders';
import { fireTimes } from './reminders';
import type { PlainDateStr, Reminder } from './types';
import { addDays as addDaysIcs, Temporal, toZoned } from './time';
import { buildRange as buildRangeForIcs, type AgendaSource } from './agenda';

/** Metin değerlerinde özel karakterleri kaçır. */
export const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** 75 baytı aşan satırları katla (UTF-8 karakterleri bölmeden). */
export function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const utcStamp = (i: Temporal.Instant) =>
  i.toString({ smallestUnit: 'second' }).replace(/[-:]/g, '').replace(/\.\d+/, '');

export interface IcsOptions {
  from: PlainDateStr;
  to: PlainDateStr;
  timeZone: string;
  calendarName: string;
  /** Alarm metni (samimi dil, arayüz dilinde) */
  alarmText: (f: FireTime, offsetMin: number) => string;
  /** Takvim kaydının süresi (dakika); bilinmiyorsa 30 */
  durationOf?: (f: FireTime) => number;
  now?: Temporal.Instant;
}

/**
 * Hatırlatmaları alarmlı takvim kayıtlarına çevirir. Her hatırlatma, kaynağın
 * o tarihteki gerçek saatinde bir kayıt + VALARM olur (atlanan/iptal edilenler
 * dahil edilmez, taşınanlar yeni saatinde). UID sabittir: aynı kayıt yeniden
 * aktarılınca takvim uygulaması güncelleyebilir.
 */
export function buildIcs(reminders: Reminder[], src: ReminderSources, o: IcsOptions): string {
  const stamp = utcStamp(o.now ?? Temporal.Now.instant());
  const byId = new Map(reminders.map((r) => [r.id, r]));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ritim//Ritim//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(o.calendarName)}`,
  ];
  for (const f of fireTimes(reminders, src, o.from, o.to, o.timeZone)) {
    const rem = byId.get(f.reminderId)!;
    const start = toZoned(f.date, f.time, o.timeZone).toInstant();
    const end = start.add({ minutes: o.durationOf?.(f) ?? 30 });
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(`${f.reminderId}-${f.date}`).replace(/[^A-Za-z0-9@._#:-]/g, '_')}@ritim`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utcStamp(start)}`,
      `DTEND:${utcStamp(end)}`,
      `SUMMARY:${icsEscape(f.title)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(o.alarmText(f, rem.offsetMin))}`,
      `TRIGGER:${rem.offsetMin ? `-PT${rem.offsetMin}M` : 'PT0M'}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/**
 * Tüm programı (rutin oluşumları, randevular, tarihli görevler) takvim
 * kayıtları olarak dışa aktarır. Atlanan/iptal edilenler dahil edilmez;
 * tüm gün etkinlik ve saatsiz görevler gün olarak yazılır.
 */
export function buildProgramIcs(
  src: AgendaSource,
  o: { from: PlainDateStr; to: PlainDateStr; timeZone: string; calendarName: string; categoryName?: (id?: string) => string | undefined; now?: Temporal.Instant },
): string {
  const stamp = utcStamp(o.now ?? Temporal.Now.instant());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ritim//Ritim//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEscape(o.calendarName)}`];
  const dateOnly = (d: string) => d.replace(/-/g, '');
  const add = (uid: string, title: string, start: string[], end: string[], extra: string[] = []) =>
    lines.push('BEGIN:VEVENT', `UID:${uid.replace(/[^A-Za-z0-9@._#:-]/g, '_')}@ritim`, `DTSTAMP:${stamp}`, ...start, ...end, `SUMMARY:${icsEscape(title)}`, ...extra, 'END:VEVENT');
  const range = buildRangeForIcs(src, o.from, o.to);
  const seen = new Set<string>();
  for (const items of range.values())
    for (const i of items) {
      if (i.continues || seen.has(i.key) || i.status === 'skipped' || i.status === 'cancelled') continue;
      seen.add(i.key);
      const cat = o.categoryName?.(i.categoryId);
      const extra = cat ? [`CATEGORIES:${icsEscape(cat)}`] : [];
      if (i.kind !== 'task' && i.timed) {
        const st = toZoned(i.date, i.startTime!, o.timeZone).toInstant();
        const en = st.add({ minutes: i.endMin - i.startMin });
        add(`${i.key}-${i.date}`, i.title, [`DTSTART:${utcStamp(st)}`], [`DTEND:${utcStamp(en)}`], extra);
      } else if (i.kind === 'task' && i.timed) {
        const st = toZoned(i.date, i.startTime!, o.timeZone).toInstant();
        add(`${i.key}-${i.date}`, i.title, [`DTSTART:${utcStamp(st)}`], [`DTEND:${utcStamp(st.add({ minutes: 15 }))}`], extra);
      } else {
        const last = i.kind === 'event' ? (src.events.find((e) => e.id === i.eventId)?.endDate ?? i.date) : i.date;
        add(`${i.key}-${i.date}`, i.title, [`DTSTART;VALUE=DATE:${dateOnly(i.date)}`], [`DTEND;VALUE=DATE:${dateOnly(addDaysIcs(last, 1))}`], extra);
      }
    }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

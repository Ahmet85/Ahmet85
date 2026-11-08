// Hatırlatmalar. Zamanları saklanmaz, kaynağın güncel saatinden hesaplanır.
// Kaynak taşınınca hatırlatma da kendiliğinden taşınır; kaynak silinince
// bağlı hatırlatmalar da silinir (repo.ts). Kimlik hedef+ofset'ten
// türetildiği için aynı hatırlatma iki kez oluşamaz.
import type {
  DatedTask,
  EventItem,
  OccurrenceRecord,
  PlainDateStr,
  Reminder,
  ReminderTarget,
  Routine,
} from './types';
import { expandRange } from './recurrence';
import { Temporal, toZoned } from './time';

/** Saati olmayan tarihli görevler için hatırlatma bu saate göre hesaplanır. */
export const DEFAULT_TASK_TIME = '09:00';

export function targetKey(t: ReminderTarget): string {
  switch (t.kind) {
    case 'routine':
      return `routine:${t.routineId}`;
    case 'occurrence':
      return `occ:${t.routineId}@${t.originalDate}`;
    case 'event':
      return `event:${t.eventId}`;
    case 'task':
      return `task:${t.taskId}`;
  }
}

export const reminderId = (t: ReminderTarget, offsetMin: number) => `${targetKey(t)}#${offsetMin}`;

export function makeReminder(profileId: string, target: ReminderTarget, offsetMin: number): Reminder {
  return { id: reminderId(target, offsetMin), profileId, target, offsetMin };
}

export interface ReminderSources {
  routines: Routine[];
  records: OccurrenceRecord[];
  events: EventItem[];
  tasks: DatedTask[];
}

export interface FireTime {
  reminderId: string;
  at: Temporal.Instant;
  /** Hatırlatılan şeyin yerel tarih/saati */
  date: PlainDateStr;
  time: string;
  title: string;
}

const inactive = (s: string) => s === 'skipped' || s === 'cancelled' || s === 'postponed';

/** [from, to] aralığındaki kaynaklar için çalma zamanları. */
export function fireTimes(
  reminders: Reminder[],
  src: ReminderSources,
  from: PlainDateStr,
  to: PlainDateStr,
  timeZone: string,
): FireTime[] {
  const out: FireTime[] = [];
  const occs = expandRange(src.routines, src.records, from, to);
  const routineTitle = new Map(src.routines.map((r) => [r.id, r.title]));
  const push = (rem: Reminder, date: string, time: string, title: string) =>
    out.push({
      reminderId: rem.id,
      at: toZoned(date, time, timeZone).subtract({ minutes: rem.offsetMin }).toInstant(),
      date,
      time,
      title,
    });

  for (const rem of reminders) {
    const t = rem.target;
    if (t.kind === 'routine' || t.kind === 'occurrence') {
      for (const o of occs) {
        if (o.routineId !== t.routineId || inactive(o.status)) continue;
        if (t.kind === 'occurrence' && o.originalDate !== t.originalDate) continue;
        push(rem, o.date, o.startTime, routineTitle.get(o.routineId) ?? '');
      }
    } else if (t.kind === 'event') {
      const e = src.events.find((x) => x.id === t.eventId);
      if (e && !inactive(e.status) && e.startDate >= from && e.startDate <= to)
        push(rem, e.startDate, e.startTime ?? DEFAULT_TASK_TIME, e.title);
    } else {
      const k = src.tasks.find((x) => x.id === t.taskId);
      if (k && !inactive(k.status) && k.date >= from && k.date <= to)
        push(rem, k.date, k.time ?? DEFAULT_TASK_TIME, k.title);
    }
  }
  return out.sort((a, b) => Temporal.Instant.compare(a.at, b.at));
}

/** Silinen bir kaynağa bağlı (artık sahipsiz kalacak) hatırlatmalar. */
export function remindersFor(
  reminders: Reminder[],
  source: { routineId?: string; eventId?: string; taskId?: string },
): Reminder[] {
  return reminders.filter((r) => {
    const t = r.target;
    if (source.routineId && (t.kind === 'routine' || t.kind === 'occurrence'))
      return t.routineId === source.routineId;
    if (source.eventId && t.kind === 'event') return t.eventId === source.eventId;
    if (source.taskId && t.kind === 'task') return t.taskId === source.taskId;
    return false;
  });
}

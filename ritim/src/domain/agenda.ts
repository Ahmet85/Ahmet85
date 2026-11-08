// Görünümlerin ortak hesabı: bir günün tüm öğeleri (rutin oluşumları,
// etkinlikler/randevular, tarihli görevler), "şimdi ne var / sırada ne var"
// ve gün özetleri. Arayüzden bağımsızdır, test edilir.
import type {
  DatedTask,
  EventItem,
  Flexibility,
  OccurrenceRecord,
  PlainDateStr,
  Routine,
  ShortVersion,
  Status,
} from './types';
import { expandRange } from './recurrence';
import { addDays, minutesOfDay, toDayNumber } from './time';

export interface AgendaSource {
  routines: Routine[];
  records: OccurrenceRecord[];
  events: EventItem[];
  tasks: DatedTask[];
}

export interface AgendaItem {
  key: string;
  kind: 'routine' | 'event' | 'task';
  title: string;
  date: PlainDateStr; // gösterildiği gün
  startTime?: string; // asıl başlangıç (görevlerde olmayabilir)
  endTime?: string;
  /** Bu günün gece yarısına göre dakika. Önceki günden taşanlarda negatif olabilir. */
  startMin: number;
  /** Ertesi güne taşanlarda 1440'ı aşabilir. */
  endMin: number;
  timed: boolean; // saati belli mi (tüm gün etkinlik / saatsiz görev değil)
  continues: boolean; // önceki günden devam
  endsNextDay: boolean;
  categoryId?: string;
  status: Status;
  routineId?: string;
  originalDate?: PlainDateStr;
  eventId?: string;
  taskId?: string;
  projectId?: string;
  flex?: Flexibility;
  shortVersions: ShortVersion[];
  /** Bu tarih için kısa sürüm planlandıysa (ör. "Günüm değişti") */
  plannedShort?: ShortVersion;
  /** Gerçekleşen süre (dakika) */
  actualMin?: number;
  /** Bilinçli değişiklik (Günüm değişti, çakışma kararı): başarısızlık sayılmaz */
  conscious?: boolean;
  /** Başka bir güne taşındıysa asıl tarihi */
  movedFromDate?: PlainDateStr;
}

const INACTIVE: Status[] = ['skipped', 'cancelled', 'postponed'];
export const isActive = (s: Status) => !INACTIVE.includes(s);
export const isDone = (s: Status) => s === 'done' || s === 'done_short';

/** [from, to] aralığındaki her gün için öğeler (tek seferde, hızlı). */
export function buildRange(src: AgendaSource, from: PlainDateStr, to: PlainDateStr): Map<PlainDateStr, AgendaItem[]> {
  const out = new Map<PlainDateStr, AgendaItem[]>();
  for (let d = from; d <= to; d = addDays(d, 1)) out.set(d, []);
  const routine = new Map(src.routines.map((r) => [r.id, r]));
  const put = (i: AgendaItem) => out.get(i.date)?.push(i);

  // Rutinler: aralıktan bir gün önce başlayıp taşanlar da dahil
  for (const o of expandRange(src.routines, src.records, addDays(from, -1), to)) {
    const r = routine.get(o.routineId)!;
    const span = toDayNumber(o.endDate) - toDayNumber(o.date);
    const start = minutesOfDay(o.startTime);
    const end = span * 1440 + minutesOfDay(o.endTime);
    for (let k = 0; k <= span; k++) {
      const date = addDays(o.date, k);
      if (k > 0 && end - k * 1440 <= 0) break; // tam gece yarısında biten
      if (!out.has(date)) continue;
      put({
        key: `r:${o.routineId}@${o.originalDate}`,
        kind: 'routine',
        title: r.title,
        date,
        startTime: o.startTime,
        endTime: o.endTime,
        startMin: start - k * 1440,
        endMin: end - k * 1440,
        timed: true,
        continues: k > 0,
        endsNextDay: end - k * 1440 > 1440,
        categoryId: r.categoryId,
        status: o.status,
        routineId: r.id,
        originalDate: o.originalDate,
        projectId: r.projectId,
        flex: r.flex,
        shortVersions: r.shortVersions,
        plannedShort: o.record?.shortVersionId ? r.shortVersions.find((v) => v.id === o.record!.shortVersionId) : undefined,
        actualMin: o.record?.actualMin,
        conscious: o.record?.consciousChange,
        movedFromDate: o.date !== o.originalDate ? o.originalDate : undefined,
      });
    }
  }

  for (const e of src.events) {
    if (e.endDate < from || e.startDate > to) continue;
    const first = e.startDate < from ? from : e.startDate;
    const last = e.endDate > to ? to : e.endDate;
    const span = toDayNumber(e.endDate) - toDayNumber(e.startDate);
    const absStart = e.startTime ? minutesOfDay(e.startTime) : 0;
    const absEnd = span * 1440 + (e.endTime ? minutesOfDay(e.endTime) : 1440);
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const k = toDayNumber(d) - toDayNumber(e.startDate);
      put({
        key: `e:${e.id}`,
        kind: 'event',
        title: e.title,
        date: d,
        startTime: e.startTime,
        endTime: e.endTime,
        startMin: absStart - k * 1440,
        endMin: absEnd - k * 1440,
        timed: !!e.startTime,
        continues: k > 0,
        endsNextDay: absEnd - k * 1440 > 1440,
        categoryId: e.categoryId,
        status: e.status,
        eventId: e.id,
        shortVersions: [],
        actualMin: e.actualMin,
      });
    }
  }

  for (const t of src.tasks) {
    if (t.date < from || t.date > to) continue;
    const m = t.time ? minutesOfDay(t.time) : 0;
    put({
      key: `t:${t.id}`,
      kind: 'task',
      title: t.title,
      date: t.date,
      startTime: t.time,
      startMin: m,
      endMin: m,
      timed: !!t.time,
      continues: false,
      endsNextDay: false,
      categoryId: t.categoryId,
      status: t.status,
      taskId: t.id,
      shortVersions: [],
    });
  }

  for (const list of out.values())
    list.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.title.localeCompare(b.title));
  return out;
}

export const buildDay = (src: AgendaSource, date: PlainDateStr) => buildRange(src, date, date).get(date)!;

const KIND_RANK = { event: 0, routine: 1, task: 2 };

/**
 * "ŞİMDİ" kartı: şu an süren öğe. Randevu/etkinlik rutin bloğun önüne geçer;
 * iç içe bloklarda (mesai içindeki kısa ara) daha yeni başlayan seçilir.
 * Sırada: henüz başlamamış, aktif öğeler.
 */
export function nowAndNext(items: AgendaItem[], nowMin: number, nextCount = 3) {
  const blocks = items.filter((i) => i.kind !== 'task' && i.timed && isActive(i.status));
  const current = blocks
    .filter((i) => i.startMin <= nowMin && nowMin < i.endMin)
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || b.startMin - a.startMin)[0];
  const next = blocks.filter((i) => i.startMin > nowMin).slice(0, nextCount);
  return { current, next, remainingMin: current ? current.endMin - nowMin : 0 };
}

export interface DaySummary {
  total: number; // tamamlanabilir öğe sayısı (iptal hariç)
  done: number;
  ratio: number | null; // öğe yoksa null
  categoryIds: string[]; // süreye göre en çoktan aza
  events: number;
  tasks: number;
}

/** Gün özeti. Önceki günden taşan parçalar sayılmaz (çift sayım olmasın). */
export function summarize(items: AgendaItem[]): DaySummary {
  let total = 0;
  let done = 0;
  const catMinutes = new Map<string, number>();
  let events = 0;
  let tasks = 0;
  for (const i of items) {
    if (i.continues) continue;
    if (i.kind === 'event') events++;
    if (i.kind === 'task') tasks++;
    if (i.status === 'cancelled') continue;
    total++;
    if (isDone(i.status)) done++;
    if (i.categoryId)
      catMinutes.set(i.categoryId, (catMinutes.get(i.categoryId) ?? 0) + Math.max(1, Math.min(i.endMin, 1440) - i.startMin));
  }
  return {
    total,
    done,
    ratio: total ? done / total : null,
    categoryIds: [...catMinutes.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k),
    events,
    tasks,
  };
}

/**
 * Haftalık tabloda üst üste binen blokları yan yana dizmek için şerit (lane)
 * ataması. Her öğeye lane ve aynı kümede kaç şerit olduğu döner.
 */
export function assignLanes<T extends { startMin: number; endMin: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: { item: T; lane: number; lanes: number }[] = [];
  let cluster: { item: T; lane: number; lanes: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const n = laneEnds.length;
    cluster.forEach((c) => (c.lanes = n));
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (item.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = item.endMin;
    cluster.push({ item, lane, lanes: 0 });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return out;
}

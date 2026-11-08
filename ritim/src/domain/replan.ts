// "Günüm değişti" yeniden planlama (tarif bölüm 9). Cihazdaki basit kurallar:
//  - Sabit randevular ve sabit saatli bloklar korunur (çapa).
//  - Korunan zamanlar (uyku, dinlenme, aile) asla sıkıştırılmaz/kaydırılmaz.
//  - Esnek bloklar boş aralıklara kaydırılır (sıra korunur).
//  - Sığmazsa sırayla: düşük öncelikliler atlanır → kısaltılabilenler kısa
//    sürüme düşer → taşınabilenler başka güne önerilir → kalanlar atlanır.
//  - "Yorgunum": baştan hafif plan (kısa sürümler, düşük öncelik atlanır).
// Kullanıcı her öğe için kararı değiştirebilir (kilit); geri kalanı yeniden planlanır.
import { buildDay, isActive, type AgendaItem, type AgendaSource } from './agenda';
import { suggestDays } from './conflicts';
import { clock, minutesOfDay } from './time';
import type { PlainDateStr, ShortVersion } from './types';

export type Reason = 'work' | 'tired' | 'urgent' | 'other';

export type Decision =
  | { action: 'keep'; start: number; duration: number } // yerinde
  | { action: 'move'; start: number; duration: number } // aynı gün başka saate
  | { action: 'shorten'; start: number; duration: number; version: ShortVersion }
  | { action: 'postpone'; date: PlainDateStr; startTime: string }
  | { action: 'skip' };

export type Lock = 'place' | 'shorten' | 'postpone' | 'skip';

export interface PlanEntry {
  item: AgendaItem;
  anchor: boolean; // sabit/korunan/randevu: değiştirilemez
  decision: Decision;
  locked?: Lock;
}

export interface ReplanInput {
  src: AgendaSource;
  date: PlainDateStr;
  nowMin: number;
  availableFrom?: number; // "şu saatten sonra müsaitim"
  reason: Reason;
  locks?: Record<string, Lock>;
}

const PRIO = { low: 0, medium: 1, high: 2 } as const;
const isAnchor = (i: AgendaItem) => i.kind === 'event' || !i.flex || i.flex.timing === 'fixed' || i.flex.protected;

interface Gap {
  start: number;
  end: number;
}

/** [from, end) içinden çapaları çıkar → boş aralıklar */
function gaps(from: number, end: number, anchors: Gap[]): Gap[] {
  const out: Gap[] = [];
  let cur = from;
  for (const a of [...anchors].sort((x, y) => x.start - y.start)) {
    if (a.end <= cur) continue;
    if (a.start > cur) out.push({ start: cur, end: Math.min(a.start, end) });
    cur = Math.max(cur, a.end);
    if (cur >= end) break;
  }
  if (cur < end) out.push({ start: cur, end });
  return out.filter((g) => g.end > g.start);
}

/** Sırayı koruyarak yerleştir; her öğe en erken (orijinal saatinden önce olmamak üzere) boşluğa. */
function place(items: { key: string; origStart: number; duration: number }[], free: Gap[]): Map<string, number> | null {
  const res = new Map<string, number>();
  const g = free.map((x) => ({ ...x }));
  let cursor = -Infinity;
  for (const it of items) {
    const want = Math.max(cursor, it.origStart);
    let placed = false;
    for (const gap of g) {
      const s = Math.max(gap.start, want);
      if (s + it.duration <= gap.end) {
        res.set(it.key, s);
        cursor = s + it.duration;
        gap.start = cursor;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Orijinal saatten daha erken bir boşluğa da razı ol
      for (const gap of g) {
        const s = Math.max(gap.start, cursor);
        if (s + it.duration <= gap.end) {
          res.set(it.key, s);
          cursor = s + it.duration;
          gap.start = cursor;
          placed = true;
          break;
        }
      }
    }
    if (!placed) return null;
  }
  return res;
}

export function replan(input: ReplanInput): PlanEntry[] {
  const { src, date, nowMin, reason } = input;
  const locks = input.locks ?? {};
  const from = Math.max(nowMin, input.availableFrom ?? nowMin);
  const day = buildDay(src, date).filter(
    (i) => i.kind !== 'task' && i.timed && !i.continues && isActive(i.status) && i.status === 'planned' && i.endMin > nowMin,
  );
  // Önceki geceden taşanlar ve tamamlananlar da çapa (yer kaplar)
  const occupied: Gap[] = buildDay(src, date)
    .filter((i) => i.kind !== 'task' && i.timed && isActive(i.status) && (i.continues || i.status !== 'planned'))
    .map((i) => ({ start: i.startMin, end: i.endMin }));

  const anchors = day.filter(isAnchor);
  const flex = day.filter((i) => !isAnchor(i)).sort((a, b) => a.startMin - b.startMin);
  const free = gaps(from, 24 * 60, [...occupied, ...anchors.map((a) => ({ start: a.startMin, end: a.endMin }))]);

  type St = { item: AgendaItem; mode: 'full' | 'short' | 'postpone' | 'skip'; ver?: ShortVersion; locked?: Lock };
  const shortestFirst = (i: AgendaItem) => i.shortVersions[0];
  const st: St[] = flex.map((item) => {
    const l = locks[item.key];
    if (l === 'skip') return { item, mode: 'skip', locked: l };
    if (l === 'postpone') return { item, mode: 'postpone', locked: l };
    if (l === 'shorten' && item.shortVersions.length) return { item, mode: 'short', ver: shortestFirst(item), locked: l };
    if (l === 'place') return { item, mode: 'full', locked: l };
    // Yorgunum: baştan hafif
    if (reason === 'tired') {
      if (item.flex!.priority === 'low') return { item, mode: 'skip' };
      if (item.flex!.shortenable && item.shortVersions.length) return { item, mode: 'short', ver: shortestFirst(item) };
    }
    return { item, mode: 'full' };
  });

  const dur = (s: St) => (s.mode === 'short' ? s.ver!.durationMin : s.item.endMin - s.item.startMin);
  const tryPlace = () =>
    place(
      st.filter((s) => s.mode === 'full' || s.mode === 'short').map((s) => ({ key: s.item.key, origStart: s.item.startMin, duration: dur(s) })),
      free,
    );

  // Azaltma adımları (öneri sırası); kilitli olanlara dokunulmaz
  const latestFirst = (a: St, b: St) => b.item.startMin - a.item.startMin;
  const steps: (() => boolean)[] = [
    () => {
      const c = st.filter((s) => !s.locked && s.mode === 'full' && s.item.flex!.priority === 'low').sort(latestFirst)[0];
      return !!c && ((c.mode = 'skip'), true);
    },
    () => {
      const c = st
        .filter((s) => !s.locked && s.mode === 'full' && s.item.flex!.shortenable && s.item.shortVersions.length)
        .sort((a, b) => PRIO[a.item.flex!.priority] - PRIO[b.item.flex!.priority] || latestFirst(a, b))[0];
      return !!c && ((c.mode = 'short'), (c.ver = c.item.shortVersions[0]), true);
    },
    () => {
      // Daha da kısa sürüm
      const c = st.find((s) => !s.locked && s.mode === 'short' && s.item.shortVersions.indexOf(s.ver!) < s.item.shortVersions.length - 1);
      return !!c && ((c.ver = c.item.shortVersions[c.item.shortVersions.indexOf(c.ver!) + 1]), true);
    },
    () => {
      const c = st.filter((s) => !s.locked && (s.mode === 'full' || s.mode === 'short') && s.item.flex!.movable).sort(latestFirst)[0];
      return !!c && ((c.mode = 'postpone'), true);
    },
    () => {
      const c = st
        .filter((s) => !s.locked && (s.mode === 'full' || s.mode === 'short'))
        .sort((a, b) => PRIO[a.item.flex!.priority] - PRIO[b.item.flex!.priority] || latestFirst(a, b))[0];
      return !!c && ((c.mode = 'skip'), true);
    },
  ];

  let placed = tryPlace();
  while (!placed) {
    const progressed = steps.some((step) => step());
    if (!progressed) {
      // Kilitli "yerleştir" öğeleri bile sığmıyor: kilidi olanlar hariç hepsini atla
      st.forEach((s) => s.locked !== 'place' && s.locked !== 'shorten' && (s.mode = 'skip'));
      placed = tryPlace() ?? new Map();
      break;
    }
    placed = tryPlace();
  }

  const busyByDate: Record<PlainDateStr, { start: number; end: number }[]> = {};
  const out: PlanEntry[] = anchors.map((item) => ({
    item,
    anchor: true,
    decision: { action: 'keep', start: item.startMin, duration: item.endMin - item.startMin },
  }));
  for (const s of st) {
    let decision: Decision;
    if (s.mode === 'skip') decision = { action: 'skip' };
    else if (s.mode === 'postpone') {
      const duration = s.item.endMin - s.item.startMin;
      // Aynı güne ertelenen diğer bloklarla da çakışmasın
      const [d] = suggestDays(src, date, duration, s.item.startMin, { ignore: (i) => i.key === s.item.key, max: 1, busyByDate });
      if (d) {
        const st0 = minutesOfDay(d.startTime);
        (busyByDate[d.date] ??= []).push({ start: st0, end: st0 + duration });
      }
      decision = d ? { action: 'postpone', date: d.date, startTime: d.startTime } : { action: 'skip' };
    } else {
      const start = placed!.get(s.item.key);
      if (start === undefined) decision = { action: 'skip' };
      else if (s.mode === 'short') decision = { action: 'shorten', start, duration: s.ver!.durationMin, version: s.ver! };
      else
        decision =
          start === s.item.startMin
            ? { action: 'keep', start, duration: dur(s) }
            : { action: 'move', start, duration: dur(s) };
    }
    out.push({ item: s.item, anchor: false, decision, locked: s.locked });
  }
  return out.sort((a, b) => a.item.startMin - b.item.startMin);
}

export const startClock = (d: Decision) => ('start' in d ? clock(d.start) : undefined);

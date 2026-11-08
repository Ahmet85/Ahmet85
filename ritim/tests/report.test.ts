import { describe, expect, it } from 'vitest';
import { weeklyReport, partOfDay } from '../src/domain/report';
import { addDays } from '../src/domain/time';
import type { OccurrenceRecord, Status } from '../src/domain/types';
import { routine } from './helpers';

const empty = { routines: [], records: [], events: [], tasks: [] };
const WEEK = '2026-03-02'; // Pazartesi
const rec = (routineId: string, d: string, p: Partial<OccurrenceRecord>): OccurrenceRecord => ({
  id: `${routineId}@${d}`, profileId: 'p1', routineId, originalDate: d, ...p,
});

describe('haftalık karne', () => {
  const a = routine({ id: 'a', title: 'Hareket', startTime: '07:00', durationMin: 60, categoryId: 'body' });
  const statuses: (Partial<OccurrenceRecord> | null)[] = [
    { status: 'done' as Status, actualMin: 60 },
    { status: 'done_short' as Status, actualMin: 15, shortVersionId: 'x' },
    { status: 'skipped' as Status },
    { status: 'skipped' as Status, consciousChange: true },
    null, // işaretlenmedi
    { status: 'done' as Status, actualMin: 50 },
    null, // bugün, henüz gelmedi
  ];
  const records = statuses.flatMap((p, i) => (p ? [rec('a', addDays(WEEK, i), p)] : []));
  const today = addDays(WEEK, 6);

  it('durumlar ayrı sayılır; bilinçli değişiklik ve gelecek orana girmez', () => {
    const r = weeklyReport({ ...empty, routines: [a], records }, WEEK, today, 6 * 60);
    expect(r.counts).toMatchObject({ done: 2, done_short: 1, skipped: 1, conscious: 1, unmarked: 1, upcoming: 1 });
    expect(r.done).toBe(3);
    expect(r.denominator).toBe(5); // 3 tamam + 1 atlandı + 1 işaretlenmedi
    expect(r.ratio).toBeCloseTo(0.6);
  });

  it('planlanan ve gerçekleşen süre, kategori bazında', () => {
    const r = weeklyReport({ ...empty, routines: [a], records }, WEEK, today, 6 * 60);
    expect(r.plannedMin).toBe(5 * 60);
    expect(r.actualMin).toBe(60 + 15 + 50);
    expect(r.categories[0]).toMatchObject({ categoryId: 'body', done: 3, total: 5 });
    expect(r.bestDay).toMatchObject({ date: WEEK, done: 1 });
  });

  it('2 haftadan az veri varsa kesin yorum yok', () => {
    const r = weeklyReport({ ...empty, routines: [a], records }, WEEK, today, 6 * 60);
    expect(r.enoughData).toBe(false);
    expect(r.suggestions[0].kind).toBe('notEnoughData');
    expect(r.suggestions.some((s) => s.kind === 'oftenPostponed')).toBe(false);
  });

  it('sık ertelenen blok için dayanağı gösterilen öneri ve deneme hamlesi', () => {
    // Perşembe akşam gitarı son 3 haftada 2 kez ertelendi; 3 haftalık veri var
    const guitar = routine({
      id: 'g', title: 'Gitar', startTime: '20:00', durationMin: 60,
      recurrence: { freq: 'weekly', byWeekday: [4], startDate: '2026-02-01' },
    });
    const thursdays = ['2026-02-19', '2026-02-26', '2026-03-05'];
    const recs = [
      rec('g', thursdays[0], { status: 'skipped' }),
      rec('g', thursdays[1], { status: 'done' }),
      rec('g', thursdays[2], { status: 'postponed' }),
      rec('g', '2026-02-12', { status: 'done' }),
    ];
    const r = weeklyReport({ ...empty, routines: [guitar], records: recs }, WEEK, '2026-03-08', 21 * 60);
    expect(r.enoughData).toBe(true);
    expect(r.oftenPostponed[0]).toMatchObject({ title: 'Gitar', count: 2, weekday: 4 });
    const s = r.suggestions.find((x) => x.kind === 'oftenPostponed')!;
    expect(s.params).toMatchObject({ title: 'Gitar', weekday: 4, part: 'evening', count: 2 });
    expect(s.tryMove).toBeDefined();
    expect(s.tryMove!.originalDate).toBe('2026-03-12'); // bir sonraki Perşembe
  });

  it('bilinçli taşınan blok "sık ertelenen"e girmez', () => {
    const g = routine({ id: 'g', startTime: '20:00', durationMin: 60 });
    const recs = ['2026-03-02', '2026-03-03', '2026-03-04'].map((d) => rec('g', d, { status: 'skipped', consciousChange: true }));
    const r = weeklyReport({ ...empty, routines: [g], records: recs }, WEEK, '2026-03-08', 0);
    expect(r.oftenPostponed).toHaveLength(0);
    expect(r.counts.conscious).toBe(3);
  });

  it('günün bölümleri', () => {
    expect(['06:00', '13:00', '19:00', '23:00'].map(partOfDay)).toEqual(['morning', 'afternoon', 'evening', 'night']);
  });
});

describe('karne süreleri ve sık ertelenenler', () => {
  it('korunan zaman (uyku) süreye girmez ama tamamlama oranına girer', () => {
    const sleep = routine({ id: 's', startTime: '23:00', durationMin: 480, flex: { timing: 'fixed', priority: 'high', shortenable: false, movable: false, protected: true } });
    const recs = [rec('s', WEEK, { status: 'done' })];
    const r = weeklyReport({ ...empty, routines: [sleep], records: recs }, WEEK, WEEK, 23 * 60 + 59);
    expect(r.plannedMin).toBe(0);
    expect(r.actualMin).toBe(0);
    expect(r.done).toBe(1);
  });

  it('her gün tekrarlanan bloğun nadir ertelemesi "sık" sayılmaz', () => {
    const d = routine({ id: 'd', startTime: '19:00', durationMin: 60, recurrence: { startDate: '2026-02-01' } });
    const recs = ['2026-02-20', '2026-03-01'].map((x) => rec('d', x, { status: 'skipped' }));
    const r = weeklyReport({ ...empty, routines: [d], records: recs }, WEEK, '2026-03-08', 0);
    expect(r.oftenPostponed).toHaveLength(0);
  });
});

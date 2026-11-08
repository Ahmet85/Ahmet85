import { describe, expect, it } from 'vitest';
import { buildDay, buildRange, nowAndNext, summarize } from '../src/domain/agenda';
import type { EventItem } from '../src/domain/types';
import { routine } from './helpers';

const empty = { routines: [], records: [], events: [], tasks: [] };
const ev = (p: Partial<EventItem>): EventItem => ({
  id: 'e1', profileId: 'p1', title: 'Doktor', startDate: '2026-03-03', startTime: '10:00',
  endDate: '2026-03-03', endTime: '10:30', status: 'planned', ...p,
});

describe('gün öğeleri', () => {
  const work = routine({ id: 'work', title: 'Mesai', startTime: '09:00', durationMin: 210 });
  const brk = routine({ id: 'brk', title: 'Kısa ara', startTime: '10:00', durationMin: 10 });
  const sleep = routine({ id: 'sleep', title: 'Uyku', startTime: '23:00', durationMin: 450 });
  const src = { ...empty, routines: [work, brk, sleep] };

  it('gece yarısını aşan blok iki günde de görünür', () => {
    const day = buildDay(src, '2026-03-03');
    const parts = day.filter((i) => i.routineId === 'sleep');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ continues: true, startMin: -60, endMin: 390 });
    expect(parts[1]).toMatchObject({ continues: false, startMin: 1380, endMin: 1830, endsNextDay: true });
  });

  it('şimdi: iç içe bloklarda daha yeni başlayan seçilir', () => {
    const day = buildDay(src, '2026-03-03');
    expect(nowAndNext(day, 10 * 60 + 5).current?.title).toBe('Kısa ara');
    expect(nowAndNext(day, 11 * 60).current?.title).toBe('Mesai');
  });

  it('şimdi: gece yarısından sonra uyku "dünden devam" olarak görünür, kalan süre doğru', () => {
    const { current, remainingMin } = nowAndNext(buildDay(src, '2026-03-03'), 5 * 60);
    expect(current?.title).toBe('Uyku');
    expect(current?.continues).toBe(true);
    expect(remainingMin).toBe(90);
  });

  it('şimdi: randevu rutin bloğun önüne geçer', () => {
    const day = buildDay({ ...src, events: [ev({ startTime: '10:00', endTime: '11:00' })] }, '2026-03-03');
    expect(nowAndNext(day, 10 * 60 + 5).current?.kind).toBe('event');
  });

  it('atlanan blok şimdi kartında ve sırada listesinde çıkmaz', () => {
    const recs = [{ id: 'work@2026-03-03', profileId: 'p1', routineId: 'work', originalDate: '2026-03-03', status: 'skipped' as const }];
    const day = buildDay({ ...src, records: recs }, '2026-03-03');
    expect(nowAndNext(day, 11 * 60).current).toBeUndefined();
    expect(nowAndNext(day, 8 * 60).next.map((i) => i.title)).toEqual(['Kısa ara', 'Uyku']);
  });

  it('çok günlü etkinlik her gününde görünür', () => {
    const e = ev({ startDate: '2026-03-03', startTime: '18:00', endDate: '2026-03-05', endTime: '12:00' });
    const range = buildRange({ ...empty, events: [e] }, '2026-03-02', '2026-03-06');
    expect([...range.entries()].filter(([, v]) => v.length).map(([k]) => k)).toEqual(['2026-03-03', '2026-03-04', '2026-03-05']);
    expect(range.get('2026-03-04')![0]).toMatchObject({ continues: true, startMin: -360, endMin: 2160 });
  });

  it('saatsiz görev "şimdi" kartına girmez', () => {
    const day = buildDay({ ...empty, tasks: [{ id: 't', profileId: 'p1', title: 'Fatura', date: '2026-03-03', status: 'planned' }] }, '2026-03-03');
    expect(day).toHaveLength(1);
    expect(nowAndNext(day, 0).current).toBeUndefined();
  });
});

describe('gün özeti', () => {
  it('tamamlama oranı; kısa sürüm tamamlandı sayılır, iptal sayılmaz, taşan parça çift sayılmaz', () => {
    const a = routine({ id: 'a', startTime: '08:00', durationMin: 60, categoryId: 'c1' });
    const b = routine({ id: 'b', startTime: '09:00', durationMin: 120, categoryId: 'c2' });
    const c = routine({ id: 'c', startTime: '12:00', durationMin: 60 });
    const night = routine({ id: 'n', startTime: '23:00', durationMin: 480 });
    const rec = (routineId: string, status: 'done' | 'done_short' | 'cancelled') => ({
      id: `${routineId}@2026-03-03`, profileId: 'p1', routineId, originalDate: '2026-03-03', status,
    });
    const s = summarize(
      buildDay({ ...empty, routines: [a, b, c, night], records: [rec('a', 'done'), rec('b', 'done_short'), rec('c', 'cancelled')] }, '2026-03-03'),
    );
    expect(s).toMatchObject({ total: 3, done: 2 });
    expect(s.categoryIds).toEqual(['c2', 'c1']);
  });

  it('boş gün', () => {
    expect(summarize([]).ratio).toBeNull();
  });
});

import { assignLanes } from '../src/domain/agenda';
describe('haftalık tabloda çakışan bloklar', () => {
  it('iç içe blok ikinci şeride, ayrı bloklar tek şeride', () => {
    const r = assignLanes([
      { id: 'mesai', startMin: 540, endMin: 750 },
      { id: 'ara', startMin: 600, endMin: 610 },
      { id: 'yemek', startMin: 750, endMin: 810 },
    ]);
    const by = Object.fromEntries(r.map((x) => [x.item.id, x]));
    expect(by.mesai).toMatchObject({ lane: 0, lanes: 2 });
    expect(by.ara).toMatchObject({ lane: 1, lanes: 2 });
    expect(by.yemek).toMatchObject({ lane: 0, lanes: 1 });
  });
});

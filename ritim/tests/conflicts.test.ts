import { describe, expect, it } from 'vitest';
import { findConflicts, freeStarts, suggestDays } from '../src/domain/conflicts';
import type { EventItem } from '../src/domain/types';
import { routine } from './helpers';

const empty = { routines: [], records: [], events: [], tasks: [] };
const D = '2026-03-03'; // Salı

describe('çakışma bulma', () => {
  const piano = routine({ id: 'piano', title: 'Piyano', startTime: '20:00', durationMin: 60 });
  const sleep = routine({ id: 'sleep', title: 'Uyku', startTime: '23:00', durationMin: 450 });
  const src = { ...empty, routines: [piano, sleep] };

  it('aynı saatteki blok bulunur', () => {
    const c = findConflicts(src, D, { start: 20 * 60 + 30, end: 21 * 60 + 30 });
    expect(c.map((x) => x.item.title)).toEqual(['Piyano']);
  });

  it('uç uca gelen saatler çakışma sayılmaz', () => {
    expect(findConflicts(src, D, { start: 21 * 60, end: 22 * 60 })).toHaveLength(0);
    expect(findConflicts(src, D, { start: 19 * 60, end: 20 * 60 })).toHaveLength(0);
  });

  it('gece yarısını aşan randevu ertesi sabahki bloğu da yakalar', () => {
    const early = routine({ id: 'early', title: 'Sabah koşusu', startTime: '05:00', durationMin: 30 });
    const c = findConflicts({ ...src, routines: [early] }, D, { start: 22 * 60, end: 24 * 60 + 5 * 60 + 15 });
    expect(c.map((x) => x.item.title)).toEqual(['Sabah koşusu']);
  });

  it('önceki geceden taşan uyku bloğu sabah randevusuyla çakışır', () => {
    const c = findConflicts(src, D, { start: 6 * 60, end: 7 * 60 });
    expect(c.map((x) => x.item.title)).toEqual(['Uyku']);
    expect(c[0].start).toBe(-60);
  });

  it('atlanan veya iptal edilen blok çakışma sayılmaz', () => {
    const recs = [{ id: `piano@${D}`, profileId: 'p1', routineId: 'piano', originalDate: D, status: 'skipped' as const }];
    expect(findConflicts({ ...src, records: recs }, D, { start: 20 * 60, end: 21 * 60 })).toHaveLength(0);
  });

  it('düzenlenen randevu kendisiyle çakışmaz', () => {
    const e: EventItem = { id: 'e', profileId: 'p1', title: 'Doktor', startDate: D, startTime: '10:00', endDate: D, endTime: '11:00', status: 'planned' };
    const s = { ...empty, events: [e] };
    expect(findConflicts(s, D, { start: 600, end: 630 })).toHaveLength(1);
    expect(findConflicts(s, D, { start: 600, end: 630 }, (i) => i.eventId === 'e')).toHaveLength(0);
  });

  it('tüm gün etkinlik ve saatsiz görev çakışma yaratmaz', () => {
    const e: EventItem = { id: 'e', profileId: 'p1', title: 'Tatil', startDate: D, endDate: D, status: 'planned' };
    const s = { ...empty, events: [e], tasks: [{ id: 't', profileId: 'p1', title: 'Fatura', date: D, status: 'planned' as const }] };
    expect(findConflicts(s, D, { start: 600, end: 700 })).toHaveLength(0);
  });
});

describe('boş saat önerileri', () => {
  const work = routine({ id: 'work', startTime: '09:00', durationMin: 480 }); // 09–17
  const dinner = routine({ id: 'dinner', startTime: '19:00', durationMin: 60 });
  const src = { ...empty, routines: [work, dinner] };

  it('yalnızca tamamen boş saatler, tercih edilene en yakından', () => {
    const starts = freeStarts(src, D, 60, 19 * 60, { max: 10 });
    for (const s of starts) {
      expect(s + 60 <= 9 * 60 || s >= 17 * 60).toBe(true);
      expect(s + 60 <= 19 * 60 || s >= 20 * 60).toBe(true);
    }
    expect(starts[0]).toBe(18 * 60); // 18:00–19:00
    expect(starts[1]).toBe(20 * 60);
  });

  it('yeni randevunun saati de dolu sayılır (yeni çakışma yaratılmaz)', () => {
    const starts = freeStarts(src, D, 60, 18 * 60, { extraBusy: [{ start: 17 * 60 + 30, end: 18 * 60 + 30 }], max: 10 });
    expect(starts).not.toContain(18 * 60);
    expect(starts).not.toContain(17 * 60);
  });

  it('gece saatleri önerilmez', () => {
    const starts = freeStarts(empty, D, 60, 2 * 60, { max: 100 });
    expect(Math.min(...starts)).toBe(6 * 60);
    expect(Math.max(...starts)).toBe(22 * 60);
  });

  it('uygun yer yoksa boş liste', () => {
    const full = routine({ id: 'full', startTime: '05:00', durationMin: 19 * 60 });
    expect(freeStarts({ ...empty, routines: [full] }, D, 30, 600)).toEqual([]);
  });

  it('erteleme: önce aynı saatin boş olduğu günler', () => {
    const piano = routine({ id: 'piano', startTime: '20:00', durationMin: 60 });
    const busyWed = routine({ id: 'b', startTime: '20:00', durationMin: 60, recurrence: { freq: 'weekly', byWeekday: [3] } });
    const s = suggestDays({ ...empty, routines: [busyWed] }, D, 60, 20 * 60, { ignore: (i) => i.routineId === piano.id });
    expect(s[0]).toMatchObject({ date: '2026-03-04', sameTime: false }); // Çarşamba 20:00 dolu → başka saat
    expect(s[1]).toMatchObject({ date: '2026-03-05', startTime: '20:00', sameTime: true });
  });
});

import { describe, expect, it } from 'vitest';
import { expandRange, occurrencesForDay, occursOn } from '../src/domain/recurrence';
import type { OccurrenceRecord } from '../src/domain/types';
import { routine } from './helpers';

// 2026-03-02 Pazartesi
describe('tekrar kuralları', () => {
  it('her gün', () => {
    const r = routine();
    expect(expandRange([r], [], '2026-03-02', '2026-03-08')).toHaveLength(7);
  });

  it('başlangıçtan önce ve bitişten sonra oluşum yok', () => {
    const r = routine({ recurrence: { startDate: '2026-03-04', endDate: '2026-03-06' } });
    expect(expandRange([r], [], '2026-03-01', '2026-03-10').map((o) => o.date)).toEqual([
      '2026-03-04', '2026-03-05', '2026-03-06',
    ]);
  });

  it('hafta içi', () => {
    const r = routine({ recurrence: { freq: 'weekly', byWeekday: [1, 2, 3, 4, 5] } });
    const dates = expandRange([r], [], '2026-03-02', '2026-03-15').map((o) => o.date);
    expect(dates).toHaveLength(10);
    expect(dates).not.toContain('2026-03-07'); // Cumartesi
    expect(dates).not.toContain('2026-03-08'); // Pazar
  });

  it('belirli günler (Sal, Per)', () => {
    const r = routine({ recurrence: { freq: 'weekly', byWeekday: [2, 4] } });
    expect(expandRange([r], [], '2026-03-02', '2026-03-08').map((o) => o.date)).toEqual([
      '2026-03-03', '2026-03-05',
    ]);
  });

  it('iki haftada bir', () => {
    const r = routine({ recurrence: { freq: 'weekly', interval: 2, byWeekday: [6] } });
    expect(expandRange([r], [], '2026-03-01', '2026-04-05').map((o) => o.date)).toEqual([
      '2026-03-07', '2026-03-21', '2026-04-04',
    ]);
  });

  it('iki günde bir', () => {
    const r = routine({ recurrence: { interval: 2 } });
    expect(occursOn(r.recurrence, '2026-03-02')).toBe(true);
    expect(occursOn(r.recurrence, '2026-03-03')).toBe(false);
    expect(occursOn(r.recurrence, '2026-03-04')).toBe(true);
  });
});

describe('tek tarihlik istisnalar', () => {
  const r = routine();
  const rec = (p: Partial<OccurrenceRecord>): OccurrenceRecord => ({
    id: `r1@${p.originalDate}`, profileId: 'p1', routineId: 'r1', originalDate: '2026-03-03', ...p,
  });

  it('atlanan oluşum durumuyla görünür, diğer günler etkilenmez', () => {
    const list = expandRange([r], [rec({ originalDate: '2026-03-03', status: 'skipped' })], '2026-03-02', '2026-03-04');
    expect(list.map((o) => o.status)).toEqual(['planned', 'skipped', 'planned']);
  });

  it('başka güne taşınan oluşum yeni gününde görünür, eski gününde görünmez', () => {
    const moved = rec({ originalDate: '2026-03-03', date: '2026-03-07', startTime: '10:00' });
    expect(expandRange([r], [moved], '2026-03-03', '2026-03-03')).toHaveLength(0);
    const sat = expandRange([r], [moved], '2026-03-07', '2026-03-07');
    expect(sat).toHaveLength(2); // kendi cumartesi oluşumu + taşınan
    const m = sat.find((o) => o.moved)!;
    expect(m.originalDate).toBe('2026-03-03');
    expect(m.startTime).toBe('10:00');
  });

  it('istisna şablonu değiştirmez', () => {
    const before = JSON.stringify(r);
    expandRange([r], [rec({ originalDate: '2026-03-03', durationMin: 15 })], '2026-03-02', '2026-03-04');
    expect(JSON.stringify(r)).toBe(before);
    const list = expandRange([r], [rec({ originalDate: '2026-03-03', durationMin: 15 })], '2026-03-02', '2026-03-04');
    expect(list.map((o) => o.durationMin)).toEqual([60, 15, 60]);
  });

  it('kuralın üretmediği bir tarihe ait kayıt hayalet oluşum yaratmaz', () => {
    const wd = routine({ recurrence: { freq: 'weekly', byWeekday: [1] } });
    const ghost = rec({ originalDate: '2026-03-03', date: '2026-03-04' });
    expect(expandRange([wd], [ghost], '2026-03-01', '2026-03-08').map((o) => o.date)).toEqual(['2026-03-02']);
  });
});

describe('gece yarısını aşan bloklar', () => {
  const shift = routine({ startTime: '22:00', durationMin: 480 });

  it('bitiş ertesi gün 06:00', () => {
    const [o] = expandRange([shift], [], '2026-03-02', '2026-03-02');
    expect(o.endDate).toBe('2026-03-03');
    expect(o.endTime).toBe('06:00');
  });

  it('ertesi günün ekranında "önceki günden devam" olarak görünür', () => {
    const r = routine({ startTime: '22:00', durationMin: 480, recurrence: { startDate: '2026-03-02', endDate: '2026-03-02' } });
    const day = occurrencesForDay([r], [], '2026-03-03');
    expect(day).toHaveLength(1);
    expect(day[0].continuesFromPrevDay).toBe(true);
  });

  it('tam gece yarısında biten blok ertesi güne taşmaz', () => {
    const r = routine({ startTime: '23:00', durationMin: 60, recurrence: { startDate: '2026-03-02', endDate: '2026-03-02' } });
    expect(occurrencesForDay([r], [], '2026-03-03')).toHaveLength(0);
  });
});
